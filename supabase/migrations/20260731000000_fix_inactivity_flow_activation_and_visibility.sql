/*
  Fix inactivity follow-up flows: activation semantics and visibility filtering

  - Replaces l.created_at >= triggerActivatedAt with GREATEST(inactivity_ref, activation)
    so that leads already in the target status at activation become eligible after
    the configured inactivity window from the activation moment.
  - Filters hidden/technical messages from the chat_activity CTE so that non-substantive
    events (reactions, story views, interactive payloads, etc.) don't reset the inactivity window.
  - Updates cancel_auto_contact_jobs_on_inbound_message to only cancel on visible inbound
    messages (not internal/technical events).
*/

-- 1. Fix the inactivity detector: activation-aware window + visible-only activity
CREATE OR REPLACE FUNCTION public.check_auto_contact_inactivity_triggers()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_supabase_url text;
  v_service_role_key text;
  v_function_url text;
  v_flow jsonb;
  v_lead record;
  v_duration_hours integer;
  v_activated_at timestamptz;
BEGIN
  SELECT NULLIF(trim(both '"' FROM config_value::text), '')
  INTO v_supabase_url
  FROM public.system_configurations
  WHERE config_key = 'supabase_url'
  LIMIT 1;

  SELECT NULLIF(trim(both '"' FROM config_value::text), '')
  INTO v_service_role_key
  FROM public.system_configurations
  WHERE config_key = 'supabase_service_role_key'
  LIMIT 1;

  IF v_supabase_url IS NULL OR v_service_role_key IS NULL THEN
    RAISE NOTICE 'Inactivity automation check skipped: missing Supabase configuration.';
    RETURN;
  END IF;

  v_function_url := rtrim(v_supabase_url, '/') || '/functions/v1/leads-api?action=check-inactivity-duration';

  FOR v_flow IN
    SELECT flow.value
    FROM public.integration_settings settings
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(settings.settings->'flows', '[]'::jsonb)) AS flow(value)
    WHERE settings.slug = 'whatsapp_auto_contact'
      AND settings.settings->>'enabled' = 'true'
      AND settings.settings->>'autoSend' = 'true'
      AND flow.value->>'triggerType' = 'inactivity_duration'
  LOOP
    BEGIN
      v_activated_at := NULLIF(v_flow->>'triggerActivatedAt', '')::timestamptz;
    EXCEPTION WHEN invalid_datetime_format THEN
      v_activated_at := NULL;
    END;

    -- Fail closed until an operator explicitly establishes a non-retroactive start.
    IF v_activated_at IS NULL THEN
      CONTINUE;
    END IF;

    v_duration_hours := GREATEST(24, COALESCE(NULLIF(v_flow->>'triggerDurationHours', '')::integer, 24));

    FOR v_lead IN
      WITH chat_activity AS (
        SELECT c.lead_id, MAX(m.message_at) AS last_activity_at
        FROM public.comm_whatsapp_chats c
        INNER JOIN public.comm_whatsapp_messages m ON m.chat_id = c.id
        WHERE c.lead_id IS NOT NULL
          AND public.comm_whatsapp_message_preview_text(m.media_caption, m.text_content, m.message_type) IS NOT NULL
        GROUP BY c.lead_id
      ), status_entries AS (
        SELECT lead_id, MAX(created_at) AS status_entered_at
        FROM public.lead_status_history
        GROUP BY lead_id
      ), trigger_statuses AS (
        SELECT ARRAY(
          SELECT jsonb_array_elements_text(COALESCE(v_flow->'triggerStatuses', '[]'::jsonb))
        ) AS values
      )
      SELECT
        l.id,
        COALESCE(a.last_activity_at, h.status_entered_at, l.updated_at, l.created_at) AS inactivity_started_at
      FROM public.leads l
      LEFT JOIN public.lead_status_config status_config ON status_config.id = l.status_id
      LEFT JOIN chat_activity a ON a.lead_id = l.id
      LEFT JOIN status_entries h ON h.lead_id = l.id
      CROSS JOIN trigger_statuses ts
      WHERE l.ativo = true
        AND l.arquivado = false
        AND cardinality(ts.values) > 0
        AND COALESCE(status_config.nome, l.status) = ANY(ts.values)
        AND GREATEST(
          COALESCE(a.last_activity_at, h.status_entered_at, l.updated_at, l.created_at),
          v_activated_at
        ) <= now() - make_interval(hours => v_duration_hours)
        AND NOT EXISTS (
          SELECT 1
          FROM public.auto_contact_flow_jobs j
          WHERE j.lead_id = l.id
            AND j.flow_id = v_flow->>'id'
            AND j.status IN ('pending', 'processing')
        )
    LOOP
      PERFORM net.http_post(
        url := v_function_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_service_role_key
        ),
        body := jsonb_build_object(
          'lead_id', v_lead.id,
          'flow_id', v_flow->>'id',
          'inactivity_started_at', v_lead.inactivity_started_at
        ),
        timeout_milliseconds := 30000
      );
    END LOOP;
  END LOOP;
END;
$$;


-- 2. Only cancel flows on visible inbound messages (exclude technical events)
CREATE OR REPLACE FUNCTION public.cancel_auto_contact_jobs_on_inbound_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead_id uuid;
BEGIN
  IF NEW.direction <> 'inbound'
    OR (TG_OP = 'UPDATE' AND OLD.direction = 'inbound')
  THEN
    RETURN NEW;
  END IF;

  IF public.comm_whatsapp_message_preview_text(NEW.media_caption, NEW.text_content, NEW.message_type) IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT lead_id INTO v_lead_id
  FROM public.comm_whatsapp_chats
  WHERE id = NEW.chat_id;

  IF v_lead_id IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.auto_contact_flow_jobs
  SET status = 'skipped',
      last_error = 'Cliente respondeu; régua automática cancelada',
      updated_at = now()
  WHERE lead_id = v_lead_id
    AND status = 'pending'
    -- Historical syncs must not cancel a flow created after the message occurred.
    AND COALESCE(NEW.message_at, now()) >= created_at;

  RETURN NEW;
END;
$$;


-- 3. Backfill missing templateId on send_message steps of inactivity flows
--    Steps without templateId fall back to the first template — make it explicit.
DO $$
DECLARE
  v_settings jsonb;
  v_flow jsonb;
  v_flow_idx int;
  v_step_idx int;
  v_first_template_id text;
  v_changed boolean := false;
BEGIN
  SELECT settings INTO v_settings
  FROM public.integration_settings
  WHERE slug = 'whatsapp_auto_contact';

  IF v_settings IS NULL THEN RETURN; END IF;

  v_first_template_id := COALESCE(
    v_settings->'messageTemplates'->0->>'id',
    'template-1'
  );

  FOR v_flow_idx IN 0 .. jsonb_array_length(COALESCE(v_settings->'flows', '[]'::jsonb)) - 1
  LOOP
    v_flow := v_settings->'flows'->v_flow_idx;
    IF v_flow->>'triggerType' <> 'inactivity_duration' THEN CONTINUE; END IF;

    FOR v_step_idx IN 0 .. jsonb_array_length(COALESCE(v_flow->'steps', '[]'::jsonb)) - 1
    LOOP
      IF v_settings->'flows'->v_flow_idx->'steps'->v_step_idx->>'actionType' = 'send_message'
         AND (v_settings->'flows'->v_flow_idx->'steps'->v_step_idx->>'templateId' IS NULL
              OR v_settings->'flows'->v_flow_idx->'steps'->v_step_idx->>'templateId' = '')
      THEN
        v_settings := jsonb_set(
          v_settings,
          ARRAY['flows', v_flow_idx::text, 'steps', v_step_idx::text, 'templateId'],
          to_jsonb(v_first_template_id),
          true
        );
        v_settings := jsonb_set(
          v_settings,
          ARRAY['flows', v_flow_idx::text, 'steps', v_step_idx::text, 'messageSource'],
          to_jsonb('template'),
          true
        );
        v_changed := true;
      END IF;
    END LOOP;
  END LOOP;

  IF v_changed THEN
    UPDATE public.integration_settings
    SET settings = v_settings, updated_at = now()
    WHERE slug = 'whatsapp_auto_contact';
  END IF;
END;
$$;
