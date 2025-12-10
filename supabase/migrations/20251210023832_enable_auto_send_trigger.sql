/*
  # Enable Auto-Send Trigger for Lead Messages

  ## Description
  Creates a database trigger that automatically calls the auto-send-lead-messages
  edge function when a new lead is created. This allows messages to be sent
  automatically 24/7, even when the user is not logged in.

  ## Changes
  1. Ensures pg_net extension is enabled
  2. Creates trigger function that calls the edge function via HTTP POST
  3. Creates trigger on leads table for INSERT operations
  4. Uses Supabase's built-in environment variables

  ## How it works
  - When a lead is inserted, the trigger fires
  - The trigger makes an HTTP POST to the edge function
  - The edge function checks settings and sends messages if autoSend is enabled
  - The edge function updates the lead status and creates an interaction record

  ## Notes
  - Requires pg_net extension for HTTP requests
  - Uses Supabase's built-in SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
  - Errors are logged but don't prevent lead creation
  - The edge function handles all business logic (settings check, sending, updates)
*/

CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION trigger_auto_send_lead_messages()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  function_url text;
  service_role_key text;
  request_id bigint;
BEGIN
  function_url := current_setting('supabase.url', true) || '/functions/v1/auto-send-lead-messages';
  service_role_key := current_setting('supabase.service_role_key', true);

  IF function_url IS NULL OR service_role_key IS NULL THEN
    RAISE WARNING 'Supabase URL ou Service Role Key não configurada';
    RETURN NEW;
  END IF;

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

  RAISE LOG 'Trigger de envio automático disparado para lead %, request_id: %', NEW.id, request_id;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Erro ao disparar envio automático: %', SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_auto_send_on_lead_insert ON leads;
CREATE TRIGGER trigger_auto_send_on_lead_insert
  AFTER INSERT ON leads
  FOR EACH ROW
  EXECUTE FUNCTION trigger_auto_send_lead_messages();

COMMENT ON FUNCTION trigger_auto_send_lead_messages IS 'Dispara automaticamente a edge function de envio quando um novo lead é criado';
COMMENT ON TRIGGER trigger_auto_send_on_lead_insert ON leads IS 'Chama a edge function auto-send após inserção de novo lead';
