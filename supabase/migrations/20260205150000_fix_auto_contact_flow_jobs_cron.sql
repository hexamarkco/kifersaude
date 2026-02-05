/*
  # Fix auto contact flow jobs cron

  - Reschedules cron using app.settings.* fallback
*/

DO $$
DECLARE
  function_url text;
  service_role_key text;
  has_config_key boolean := false;
  has_config_value boolean := false;
BEGIN
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

  IF function_url IS NULL THEN
    SELECT value INTO function_url
    FROM system_configurations
    WHERE label = 'supabase_url'
    LIMIT 1;
  END IF;

  IF service_role_key IS NULL THEN
    SELECT value INTO service_role_key
    FROM system_configurations
    WHERE label = 'supabase_service_role_key'
    LIMIT 1;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'system_configurations' AND column_name = 'config_key'
  ) INTO has_config_key;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'system_configurations' AND column_name = 'config_value'
  ) INTO has_config_value;

  IF function_url IS NULL AND has_config_key AND has_config_value THEN
    EXECUTE $sql$
      SELECT config_value
      FROM system_configurations
      WHERE config_key = 'supabase_url'
      LIMIT 1
    $sql$ INTO function_url;
  END IF;

  IF service_role_key IS NULL AND has_config_key AND has_config_value THEN
    EXECUTE $sql$
      SELECT config_value
      FROM system_configurations
      WHERE config_key = 'supabase_service_role_key'
      LIMIT 1
    $sql$ INTO service_role_key;
  END IF;

  IF function_url IS NOT NULL THEN
    function_url := function_url || '/functions/v1/leads-api?action=process-flow-jobs';
  END IF;

  IF function_url IS NULL OR service_role_key IS NULL THEN
    RAISE NOTICE 'Auto contact flow jobs cron not configured (missing settings).';
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-auto-contact-flow-jobs') THEN
    PERFORM cron.unschedule('process-auto-contact-flow-jobs');
  END IF;

  PERFORM cron.schedule(
    'process-auto-contact-flow-jobs',
    '* * * * *',
    format(
      'SELECT net.http_post(url := %L, headers := jsonb_build_object(''Content-Type'', ''application/json'', ''Authorization'', ''Bearer %s''), body := jsonb_build_object(''source'', ''cron''));',
      function_url,
      service_role_key
    )
  );
END $$;
