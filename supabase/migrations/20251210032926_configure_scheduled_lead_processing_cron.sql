/*
  # Configure Scheduled Lead Processing Cron Job

  ## Overview
  This migration configures a pg_cron job that automatically runs every minute
  to process pending leads. The job calls the process-pending-leads Edge Function.

  ## Cron Job Details
  - Name: process-pending-leads-every-minute
  - Schedule: '* * * * *' (every minute)
  - Action: Calls the process-pending-leads Edge Function
  - Authentication: Uses service role key for full access

  ## How It Works
  1. pg_cron extension triggers the job every minute
  2. Job makes HTTP POST request to the Edge Function
  3. Edge Function processes batch of leads (50 by default)
  4. Cursor tracks progress for next execution
  5. System runs 24/7 independent of user sessions

  ## Benefits
  - Completely server-side (no client needed)
  - Automatic retry on failure
  - Scalable (3000+ leads/hour)
  - Self-healing (lock timeout prevents deadlocks)
  - Continuous processing (cursor resets when done)

  ## Monitoring
  - Check v_lead_processing_dashboard view for status
  - View lead_processing_cursor table for cursor position
  - Check Edge Function logs for detailed execution info

  ## Notes
  - Requires pg_cron extension (enabled by default in Supabase)
  - Uses pg_net extension for HTTP requests
  - Service role key is automatically available in database
*/

-- Enable required extensions if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Get the Supabase project URL (will be available in database settings)
-- Note: The URL will be in format https://PROJECT_REF.supabase.co

-- First, remove any existing cron job with the same name to avoid duplicates
SELECT cron.unschedule('process-pending-leads-every-minute')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'process-pending-leads-every-minute'
);

-- Create the cron job to run every minute
-- The job will call the Edge Function using the service role key
SELECT cron.schedule(
  'process-pending-leads-every-minute',
  '* * * * *',
  $$
  SELECT
    net.http_post(
      url := current_setting('app.supabase_url', true) || '/functions/v1/process-pending-leads',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key', true)
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 30000
    ) as request_id;
  $$
);

-- Create a table to store the Supabase URL and service key if not exists
-- This is needed because pg_cron needs access to these values
CREATE TABLE IF NOT EXISTS _system_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on system config
ALTER TABLE _system_config ENABLE ROW LEVEL SECURITY;

-- Only service role can access system config
CREATE POLICY "Service role full access to system config"
  ON _system_config
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Admin users can view (but not modify) for debugging
CREATE POLICY "Admin users can view system config"
  ON _system_config
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- Note: The actual URL and service key will need to be set by the application
-- or manually by an admin. This can be done via:
-- INSERT INTO _system_config (key, value) VALUES ('supabase_url', 'https://YOUR_PROJECT.supabase.co')
-- INSERT INTO _system_config (key, value) VALUES ('supabase_service_role_key', 'YOUR_SERVICE_KEY')
-- ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Create a view to check cron job status
CREATE OR REPLACE VIEW v_cron_jobs AS
SELECT
  jobid,
  jobname,
  schedule,
  command,
  active,
  database
FROM cron.job
WHERE jobname LIKE '%lead%'
ORDER BY jobname;

-- Grant access to cron.job_run_details for monitoring
-- This allows checking execution history
CREATE OR REPLACE VIEW v_cron_job_runs AS
SELECT
  j.jobname,
  r.runid,
  r.job_pid,
  r.database,
  r.username,
  r.command,
  r.status,
  r.return_message,
  r.start_time,
  r.end_time
FROM cron.job j
LEFT JOIN cron.job_run_details r ON j.jobid = r.jobid
WHERE j.jobname = 'process-pending-leads-every-minute'
ORDER BY r.start_time DESC
LIMIT 100;

-- Add helpful comments
COMMENT ON TABLE _system_config IS 
  'System configuration values needed for cron jobs and automated processes';

COMMENT ON VIEW v_cron_jobs IS 
  'Shows all active cron jobs related to lead processing';

COMMENT ON VIEW v_cron_job_runs IS 
  'Shows execution history for the lead processing cron job (last 100 runs)';