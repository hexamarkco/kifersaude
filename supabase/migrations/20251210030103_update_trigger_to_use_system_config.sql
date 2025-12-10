/*
  # Update Trigger to Use System Configurations
  
  1. Problem
    - Current trigger uses current_setting() which returns NULL
    - Environment variables are not accessible in database functions
  
  2. Solution
    - Modify trigger to read from system_configurations table
    - This allows configuration via the UI
  
  3. Changes
    - Replace current_setting() with SELECT from system_configurations
    - Add better error handling and logging
*/

-- Drop existing trigger and function
DROP TRIGGER IF EXISTS trigger_auto_send_on_lead_insert ON leads;
DROP FUNCTION IF EXISTS trigger_auto_send_lead_messages();

-- Create updated function that reads from system_configurations
CREATE OR REPLACE FUNCTION trigger_auto_send_lead_messages()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  function_url text;
  service_role_key text;
  request_id bigint;
BEGIN
  -- Get configuration from system_configurations table
  SELECT 
    (config_value->>'supabase_url')::text,
    (config_value->>'supabase_service_role_key')::text
  INTO function_url, service_role_key
  FROM (
    SELECT jsonb_object_agg(config_key, config_value) as config_value
    FROM system_configurations
    WHERE config_key IN ('supabase_url', 'supabase_service_role_key')
  ) configs;

  -- Build full function URL
  IF function_url IS NOT NULL THEN
    function_url := function_url || '/functions/v1/auto-send-lead-messages';
  END IF;

  -- Log what we got
  RAISE LOG 'Auto-send trigger: URL=%, has_key=%', function_url, (service_role_key IS NOT NULL);

  IF function_url IS NULL OR service_role_key IS NULL THEN
    RAISE WARNING 'Configurações do Supabase não encontradas em system_configurations. Configure supabase_url e supabase_service_role_key.';
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

-- Log success
DO $$
BEGIN
  RAISE NOTICE 'Trigger atualizado com sucesso. Configure as variáveis em system_configurations.';
END $$;
