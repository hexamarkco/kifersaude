/*
  # Configure System Configuration Values

  ## Overview
  This migration populates the _system_config table with the required values
  for the scheduled lead processing system to work.

  ## Configuration Values
  - `supabase_url` - The Supabase project URL
  - `supabase_service_role_key` - The Supabase service role key (needs to be set manually)

  ## Setup Instructions
  After this migration runs, you need to manually set the service role key:
  
  1. Get your service role key from the Supabase dashboard:
     - Go to Project Settings > API
     - Copy the "service_role" key (secret key)
  
  2. Run this SQL command with your actual key:
     ```sql
     INSERT INTO _system_config (key, value) 
     VALUES ('supabase_service_role_key', 'YOUR_SERVICE_ROLE_KEY_HERE')
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
     ```

  ## Security Note
  - The service role key should NEVER be exposed in client-side code
  - It should only be stored in the database (which is server-side)
  - The _system_config table has RLS enabled and is only accessible to service role and admins

  ## Verification
  After configuration, verify the system is working:
  ```sql
  SELECT * FROM v_lead_processing_dashboard;
  SELECT * FROM v_cron_jobs;
  SELECT * FROM v_cron_job_runs ORDER BY start_time DESC LIMIT 5;
  ```
*/

-- Insert the Supabase URL (this is public information, not a secret)
INSERT INTO _system_config (key, value) 
VALUES ('supabase_url', 'https://eaxvvhamkmovkoqssahj.supabase.co')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

-- Note: The service role key MUST be configured manually for security reasons
-- Do NOT commit the service role key to version control

-- Create a helper function to check if system is configured
CREATE OR REPLACE FUNCTION is_system_configured()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  supabase_url_set BOOLEAN;
  service_key_set BOOLEAN;
  cron_active BOOLEAN;
  result JSONB;
BEGIN
  -- Check if supabase_url is set
  SELECT EXISTS (
    SELECT 1 FROM _system_config WHERE key = 'supabase_url' AND value IS NOT NULL AND value != ''
  ) INTO supabase_url_set;

  -- Check if service_role_key is set
  SELECT EXISTS (
    SELECT 1 FROM _system_config WHERE key = 'supabase_service_role_key' AND value IS NOT NULL AND value != ''
  ) INTO service_key_set;

  -- Check if cron job is active
  SELECT EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'process-pending-leads-every-minute' AND active = true
  ) INTO cron_active;

  result := jsonb_build_object(
    'supabase_url_configured', supabase_url_set,
    'service_key_configured', service_key_set,
    'cron_job_active', cron_active,
    'fully_configured', supabase_url_set AND service_key_set AND cron_active,
    'message', CASE
      WHEN NOT supabase_url_set THEN 'Supabase URL not configured'
      WHEN NOT service_key_set THEN 'Service role key not configured'
      WHEN NOT cron_active THEN 'Cron job not active'
      ELSE 'System fully configured and ready'
    END
  );

  RETURN result;
END;
$$;

-- Create a view to show configuration status (safe - doesn't expose keys)
CREATE OR REPLACE VIEW v_system_config_status AS
SELECT
  (SELECT COUNT(*) FROM _system_config WHERE key = 'supabase_url') > 0 as url_configured,
  (SELECT COUNT(*) FROM _system_config WHERE key = 'supabase_service_role_key') > 0 as key_configured,
  (SELECT COUNT(*) FROM cron.job WHERE jobname = 'process-pending-leads-every-minute' AND active = true) > 0 as cron_active,
  (SELECT is_running FROM lead_processing_cursor WHERE id = 1) as processor_running,
  (SELECT last_processed_at FROM lead_processing_cursor WHERE id = 1) as last_run,
  (SELECT COUNT(*) FROM leads WHERE status = 'Novo' AND telefone IS NOT NULL AND auto_message_sent_at IS NULL) as pending_leads;

-- Add helpful comments
COMMENT ON FUNCTION is_system_configured() IS 
  'Checks if the scheduled lead processing system is fully configured and ready to run';

COMMENT ON VIEW v_system_config_status IS 
  'Shows configuration status of the scheduled lead processing system without exposing secrets';

-- Log instructions
DO $$
BEGIN
  RAISE NOTICE '================================================================';
  RAISE NOTICE 'Scheduled Lead Processing System - Configuration Status';
  RAISE NOTICE '================================================================';
  RAISE NOTICE '';
  RAISE NOTICE '✓ Supabase URL configured: https://eaxvvhamkmovkoqssahj.supabase.co';
  RAISE NOTICE '✗ Service Role Key: NOT YET CONFIGURED';
  RAISE NOTICE '';
  RAISE NOTICE 'To complete setup, run the following SQL with your actual service role key:';
  RAISE NOTICE '';
  RAISE NOTICE 'INSERT INTO _system_config (key, value)';
  RAISE NOTICE 'VALUES (''supabase_service_role_key'', ''YOUR_SERVICE_ROLE_KEY_HERE'')';
  RAISE NOTICE 'ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;';
  RAISE NOTICE '';
  RAISE NOTICE 'To check configuration status, run:';
  RAISE NOTICE 'SELECT is_system_configured();';
  RAISE NOTICE '';
  RAISE NOTICE '================================================================';
END $$;