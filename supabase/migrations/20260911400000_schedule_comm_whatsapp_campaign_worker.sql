/*
  # Schedule WhatsApp campaign worker

  Calls the comm-whatsapp-campaign-worker Edge Function every minute so queued
  campaigns do not depend on a manual "Processar lote" action in the UI.
*/

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
    RAISE NOTICE 'cron.job table not found, skipping WhatsApp campaign worker scheduler setup.';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'net'
      AND p.proname = 'http_post'
  ) THEN
    RAISE NOTICE 'net.http_post not available, skipping WhatsApp campaign worker scheduler setup.';
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
    RAISE NOTICE 'WhatsApp campaign worker scheduler not configured (missing supabase_url or service role key).';
    RETURN;
  END IF;

  function_url := rtrim(function_url, '/') || '/functions/v1/comm-whatsapp-campaign-worker';

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-comm-whatsapp-campaign-worker') THEN
    PERFORM cron.unschedule('process-comm-whatsapp-campaign-worker');
  END IF;

  PERFORM cron.schedule(
    'process-comm-whatsapp-campaign-worker',
    '* * * * *',
    format(
      'SELECT net.http_post(url := %L, headers := jsonb_build_object(''Content-Type'', ''application/json'', ''Authorization'', %L), body := jsonb_build_object(''action'', ''process'', ''source'', ''cron'', ''limit'', 25));',
      function_url,
      'Bearer ' || service_role_key
    )
  );
END $$;
