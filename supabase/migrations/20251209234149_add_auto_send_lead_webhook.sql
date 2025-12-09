/*
  # Add Auto-Send Lead Messages Webhook

  ## Description
  Creates a database trigger that automatically calls the edge function
  to send WhatsApp messages when a new lead is created.

  ## Changes
  1. Creates a trigger function that calls the auto-send edge function
  2. Creates a trigger on leads table for INSERT operations
  3. The trigger will call the edge function asynchronously using pg_net

  ## Notes
  - Requires pg_net extension to be enabled
  - The edge function URL must be configured with SUPABASE_URL
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
  function_url := current_setting('app.settings.supabase_url', true) || '/functions/v1/auto-send-lead-messages';
  service_role_key := current_setting('app.settings.supabase_service_role_key', true);

  IF function_url IS NULL OR service_role_key IS NULL THEN
    RAISE WARNING 'Supabase URL or Service Role Key not configured';
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

  RAISE LOG 'Auto-send lead messages triggered for lead %, request_id: %', NEW.id, request_id;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error triggering auto-send: %', SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_auto_send_on_lead_insert ON leads;
CREATE TRIGGER trigger_auto_send_on_lead_insert
  AFTER INSERT ON leads
  FOR EACH ROW
  EXECUTE FUNCTION trigger_auto_send_lead_messages();

COMMENT ON FUNCTION trigger_auto_send_lead_messages IS 'Automatically triggers the auto-send edge function when a new lead is created';
COMMENT ON TRIGGER trigger_auto_send_on_lead_insert ON leads IS 'Calls auto-send edge function after a new lead is inserted';
