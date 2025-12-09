/*
  # Configure Supabase Settings for Triggers

  ## Description
  Configura as variáveis necessárias para que triggers possam chamar edge functions.
  Define SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY como configurações do banco.

  ## Changes
  - Cria configurações app.settings.supabase_url
  - Cria configurações app.settings.supabase_service_role_key
  - Estas configurações são usadas pelos triggers para chamar edge functions via pg_net
*/

DO $$
DECLARE
  supabase_url text;
  service_role_key text;
BEGIN
  -- Obtém as variáveis de ambiente do Supabase
  supabase_url := current_setting('request.headers', true)::json->>'x-forwarded-host';
  
  -- Se não conseguir pegar do header, usa variável de ambiente padrão
  IF supabase_url IS NULL OR supabase_url = '' THEN
    BEGIN
      supabase_url := current_setting('supabase.url', false);
    EXCEPTION WHEN OTHERS THEN
      supabase_url := NULL;
    END;
  END IF;

  -- Tenta obter service role key de variáveis de ambiente
  BEGIN
    service_role_key := current_setting('supabase.service_role_key', false);
  EXCEPTION WHEN OTHERS THEN
    service_role_key := NULL;
  END;

  -- Define as configurações se existirem
  IF supabase_url IS NOT NULL THEN
    EXECUTE format('ALTER DATABASE %I SET app.settings.supabase_url TO %L', current_database(), 'https://' || supabase_url);
  END IF;

  IF service_role_key IS NOT NULL THEN
    EXECUTE format('ALTER DATABASE %I SET app.settings.supabase_service_role_key TO %L', current_database(), service_role_key);
  END IF;
END $$;
