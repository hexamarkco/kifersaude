/*
  # Auto-contact flow jobs

  Schedules flow steps to run asynchronously with pg_cron.
*/

CREATE TABLE IF NOT EXISTS auto_contact_flow_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  flow_id text NOT NULL,
  step_id text NOT NULL,
  action_type text NOT NULL,
  message_source text,
  template_id text,
  custom_message jsonb,
  status_to_set text,
  scheduled_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auto_contact_flow_jobs_due
  ON auto_contact_flow_jobs (status, scheduled_at);

CREATE INDEX IF NOT EXISTS idx_auto_contact_flow_jobs_lead
  ON auto_contact_flow_jobs (lead_id, flow_id);

ALTER TABLE auto_contact_flow_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage auto contact jobs"
  ON auto_contact_flow_jobs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION update_auto_contact_flow_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_auto_contact_flow_jobs_updated_at ON auto_contact_flow_jobs;
CREATE TRIGGER trigger_update_auto_contact_flow_jobs_updated_at
  BEFORE UPDATE ON auto_contact_flow_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_auto_contact_flow_jobs_updated_at();

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
  END IF;
END $$;

DO $$
DECLARE
  function_url text;
  service_role_key text;
BEGIN
  SELECT 
    (config_value->>'supabase_url')::text,
    (config_value->>'supabase_service_role_key')::text
  INTO function_url, service_role_key
  FROM (
    SELECT jsonb_object_agg(config_key, config_value) as config_value
    FROM system_configurations
    WHERE config_key IN ('supabase_url', 'supabase_service_role_key')
  ) configs;

  IF function_url IS NOT NULL THEN
    function_url := function_url || '/functions/v1/leads-api?action=process-flow-jobs';
  END IF;

  IF function_url IS NULL OR service_role_key IS NULL THEN
    RAISE NOTICE 'Auto contact flow jobs cron not configured (missing system_configurations).';
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-auto-contact-flow-jobs') THEN
    PERFORM cron.unschedule('process-auto-contact-flow-jobs');
  END IF;

  PERFORM cron.schedule(
    'process-auto-contact-flow-jobs',
    '* * * * *',
    format(
      'SELECT net.http_post(url := %L, headers := jsonb_build_object(''Content-Type'', ''application/json'', ''Authorization'', ''Bearer %s''), body := jsonb_build_object(''source'', ''cron''));',
      function_url,
      service_role_key
    )
  );
END $$;
