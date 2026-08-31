/*
  # Reduzir latencia do atendimento autonomo

  O cron continua como rede de seguranca a cada minuto, mas o caminho principal
  passa a ser acionado pelo proprio agendamento do webhook: cada inbound cria ou
  reagenda um unico job pendente por chat e chama o worker em segundo plano. O
  worker espera o debounce curto vencer e so processa se nenhuma mensagem nova
  tiver empurrado o scheduled_at.
*/

BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.schedule_ai_autonomous_reply_job(
  p_chat_id uuid,
  p_delay_seconds integer DEFAULT 15
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_status text;
  v_lead_id uuid;
  v_function_url text;
  v_service_role_key text;
  v_has_label boolean := false;
  v_has_value boolean := false;
  v_has_config_key boolean := false;
  v_has_config_value boolean := false;
BEGIN
  SELECT autonomous_attendance_status, lead_id
    INTO v_status, v_lead_id
    FROM public.comm_whatsapp_chats
    WHERE id = p_chat_id;

  IF v_status IS DISTINCT FROM 'active' OR v_lead_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.ai_autonomous_reply_jobs (chat_id, lead_id, scheduled_at)
  VALUES (p_chat_id, v_lead_id, now() + make_interval(secs => GREATEST(p_delay_seconds, 1)))
  ON CONFLICT (chat_id) WHERE status = 'pending'
  DO UPDATE SET scheduled_at = EXCLUDED.scheduled_at, updated_at = now();

  BEGIN
    v_function_url := NULLIF(trim(both '"' FROM COALESCE(current_setting('app.settings.supabase_url', true), '')), '');
  EXCEPTION WHEN OTHERS THEN
    v_function_url := NULL;
  END;

  BEGIN
    v_service_role_key := NULLIF(trim(both '"' FROM COALESCE(current_setting('app.settings.supabase_service_role_key', true), '')), '');
  EXCEPTION WHEN OTHERS THEN
    v_service_role_key := NULL;
  END;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'system_configurations' AND column_name = 'label'
  ) INTO v_has_label;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'system_configurations' AND column_name = 'value'
  ) INTO v_has_value;

  IF v_function_url IS NULL AND v_has_label AND v_has_value THEN
    EXECUTE $sql$
      SELECT NULLIF(trim(both '"' FROM value), '')
      FROM system_configurations
      WHERE label = 'supabase_url'
      LIMIT 1
    $sql$ INTO v_function_url;
  END IF;

  IF v_service_role_key IS NULL AND v_has_label AND v_has_value THEN
    EXECUTE $sql$
      SELECT NULLIF(trim(both '"' FROM value), '')
      FROM system_configurations
      WHERE label = 'supabase_service_role_key'
      LIMIT 1
    $sql$ INTO v_service_role_key;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'system_configurations' AND column_name = 'config_key'
  ) INTO v_has_config_key;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'system_configurations' AND column_name = 'config_value'
  ) INTO v_has_config_value;

  IF v_function_url IS NULL AND v_has_config_key AND v_has_config_value THEN
    EXECUTE $sql$
      SELECT NULLIF(trim(both '"' FROM config_value::text), '')
      FROM system_configurations
      WHERE config_key = 'supabase_url'
      LIMIT 1
    $sql$ INTO v_function_url;
  END IF;

  IF v_service_role_key IS NULL AND v_has_config_key AND v_has_config_value THEN
    EXECUTE $sql$
      SELECT NULLIF(trim(both '"' FROM config_value::text), '')
      FROM system_configurations
      WHERE config_key = 'supabase_service_role_key'
      LIMIT 1
    $sql$ INTO v_service_role_key;
  END IF;

  IF v_function_url IS NULL OR v_service_role_key IS NULL THEN
    RAISE NOTICE 'ai-autonomous-reply-worker immediate invoke not configured (missing settings).';
    RETURN;
  END IF;

  v_function_url := rtrim(v_function_url, '/') || '/functions/v1/ai-autonomous-reply-worker';

  PERFORM net.http_post(
    url := v_function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_role_key
    ),
    body := jsonb_build_object(
      'source', 'webhook_debounce',
      'chatId', p_chat_id,
      'waitUntilDue', true
    ),
    timeout_milliseconds := 120000
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.schedule_ai_autonomous_reply_job(uuid, integer) TO service_role;

COMMIT;
