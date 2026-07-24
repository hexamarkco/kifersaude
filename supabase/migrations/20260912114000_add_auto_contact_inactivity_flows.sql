/*
  Inactivity follow-up flows

  A response from the customer must stop queued follow-ups immediately. The
  periodic detector only schedules a flow after at least 24h without any chat
  activity, while the Edge Function performs a second check before scheduling.
*/

CREATE INDEX IF NOT EXISTS idx_comm_whatsapp_messages_chat_direction_message_at
  ON public.comm_whatsapp_messages (chat_id, direction, message_at DESC);

CREATE OR REPLACE FUNCTION public.cancel_auto_contact_jobs_on_inbound_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead_id uuid;
BEGIN
  IF NEW.direction <> 'inbound'
    OR (TG_OP = 'UPDATE' AND OLD.direction = 'inbound')
  THEN
    RETURN NEW;
  END IF;

  SELECT lead_id INTO v_lead_id
  FROM public.comm_whatsapp_chats
  WHERE id = NEW.chat_id;

  IF v_lead_id IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.auto_contact_flow_jobs
  SET status = 'skipped',
      last_error = 'Cliente respondeu; régua automática cancelada',
      updated_at = now()
  WHERE lead_id = v_lead_id
    AND status = 'pending'
    -- Historical syncs must not cancel a flow created after the message occurred.
    AND COALESCE(NEW.message_at, now()) >= created_at;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS cancel_auto_contact_jobs_on_inbound_message
  ON public.comm_whatsapp_messages;

CREATE TRIGGER cancel_auto_contact_jobs_on_inbound_message
  AFTER INSERT OR UPDATE OF direction ON public.comm_whatsapp_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.cancel_auto_contact_jobs_on_inbound_message();

CREATE OR REPLACE FUNCTION public.check_auto_contact_inactivity_triggers()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_supabase_url text;
  v_service_role_key text;
  v_function_url text;
  v_flow jsonb;
  v_lead record;
  v_duration_hours integer;
BEGIN
  SELECT NULLIF(trim(both '"' FROM config_value::text), '')
  INTO v_supabase_url
  FROM public.system_configurations
  WHERE config_key = 'supabase_url'
  LIMIT 1;

  SELECT NULLIF(trim(both '"' FROM config_value::text), '')
  INTO v_service_role_key
  FROM public.system_configurations
  WHERE config_key = 'supabase_service_role_key'
  LIMIT 1;

  IF v_supabase_url IS NULL OR v_service_role_key IS NULL THEN
    RAISE NOTICE 'Inactivity automation check skipped: missing Supabase configuration.';
    RETURN;
  END IF;

  v_function_url := rtrim(v_supabase_url, '/') || '/functions/v1/leads-api?action=check-inactivity-duration';

  FOR v_flow IN
    SELECT flow.value
    FROM public.integration_settings settings
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(settings.settings->'flows', '[]'::jsonb)) AS flow(value)
    WHERE settings.slug = 'whatsapp_auto_contact'
      AND settings.settings->>'enabled' = 'true'
      AND settings.settings->>'autoSend' = 'true'
      AND flow.value->>'triggerType' = 'inactivity_duration'
  LOOP
    v_duration_hours := GREATEST(24, COALESCE(NULLIF(v_flow->>'triggerDurationHours', '')::integer, 24));

    FOR v_lead IN
      WITH chat_activity AS (
        SELECT c.lead_id, MAX(m.message_at) AS last_activity_at
        FROM public.comm_whatsapp_chats c
        INNER JOIN public.comm_whatsapp_messages m ON m.chat_id = c.id
        WHERE c.lead_id IS NOT NULL
        GROUP BY c.lead_id
      ), status_entries AS (
        SELECT lead_id, MAX(created_at) AS status_entered_at
        FROM public.lead_status_history
        GROUP BY lead_id
      ), trigger_statuses AS (
        SELECT ARRAY(
          SELECT jsonb_array_elements_text(COALESCE(v_flow->'triggerStatuses', '[]'::jsonb))
        ) AS values
      )
      SELECT
        l.id,
        COALESCE(a.last_activity_at, h.status_entered_at, l.updated_at, l.created_at) AS inactivity_started_at
      FROM public.leads l
      LEFT JOIN public.lead_status_config status_config ON status_config.id = l.status_id
      LEFT JOIN chat_activity a ON a.lead_id = l.id
      LEFT JOIN status_entries h ON h.lead_id = l.id
      CROSS JOIN trigger_statuses ts
      WHERE l.ativo = true
        AND l.arquivado = false
        AND cardinality(ts.values) > 0
        AND COALESCE(status_config.nome, l.status) = ANY(ts.values)
        AND COALESCE(a.last_activity_at, h.status_entered_at, l.updated_at, l.created_at)
          <= now() - make_interval(hours => v_duration_hours)
        AND NOT EXISTS (
          SELECT 1
          FROM public.auto_contact_flow_jobs j
          WHERE j.lead_id = l.id
            AND j.flow_id = v_flow->>'id'
            AND j.status IN ('pending', 'processing')
        )
    LOOP
      PERFORM net.http_post(
        url := v_function_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_service_role_key
        ),
        body := jsonb_build_object(
          'lead_id', v_lead.id,
          'flow_id', v_flow->>'id',
          'inactivity_started_at', v_lead.inactivity_started_at
        ),
        timeout_milliseconds := 30000
      );
    END LOOP;
  END LOOP;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'check-auto-contact-inactivity-triggers') THEN
    PERFORM cron.unschedule('check-auto-contact-inactivity-triggers');
  END IF;

  PERFORM cron.schedule(
    'check-auto-contact-inactivity-triggers',
    '*/5 * * * *',
    'SELECT public.check_auto_contact_inactivity_triggers();'
  );
END;
$$;
