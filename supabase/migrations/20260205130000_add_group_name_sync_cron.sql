/*
  # Sync WhatsApp group names

  - Schedule periodic sync for group chat names
*/

DO $$
DECLARE
  function_url text;
  service_role_key text;
BEGIN
  SELECT
    (config_value->>'supabase_url')::text,
    (config_value->>'supabase_service_role_key')::text
  INTO function_url, service_role_key
  FROM (
    SELECT jsonb_object_agg(config_key, config_value) as config_value
    FROM system_configurations
    WHERE config_key IN ('supabase_url', 'supabase_service_role_key')
  ) configs;

  IF function_url IS NOT NULL THEN
    function_url := function_url || '/functions/v1/whatsapp-sync-group-names';
  END IF;

  IF function_url IS NULL OR service_role_key IS NULL THEN
    RAISE NOTICE 'WhatsApp group name cron not configured (missing system_configurations).';
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-whatsapp-group-names') THEN
    PERFORM cron.unschedule('sync-whatsapp-group-names');
  END IF;

  PERFORM cron.schedule(
    'sync-whatsapp-group-names',
    '0 */6 * * *',
    format(
      'SELECT net.http_post(url := %L, headers := jsonb_build_object(''Content-Type'', ''application/json'', ''Authorization'', ''Bearer %s''), body := jsonb_build_object(''source'', ''cron''));',
      function_url,
      service_role_key
    )
  );
END $$;
