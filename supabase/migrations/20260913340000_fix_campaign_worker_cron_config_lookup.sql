/*
  # Corrige leitura de config do cron do worker de campanhas

  `invoke_comm_whatsapp_campaign_worker()` (chamada pelo pg_cron a cada
  minuto) tinha um primeiro fallback assumindo o schema antigo de
  system_configurations (colunas `label text` / `value text`, definidas na
  migracao original da tabela). O schema realmente em producao ja divergiu
  disso ha tempos: as colunas de verdade sao `config_key text` /
  `config_value jsonb` - `label` la existe, mas como uma coluna `integer`
  sem relacao com essa, e `value` nem existe.

  Como o Postgres setting (app.settings.supabase_url/service_role_key)
  tambem nao estava configurado, TODA execucao do cron caia nesse primeiro
  fallback e estourava erro (coluna "value" inexistente / comparar integer
  com texto) antes mesmo de chegar no segundo fallback (config_key/
  config_value), que e o correto e ja tinha os valores certos cadastrados.
  Resultado: o cron rodava a cada minuto, sempre falhando silenciosamente
  do ponto de vista do usuario (nenhuma linha nova em
  comm_whatsapp_campaign_worker_runs com source='cron'), e nenhuma campanha
  avancava sozinha - so processava quando alguem clicava "Processar lote"
  manualmente no painel.

  Remove o fallback baseado no schema antigo (label/value) e usa direto
  config_key/config_value, que e o schema real da tabela.
*/

BEGIN;

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
    SELECT NULLIF(trim(both '"' FROM config_value::text), '')
    INTO function_url
    FROM public.system_configurations
    WHERE config_key = 'supabase_url'
    LIMIT 1;
  END IF;

  IF service_role_key IS NULL THEN
    SELECT NULLIF(trim(both '"' FROM config_value::text), '')
    INTO service_role_key
    FROM public.system_configurations
    WHERE config_key = 'supabase_service_role_key'
    LIMIT 1;
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

COMMIT;
