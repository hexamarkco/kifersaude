/*
  # Align WhatsApp campaign permissions and audience preview

  - Aligns direct table access with the same `can_edit` module permission used by
    dashboard-auth and campaign RPCs.
  - Adds a server-side preview RPC so filter preview uses the same deduped logic
    as campaign creation.
  - Hardens CSV creation by validating `existing_lead_id` against the normalized
    phone provided by the client.
*/

DROP POLICY IF EXISTS "Admins can read WhatsApp campaigns" ON public.whatsapp_campaigns;
DROP POLICY IF EXISTS "Admins can insert WhatsApp campaigns" ON public.whatsapp_campaigns;
DROP POLICY IF EXISTS "Admins can update WhatsApp campaigns" ON public.whatsapp_campaigns;
DROP POLICY IF EXISTS "Admins can delete WhatsApp campaigns" ON public.whatsapp_campaigns;
DROP POLICY IF EXISTS "Users with edit access can read WhatsApp campaigns" ON public.whatsapp_campaigns;
DROP POLICY IF EXISTS "Users with edit access can insert WhatsApp campaigns" ON public.whatsapp_campaigns;
DROP POLICY IF EXISTS "Users with edit access can update WhatsApp campaigns" ON public.whatsapp_campaigns;
DROP POLICY IF EXISTS "Users with edit access can delete WhatsApp campaigns" ON public.whatsapp_campaigns;

CREATE POLICY "Users with edit access can read WhatsApp campaigns"
  ON public.whatsapp_campaigns
  FOR SELECT
  TO authenticated
  USING (public.current_user_can_edit_whatsapp());

CREATE POLICY "Users with edit access can insert WhatsApp campaigns"
  ON public.whatsapp_campaigns
  FOR INSERT
  TO authenticated
  WITH CHECK (public.current_user_can_edit_whatsapp());

CREATE POLICY "Users with edit access can update WhatsApp campaigns"
  ON public.whatsapp_campaigns
  FOR UPDATE
  TO authenticated
  USING (public.current_user_can_edit_whatsapp())
  WITH CHECK (public.current_user_can_edit_whatsapp());

CREATE POLICY "Users with edit access can delete WhatsApp campaigns"
  ON public.whatsapp_campaigns
  FOR DELETE
  TO authenticated
  USING (public.current_user_can_edit_whatsapp());

DROP POLICY IF EXISTS "Admins can read WhatsApp campaign targets" ON public.whatsapp_campaign_targets;
DROP POLICY IF EXISTS "Admins can insert WhatsApp campaign targets" ON public.whatsapp_campaign_targets;
DROP POLICY IF EXISTS "Admins can update WhatsApp campaign targets" ON public.whatsapp_campaign_targets;
DROP POLICY IF EXISTS "Admins can delete WhatsApp campaign targets" ON public.whatsapp_campaign_targets;
DROP POLICY IF EXISTS "Users with edit access can read WhatsApp campaign targets" ON public.whatsapp_campaign_targets;
DROP POLICY IF EXISTS "Users with edit access can insert WhatsApp campaign targets" ON public.whatsapp_campaign_targets;
DROP POLICY IF EXISTS "Users with edit access can update WhatsApp campaign targets" ON public.whatsapp_campaign_targets;
DROP POLICY IF EXISTS "Users with edit access can delete WhatsApp campaign targets" ON public.whatsapp_campaign_targets;

CREATE POLICY "Users with edit access can read WhatsApp campaign targets"
  ON public.whatsapp_campaign_targets
  FOR SELECT
  TO authenticated
  USING (public.current_user_can_edit_whatsapp());

CREATE POLICY "Users with edit access can insert WhatsApp campaign targets"
  ON public.whatsapp_campaign_targets
  FOR INSERT
  TO authenticated
  WITH CHECK (public.current_user_can_edit_whatsapp());

CREATE POLICY "Users with edit access can update WhatsApp campaign targets"
  ON public.whatsapp_campaign_targets
  FOR UPDATE
  TO authenticated
  USING (public.current_user_can_edit_whatsapp())
  WITH CHECK (public.current_user_can_edit_whatsapp());

CREATE POLICY "Users with edit access can delete WhatsApp campaign targets"
  ON public.whatsapp_campaign_targets
  FOR DELETE
  TO authenticated
  USING (public.current_user_can_edit_whatsapp());

CREATE OR REPLACE FUNCTION public.resolve_whatsapp_campaign_filter_leads(
  p_audience_filter jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE(
  lead_id uuid,
  nome_completo text,
  telefone text,
  status text,
  origem text,
  responsavel text,
  canal text,
  status_id uuid,
  origem_id uuid,
  responsavel_id uuid,
  normalized_phone text
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH normalized_filter AS (
    SELECT CASE
      WHEN p_audience_filter IS NOT NULL AND jsonb_typeof(p_audience_filter) = 'object' THEN p_audience_filter
      ELSE '{}'::jsonb
    END AS audience_filter
  ),
  filtered_leads AS (
    SELECT
      l.id AS lead_id,
      l.nome_completo,
      l.telefone,
      l.status,
      l.origem,
      l.responsavel,
      l.canal,
      l.status_id,
      l.origem_id,
      l.responsavel_id,
      public.normalize_whatsapp_campaign_phone(l.telefone) AS normalized_phone,
      row_number() OVER (
        PARTITION BY public.normalize_whatsapp_campaign_phone(l.telefone)
        ORDER BY COALESCE(l.updated_at, l.created_at, l.data_criacao) DESC NULLS LAST, l.id DESC
      ) AS phone_rank
    FROM public.leads l
    CROSS JOIN normalized_filter f
    WHERE COALESCE(l.arquivado, false) = false
      AND NULLIF(btrim(COALESCE(l.telefone, '')), '') IS NOT NULL
      AND (
        NULLIF(btrim(COALESCE(f.audience_filter ->> 'status_id', '')), '') IS NULL
        OR l.status_id = (f.audience_filter ->> 'status_id')::uuid
      )
      AND (
        NULLIF(btrim(COALESCE(f.audience_filter ->> 'responsavel_id', '')), '') IS NULL
        OR l.responsavel_id = (f.audience_filter ->> 'responsavel_id')::uuid
      )
      AND (
        NULLIF(btrim(COALESCE(f.audience_filter ->> 'origem_id', '')), '') IS NULL
        OR l.origem_id = (f.audience_filter ->> 'origem_id')::uuid
      )
      AND (
        NULLIF(btrim(COALESCE(f.audience_filter ->> 'canal', '')), '') IS NULL
        OR COALESCE(l.canal, '') = f.audience_filter ->> 'canal'
      )
  )
  SELECT
    lead_id,
    nome_completo,
    telefone,
    status,
    origem,
    responsavel,
    canal,
    status_id,
    origem_id,
    responsavel_id,
    normalized_phone
  FROM filtered_leads
  WHERE phone_rank = 1
    AND normalized_phone <> '';
$$;

REVOKE ALL ON FUNCTION public.resolve_whatsapp_campaign_filter_leads(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_whatsapp_campaign_filter_leads(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.preview_whatsapp_campaign_audience(
  p_audience_filter jsonb DEFAULT '{}'::jsonb,
  p_limit integer DEFAULT 80
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_requester_id uuid;
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 80), 1), 200);
  v_total_targets integer := 0;
  v_sample_targets jsonb := '[]'::jsonb;
BEGIN
  v_requester_id := auth.uid();

  IF v_requester_id IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado';
  END IF;

  IF NOT public.current_user_can_edit_whatsapp() THEN
    RAISE EXCEPTION 'Permissao insuficiente para visualizar o publico da campanha do WhatsApp';
  END IF;

  SELECT COUNT(*)::int
  INTO v_total_targets
  FROM public.resolve_whatsapp_campaign_filter_leads(p_audience_filter);

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', sample.lead_id,
        'nome_completo', sample.nome_completo,
        'telefone', sample.telefone,
        'status_id', sample.status_id,
        'responsavel_id', sample.responsavel_id,
        'origem_id', sample.origem_id,
        'canal', sample.canal
      )
      ORDER BY COALESCE(sample.nome_completo, ''), sample.lead_id
    ),
    '[]'::jsonb
  )
  INTO v_sample_targets
  FROM (
    SELECT *
    FROM public.resolve_whatsapp_campaign_filter_leads(p_audience_filter)
    ORDER BY COALESCE(nome_completo, ''), lead_id
    LIMIT v_limit
  ) AS sample;

  RETURN jsonb_build_object(
    'total_targets', v_total_targets,
    'sample_targets', v_sample_targets
  );
END;
$$;

REVOKE ALL ON FUNCTION public.preview_whatsapp_campaign_audience(jsonb, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.preview_whatsapp_campaign_audience(jsonb, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.create_whatsapp_campaign_atomic(
  p_name text,
  p_message text,
  p_flow_steps jsonb,
  p_audience_source text,
  p_audience_filter jsonb DEFAULT '{}'::jsonb,
  p_audience_config jsonb DEFAULT '{}'::jsonb,
  p_scheduled_at timestamptz DEFAULT NULL,
  p_csv_targets jsonb DEFAULT '[]'::jsonb
)
RETURNS public.whatsapp_campaigns
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_requester_id uuid;
  v_campaign public.whatsapp_campaigns%ROWTYPE;
  v_audience_filter jsonb := CASE
    WHEN p_audience_filter IS NOT NULL AND jsonb_typeof(p_audience_filter) = 'object' THEN p_audience_filter
    ELSE '{}'::jsonb
  END;
  v_audience_config jsonb := CASE
    WHEN p_audience_config IS NOT NULL AND jsonb_typeof(p_audience_config) = 'object' THEN p_audience_config
    ELSE '{}'::jsonb
  END;
  v_csv_targets jsonb := CASE
    WHEN p_csv_targets IS NOT NULL AND jsonb_typeof(p_csv_targets) = 'array' THEN p_csv_targets
    ELSE '[]'::jsonb
  END;
  v_target_count integer := 0;
  v_missing_count integer := 0;
  v_origem_id uuid := NULLIF(btrim(COALESCE(v_audience_config #>> '{crm_defaults,origem_id}', '')), '')::uuid;
  v_status_id uuid := NULLIF(btrim(COALESCE(v_audience_config #>> '{crm_defaults,status_id}', '')), '')::uuid;
  v_tipo_contratacao_id uuid := NULLIF(btrim(COALESCE(v_audience_config #>> '{crm_defaults,tipo_contratacao_id}', '')), '')::uuid;
  v_responsavel_id uuid := NULLIF(btrim(COALESCE(v_audience_config #>> '{crm_defaults,responsavel_id}', '')), '')::uuid;
  v_origem_label text := NULLIF(btrim(COALESCE(v_audience_config #>> '{crm_defaults,origem_label}', '')), '');
  v_status_label text := NULLIF(btrim(COALESCE(v_audience_config #>> '{crm_defaults,status_label}', '')), '');
  v_tipo_contratacao_label text := NULLIF(btrim(COALESCE(v_audience_config #>> '{crm_defaults,tipo_contratacao_label}', '')), '');
  v_responsavel_label text := NULLIF(btrim(COALESCE(v_audience_config #>> '{crm_defaults,responsavel_label}', '')), '');
BEGIN
  v_requester_id := auth.uid();

  IF v_requester_id IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado';
  END IF;

  IF NOT public.current_user_can_edit_whatsapp() THEN
    RAISE EXCEPTION 'Permissao insuficiente para criar campanhas do WhatsApp';
  END IF;

  IF NULLIF(btrim(COALESCE(p_name, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Nome da campanha obrigatorio';
  END IF;

  IF p_audience_source NOT IN ('filters', 'csv') THEN
    RAISE EXCEPTION 'Fonte de publico invalida';
  END IF;

  IF p_flow_steps IS NULL OR jsonb_typeof(p_flow_steps) <> 'array' OR jsonb_array_length(p_flow_steps) = 0 THEN
    RAISE EXCEPTION 'Fluxo da campanha invalido';
  END IF;

  INSERT INTO public.whatsapp_campaigns (
    name,
    message,
    flow_steps,
    status,
    audience_source,
    audience_filter,
    audience_config,
    total_targets,
    pending_targets,
    sent_targets,
    failed_targets,
    invalid_targets,
    scheduled_at,
    created_by
  )
  VALUES (
    btrim(p_name),
    COALESCE(p_message, ''),
    p_flow_steps,
    'draft',
    p_audience_source,
    v_audience_filter,
    v_audience_config,
    0,
    0,
    0,
    0,
    0,
    p_scheduled_at,
    v_requester_id
  )
  RETURNING * INTO v_campaign;

  IF p_audience_source = 'filters' THEN
    WITH filtered_leads AS (
      SELECT *
      FROM public.resolve_whatsapp_campaign_filter_leads(v_audience_filter)
    ),
    inserted_targets AS (
      INSERT INTO public.whatsapp_campaign_targets (
        campaign_id,
        lead_id,
        phone,
        raw_phone,
        display_name,
        chat_id,
        source_kind,
        source_payload,
        status
      )
      SELECT
        v_campaign.id,
        filtered_leads.lead_id,
        filtered_leads.normalized_phone,
        NULLIF(btrim(COALESCE(filtered_leads.telefone, '')), ''),
        NULLIF(btrim(COALESCE(filtered_leads.nome_completo, '')), ''),
        filtered_leads.normalized_phone || '@s.whatsapp.net',
        'lead_filter',
        jsonb_strip_nulls(
          jsonb_build_object(
            'nome', NULLIF(btrim(COALESCE(filtered_leads.nome_completo, '')), ''),
            'telefone', NULLIF(btrim(COALESCE(filtered_leads.telefone, '')), ''),
            'status', NULLIF(btrim(COALESCE(filtered_leads.status, '')), ''),
            'origem', NULLIF(btrim(COALESCE(filtered_leads.origem, '')), ''),
            'responsavel', NULLIF(btrim(COALESCE(filtered_leads.responsavel, '')), ''),
            'canal', NULLIF(btrim(COALESCE(filtered_leads.canal, '')), '')
          )
        ),
        'pending'
      FROM filtered_leads
      RETURNING id
    )
    SELECT COUNT(*)::int INTO v_target_count
    FROM inserted_targets;

    IF v_target_count = 0 THEN
      RAISE EXCEPTION 'Nenhum lead com telefone valido encontrado para os filtros selecionados';
    END IF;
  ELSE
    IF jsonb_array_length(v_csv_targets) = 0 THEN
      RAISE EXCEPTION 'Nenhum alvo valido enviado para a campanha CSV';
    END IF;

    SELECT COUNT(*)::int INTO v_missing_count
    FROM jsonb_array_elements(v_csv_targets) AS element(item)
    WHERE public.normalize_whatsapp_campaign_phone(item ->> 'normalized_phone') = '';

    IF v_missing_count > 0 THEN
      RAISE EXCEPTION 'Existem linhas CSV com telefone invalido';
    END IF;

    SELECT COUNT(*)::int INTO v_missing_count
    FROM jsonb_array_elements(v_csv_targets) AS element(item)
    WHERE COALESCE((item ->> 'needs_lead_creation')::boolean, false) = true
      AND NULLIF(btrim(COALESCE(item ->> 'display_name', '')), '') IS NULL;

    IF v_missing_count > 0 THEN
      RAISE EXCEPTION 'Existem linhas CSV sem nome para criacao de lead';
    END IF;

    SELECT COUNT(*)::int INTO v_missing_count
    FROM jsonb_array_elements(v_csv_targets) AS element(item)
    WHERE COALESCE((item ->> 'needs_lead_creation')::boolean, false) = true;

    IF v_missing_count > 0 AND (
      v_origem_id IS NULL
      OR v_status_id IS NULL
      OR v_tipo_contratacao_id IS NULL
      OR v_responsavel_id IS NULL
    ) THEN
      RAISE EXCEPTION 'Defaults do CRM incompletos para criar novos leads via CSV';
    END IF;

    WITH raw_items AS (
      SELECT
        row_number() OVER () AS item_order,
        public.normalize_whatsapp_campaign_phone(item ->> 'normalized_phone') AS normalized_phone,
        NULLIF(btrim(COALESCE(item ->> 'raw_phone', '')), '') AS raw_phone,
        NULLIF(btrim(COALESCE(item ->> 'display_name', '')), '') AS display_name,
        NULLIF(btrim(COALESCE(item ->> 'chat_id', '')), '') AS chat_id,
        CASE
          WHEN item ? 'source_payload' AND jsonb_typeof(item -> 'source_payload') = 'object' THEN item -> 'source_payload'
          ELSE '{}'::jsonb
        END AS source_payload,
        CASE
          WHEN NULLIF(btrim(COALESCE(item ->> 'existing_lead_id', '')), '') IS NULL THEN NULL
          ELSE (item ->> 'existing_lead_id')::uuid
        END AS existing_lead_id,
        COALESCE((item ->> 'needs_lead_creation')::boolean, false) AS needs_lead_creation
      FROM jsonb_array_elements(v_csv_targets) AS element(item)
    ),
    deduped_items AS (
      SELECT DISTINCT ON (normalized_phone)
        normalized_phone,
        raw_phone,
        display_name,
        chat_id,
        source_payload,
        existing_lead_id,
        needs_lead_creation
      FROM raw_items
      WHERE normalized_phone <> ''
      ORDER BY normalized_phone, item_order
    )
    SELECT COUNT(*)::int INTO v_missing_count
    FROM deduped_items
    WHERE existing_lead_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.leads l
        WHERE l.id = deduped_items.existing_lead_id
          AND public.normalize_whatsapp_campaign_phone(l.telefone) = deduped_items.normalized_phone
      );

    IF v_missing_count > 0 THEN
      RAISE EXCEPTION 'Existem linhas CSV com lead existente inconsistente com o telefone informado';
    END IF;

    WITH raw_items AS (
      SELECT
        row_number() OVER () AS item_order,
        public.normalize_whatsapp_campaign_phone(item ->> 'normalized_phone') AS normalized_phone,
        NULLIF(btrim(COALESCE(item ->> 'raw_phone', '')), '') AS raw_phone,
        NULLIF(btrim(COALESCE(item ->> 'display_name', '')), '') AS display_name,
        NULLIF(btrim(COALESCE(item ->> 'chat_id', '')), '') AS chat_id,
        CASE
          WHEN item ? 'source_payload' AND jsonb_typeof(item -> 'source_payload') = 'object' THEN item -> 'source_payload'
          ELSE '{}'::jsonb
        END AS source_payload,
        CASE
          WHEN NULLIF(btrim(COALESCE(item ->> 'existing_lead_id', '')), '') IS NULL THEN NULL
          ELSE (item ->> 'existing_lead_id')::uuid
        END AS existing_lead_id,
        COALESCE((item ->> 'needs_lead_creation')::boolean, false) AS needs_lead_creation
      FROM jsonb_array_elements(v_csv_targets) AS element(item)
    ),
    deduped_items AS (
      SELECT DISTINCT ON (normalized_phone)
        normalized_phone,
        raw_phone,
        display_name,
        chat_id,
        source_payload,
        existing_lead_id,
        needs_lead_creation
      FROM raw_items
      WHERE normalized_phone <> ''
      ORDER BY normalized_phone, item_order
    )
    INSERT INTO public.leads (
      nome_completo,
      telefone,
      origem,
      origem_id,
      tipo_contratacao,
      tipo_contratacao_id,
      status,
      status_id,
      responsavel,
      responsavel_id,
      data_criacao,
      ultimo_contato,
      canal,
      skip_automation
    )
    SELECT
      deduped_items.display_name,
      public.storage_whatsapp_campaign_phone(deduped_items.normalized_phone),
      v_origem_label,
      v_origem_id,
      v_tipo_contratacao_label,
      v_tipo_contratacao_id,
      v_status_label,
      v_status_id,
      v_responsavel_label,
      v_responsavel_id,
      now(),
      now(),
      'whatsapp_campaign',
      true
    FROM deduped_items
    WHERE deduped_items.existing_lead_id IS NULL
      AND deduped_items.needs_lead_creation = true
      AND NOT EXISTS (
        SELECT 1
        FROM public.leads existing_leads
        WHERE public.normalize_whatsapp_campaign_phone(existing_leads.telefone) = deduped_items.normalized_phone
      );

    WITH raw_items AS (
      SELECT
        row_number() OVER () AS item_order,
        public.normalize_whatsapp_campaign_phone(item ->> 'normalized_phone') AS normalized_phone,
        NULLIF(btrim(COALESCE(item ->> 'raw_phone', '')), '') AS raw_phone,
        NULLIF(btrim(COALESCE(item ->> 'display_name', '')), '') AS display_name,
        NULLIF(btrim(COALESCE(item ->> 'chat_id', '')), '') AS chat_id,
        CASE
          WHEN item ? 'source_payload' AND jsonb_typeof(item -> 'source_payload') = 'object' THEN item -> 'source_payload'
          ELSE '{}'::jsonb
        END AS source_payload,
        CASE
          WHEN NULLIF(btrim(COALESCE(item ->> 'existing_lead_id', '')), '') IS NULL THEN NULL
          ELSE (item ->> 'existing_lead_id')::uuid
        END AS existing_lead_id
      FROM jsonb_array_elements(v_csv_targets) AS element(item)
    ),
    deduped_items AS (
      SELECT DISTINCT ON (normalized_phone)
        normalized_phone,
        raw_phone,
        display_name,
        chat_id,
        source_payload,
        existing_lead_id
      FROM raw_items
      WHERE normalized_phone <> ''
      ORDER BY normalized_phone, item_order
    ),
    resolved_items AS (
      SELECT
        deduped_items.normalized_phone,
        deduped_items.raw_phone,
        deduped_items.display_name,
        COALESCE(deduped_items.chat_id, deduped_items.normalized_phone || '@s.whatsapp.net') AS resolved_chat_id,
        deduped_items.source_payload,
        COALESCE(deduped_items.existing_lead_id, lead_match.id) AS lead_id
      FROM deduped_items
      LEFT JOIN LATERAL (
        SELECT l.id
        FROM public.leads l
        WHERE (
            deduped_items.existing_lead_id IS NOT NULL
            AND l.id = deduped_items.existing_lead_id
            AND public.normalize_whatsapp_campaign_phone(l.telefone) = deduped_items.normalized_phone
          )
          OR (
            deduped_items.existing_lead_id IS NULL
            AND public.normalize_whatsapp_campaign_phone(l.telefone) = deduped_items.normalized_phone
          )
        ORDER BY
          CASE WHEN l.id = deduped_items.existing_lead_id THEN 0 ELSE 1 END,
          COALESCE(l.updated_at, l.created_at, l.data_criacao) DESC NULLS LAST,
          l.id DESC
        LIMIT 1
      ) AS lead_match ON true
    )
    SELECT COUNT(*)::int INTO v_missing_count
    FROM resolved_items
    WHERE lead_id IS NULL;

    IF v_missing_count > 0 THEN
      RAISE EXCEPTION 'Nao foi possivel vincular todos os leads do CSV';
    END IF;

    WITH raw_items AS (
      SELECT
        row_number() OVER () AS item_order,
        public.normalize_whatsapp_campaign_phone(item ->> 'normalized_phone') AS normalized_phone,
        NULLIF(btrim(COALESCE(item ->> 'raw_phone', '')), '') AS raw_phone,
        NULLIF(btrim(COALESCE(item ->> 'display_name', '')), '') AS display_name,
        NULLIF(btrim(COALESCE(item ->> 'chat_id', '')), '') AS chat_id,
        CASE
          WHEN item ? 'source_payload' AND jsonb_typeof(item -> 'source_payload') = 'object' THEN item -> 'source_payload'
          ELSE '{}'::jsonb
        END AS source_payload,
        CASE
          WHEN NULLIF(btrim(COALESCE(item ->> 'existing_lead_id', '')), '') IS NULL THEN NULL
          ELSE (item ->> 'existing_lead_id')::uuid
        END AS existing_lead_id
      FROM jsonb_array_elements(v_csv_targets) AS element(item)
    ),
    deduped_items AS (
      SELECT DISTINCT ON (normalized_phone)
        normalized_phone,
        raw_phone,
        display_name,
        chat_id,
        source_payload,
        existing_lead_id
      FROM raw_items
      WHERE normalized_phone <> ''
      ORDER BY normalized_phone, item_order
    ),
    resolved_items AS (
      SELECT
        deduped_items.normalized_phone,
        deduped_items.raw_phone,
        deduped_items.display_name,
        COALESCE(deduped_items.chat_id, deduped_items.normalized_phone || '@s.whatsapp.net') AS resolved_chat_id,
        deduped_items.source_payload,
        COALESCE(deduped_items.existing_lead_id, lead_match.id) AS lead_id
      FROM deduped_items
      LEFT JOIN LATERAL (
        SELECT l.id
        FROM public.leads l
        WHERE (
            deduped_items.existing_lead_id IS NOT NULL
            AND l.id = deduped_items.existing_lead_id
            AND public.normalize_whatsapp_campaign_phone(l.telefone) = deduped_items.normalized_phone
          )
          OR (
            deduped_items.existing_lead_id IS NULL
            AND public.normalize_whatsapp_campaign_phone(l.telefone) = deduped_items.normalized_phone
          )
        ORDER BY
          CASE WHEN l.id = deduped_items.existing_lead_id THEN 0 ELSE 1 END,
          COALESCE(l.updated_at, l.created_at, l.data_criacao) DESC NULLS LAST,
          l.id DESC
        LIMIT 1
      ) AS lead_match ON true
    ),
    inserted_targets AS (
      INSERT INTO public.whatsapp_campaign_targets (
        campaign_id,
        lead_id,
        phone,
        raw_phone,
        display_name,
        chat_id,
        source_kind,
        source_payload,
        status
      )
      SELECT
        v_campaign.id,
        resolved_items.lead_id,
        resolved_items.normalized_phone,
        resolved_items.raw_phone,
        resolved_items.display_name,
        resolved_items.resolved_chat_id,
        'csv_import',
        resolved_items.source_payload,
        'pending'
      FROM resolved_items
      RETURNING id
    )
    SELECT COUNT(*)::int INTO v_target_count
    FROM inserted_targets;

    IF v_target_count = 0 THEN
      RAISE EXCEPTION 'Nenhum alvo valido encontrado para a campanha CSV';
    END IF;
  END IF;

  UPDATE public.whatsapp_campaigns
  SET
    audience_config = jsonb_set(v_audience_config, '{resolved_target_count}', to_jsonb(v_target_count), true),
    total_targets = v_target_count,
    pending_targets = v_target_count,
    sent_targets = 0,
    failed_targets = 0,
    invalid_targets = 0,
    completed_at = NULL,
    last_error = NULL
  WHERE id = v_campaign.id
  RETURNING * INTO v_campaign;

  RETURN v_campaign;
END;
$$;

REVOKE ALL ON FUNCTION public.create_whatsapp_campaign_atomic(text, text, jsonb, text, jsonb, jsonb, timestamptz, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_whatsapp_campaign_atomic(text, text, jsonb, text, jsonb, jsonb, timestamptz, jsonb) TO authenticated;
