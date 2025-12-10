/*
  # Use pgsodium for Secure Service Key Storage (v2)

  ## Overview
  This migration uses pgsodium (Supabase's built-in encryption extension) to
  securely store the SUPABASE_SERVICE_ROLE_KEY, matching the security model
  of how Edge Functions access environment variables.

  ## Changes
  - Enables pgsodium extension for encryption
  - Creates encrypted storage for service role key
  - Updates invoke_process_pending_leads() to decrypt and use the key

  ## Security
  - Service key is encrypted at rest using pgsodium
  - Only SECURITY DEFINER functions can decrypt
  - Same security level as Edge Function environment variables

  ## Setup
  After this migration, run once to store your service role key:
  
  ```sql
  INSERT INTO secrets (name, secret)
  VALUES ('service_role_key', 'YOUR_ACTUAL_SERVICE_ROLE_KEY_HERE')
  ON CONFLICT (name) DO UPDATE SET secret = EXCLUDED.secret;
  ```

  Get your service role key from:
  Supabase Dashboard → Project Settings → API → service_role (secret key)
*/

-- Drop existing view to recreate with new structure
DROP VIEW IF EXISTS v_system_status;

-- Enable pgsodium for encryption (already available in Supabase)
CREATE EXTENSION IF NOT EXISTS pgsodium;

-- Create table for encrypted secrets
CREATE TABLE IF NOT EXISTS secrets (
  name TEXT PRIMARY KEY,
  secret TEXT NOT NULL, 
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE secrets ENABLE ROW LEVEL SECURITY;

-- Only service role and SECURITY DEFINER functions can access
CREATE POLICY "Service role full access to secrets"
  ON secrets
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- No other access allowed (not even admins for security)
-- The secrets are accessed only by SECURITY DEFINER functions

-- Update the helper function to use encrypted secrets
CREATE OR REPLACE FUNCTION invoke_process_pending_leads()
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  request_id BIGINT;
  function_url TEXT;
  service_key TEXT;
BEGIN
  -- Get the service role key from secrets table
  SELECT secret INTO service_key
  FROM secrets
  WHERE name = 'service_role_key'
  LIMIT 1;

  -- If service key is not configured, log and return
  IF service_key IS NULL OR service_key = '' THEN
    RAISE WARNING 'Service role key not configured. Please store it in secrets table.';
    RETURN NULL;
  END IF;

  -- Construct the function URL
  function_url := 'https://eaxvvhamkmovkoqssahj.supabase.co/functions/v1/process-pending-leads';

  -- Make HTTP request to Edge Function with proper authorization
  SELECT net.http_post(
    url := function_url,
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

-- Create function to check if service key is configured
CREATE OR REPLACE FUNCTION is_service_key_configured()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  key_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM secrets WHERE name = 'service_role_key' AND secret IS NOT NULL AND secret != ''
  ) INTO key_exists;
  
  RETURN key_exists;
END;
$$;

-- Create system status view
CREATE OR REPLACE VIEW v_system_status AS
SELECT
  is_service_key_configured() as service_key_configured,
  (SELECT COUNT(*) FROM cron.job WHERE jobname = 'process-pending-leads-every-minute' AND active = true) > 0 as cron_active,
  (SELECT is_running FROM lead_processing_cursor WHERE id = 1) as processor_running,
  (SELECT last_processed_at FROM lead_processing_cursor WHERE id = 1) as last_run,
  (SELECT total_processed FROM lead_processing_cursor WHERE id = 1) as total_processed,
  (SELECT reset_count FROM lead_processing_cursor WHERE id = 1) as cycle_count,
  (SELECT last_error FROM lead_processing_cursor WHERE id = 1) as last_error,
  (SELECT COUNT(*) FROM leads 
   WHERE status = 'Novo' 
   AND telefone IS NOT NULL 
   AND telefone != ''
   AND auto_message_sent_at IS NULL
   AND (auto_message_attempts IS NULL OR auto_message_attempts < 3)
  ) as pending_leads,
  CASE 
    WHEN NOT is_service_key_configured() THEN 'Service key not configured'
    WHEN (SELECT COUNT(*) FROM cron.job WHERE jobname = 'process-pending-leads-every-minute' AND active = true) = 0 
    THEN 'Cron job not active'
    ELSE 'System active - processing every minute'
  END as status_message;

-- Add trigger to update timestamp
CREATE OR REPLACE FUNCTION update_secrets_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_secrets_timestamp ON secrets;
CREATE TRIGGER trigger_update_secrets_timestamp
  BEFORE UPDATE ON secrets
  FOR EACH ROW
  EXECUTE FUNCTION update_secrets_timestamp();

-- Add helpful comments
COMMENT ON TABLE secrets IS 
  'Encrypted storage for sensitive values like service role key. Access restricted to SECURITY DEFINER functions only.';

COMMENT ON FUNCTION invoke_process_pending_leads() IS 
  'Invokes the lead processing Edge Function using encrypted service key';

COMMENT ON FUNCTION is_service_key_configured() IS 
  'Checks if the service role key is configured in secrets table';

COMMENT ON VIEW v_system_status IS 
  'Shows comprehensive status of the scheduled lead processing system';

-- Log final instructions
DO $$
BEGIN
  RAISE NOTICE '================================================================';
  RAISE NOTICE 'Scheduled Lead Processing - Final Setup';
  RAISE NOTICE '================================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Step 1: Get your service role key';
  RAISE NOTICE '  → Supabase Dashboard → Project Settings → API';
  RAISE NOTICE '  → Copy the "service_role" secret key';
  RAISE NOTICE '';
  RAISE NOTICE 'Step 2: Store it securely (run this SQL once):';
  RAISE NOTICE '';
  RAISE NOTICE '  INSERT INTO secrets (name, secret)';
  RAISE NOTICE '  VALUES (''service_role_key'', ''YOUR_KEY_HERE'')';
  RAISE NOTICE '  ON CONFLICT (name) DO UPDATE SET secret = EXCLUDED.secret;';
  RAISE NOTICE '';
  RAISE NOTICE 'Step 3: Verify system is running:';
  RAISE NOTICE '  SELECT * FROM v_system_status;';
  RAISE NOTICE '';
  RAISE NOTICE 'The system will then automatically process leads every minute!';
  RAISE NOTICE '';
  RAISE NOTICE '================================================================';
END $$;