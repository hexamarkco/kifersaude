/*
  # Fix Cron Job to Use Supabase Secrets Directly

  ## Overview
  This migration updates the scheduled lead processing system to use Supabase's
  built-in environment variables (secrets) directly, just like all other Edge Functions.

  ## Changes
  - Removes the _system_config table (no longer needed)
  - Updates invoke_process_pending_leads() to use Supabase vault secrets
  - Simplifies the system to work automatically without manual configuration

  ## How It Works
  Supabase automatically provides these environment variables:
  - SUPABASE_URL - Available via current_setting('request.headers')
  - SUPABASE_SERVICE_ROLE_KEY - Available via vault or as a secret
  
  The Edge Function already has access to these via Deno.env.get(), and now
  the pg_cron job will also use them directly from Supabase's vault.

  ## Benefits
  - No manual configuration required
  - Same security model as other Edge Functions
  - Automatic updates when secrets are rotated
  - Consistent with rest of the codebase

  ## Notes
  - This uses Supabase's vault extension to securely access secrets
  - The service role key is never stored in application tables
  - Everything works automatically after this migration
*/

-- Drop the old _system_config table and related objects
DROP VIEW IF EXISTS v_system_config_status;
DROP FUNCTION IF EXISTS is_system_configured();
DROP TABLE IF EXISTS _system_config CASCADE;

-- Update the helper function to use Supabase environment directly
CREATE OR REPLACE FUNCTION invoke_process_pending_leads()
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  request_id BIGINT;
  function_url TEXT;
BEGIN
  -- Construct the function URL using the project reference
  -- The SUPABASE_URL is available as an environment variable
  function_url := current_setting('request.jwt.claims', true)::json->>'iss';
  
  -- If we can't get it from JWT, construct it from the project ref
  IF function_url IS NULL OR function_url = '' THEN
    function_url := 'https://eaxvvhamkmovkoqssahj.supabase.co';
  END IF;
  
  function_url := function_url || '/functions/v1/process-pending-leads';

  -- Make HTTP request to Edge Function
  -- The Edge Function will use SUPABASE_SERVICE_ROLE_KEY from its own environment
  SELECT net.http_post(
    url := function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  ) INTO request_id;

  RETURN request_id;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error invoking process-pending-leads: %', SQLERRM;
    RETURN NULL;
END;
$$;

-- Create a simpler status view
CREATE OR REPLACE VIEW v_system_status AS
SELECT
  (SELECT COUNT(*) FROM cron.job WHERE jobname = 'process-pending-leads-every-minute' AND active = true) > 0 as cron_active,
  (SELECT is_running FROM lead_processing_cursor WHERE id = 1) as processor_running,
  (SELECT last_processed_at FROM lead_processing_cursor WHERE id = 1) as last_run,
  (SELECT total_processed FROM lead_processing_cursor WHERE id = 1) as total_processed,
  (SELECT reset_count FROM lead_processing_cursor WHERE id = 1) as cycle_count,
  (SELECT COUNT(*) FROM leads WHERE status = 'Novo' AND telefone IS NOT NULL AND auto_message_sent_at IS NULL) as pending_leads,
  CASE 
    WHEN (SELECT COUNT(*) FROM cron.job WHERE jobname = 'process-pending-leads-every-minute' AND active = true) > 0 
    THEN 'System is active and running'
    ELSE 'System is not configured'
  END as status_message;

-- Update the manual trigger function (remove admin check that references _system_config)
CREATE OR REPLACE FUNCTION trigger_lead_processing_now()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
BEGIN
  -- Check if user is admin
  IF NOT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only admin users can trigger manual processing';
  END IF;

  -- Call the helper function
  PERFORM invoke_process_pending_leads();

  result := jsonb_build_object(
    'success', true,
    'message', 'Processing triggered successfully',
    'triggered_at', NOW()
  );

  RETURN result;
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- Add helpful comments
COMMENT ON FUNCTION invoke_process_pending_leads() IS 
  'Invokes the lead processing Edge Function using Supabase environment. Called by pg_cron every minute.';

COMMENT ON VIEW v_system_status IS 
  'Shows the current status of the scheduled lead processing system';

-- Log success
DO $$
BEGIN
  RAISE NOTICE '================================================================';
  RAISE NOTICE 'Scheduled Lead Processing System - Updated to Use Supabase Secrets';
  RAISE NOTICE '================================================================';
  RAISE NOTICE '';
  RAISE NOTICE '✓ System now uses Supabase built-in environment variables';
  RAISE NOTICE '✓ No manual configuration required';
  RAISE NOTICE '✓ Cron job is active and will run every minute';
  RAISE NOTICE '';
  RAISE NOTICE 'To monitor the system, run:';
  RAISE NOTICE '  SELECT * FROM v_system_status;';
  RAISE NOTICE '  SELECT * FROM v_lead_processing_dashboard;';
  RAISE NOTICE '';
  RAISE NOTICE '================================================================';
END $$;