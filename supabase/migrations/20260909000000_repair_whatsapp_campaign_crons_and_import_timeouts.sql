/*
  # Repair WhatsApp campaign cron config and import timeout

  Recreates the WhatsApp campaign cron jobs using sanitized configuration
  values from system_configurations and raises the CSV append RPC timeout for
  existing environments that were already migrated.
*/

CREATE INDEX IF NOT EXISTS idx_leads_whatsapp_campaign_phone_rank
  ON public.leads (
    public.normalize_whatsapp_campaign_phone(telefone),
    COALESCE(updated_at, created_at, data_criacao) DESC,
    id DESC
  )
  WHERE COALESCE(arquivado, false) = false
    AND NULLIF(btrim(COALESCE(telefone, '')), '') IS NOT NULL;

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
    RAISE NOTICE 'cron.job table not found, skipping WhatsApp campaign cron repair.';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'net'
      AND p.proname = 'http_post'
  ) THEN
    RAISE NOTICE 'net.http_post not available, skipping WhatsApp campaign cron repair.';
    RETURN;
  END IF;

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

  IF has_label AND has_value THEN
    SELECT NULLIF(trim(both '"' FROM value), '') INTO function_url
    FROM public.system_configurations
    WHERE label = 'supabase_url'
    LIMIT 1;
  END IF;

  IF has_label AND has_value THEN
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

  IF function_url IS NULL THEN
    BEGIN
      function_url := NULLIF(trim(both '"' FROM COALESCE(current_setting('app.settings.supabase_url', true), '')), '');
    EXCEPTION WHEN OTHERS THEN
      function_url := NULL;
    END;
  END IF;

  IF service_role_key IS NULL THEN
    BEGIN
      service_role_key := NULLIF(trim(both '"' FROM COALESCE(current_setting('app.settings.supabase_service_role_key', true), '')), '');
    EXCEPTION WHEN OTHERS THEN
      service_role_key := NULL;
    END;
  END IF;

  IF function_url IS NULL OR service_role_key IS NULL THEN
    RAISE NOTICE 'WhatsApp campaign cron repair skipped (missing supabase_url or service role key).';
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-whatsapp-campaign-imports') THEN
    PERFORM cron.unschedule('process-whatsapp-campaign-imports');
  END IF;

  PERFORM cron.schedule(
    'process-whatsapp-campaign-imports',
    '* * * * *',
    format(
      'SELECT net.http_post(url := %L, headers := jsonb_build_object(''Content-Type'', ''application/json'', ''Authorization'', %L), body := jsonb_build_object(''action'', ''process'', ''source'', ''cron''), timeout_milliseconds := 30000);',
      rtrim(function_url, '/') || '/functions/v1/whatsapp-campaign-import',
      'Bearer ' || service_role_key
    )
  );

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-whatsapp-broadcast-campaigns') THEN
    PERFORM cron.unschedule('process-whatsapp-broadcast-campaigns');
  END IF;

  PERFORM cron.schedule(
    'process-whatsapp-broadcast-campaigns',
    '* * * * *',
    format(
      'SELECT net.http_post(url := %L, headers := jsonb_build_object(''Content-Type'', ''application/json'', ''Authorization'', %L), body := jsonb_build_object(''action'', ''process'', ''source'', ''cron''), timeout_milliseconds := 30000);',
      rtrim(function_url, '/') || '/functions/v1/whatsapp-broadcast',
      'Bearer ' || service_role_key
    )
  );
END $$;
