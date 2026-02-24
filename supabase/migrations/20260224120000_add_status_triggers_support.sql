-- Migration: Add status trigger support for auto contact flows
-- This migration adds support for:
-- 1. status_changed trigger - fires when lead status changes
-- 2. status_duration trigger - fires when lead is in status for X hours

-- 1. Add new columns to auto_contact_flows table
ALTER TABLE auto_contact_flows 
ADD COLUMN IF NOT EXISTS trigger_type text DEFAULT 'lead_created',
ADD COLUMN IF NOT EXISTS trigger_statuses text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS trigger_duration_hours integer DEFAULT 24;

-- 2. Create table to track executed flows (prevent duplicates)
CREATE TABLE IF NOT EXISTS auto_contact_flow_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  flow_id uuid NOT NULL,
  executed_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(lead_id, flow_id)
);

CREATE INDEX IF NOT EXISTS idx_auto_contact_flow_executions_lead ON auto_contact_flow_executions(lead_id);
CREATE INDEX IF NOT EXISTS idx_auto_contact_flow_executions_flow ON auto_contact_flow_executions(flow_id);

-- 2. Update trigger function to detect status changes
CREATE OR REPLACE FUNCTION trigger_auto_send_lead_messages()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  function_url text;
  service_role_key text;
  request_id bigint;
  event_type text;
  is_status_change boolean;
BEGIN
  -- Detect if status changed
  is_status_change := (OLD IS NOT NULL AND OLD.status IS DISTINCT FROM NEW.status);
  
  -- Determine event type
  IF TG_OP = 'INSERT' THEN
    event_type := 'lead_created';
  ELSIF is_status_change THEN
    event_type := 'status_changed';
  ELSE
    event_type := 'update';
  END IF;

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
    function_url := function_url || '/functions/v1/leads-api?action=auto-contact';
  END IF;

  RAISE LOG 'Auto-contact%, has_key=%, event=% trigger: URL=', function_url, (service_role_key IS NOT NULL), event_type;

  IF function_url IS NULL OR service_role_key IS NULL THEN
    RAISE WARNING 'Configurações do Supabase não encontradas em system_configurations. Configure supabase_url e supabase_service_role_key.';
    RETURN NEW;
  END IF;

  SELECT INTO request_id net.http_post(
    url := function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_role_key
    ),
    body := jsonb_build_object(
      'type', event_type,
      'table', 'leads',
      'record', row_to_json(NEW),
      'old_record', CASE WHEN TG_OP = 'UPDATE' THEN row_to_json(OLD) ELSE NULL END,
      'is_status_change', is_status_change
    )
  );

  RAISE LOG 'Auto-contact trigger disparado para lead %, request_id: %, event: %', NEW.id, request_id, event_type;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Erro ao dispara automação no leads-api: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- 3. Create function to check status duration triggers (runs periodically via cron)
CREATE OR REPLACE FUNCTION check_status_duration_triggers()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  flow_record RECORD;
  lead_record RECORD;
  hours_since_change numeric;
  config_value JSONB;
  service_role_key text;
  function_url text;
  request_id bigint;
BEGIN
  -- Get config
  SELECT config_value INTO config_value
  FROM system_configurations
  WHERE config_key = 'supabase_service_role_key'
  LIMIT 1;
  
  service_role_key := config_value->>'supabase_service_role_key';
  
  SELECT (config_value->>'supabase_url')::text INTO function_url
  FROM system_configurations
  WHERE config_key = 'supabase_url'
  LIMIT 1;
  
  IF function_url IS NULL OR service_role_key IS NULL THEN
    RAISE WARNING 'Configurações não encontradas para status duration triggers';
    RETURN;
  END IF;

  function_url := function_url || '/functions/v1/leads-api?action=check-status-duration';

  -- Loop through flows with status_duration trigger
  FOR flow_record IN
    SELECT id, name, trigger_statuses, trigger_duration_hours
    FROM auto_contact_flows
    WHERE trigger_type = 'status_duration'
      AND ativo = true
  LOOP
    -- Find leads that have been in trigger statuses for longer than trigger_duration_hours
    -- and haven't executed this flow yet
    FOR lead_record IN
      SELECT 
        l.id,
        l.status,
        MAX(lesh.created_at) as last_status_change
      FROM leads l
      INNER JOIN lead_status_history lesh ON lesh.lead_id = l.id
      WHERE l.status = ANY(flow_record.trigger_statuses)
        AND l.ativo = true
        AND l.arquivado = false
        AND NOT EXISTS (
          SELECT 1 FROM auto_contact_flow_executions 
          WHERE lead_id = l.id AND flow_id = flow_record.id
        )
      GROUP BY l.id, l.status
      HAVING MAX(lesh.created_at) < NOW() - (flow_record.trigger_duration_hours || ' hours')::interval
    LOOP
      -- Execute the flow for this lead
      PERFORM net.http_post(
        url := function_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || service_role_key
        ),
        body := jsonb_build_object(
          'lead_id', lead_record.id,
          'flow_id', flow_record.id
        )
      );
      
      RAISE LOG 'Status duration trigger: scheduling flow % for lead %', flow_record.id, lead_record.id;
    END LOOP;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION check_status_duration_triggers() IS 'Verifica leads que estão há tempo suficiente em certos status e executa os fluxos correspondientes';

-- 4. Add cron job to check status duration every 5 minutes
DO $$
DECLARE
  config_value JSONB;
  supabase_url text;
  service_role_key text;
  cron_schedule text;
BEGIN
  SELECT config_value INTO config_value
  FROM system_configurations
  WHERE config_key = 'supabase_service_role_key'
  LIMIT 1;
  
  service_role_key := config_value->>'supabase_service_role_key';
  
  SELECT (config_value->>'supabase_url')::text INTO supabase_url
  FROM system_configurations
  WHERE config_key = 'supabase_url'
  LIMIT 1;
  
  IF supabase_url IS NULL OR service_role_key IS NULL THEN
    RAISE NOTICE 'Status duration cron not configured (missing system_configurations).';
    RETURN;
  END IF;

  -- Remove existing job if exists
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'check-status-duration-triggers') THEN
    PERFORM cron.unschedule('check-status-duration-triggers');
  END IF;

  -- Schedule to run every 5 minutes
  PERFORM cron.schedule(
    'check-status-duration-triggers',
    '*/5 * * * *',
    format('SELECT check_status_duration_triggers()')
  );
  
  RAISE NOTICE 'Status duration triggers cron scheduled: check-status-duration-triggers';
END
$$;
