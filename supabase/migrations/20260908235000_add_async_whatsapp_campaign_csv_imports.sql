/*
  # Add async WhatsApp campaign CSV imports

  Moves large CSV campaign creation out of a single synchronous RPC and into
  resumable import jobs processed in smaller batches by an edge worker.
*/

DO $$
BEGIN
  IF to_regclass('public.whatsapp_campaigns') IS NULL THEN
    RAISE NOTICE 'public.whatsapp_campaigns not found, skipping async campaign import migration.';
    RETURN;
  END IF;

  ALTER TABLE public.whatsapp_campaigns
    ADD COLUMN IF NOT EXISTS import_status text DEFAULT 'ready',
    ADD COLUMN IF NOT EXISTS import_total_rows integer DEFAULT 0,
    ADD COLUMN IF NOT EXISTS import_processed_rows integer DEFAULT 0,
    ADD COLUMN IF NOT EXISTS import_failed_rows integer DEFAULT 0,
    ADD COLUMN IF NOT EXISTS import_started_at timestamptz,
    ADD COLUMN IF NOT EXISTS import_completed_at timestamptz,
    ADD COLUMN IF NOT EXISTS import_error text;

  UPDATE public.whatsapp_campaigns
  SET
    import_status = CASE
      WHEN import_status IN ('ready', 'queued', 'processing', 'failed', 'cancelled') THEN import_status
      ELSE 'ready'
    END,
    import_total_rows = GREATEST(COALESCE(import_total_rows, 0), 0),
    import_processed_rows = GREATEST(COALESCE(import_processed_rows, 0), 0),
    import_failed_rows = GREATEST(COALESCE(import_failed_rows, 0), 0),
    import_error = NULLIF(btrim(COALESCE(import_error, '')), '');

  ALTER TABLE public.whatsapp_campaigns
    ALTER COLUMN import_status SET NOT NULL,
    ALTER COLUMN import_status SET DEFAULT 'ready',
    ALTER COLUMN import_total_rows SET NOT NULL,
    ALTER COLUMN import_total_rows SET DEFAULT 0,
    ALTER COLUMN import_processed_rows SET NOT NULL,
    ALTER COLUMN import_processed_rows SET DEFAULT 0,
    ALTER COLUMN import_failed_rows SET NOT NULL,
    ALTER COLUMN import_failed_rows SET DEFAULT 0;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'whatsapp_campaigns_import_status_check'
      AND conrelid = 'public.whatsapp_campaigns'::regclass
  ) THEN
    ALTER TABLE public.whatsapp_campaigns
      DROP CONSTRAINT whatsapp_campaigns_import_status_check;
  END IF;

  ALTER TABLE public.whatsapp_campaigns
    ADD CONSTRAINT whatsapp_campaigns_import_status_check
    CHECK (import_status IN ('ready', 'queued', 'processing', 'failed', 'cancelled'));

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'whatsapp_campaigns_import_rows_check'
      AND conrelid = 'public.whatsapp_campaigns'::regclass
  ) THEN
    ALTER TABLE public.whatsapp_campaigns
      DROP CONSTRAINT whatsapp_campaigns_import_rows_check;
  END IF;

  ALTER TABLE public.whatsapp_campaigns
    ADD CONSTRAINT whatsapp_campaigns_import_rows_check
    CHECK (
      import_total_rows >= 0
      AND import_processed_rows >= 0
      AND import_failed_rows >= 0
      AND import_processed_rows <= import_total_rows
    );
END $$;

CREATE INDEX IF NOT EXISTS idx_whatsapp_campaigns_import_status_created
  ON public.whatsapp_campaigns (import_status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.whatsapp_campaign_import_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.whatsapp_campaigns(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'queued',
  storage_bucket text NOT NULL DEFAULT 'whatsapp-campaign-imports',
  storage_path text NOT NULL,
  file_name text,
  delimiter text NOT NULL DEFAULT ';',
  mapping jsonb NOT NULL DEFAULT '{}'::jsonb,
  crm_defaults jsonb NOT NULL DEFAULT '{}'::jsonb,
  total_rows integer NOT NULL DEFAULT 0,
  processed_rows integer NOT NULL DEFAULT 0,
  failed_rows integer NOT NULL DEFAULT 0,
  created_leads integer NOT NULL DEFAULT 0,
  created_targets integer NOT NULL DEFAULT 0,
  next_row_offset integer NOT NULL DEFAULT 0,
  last_error text,
  processing_started_at timestamptz,
  processing_expires_at timestamptz,
  created_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT whatsapp_campaign_import_jobs_campaign_id_key UNIQUE (campaign_id)
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'whatsapp_campaign_import_jobs_status_check'
      AND conrelid = 'public.whatsapp_campaign_import_jobs'::regclass
  ) THEN
    ALTER TABLE public.whatsapp_campaign_import_jobs
      DROP CONSTRAINT whatsapp_campaign_import_jobs_status_check;
  END IF;

  ALTER TABLE public.whatsapp_campaign_import_jobs
    ADD CONSTRAINT whatsapp_campaign_import_jobs_status_check
    CHECK (status IN ('queued', 'processing', 'ready', 'failed', 'cancelled'));

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'whatsapp_campaign_import_jobs_nonnegative_check'
      AND conrelid = 'public.whatsapp_campaign_import_jobs'::regclass
  ) THEN
    ALTER TABLE public.whatsapp_campaign_import_jobs
      DROP CONSTRAINT whatsapp_campaign_import_jobs_nonnegative_check;
  END IF;

  ALTER TABLE public.whatsapp_campaign_import_jobs
    ADD CONSTRAINT whatsapp_campaign_import_jobs_nonnegative_check
    CHECK (
      total_rows >= 0
      AND processed_rows >= 0
      AND failed_rows >= 0
      AND created_leads >= 0
      AND created_targets >= 0
      AND next_row_offset >= 0
      AND processed_rows <= total_rows
      AND next_row_offset <= total_rows
    );

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'whatsapp_campaign_import_jobs_mapping_is_object'
      AND conrelid = 'public.whatsapp_campaign_import_jobs'::regclass
  ) THEN
    ALTER TABLE public.whatsapp_campaign_import_jobs
      DROP CONSTRAINT whatsapp_campaign_import_jobs_mapping_is_object;
  END IF;

  ALTER TABLE public.whatsapp_campaign_import_jobs
    ADD CONSTRAINT whatsapp_campaign_import_jobs_mapping_is_object
    CHECK (jsonb_typeof(mapping) = 'object');

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'whatsapp_campaign_import_jobs_crm_defaults_is_object'
      AND conrelid = 'public.whatsapp_campaign_import_jobs'::regclass
  ) THEN
    ALTER TABLE public.whatsapp_campaign_import_jobs
      DROP CONSTRAINT whatsapp_campaign_import_jobs_crm_defaults_is_object;
  END IF;

  ALTER TABLE public.whatsapp_campaign_import_jobs
    ADD CONSTRAINT whatsapp_campaign_import_jobs_crm_defaults_is_object
    CHECK (jsonb_typeof(crm_defaults) = 'object');
END $$;

CREATE INDEX IF NOT EXISTS idx_whatsapp_campaign_import_jobs_queue
  ON public.whatsapp_campaign_import_jobs (status, processing_expires_at, created_at)
  WHERE status IN ('queued', 'processing');

CREATE OR REPLACE FUNCTION public.set_whatsapp_campaign_import_jobs_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_whatsapp_campaign_import_jobs_updated_at
  ON public.whatsapp_campaign_import_jobs;

CREATE TRIGGER trg_whatsapp_campaign_import_jobs_updated_at
BEFORE UPDATE ON public.whatsapp_campaign_import_jobs
FOR EACH ROW
EXECUTE FUNCTION public.set_whatsapp_campaign_import_jobs_updated_at();

ALTER TABLE public.whatsapp_campaign_import_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read WhatsApp campaign import jobs" ON public.whatsapp_campaign_import_jobs;
DROP POLICY IF EXISTS "Admins can insert WhatsApp campaign import jobs" ON public.whatsapp_campaign_import_jobs;
DROP POLICY IF EXISTS "Admins can update WhatsApp campaign import jobs" ON public.whatsapp_campaign_import_jobs;
DROP POLICY IF EXISTS "Admins can delete WhatsApp campaign import jobs" ON public.whatsapp_campaign_import_jobs;
DROP POLICY IF EXISTS "Service role can manage WhatsApp campaign import jobs" ON public.whatsapp_campaign_import_jobs;

CREATE POLICY "Admins can read WhatsApp campaign import jobs"
  ON public.whatsapp_campaign_import_jobs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert WhatsApp campaign import jobs"
  ON public.whatsapp_campaign_import_jobs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update WhatsApp campaign import jobs"
  ON public.whatsapp_campaign_import_jobs
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete WhatsApp campaign import jobs"
  ON public.whatsapp_campaign_import_jobs
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Service role can manage WhatsApp campaign import jobs"
  ON public.whatsapp_campaign_import_jobs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

INSERT INTO storage.buckets (id, name, public)
VALUES ('whatsapp-campaign-imports', 'whatsapp-campaign-imports', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Admins can view WhatsApp campaign imports" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload WhatsApp campaign imports" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update WhatsApp campaign imports" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete WhatsApp campaign imports" ON storage.objects;

CREATE POLICY "Admins can view WhatsApp campaign imports"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'whatsapp-campaign-imports'
    AND EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can upload WhatsApp campaign imports"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'whatsapp-campaign-imports'
    AND EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update WhatsApp campaign imports"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'whatsapp-campaign-imports'
    AND EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete WhatsApp campaign imports"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'whatsapp-campaign-imports'
    AND EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role = 'admin'
    )
  );

CREATE OR REPLACE FUNCTION public.create_whatsapp_campaign_csv_import_atomic(
  p_name text,
  p_message text,
  p_flow_steps jsonb,
  p_audience_config jsonb DEFAULT '{}'::jsonb,
  p_scheduled_at timestamptz DEFAULT NULL,
  p_storage_bucket text DEFAULT 'whatsapp-campaign-imports',
  p_storage_path text DEFAULT NULL,
  p_file_name text DEFAULT NULL,
  p_delimiter text DEFAULT ';',
  p_mapping jsonb DEFAULT '{}'::jsonb,
  p_crm_defaults jsonb DEFAULT '{}'::jsonb,
  p_total_rows integer DEFAULT 0
)
RETURNS public.whatsapp_campaigns
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_requester_id uuid;
  v_campaign public.whatsapp_campaigns%ROWTYPE;
  v_audience_config jsonb := CASE
    WHEN p_audience_config IS NOT NULL AND jsonb_typeof(p_audience_config) = 'object' THEN p_audience_config
    ELSE '{}'::jsonb
  END;
  v_mapping jsonb := CASE
    WHEN p_mapping IS NOT NULL AND jsonb_typeof(p_mapping) = 'object' THEN p_mapping
    ELSE '{}'::jsonb
  END;
  v_crm_defaults jsonb := CASE
    WHEN p_crm_defaults IS NOT NULL AND jsonb_typeof(p_crm_defaults) = 'object' THEN p_crm_defaults
    ELSE '{}'::jsonb
  END;
  v_storage_bucket text := NULLIF(btrim(COALESCE(p_storage_bucket, '')), '');
  v_storage_path text := NULLIF(btrim(COALESCE(p_storage_path, '')), '');
  v_file_name text := NULLIF(btrim(COALESCE(p_file_name, '')), '');
  v_phone_column_key text := NULLIF(btrim(COALESCE(v_mapping ->> 'phone_column_key', '')), '');
  v_total_rows integer := GREATEST(COALESCE(p_total_rows, 0), 0);
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

  IF p_flow_steps IS NULL OR jsonb_typeof(p_flow_steps) <> 'array' OR jsonb_array_length(p_flow_steps) = 0 THEN
    RAISE EXCEPTION 'Fluxo da campanha invalido';
  END IF;

  IF v_storage_bucket IS NULL OR v_storage_path IS NULL THEN
    RAISE EXCEPTION 'Arquivo CSV da campanha ausente';
  END IF;

  IF v_phone_column_key IS NULL THEN
    RAISE EXCEPTION 'Mapeamento da coluna de telefone obrigatorio';
  END IF;

  v_audience_config := v_audience_config || jsonb_strip_nulls(
    jsonb_build_object(
      'source', 'csv',
      'csv_file_name', v_file_name,
      'csv_delimiter', CASE WHEN p_delimiter IN (',', ';') THEN p_delimiter ELSE ';' END,
      'mapping', v_mapping,
      'crm_defaults', v_crm_defaults
    )
  );

  INSERT INTO public.whatsapp_campaigns (
    name,
    message,
    flow_steps,
    status,
    import_status,
    audience_source,
    audience_filter,
    audience_config,
    total_targets,
    pending_targets,
    sent_targets,
    failed_targets,
    invalid_targets,
    scheduled_at,
    import_total_rows,
    import_processed_rows,
    import_failed_rows,
    import_started_at,
    import_completed_at,
    import_error,
    created_by
  )
  VALUES (
    btrim(p_name),
    COALESCE(p_message, ''),
    p_flow_steps,
    'draft',
    'queued',
    'csv',
    '{}'::jsonb,
    v_audience_config,
    0,
    0,
    0,
    0,
    0,
    p_scheduled_at,
    v_total_rows,
    0,
    0,
    NULL,
    NULL,
    NULL,
    v_requester_id
  )
  RETURNING * INTO v_campaign;

  INSERT INTO public.whatsapp_campaign_import_jobs (
    campaign_id,
    status,
    storage_bucket,
    storage_path,
    file_name,
    delimiter,
    mapping,
    crm_defaults,
    total_rows,
    processed_rows,
    failed_rows,
    created_leads,
    created_targets,
    next_row_offset,
    last_error,
    created_by
  )
  VALUES (
    v_campaign.id,
    'queued',
    v_storage_bucket,
    v_storage_path,
    v_file_name,
    CASE WHEN p_delimiter IN (',', ';') THEN p_delimiter ELSE ';' END,
    v_mapping,
    v_crm_defaults,
    v_total_rows,
    0,
    0,
    0,
    0,
    0,
    NULL,
    v_requester_id
  );

  RETURN v_campaign;
END;
$$;

REVOKE ALL ON FUNCTION public.create_whatsapp_campaign_csv_import_atomic(text, text, jsonb, jsonb, timestamptz, text, text, text, text, jsonb, jsonb, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_whatsapp_campaign_csv_import_atomic(text, text, jsonb, jsonb, timestamptz, text, text, text, text, jsonb, jsonb, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.append_whatsapp_campaign_csv_targets_batch(
  p_campaign_id uuid,
  p_csv_targets jsonb DEFAULT '[]'::jsonb,
  p_crm_defaults jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_campaign public.whatsapp_campaigns%ROWTYPE;
  v_csv_targets jsonb := CASE
    WHEN p_csv_targets IS NOT NULL AND jsonb_typeof(p_csv_targets) = 'array' THEN p_csv_targets
    ELSE '[]'::jsonb
  END;
  v_crm_defaults jsonb := CASE
    WHEN p_crm_defaults IS NOT NULL AND jsonb_typeof(p_crm_defaults) = 'object' THEN p_crm_defaults
    ELSE '{}'::jsonb
  END;
  v_origem_id uuid := NULLIF(btrim(COALESCE(v_crm_defaults ->> 'origem_id', '')), '')::uuid;
  v_status_id uuid := NULLIF(btrim(COALESCE(v_crm_defaults ->> 'status_id', '')), '')::uuid;
  v_tipo_contratacao_id uuid := NULLIF(btrim(COALESCE(v_crm_defaults ->> 'tipo_contratacao_id', '')), '')::uuid;
  v_responsavel_id uuid := NULLIF(btrim(COALESCE(v_crm_defaults ->> 'responsavel_id', '')), '')::uuid;
  v_auth_role text := auth.role();
  v_input_rows integer := 0;
  v_invalid_phone_rows integer := 0;
  v_duplicate_rows integer := 0;
  v_created_leads integer := 0;
  v_unresolved_rows integer := 0;
  v_conflict_rows integer := 0;
  v_inserted_targets integer := 0;
BEGIN
  IF auth.uid() IS NULL AND COALESCE(v_auth_role, '') <> 'service_role' THEN
    RAISE EXCEPTION 'Usuario nao autenticado';
  END IF;

  IF COALESCE(v_auth_role, '') <> 'service_role' AND NOT public.current_user_can_edit_whatsapp() THEN
    RAISE EXCEPTION 'Permissao insuficiente para importar campanhas do WhatsApp';
  END IF;

  SELECT *
  INTO v_campaign
  FROM public.whatsapp_campaigns
  WHERE id = p_campaign_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Campanha nao encontrada';
  END IF;

  IF v_campaign.audience_source <> 'csv' THEN
    RAISE EXCEPTION 'Campanha nao configurada para importacao CSV';
  END IF;

  IF v_campaign.status = 'cancelled' THEN
    RAISE EXCEPTION 'Campanha cancelada';
  END IF;

  IF jsonb_array_length(v_csv_targets) = 0 THEN
    RETURN jsonb_build_object(
      'input_rows', 0,
      'invalid_phone_rows', 0,
      'duplicate_rows', 0,
      'created_leads', 0,
      'unresolved_rows', 0,
      'conflict_rows', 0,
      'inserted_targets', 0
    );
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
      COALESCE((item ->> 'needs_lead_creation')::boolean, true) AS needs_lead_creation
    FROM jsonb_array_elements(v_csv_targets) AS element(item)
  ),
  classified_items AS (
    SELECT
      raw_items.*,
      row_number() OVER (PARTITION BY normalized_phone ORDER BY item_order) AS phone_rank
    FROM raw_items
  ),
  deduped_items AS (
    SELECT *
    FROM classified_items
    WHERE phone_rank = 1
  ),
  matched_items AS (
    SELECT
      deduped_items.*,
      lead_match.id AS matched_lead_id
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
    ) AS lead_match ON deduped_items.normalized_phone <> ''
  ),
  needs_lead_creation AS (
    SELECT COUNT(*)::int AS total
    FROM matched_items
    WHERE normalized_phone <> ''
      AND matched_lead_id IS NULL
      AND needs_lead_creation = true
      AND display_name IS NOT NULL
  )
  SELECT
    (SELECT COUNT(*)::int FROM raw_items),
    (SELECT COUNT(*)::int FROM classified_items WHERE normalized_phone = ''),
    (SELECT COUNT(*)::int FROM classified_items WHERE normalized_phone <> '' AND phone_rank > 1)
  INTO
    v_input_rows,
    v_invalid_phone_rows,
    v_duplicate_rows;

  IF EXISTS (
    WITH raw_items AS (
      SELECT
        row_number() OVER () AS item_order,
        public.normalize_whatsapp_campaign_phone(item ->> 'normalized_phone') AS normalized_phone,
        NULLIF(btrim(COALESCE(item ->> 'display_name', '')), '') AS display_name,
        COALESCE((item ->> 'needs_lead_creation')::boolean, true) AS needs_lead_creation
      FROM jsonb_array_elements(v_csv_targets) AS element(item)
    ),
    deduped_items AS (
      SELECT DISTINCT ON (normalized_phone)
        normalized_phone,
        display_name,
        needs_lead_creation
      FROM raw_items
      WHERE normalized_phone <> ''
      ORDER BY normalized_phone, item_order
    ),
    matched_items AS (
      SELECT
        deduped_items.*,
        lead_match.id AS matched_lead_id
      FROM deduped_items
      LEFT JOIN LATERAL (
        SELECT l.id
        FROM public.leads l
        WHERE public.normalize_whatsapp_campaign_phone(l.telefone) = deduped_items.normalized_phone
        ORDER BY COALESCE(l.updated_at, l.created_at, l.data_criacao) DESC NULLS LAST, l.id DESC
        LIMIT 1
      ) AS lead_match ON true
    )
    SELECT 1
    FROM matched_items
    WHERE matched_lead_id IS NULL
      AND needs_lead_creation = true
      AND display_name IS NOT NULL
      AND (
        v_origem_id IS NULL
        OR v_status_id IS NULL
        OR v_tipo_contratacao_id IS NULL
        OR v_responsavel_id IS NULL
      )
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
      COALESCE((item ->> 'needs_lead_creation')::boolean, true) AS needs_lead_creation
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
  ),
  matched_items AS (
    SELECT
      deduped_items.*,
      lead_match.id AS matched_lead_id
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
  inserted_leads AS (
    INSERT INTO public.leads (
      nome_completo,
      telefone,
      origem_id,
      tipo_contratacao_id,
      status_id,
      responsavel_id,
      data_criacao,
      ultimo_contato,
      canal
    )
    SELECT
      matched_items.display_name,
      public.storage_whatsapp_campaign_phone(matched_items.normalized_phone),
      v_origem_id,
      v_tipo_contratacao_id,
      v_status_id,
      v_responsavel_id,
      now(),
      now(),
      'whatsapp_campaign'
    FROM matched_items
    WHERE matched_items.matched_lead_id IS NULL
      AND matched_items.needs_lead_creation = true
      AND matched_items.display_name IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.leads existing_leads
        WHERE public.normalize_whatsapp_campaign_phone(existing_leads.telefone) = matched_items.normalized_phone
      )
    RETURNING id, public.normalize_whatsapp_campaign_phone(telefone) AS normalized_phone
  ),
  resolved_items AS (
    SELECT
      matched_items.normalized_phone,
      matched_items.raw_phone,
      matched_items.display_name,
      COALESCE(matched_items.chat_id, matched_items.normalized_phone || '@s.whatsapp.net') AS resolved_chat_id,
      matched_items.source_payload,
      COALESCE(matched_items.matched_lead_id, inserted_leads.id, fallback_lead.id) AS lead_id
    FROM matched_items
    LEFT JOIN inserted_leads
      ON inserted_leads.normalized_phone = matched_items.normalized_phone
    LEFT JOIN LATERAL (
      SELECT l.id
      FROM public.leads l
      WHERE public.normalize_whatsapp_campaign_phone(l.telefone) = matched_items.normalized_phone
      ORDER BY COALESCE(l.updated_at, l.created_at, l.data_criacao) DESC NULLS LAST, l.id DESC
      LIMIT 1
    ) AS fallback_lead ON matched_items.matched_lead_id IS NULL AND inserted_leads.id IS NULL
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
    WHERE resolved_items.lead_id IS NOT NULL
    ON CONFLICT (campaign_id, phone) DO NOTHING
    RETURNING id
  )
  SELECT
    COALESCE((SELECT COUNT(*)::int FROM inserted_leads), 0),
    COALESCE((SELECT COUNT(*)::int FROM resolved_items WHERE lead_id IS NULL AND normalized_phone <> ''), 0),
    COALESCE((SELECT COUNT(*)::int FROM resolved_items WHERE lead_id IS NOT NULL), 0) - COALESCE((SELECT COUNT(*)::int FROM inserted_targets), 0),
    COALESCE((SELECT COUNT(*)::int FROM inserted_targets), 0)
  INTO
    v_created_leads,
    v_unresolved_rows,
    v_conflict_rows,
    v_inserted_targets;

  IF v_inserted_targets > 0 THEN
    UPDATE public.whatsapp_campaigns
    SET
      total_targets = COALESCE(total_targets, 0) + v_inserted_targets,
      pending_targets = COALESCE(pending_targets, 0) + v_inserted_targets,
      last_error = NULL
    WHERE id = v_campaign.id;
  END IF;

  RETURN jsonb_build_object(
    'input_rows', v_input_rows,
    'invalid_phone_rows', v_invalid_phone_rows,
    'duplicate_rows', v_duplicate_rows,
    'created_leads', v_created_leads,
    'unresolved_rows', v_unresolved_rows,
    'conflict_rows', v_conflict_rows,
    'inserted_targets', v_inserted_targets
  );
END;
$$;

REVOKE ALL ON FUNCTION public.append_whatsapp_campaign_csv_targets_batch(uuid, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.append_whatsapp_campaign_csv_targets_batch(uuid, jsonb, jsonb) TO authenticated;

ALTER FUNCTION public.append_whatsapp_campaign_csv_targets_batch(uuid, jsonb, jsonb)
  SET statement_timeout = '120s';

DO $$
DECLARE
  function_url text;
  service_role_key text;
  has_label boolean := false;
  has_value boolean := false;
  has_config_key boolean := false;
  has_config_value boolean := false;
BEGIN
  IF to_regclass('cron.job') IS NULL THEN
    RAISE NOTICE 'cron.job table not found, skipping WhatsApp campaign import scheduler setup.';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'net'
      AND p.proname = 'http_post'
  ) THEN
    RAISE NOTICE 'net.http_post not available, skipping WhatsApp campaign import scheduler setup.';
    RETURN;
  END IF;

  BEGIN
    function_url := NULLIF(trim(both '"' FROM COALESCE(current_setting('app.settings.supabase_url', true), '')), '');
  EXCEPTION WHEN OTHERS THEN
    function_url := NULL;
  END;

  BEGIN
    service_role_key := NULLIF(trim(both '"' FROM COALESCE(current_setting('app.settings.supabase_service_role_key', true), '')), '');
  EXCEPTION WHEN OTHERS THEN
    service_role_key := NULL;
  END;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'system_configurations'
      AND column_name = 'label'
  ) INTO has_label;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'system_configurations'
      AND column_name = 'value'
  ) INTO has_value;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'system_configurations'
      AND column_name = 'config_key'
  ) INTO has_config_key;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'system_configurations'
      AND column_name = 'config_value'
  ) INTO has_config_value;

  IF function_url IS NULL AND has_label AND has_value THEN
    SELECT NULLIF(trim(both '"' FROM value), '') INTO function_url
    FROM public.system_configurations
    WHERE label = 'supabase_url'
    LIMIT 1;
  END IF;

  IF service_role_key IS NULL AND has_label AND has_value THEN
    SELECT NULLIF(trim(both '"' FROM value), '') INTO service_role_key
    FROM public.system_configurations
    WHERE label = 'supabase_service_role_key'
    LIMIT 1;
  END IF;

  IF function_url IS NULL AND has_config_key AND has_config_value THEN
    EXECUTE $sql$
      SELECT NULLIF(trim(both '"' FROM config_value::text), '')
      FROM public.system_configurations
      WHERE config_key = 'supabase_url'
      LIMIT 1
    $sql$ INTO function_url;
  END IF;

  IF service_role_key IS NULL AND has_config_key AND has_config_value THEN
    EXECUTE $sql$
      SELECT NULLIF(trim(both '"' FROM config_value::text), '')
      FROM public.system_configurations
      WHERE config_key = 'supabase_service_role_key'
      LIMIT 1
    $sql$ INTO service_role_key;
  END IF;

  IF function_url IS NULL OR service_role_key IS NULL THEN
    RAISE NOTICE 'WhatsApp campaign import scheduler not configured (missing supabase_url or service role key).';
    RETURN;
  END IF;

  function_url := rtrim(function_url, '/') || '/functions/v1/whatsapp-campaign-import';

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-whatsapp-campaign-imports') THEN
    PERFORM cron.unschedule('process-whatsapp-campaign-imports');
  END IF;

  PERFORM cron.schedule(
    'process-whatsapp-campaign-imports',
    '* * * * *',
    format(
      'SELECT net.http_post(url := %L, headers := jsonb_build_object(''Content-Type'', ''application/json'', ''Authorization'', %L), body := jsonb_build_object(''action'', ''process'', ''source'', ''cron''));',
      function_url,
      'Bearer ' || service_role_key
    )
  );
END $$;
