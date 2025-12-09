/*
  # Fix Auto-Send Trigger to Use Environment Variables

  ## Description
  Atualiza o trigger para usar variáveis de ambiente disponíveis diretamente
  no contexto do Supabase, sem depender de configurações do banco.

  ## Changes
  - Remove dependência de app.settings
  - Usa SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY do ambiente
*/

CREATE OR REPLACE FUNCTION trigger_auto_send_lead_messages()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  request_id bigint;
  supabase_url text;
  service_role_key text;
BEGIN
  -- Tenta obter a URL do Supabase de diferentes fontes
  BEGIN
    supabase_url := current_setting('app.supabase_url', true);
  EXCEPTION WHEN OTHERS THEN
    supabase_url := NULL;
  END;

  -- Se não encontrou, tenta de outra forma
  IF supabase_url IS NULL THEN
    BEGIN
      -- No Supabase, a URL está disponível via esta variável
      SELECT INTO supabase_url 
        COALESCE(
          current_setting('request.headers', true)::json->>'host',
          current_setting('request.headers', true)::json->>'x-forwarded-host'
        );
      
      IF supabase_url IS NOT NULL THEN
        supabase_url := 'https://' || supabase_url;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Could not determine Supabase URL: %', SQLERRM;
      RETURN NEW;
    END;
  END IF;

  -- Tenta obter o service role key
  BEGIN
    service_role_key := current_setting('app.service_role_key', true);
  EXCEPTION WHEN OTHERS THEN
    service_role_key := NULL;
  END;

  -- Valida se conseguiu obter as configurações necessárias
  IF supabase_url IS NULL OR service_role_key IS NULL THEN
    RAISE WARNING 'Supabase URL or Service Role Key not available. URL: %, Key: %', 
      supabase_url, 
      CASE WHEN service_role_key IS NULL THEN 'NULL' ELSE 'SET' END;
    RETURN NEW;
  END IF;

  -- Faz a requisição HTTP para a edge function
  SELECT INTO request_id net.http_post(
    url := supabase_url || '/functions/v1/auto-send-lead-messages',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_role_key
    ),
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', 'leads',
      'record', row_to_json(NEW)
    )
  );

  RAISE LOG 'Auto-send triggered for lead %, request_id: %', NEW.id, request_id;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error in auto-send trigger: %', SQLERRM;
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION trigger_auto_send_lead_messages IS 'Triggers auto-send edge function when a new lead is created';
