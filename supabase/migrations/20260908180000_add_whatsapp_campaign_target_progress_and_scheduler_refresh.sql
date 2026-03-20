/*
  # Harden WhatsApp campaign processing

  Adds per-target step checkpoints and processing leases so the worker can
  resume partially sent flows without replaying successful steps, recover
  stale processing rows, and refresh the scheduler job configuration.
*/

DO $$
BEGIN
  IF to_regclass('public.whatsapp_campaign_targets') IS NULL THEN
    RAISE NOTICE 'public.whatsapp_campaign_targets not found, skipping campaign hardening migration.';
    RETURN;
  END IF;

  ALTER TABLE public.whatsapp_campaign_targets
    ADD COLUMN IF NOT EXISTS processing_started_at timestamptz,
    ADD COLUMN IF NOT EXISTS processing_expires_at timestamptz,
    ADD COLUMN IF NOT EXISTS last_completed_step_index integer DEFAULT -1,
    ADD COLUMN IF NOT EXISTS last_completed_step_id text,
    ADD COLUMN IF NOT EXISTS last_sent_step_at timestamptz;

  UPDATE public.whatsapp_campaign_targets
  SET
    last_completed_step_index = COALESCE(last_completed_step_index, -1),
    last_completed_step_id = NULLIF(btrim(COALESCE(last_completed_step_id, '')), ''),
    last_sent_step_at = COALESCE(last_sent_step_at, sent_at),
    processing_started_at = CASE
      WHEN status = 'processing' THEN COALESCE(processing_started_at, last_attempt_at, updated_at, created_at)
      ELSE NULL
    END,
    processing_expires_at = CASE
      WHEN status = 'processing' THEN COALESCE(processing_expires_at, now() - interval '1 minute')
      ELSE NULL
    END;

  ALTER TABLE public.whatsapp_campaign_targets
    ALTER COLUMN last_completed_step_index SET NOT NULL,
    ALTER COLUMN last_completed_step_index SET DEFAULT -1;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'whatsapp_campaign_targets_step_index_check'
      AND conrelid = 'public.whatsapp_campaign_targets'::regclass
  ) THEN
    ALTER TABLE public.whatsapp_campaign_targets
      DROP CONSTRAINT whatsapp_campaign_targets_step_index_check;
  END IF;

  ALTER TABLE public.whatsapp_campaign_targets
    ADD CONSTRAINT whatsapp_campaign_targets_step_index_check
    CHECK (last_completed_step_index >= -1);
END $$;

CREATE INDEX IF NOT EXISTS idx_whatsapp_campaign_targets_processing_queue
  ON public.whatsapp_campaign_targets (status, processing_expires_at, created_at)
  WHERE status IN ('pending', 'processing');

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
    RAISE NOTICE 'cron.job table not found, skipping WhatsApp campaign scheduler refresh.';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'net'
      AND p.proname = 'http_post'
  ) THEN
    RAISE NOTICE 'net.http_post not available, skipping WhatsApp campaign scheduler refresh.';
    RETURN;
  END IF;

  BEGIN
    function_url := current_setting('app.settings.supabase_url', true);
  EXCEPTION WHEN OTHERS THEN
    function_url := NULL;
  END;

  BEGIN
    service_role_key := current_setting('app.settings.supabase_service_role_key', true);
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
    SELECT value INTO function_url
    FROM public.system_configurations
    WHERE label = 'supabase_url'
    LIMIT 1;
  END IF;

  IF service_role_key IS NULL AND has_label AND has_value THEN
    SELECT value INTO service_role_key
    FROM public.system_configurations
    WHERE label = 'supabase_service_role_key'
    LIMIT 1;
  END IF;

  IF function_url IS NULL AND has_config_key AND has_config_value THEN
    EXECUTE $sql$
      SELECT config_value
      FROM public.system_configurations
      WHERE config_key = 'supabase_url'
      LIMIT 1
    $sql$ INTO function_url;
  END IF;

  IF service_role_key IS NULL AND has_config_key AND has_config_value THEN
    EXECUTE $sql$
      SELECT config_value
      FROM public.system_configurations
      WHERE config_key = 'supabase_service_role_key'
      LIMIT 1
    $sql$ INTO service_role_key;
  END IF;

  IF function_url IS NULL OR service_role_key IS NULL THEN
    RAISE NOTICE 'WhatsApp campaign scheduler refresh skipped (missing supabase_url or service role key).';
    RETURN;
  END IF;

  function_url := rtrim(function_url, '/') || '/functions/v1/whatsapp-broadcast';

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-whatsapp-broadcast-campaigns') THEN
    PERFORM cron.unschedule('process-whatsapp-broadcast-campaigns');
  END IF;

  PERFORM cron.schedule(
    'process-whatsapp-broadcast-campaigns',
    '* * * * *',
    format(
      'SELECT net.http_post(url := %L, headers := jsonb_build_object(''Content-Type'', ''application/json'', ''Authorization'', %L), body := jsonb_build_object(''action'', ''process'', ''source'', ''cron''));',
      function_url,
      'Bearer ' || service_role_key
    )
  );
END $$;
