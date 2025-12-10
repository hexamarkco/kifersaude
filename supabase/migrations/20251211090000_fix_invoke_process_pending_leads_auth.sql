/*
  # Fix process-pending-leads invocation (missing authorization)

  ## Context
  A cron job calls the invoke_process_pending_leads() helper to trigger the
  Edge Function that sends mensagens automáticas aos leads. A versão anterior
  da função passou a montar a URL usando um valor fixo e, em determinados
  momentos, deixou de enviar o cabeçalho Authorization. Como o endpoint de
  Edge Functions exige chave (anon ou service role), a chamada retornava 401 e
  os leads novos não eram abordados automaticamente, mesmo após 1 minuto.

  ## Ajustes
  - Lê a URL do projeto a partir das configurações já existentes
    (app.settings.supabase_url ou supabase.url) e faz fallback para o ISS do
    JWT quando disponível.
  - Busca a service_role_key somente nos secrets gerenciados pelo Supabase
    (SUPABASE_SERVICE_ROLE_KEY) para alinhar com o uso do Deno.env.
  - Sempre envia o cabeçalho Authorization com a service role key.
  - Recria o helper is_service_key_configured() e a view v_system_status para
    refletir a nova lógica de configuração.
*/

-- Utilitário para obter a service role key do Supabase (vault secret)
CREATE OR REPLACE FUNCTION get_supabase_service_role_key()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  key_value TEXT;
BEGIN
  -- Secrets gerenciados pelo Supabase (bolt database)
  key_value := vault.decrypted_secret('SUPABASE_SERVICE_ROLE_KEY');

  RETURN NULLIF(key_value, '');
END;
$$;

-- Helper para identificar se a service key está configurada
CREATE OR REPLACE FUNCTION is_service_key_configured()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN get_supabase_service_role_key() IS NOT NULL;
END;
$$;

-- Atualiza a função que dispara a Edge Function
CREATE OR REPLACE FUNCTION invoke_process_pending_leads()
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  request_id BIGINT;
  function_url TEXT;
  service_key TEXT;
BEGIN
  -- Recupera URL do projeto (prioriza configurações do banco, depois ISS do JWT)
  function_url := COALESCE(
    current_setting('app.settings.supabase_url', true),
    current_setting('supabase.url', true),
    (current_setting('request.jwt.claims', true)::json->>'iss')
  );

  IF function_url IS NULL OR function_url = '' THEN
    RAISE WARNING 'Supabase URL não configurada. Não foi possível invocar a função.';
    RETURN NULL;
  END IF;

  -- Normaliza suprimindo barra final
  function_url := rtrim(function_url, '/');
  function_url := function_url || '/functions/v1/process-pending-leads';

  -- Recupera service role key (via secrets do Supabase)
  service_key := get_supabase_service_role_key();
  IF service_key IS NULL THEN
    RAISE WARNING 'Service role key não configurada. Não foi possível invocar a função.';
    RETURN NULL;
  END IF;

  -- Dispara a Edge Function com autenticação
  SELECT net.http_post(
    url := function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  ) INTO request_id;

  RETURN request_id;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Erro ao invocar process-pending-leads: %', SQLERRM;
    RETURN NULL;
END;
$$;

-- Atualiza view de status para usar a nova verificação
CREATE OR REPLACE VIEW v_system_status AS
SELECT
  is_service_key_configured() as service_key_configured,
  (SELECT COUNT(*) FROM cron.job WHERE jobname = 'process-pending-leads-every-minute' AND active = true) > 0 as cron_active,
  (SELECT is_running FROM lead_processing_cursor WHERE id = 1) as processor_running,
  (SELECT last_processed_at FROM lead_processing_cursor WHERE id = 1) as last_run,
  (SELECT total_processed FROM lead_processing_cursor WHERE id = 1) as total_processed,
  (SELECT reset_count FROM lead_processing_cursor WHERE id = 1) as cycle_count,
  (SELECT last_error FROM lead_processing_cursor WHERE id = 1) as last_error,
  (SELECT COUNT(*) FROM leads
   WHERE status = 'Novo'
   AND telefone IS NOT NULL
   AND telefone != ''
   AND auto_message_sent_at IS NULL
   AND (auto_message_attempts IS NULL OR auto_message_attempts < 3)
  ) as pending_leads,
  CASE
    WHEN NOT is_service_key_configured() THEN 'Service key not configured'
    WHEN (SELECT COUNT(*) FROM cron.job WHERE jobname = 'process-pending-leads-every-minute' AND active = true) = 0 THEN 'Cron job not active'
    ELSE 'System active - processing every minute'
  END as status_message;

COMMENT ON FUNCTION invoke_process_pending_leads() IS
  'Invoca a edge function de processamento de leads com autenticação via service role key.';

COMMENT ON FUNCTION get_supabase_service_role_key() IS
  'Obtém a service role key armazenada como secret do Supabase (SUPABASE_SERVICE_ROLE_KEY).';

COMMENT ON FUNCTION is_service_key_configured() IS
  'Indica se a service role key está disponível para o agendador automático de leads.';

COMMENT ON VIEW v_system_status IS
  'Status do agendador automático (cron) e configuração de credenciais.';
