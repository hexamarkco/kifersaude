/*
  # Fix Trigger Configuration Reading v2
  
  1. Problem
    - Previous migration had incorrect JSON path access
    - config_value already contains the value, not nested
    - Need to use CASCADE to drop function
  
  2. Solution
    - Fix the SELECT query to properly extract values
    - Use CASCADE when dropping function
*/

-- Drop function with CASCADE to also drop trigger
DROP FUNCTION IF EXISTS trigger_auto_send_lead_messages() CASCADE;

-- Create function with correct logic
CREATE OR REPLACE FUNCTION trigger_auto_send_lead_messages()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  function_url text;
  service_role_key text;
  request_id bigint;
  supabase_url text;
BEGIN
  -- Get supabase URL from system_configurations
  SELECT (config_value #>> '{}')::text
  INTO supabase_url
  FROM system_configurations
  WHERE config_key = 'supabase_url';

  -- Get service role key from system_configurations
  SELECT (config_value #>> '{}')::text
  INTO service_role_key
  FROM system_configurations
  WHERE config_key = 'supabase_service_role_key';

  -- Build full function URL
  IF supabase_url IS NOT NULL THEN
    function_url := supabase_url || '/functions/v1/auto-send-lead-messages';
  END IF;

  -- Log what we got
  RAISE LOG 'Auto-send trigger: URL=%, has_key=%', function_url, (service_role_key IS NOT NULL AND service_role_key != 'PLACEHOLDER_SERVICE_KEY');

  IF function_url IS NULL OR service_role_key IS NULL OR service_role_key = 'PLACEHOLDER_SERVICE_KEY' THEN
    RAISE WARNING 'Configurações do Supabase não encontradas. Acesse Configurações > Sistema para configurar.';
    RETURN NEW;
  END IF;

  -- Make HTTP request to edge function
  SELECT INTO request_id net.http_post(
    url := function_url,
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

  RAISE LOG 'Auto-send trigger disparado para lead %, request_id: %', NEW.id, request_id;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Erro ao disparar envio automático: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Recreate trigger
CREATE TRIGGER trigger_auto_send_on_lead_insert
  AFTER INSERT ON leads
  FOR EACH ROW
  EXECUTE FUNCTION trigger_auto_send_lead_messages();
