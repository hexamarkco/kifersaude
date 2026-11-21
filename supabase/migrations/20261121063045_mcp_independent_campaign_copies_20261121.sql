-- MCP campaign stage/copy editor compatibility (2026-11-21)
-- Only variant_sequences_v2 uses full replacement, guarded against started campaigns.
-- Legacy individual step patches remain supported.
CREATE OR REPLACE FUNCTION public._mcp_comm_whatsapp_campaign_replace_steps(p_campaign_id uuid, p_steps jsonb, p_fallback_message text)
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public', 'storage'
AS $function$
DECLARE
  v_step jsonb;
  v_ordinal integer := 0;
  v_step_index integer;
  v_stage_index integer;
  v_message text;
  v_delay integer;
  v_unit text;
  v_variant_label text;
  v_step_kind text;
  v_status_to_set text;
  v_media_path text;
  v_media_url text;
  v_media_type text;
  v_media_filename text;
  v_media_mime text;
  v_media_size bigint;
  v_first_message text := '';
  v_existing public.comm_whatsapp_campaign_steps%ROWTYPE;
  v_updated integer;
  v_steps jsonb := p_steps;
BEGIN
  IF v_steps IS NULL THEN
    v_steps := jsonb_build_array(jsonb_build_object('message', COALESCE(p_fallback_message, '')));
  ELSIF jsonb_typeof(v_steps) <> 'array' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'MCP_CAMPAIGN_STEPS_INVALID';
  ELSIF jsonb_array_length(v_steps) = 0 THEN
    v_steps := jsonb_build_array(jsonb_build_object('message', COALESCE(p_fallback_message, '')));
  END IF;
  IF jsonb_array_length(v_steps) > 240 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'MCP_CAMPAIGN_TOO_MANY_STEPS';
  END IF;

  -- Somente sequências novas substituem integralmente as etapas físicas.
  -- O formato legado mantém a semântica anterior de edição parcial.
  IF EXISTS (
    SELECT 1 FROM public.comm_whatsapp_campaigns AS c
    WHERE c.id = p_campaign_id AND c.audience_config->>'variant_sequences_v2' = 'true'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM public.comm_whatsapp_campaigns AS c
      WHERE c.id = p_campaign_id AND c.status NOT IN ('draft', 'scheduled', 'paused')
    ) OR EXISTS (
      SELECT 1 FROM public.comm_whatsapp_campaign_targets AS t
      WHERE t.campaign_id = p_campaign_id
        AND t.status IN ('sending','sent','responded','stopped','failed','invalid')
    ) THEN
      RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='MCP_CAMPAIGN_HAS_PROCESSED_CONTACTS';
    END IF;
    IF EXISTS (
      SELECT 1 FROM jsonb_array_elements(v_steps) AS item
      WHERE item->>'step_index' IS NULL OR item->>'variant_label' IS NULL
    ) THEN
      RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='MCP_CAMPAIGN_SEQUENCE_POSITION_REQUIRED';
    END IF;
    -- Configuração transitória de uma campanha não iniciada; a transação
    -- restaura as linhas anteriores automaticamente se alguma validação falhar.
    DELETE FROM public.comm_whatsapp_campaign_steps WHERE campaign_id = p_campaign_id;
  END IF;

  FOR v_step IN SELECT value FROM jsonb_array_elements(v_steps)
  LOOP
    v_ordinal := v_ordinal + 1;
    IF jsonb_typeof(v_step) <> 'object' THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'MCP_CAMPAIGN_STEP_INVALID';
    END IF;
    IF v_step ? 'media_url' OR v_step ? 'media_type' OR v_step ? 'media_filename' THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'MCP_CAMPAIGN_MEDIA_URL_NOT_ALLOWED';
    END IF;

    IF NULLIF(v_step->>'step_index', '') IS NOT NULL THEN
      v_step_index := (v_step->>'step_index')::integer;
    ELSE
      SELECT indices.step_index INTO v_step_index
      FROM (
        SELECT DISTINCT step.step_index
        FROM public.comm_whatsapp_campaign_steps AS step
        WHERE step.campaign_id = p_campaign_id
        ORDER BY step.step_index
      ) AS indices
      OFFSET v_ordinal - 1 LIMIT 1;
      v_step_index := COALESCE(v_step_index, v_ordinal - 1);
    END IF;
    v_variant_label := NULLIF(v_step->>'variant_label', '');
    IF v_step_index < 0 OR v_step_index > 29
       OR (v_variant_label IS NOT NULL AND NOT (v_variant_label = 'ANY' OR v_variant_label ~ '^[A-Z]$')) THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'MCP_CAMPAIGN_STEP_INVALID';
    END IF;
    IF v_variant_label IS NULL THEN
      SELECT CASE
        WHEN EXISTS (SELECT 1 FROM public.comm_whatsapp_campaign_steps WHERE campaign_id = p_campaign_id AND step_index = v_step_index AND variant_label = 'ANY') THEN 'ANY'
        WHEN EXISTS (SELECT 1 FROM public.comm_whatsapp_campaign_steps WHERE campaign_id = p_campaign_id AND step_index = v_step_index AND variant_label = 'A') THEN 'A'
        WHEN EXISTS (SELECT 1 FROM public.comm_whatsapp_campaign_steps WHERE campaign_id = p_campaign_id AND step_index = v_step_index AND variant_label = 'B') THEN 'B'
        ELSE 'ANY'
      END INTO v_variant_label;
    END IF;
    v_message := btrim(COALESCE(v_step->>'message', v_step->>'message_text', ''));
    IF v_message = '' OR char_length(v_message) > 4096 THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'MCP_CAMPAIGN_MESSAGE_REQUIRED';
    END IF;
    v_first_message := COALESCE(NULLIF(v_first_message, ''), v_message);

    v_delay := NULLIF(v_step->>'delay_amount', '')::integer;
    v_unit := NULLIF(v_step->>'delay_unit', '');
    IF (v_delay IS NOT NULL AND (v_delay < 0 OR v_delay > 31622400))
       OR (v_unit IS NOT NULL AND v_unit NOT IN ('seconds', 'minutes', 'hours', 'days')) THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'MCP_CAMPAIGN_STEP_DELAY_INVALID';
    END IF;
    v_stage_index := NULLIF(v_step->>'stage_index', '')::integer;
    IF v_stage_index IS NOT NULL AND v_stage_index < 0 THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'MCP_CAMPAIGN_STEP_INVALID';
    END IF;
    v_step_kind := NULLIF(v_step->>'step_kind', '');
    IF v_step_kind IS NOT NULL AND v_step_kind NOT IN ('message', 'status_change') THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'MCP_CAMPAIGN_STEP_INVALID';
    END IF;
    v_status_to_set := NULLIF(btrim(v_step->>'status_to_set'), '');

    v_media_url := NULL;
    v_media_type := NULL;
    v_media_filename := NULL;
    IF v_step ? 'media_storage_path' AND jsonb_typeof(v_step->'media_storage_path') <> 'null' THEN
      v_media_path := v_step->>'media_storage_path';
      IF v_media_path IS NULL OR length(v_media_path) > 512 OR v_media_path = ''
         OR left(v_media_path, 1) = '/' OR position(chr(92) in v_media_path) > 0
         OR v_media_path LIKE '%//%'
         OR v_media_path ~ '(^|/)\.\.?(/|$)'
         OR v_media_path ~* '%(2e|2f|5c)' THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'MCP_CAMPAIGN_MEDIA_PATH_INVALID';
      END IF;
      SELECT object.metadata->>'mimetype', NULLIF(object.metadata->>'size', '')::bigint
      INTO v_media_mime, v_media_size
      FROM storage.objects AS object
      WHERE object.bucket_id = 'whatsapp-campaign-media' AND object.name = v_media_path;
      IF NOT FOUND OR v_media_mime NOT IN ('image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'application/pdf')
         OR COALESCE(v_media_size, 0) < 1 OR v_media_size > 20971520 THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'MCP_CAMPAIGN_MEDIA_OBJECT_INVALID';
      END IF;
      v_media_url := 'storage://whatsapp-campaign-media/' || v_media_path;
      v_media_type := CASE WHEN v_media_mime LIKE 'image/%' THEN 'image'
        WHEN v_media_mime = 'video/mp4' THEN 'video' ELSE 'document' END;
      v_media_filename := right(v_media_path, 120);
    ELSIF v_step ? 'media_storage_path' THEN
      v_media_path := NULL;
    END IF;

    v_updated := 0;
    FOR v_existing IN
      SELECT * FROM public.comm_whatsapp_campaign_steps AS step
      WHERE step.campaign_id = p_campaign_id
        AND step.step_index = v_step_index
        AND step.variant_label = v_variant_label
      ORDER BY CASE step.variant_label WHEN 'ANY' THEN 0 WHEN 'A' THEN 1 ELSE 2 END
    LOOP
      UPDATE public.comm_whatsapp_campaign_steps AS step
      SET stage_index = COALESCE(v_stage_index, v_existing.stage_index),
          step_kind = COALESCE(v_step_kind, v_existing.step_kind),
          status_to_set = CASE WHEN v_step ? 'status_to_set' THEN v_status_to_set ELSE v_existing.status_to_set END,
          message_text = v_message,
          delay_amount = COALESCE(v_delay, v_existing.delay_amount),
          delay_unit = COALESCE(v_unit, v_existing.delay_unit),
          media_url = CASE WHEN v_step ? 'media_storage_path' THEN v_media_url ELSE v_existing.media_url END,
          media_type = CASE WHEN v_step ? 'media_storage_path' THEN v_media_type ELSE v_existing.media_type END,
          media_filename = CASE WHEN v_step ? 'media_storage_path' THEN v_media_filename ELSE v_existing.media_filename END,
          variant_label = COALESCE(v_variant_label, v_existing.variant_label),
          updated_at = now()
      WHERE step.id = v_existing.id;
      v_updated := v_updated + 1;
    END LOOP;

    IF v_updated = 0 THEN
      v_variant_label := COALESCE(v_variant_label, 'ANY');
      IF COALESCE(v_step_kind, 'message') = 'status_change' AND v_status_to_set IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'MCP_CAMPAIGN_STATUS_REQUIRED';
      END IF;
      INSERT INTO public.comm_whatsapp_campaign_steps (
        campaign_id, step_index, stage_index, step_kind, status_to_set,
        message_text, delay_amount, delay_unit, media_url, media_type,
        media_filename, variant_label
      ) VALUES (
        p_campaign_id, v_step_index, COALESCE(v_stage_index, 0), COALESCE(v_step_kind, 'message'),
        v_status_to_set, v_message, COALESCE(v_delay, 0), COALESCE(v_unit, 'minutes'),
        v_media_url, v_media_type, v_media_filename, v_variant_label
      );
    END IF;
  END LOOP;

  IF EXISTS (
    SELECT 1 FROM public.comm_whatsapp_campaigns AS c
    WHERE c.id = p_campaign_id AND c.audience_config->>'variant_sequences_v2' = 'true'
  ) THEN
    UPDATE public.comm_whatsapp_campaigns
    SET ab_test_enabled = true
    WHERE id = p_campaign_id;
  END IF;
  RETURN v_first_message;
END;
$function$

