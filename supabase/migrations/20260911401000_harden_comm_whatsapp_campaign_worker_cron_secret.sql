/*
  # Harden WhatsApp campaign worker cron secret handling

  Keeps the service role key out of cron.job.command by resolving it at runtime
  inside a SECURITY DEFINER helper.
*/

CREATE OR REPLACE FUNCTION public.invoke_comm_whatsapp_campaign_worker()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, net
AS $$
DECLARE
  function_url text;
  service_role_key text;
  request_id bigint;
BEGIN
  function_url := NULLIF(trim(both '"' FROM COALESCE(current_setting('app.settings.supabase_url', true), '')), '');
  service_role_key := NULLIF(trim(both '"' FROM COALESCE(current_setting('app.settings.supabase_service_role_key', true), '')), '');

  IF function_url IS NULL THEN
    SELECT NULLIF(trim(both '"' FROM COALESCE(value, '')), '') INTO function_url
    FROM public.system_configurations
    WHERE label = 'supabase_url'
    LIMIT 1;
  END IF;

  IF service_role_key IS NULL THEN
    SELECT NULLIF(trim(both '"' FROM COALESCE(value, '')), '') INTO service_role_key
    FROM public.system_configurations
    WHERE label = 'supabase_service_role_key'
    LIMIT 1;
  END IF;

  IF function_url IS NULL THEN
    EXECUTE $sql$
      SELECT NULLIF(trim(both '"' FROM config_value::text), '')
      FROM public.system_configurations
      WHERE config_key = 'supabase_url'
      LIMIT 1
    $sql$ INTO function_url;
  END IF;

  IF service_role_key IS NULL THEN
    EXECUTE $sql$
      SELECT NULLIF(trim(both '"' FROM config_value::text), '')
      FROM public.system_configurations
      WHERE config_key = 'supabase_service_role_key'
      LIMIT 1
    $sql$ INTO service_role_key;
  END IF;

  IF function_url IS NULL OR service_role_key IS NULL THEN
    RAISE NOTICE 'WhatsApp campaign worker cron skipped: missing Supabase URL or service role key.';
    RETURN NULL;
  END IF;

  SELECT net.http_post(
    url := rtrim(function_url, '/') || '/functions/v1/comm-whatsapp-campaign-worker',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_role_key
    ),
    body := jsonb_build_object('action', 'process', 'source', 'cron', 'limit', 25)
  ) INTO request_id;

  RETURN request_id;
END;
$$;

REVOKE ALL ON FUNCTION public.invoke_comm_whatsapp_campaign_worker() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.invoke_comm_whatsapp_campaign_worker() TO postgres, service_role;

DO $$
BEGIN
  IF to_regclass('cron.job') IS NULL THEN
    RAISE NOTICE 'cron.job table not found, skipping WhatsApp campaign worker scheduler hardening.';
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-comm-whatsapp-campaign-worker') THEN
    PERFORM cron.unschedule('process-comm-whatsapp-campaign-worker');
  END IF;

  PERFORM cron.schedule(
    'process-comm-whatsapp-campaign-worker',
    '* * * * *',
    'SELECT public.invoke_comm_whatsapp_campaign_worker();'
  );
END $$;
