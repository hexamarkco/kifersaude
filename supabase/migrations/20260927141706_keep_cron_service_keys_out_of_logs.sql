BEGIN;

-- Do not interpolate the service-role key into a pg_cron command. PostgreSQL
-- logs the command text, so the previous cron setup made the credential
-- visible in postgres_logs. These wrappers resolve the key only while the
-- request is being sent and keep the cron command itself credential-free.
CREATE OR REPLACE FUNCTION public.comm_whatsapp_invoke_auto_contact_flow_jobs()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request_id bigint;
  v_supabase_url text;
  v_service_role_key text;
BEGIN
  v_supabase_url := NULLIF(
    trim(both '"' FROM COALESCE(current_setting('app.settings.supabase_url', true), '')),
    ''
  );
  IF v_supabase_url IS NULL THEN
    SELECT NULLIF(trim(both '"' FROM config_value::text), '')
    INTO v_supabase_url
    FROM public.system_configurations
    WHERE config_key = 'supabase_url'
    LIMIT 1;
  END IF;
  IF v_supabase_url IS NULL THEN
    v_supabase_url := NULLIF(current_setting('supabase.url', true), '');
  END IF;

  v_service_role_key := NULLIF(
    trim(both '"' FROM COALESCE(current_setting('app.settings.supabase_service_role_key', true), '')),
    ''
  );
  IF v_service_role_key IS NULL THEN
    SELECT NULLIF(trim(both '"' FROM config_value::text), '')
    INTO v_service_role_key
    FROM public.system_configurations
    WHERE config_key = 'supabase_service_role_key'
    LIMIT 1;
  END IF;

  IF v_supabase_url IS NULL OR v_service_role_key IS NULL THEN
    RAISE WARNING 'Configuração do worker de automação não encontrada.';
    RETURN NULL;
  END IF;

  SELECT net.http_post(
    url := rtrim(v_supabase_url, '/') || '/functions/v1/leads-api?action=process-flow-jobs',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_role_key
    ),
    body := jsonb_build_object('source', 'cron'),
    timeout_milliseconds := 30000
  )
  INTO v_request_id;

  RETURN v_request_id;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Falha ao invocar worker de automação: %', SQLERRM;
    RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.comm_whatsapp_invoke_ai_autonomous_reply_jobs()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request_id bigint;
  v_supabase_url text;
  v_service_role_key text;
BEGIN
  v_supabase_url := NULLIF(
    trim(both '"' FROM COALESCE(current_setting('app.settings.supabase_url', true), '')),
    ''
  );
  IF v_supabase_url IS NULL THEN
    SELECT NULLIF(trim(both '"' FROM config_value::text), '')
    INTO v_supabase_url
    FROM public.system_configurations
    WHERE config_key = 'supabase_url'
    LIMIT 1;
  END IF;
  IF v_supabase_url IS NULL THEN
    v_supabase_url := NULLIF(current_setting('supabase.url', true), '');
  END IF;

  v_service_role_key := NULLIF(
    trim(both '"' FROM COALESCE(current_setting('app.settings.supabase_service_role_key', true), '')),
    ''
  );
  IF v_service_role_key IS NULL THEN
    SELECT NULLIF(trim(both '"' FROM config_value::text), '')
    INTO v_service_role_key
    FROM public.system_configurations
    WHERE config_key = 'supabase_service_role_key'
    LIMIT 1;
  END IF;

  IF v_supabase_url IS NULL OR v_service_role_key IS NULL THEN
    RAISE WARNING 'Configuração do worker de respostas autônomas não encontrada.';
    RETURN NULL;
  END IF;

  SELECT net.http_post(
    url := rtrim(v_supabase_url, '/') || '/functions/v1/ai-autonomous-reply-worker',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_role_key
    ),
    body := jsonb_build_object('source', 'cron'),
    timeout_milliseconds := 30000
  )
  INTO v_request_id;

  RETURN v_request_id;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Falha ao invocar worker de respostas autônomas: %', SQLERRM;
    RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_invoke_auto_contact_flow_jobs() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.comm_whatsapp_invoke_ai_autonomous_reply_jobs() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_invoke_auto_contact_flow_jobs() TO service_role;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_invoke_ai_autonomous_reply_jobs() TO service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-auto-contact-flow-jobs') THEN
    PERFORM cron.unschedule('process-auto-contact-flow-jobs');
  END IF;
  PERFORM cron.schedule(
    'process-auto-contact-flow-jobs',
    '* * * * *',
    'SELECT public.comm_whatsapp_invoke_auto_contact_flow_jobs();'
  );

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-ai-autonomous-reply-jobs') THEN
    PERFORM cron.unschedule('process-ai-autonomous-reply-jobs');
  END IF;
  PERFORM cron.schedule(
    'process-ai-autonomous-reply-jobs',
    '* * * * *',
    'SELECT public.comm_whatsapp_invoke_ai_autonomous_reply_jobs();'
  );
END;
$$;

COMMIT;
