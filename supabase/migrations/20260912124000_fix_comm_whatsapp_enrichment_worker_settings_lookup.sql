BEGIN;

CREATE OR REPLACE FUNCTION public.invoke_comm_whatsapp_enrichment_worker()
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
    SELECT NULLIF(trim(both '"' FROM COALESCE(config_value::text, '')), '')
    INTO function_url
    FROM public.system_configurations
    WHERE config_key = 'supabase_url'
    LIMIT 1;
  END IF;

  IF service_role_key IS NULL THEN
    SELECT NULLIF(trim(both '"' FROM COALESCE(config_value::text, '')), '')
    INTO service_role_key
    FROM public.system_configurations
    WHERE config_key = 'supabase_service_role_key'
    LIMIT 1;
  END IF;

  IF function_url IS NULL OR service_role_key IS NULL THEN
    RAISE NOTICE 'WhatsApp enrichment worker skipped: missing Supabase URL or service role key.';
    RETURN NULL;
  END IF;

  SELECT net.http_post(
    url := rtrim(function_url, '/') || '/functions/v1/comm-whatsapp-enrichment-worker',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_role_key
    ),
    body := jsonb_build_object('limit', 25)
  ) INTO request_id;

  RETURN request_id;
END;
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
