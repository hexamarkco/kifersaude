/*
  # Add Cron Helper Function for Lead Processing

  ## Overview
  This migration creates a helper function that the pg_cron job can call.
  The function handles calling the Edge Function with proper configuration.

  ## New Functions
  
  ### `invoke_process_pending_leads()`
  - Called by pg_cron every minute
  - Reads Supabase URL and service key from _system_config
  - Makes HTTP request to process-pending-leads Edge Function
  - Returns request ID for tracking

  ## Setup Instructions
  After running this migration, you need to configure the system:
  
  1. Insert Supabase URL and service role key:
     ```sql
     INSERT INTO _system_config (key, value) 
     VALUES 
       ('supabase_url', 'https://YOUR_PROJECT_REF.supabase.co'),
       ('supabase_service_role_key', 'YOUR_SERVICE_ROLE_KEY')
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
     ```

  2. Verify cron job is active:
     ```sql
     SELECT * FROM v_cron_jobs;
     ```

  3. Monitor execution:
     ```sql
     SELECT * FROM v_lead_processing_dashboard;
     SELECT * FROM v_cron_job_runs;
     ```

  ## Notes
  - Function uses pg_net extension for HTTP requests
  - Timeout is set to 30 seconds per execution
  - Errors are logged in cron.job_run_details
*/

-- Create helper function to invoke the Edge Function
CREATE OR REPLACE FUNCTION invoke_process_pending_leads()
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  supabase_url TEXT;
  service_key TEXT;
  request_id BIGINT;
BEGIN
  -- Get configuration values
  SELECT value INTO supabase_url
  FROM _system_config
  WHERE key = 'supabase_url';

  SELECT value INTO service_key
  FROM _system_config
  WHERE key = 'supabase_service_role_key';

  -- Check if configuration is set
  IF supabase_url IS NULL OR service_key IS NULL THEN
    RAISE NOTICE 'System configuration not set. Please configure supabase_url and supabase_service_role_key in _system_config table.';
    RETURN NULL;
  END IF;

  -- Make HTTP request to Edge Function
  SELECT net.http_post(
    url := supabase_url || '/functions/v1/process-pending-leads',
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
    RAISE WARNING 'Error invoking process-pending-leads: %', SQLERRM;
    RETURN NULL;
END;
$$;

-- Update the cron job to use the helper function
SELECT cron.unschedule('process-pending-leads-every-minute')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'process-pending-leads-every-minute'
);

SELECT cron.schedule(
  'process-pending-leads-every-minute',
  '* * * * *',
  $$SELECT invoke_process_pending_leads();$$
);

-- Create a function to manually trigger processing (for testing)
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
  'Helper function called by pg_cron to invoke the lead processing Edge Function';

COMMENT ON FUNCTION trigger_lead_processing_now() IS 
  'Manually trigger lead processing (admin only). Useful for testing and debugging.';