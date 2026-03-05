/*
  # Cleanup legacy edge functions

  - Unschedules pg_cron jobs that still call removed legacy functions
  - Reconfirms lead auto-contact trigger to call `leads-api`
*/

DO $$
DECLARE
  legacy_job record;
BEGIN
  IF to_regclass('cron.job') IS NULL THEN
    RAISE NOTICE 'cron.job not found, skipping legacy edge function cleanup.';
  ELSE
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-pending-leads-every-minute') THEN
      PERFORM cron.unschedule('process-pending-leads-every-minute');
      RAISE NOTICE 'Unscheduled process-pending-leads-every-minute.';
    END IF;

    FOR legacy_job IN
      SELECT jobid, jobname
      FROM cron.job
      WHERE command ILIKE '%/functions/v1/process-pending-leads%'
         OR command ILIKE '%/functions/v1/auto-send-lead-messages%'
    LOOP
      PERFORM cron.unschedule(legacy_job.jobid);
      RAISE NOTICE 'Unscheduled legacy cron job id=%, name=%', legacy_job.jobid, legacy_job.jobname;
    END LOOP;
  END IF;
END $$;

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
  is_status_change := (OLD IS NOT NULL AND OLD.status IS DISTINCT FROM NEW.status);

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
    SELECT jsonb_object_agg(config_key, config_value) AS config_value
    FROM system_configurations
    WHERE config_key IN ('supabase_url', 'supabase_service_role_key')
  ) configs;

  IF function_url IS NOT NULL THEN
    function_url := function_url || '/functions/v1/leads-api?action=auto-contact';
  END IF;

  RAISE LOG 'Auto-contact trigger: URL=%, has_key=%, event=%',
    function_url,
    (service_role_key IS NOT NULL),
    event_type;

  IF function_url IS NULL OR service_role_key IS NULL THEN
    RAISE WARNING 'Configuracoes do Supabase nao encontradas em system_configurations.';
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

  RAISE LOG 'Auto-contact trigger dispatched for lead %, request_id: %, event: %', NEW.id, request_id, event_type;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Erro ao disparar automacao no leads-api: %', SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_auto_send_on_lead_insert ON leads;
DROP TRIGGER IF EXISTS trigger_auto_send_on_lead_change ON leads;

CREATE TRIGGER trigger_auto_send_on_lead_change
  AFTER INSERT OR UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION trigger_auto_send_lead_messages();
