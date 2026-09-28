BEGIN;

-- The inactivity scanner only needs the latest visible message for each chat.
-- Keeping that predicate in the index prevents every cron run from evaluating
-- the preview helper over the full message history.
CREATE INDEX IF NOT EXISTS idx_comm_whatsapp_messages_chat_latest_visible
  ON public.comm_whatsapp_messages (chat_id, message_at DESC, id DESC)
  WHERE public.comm_whatsapp_message_preview_text(media_caption, text_content, message_type) IS NOT NULL;

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
  v_activated_at timestamptz;
  v_lead_count integer;
  v_flow_count integer := 0;
  v_total_leads integer := 0;
  v_cutover_at timestamptz;
BEGIN
  BEGIN
    BEGIN
      v_supabase_url := NULLIF(trim(both '"' FROM COALESCE(current_setting('app.settings.supabase_url', true), '')), '');
    EXCEPTION WHEN OTHERS THEN
      v_supabase_url := NULL;
    END;
    IF v_supabase_url IS NULL THEN
      SELECT NULLIF(trim(both '"' FROM config_value::text), '')
      INTO v_supabase_url
      FROM public.system_configurations
      WHERE config_key = 'supabase_url'
      LIMIT 1;
    END IF;

    BEGIN
      v_service_role_key := NULLIF(trim(both '"' FROM COALESCE(current_setting('app.settings.supabase_service_role_key', true), '')), '');
    EXCEPTION WHEN OTHERS THEN
      v_service_role_key := NULL;
    END;
    IF v_service_role_key IS NULL THEN
      SELECT NULLIF(trim(both '"' FROM config_value::text), '')
      INTO v_service_role_key
      FROM public.system_configurations
      WHERE config_key = 'supabase_service_role_key'
      LIMIT 1;
    END IF;

    IF v_supabase_url IS NULL OR v_service_role_key IS NULL THEN
      RAISE EXCEPTION 'Supabase configuration missing (app.settings GUC and system_configurations)';
    END IF;

    v_function_url := rtrim(v_supabase_url, '/') || '/functions/v1/leads-api?action=check-inactivity-duration';

    SELECT NULLIF(trim(both '"' FROM config_value::text), '')::timestamptz
    INTO v_cutover_at
    FROM public.system_configurations
    WHERE config_key = 'inactivity_enrollment_cutover_at'
    LIMIT 1;

    FOR v_flow IN
      SELECT flow.value
      FROM public.integration_settings settings
      CROSS JOIN LATERAL jsonb_array_elements(COALESCE(settings.settings->'flows', '[]'::jsonb)) AS flow(value)
      WHERE settings.slug = 'whatsapp_auto_contact'
        AND settings.settings->>'enabled' = 'true'
        AND settings.settings->>'autoSend' = 'true'
        AND flow.value->>'triggerType' = 'inactivity_duration'
        AND COALESCE(flow.value->>'ativo', 'true') != 'false'
    LOOP
      v_flow_count := v_flow_count + 1;

      BEGIN
        v_activated_at := NULLIF(v_flow->>'triggerActivatedAt', '')::timestamptz;
      EXCEPTION WHEN invalid_datetime_format THEN
        v_activated_at := NULL;
      END;

      IF v_activated_at IS NULL THEN
        CONTINUE;
      END IF;

      v_duration_hours := GREATEST(1, COALESCE(NULLIF(v_flow->>'triggerDurationHours', '')::integer, 24));
      v_lead_count := 0;

      FOR v_lead IN
        SELECT
          l.id,
          latest.last_message_at AS inactivity_started_at,
          latest.last_message_id AS outbound_msg_id
        FROM public.leads l
        LEFT JOIN public.lead_status_config status_config ON status_config.id = l.status_id
        CROSS JOIN (
          SELECT ARRAY(
            SELECT jsonb_array_elements_text(COALESCE(v_flow->'triggerStatuses', '[]'::jsonb))
          ) AS values
        ) ts
        JOIN LATERAL (
          SELECT
            c.lead_id,
            latest_message.direction AS last_direction,
            latest_message.message_at AS last_message_at,
            latest_message.id AS last_message_id,
            latest_message.source AS last_message_source,
            latest_message.metadata AS last_message_metadata
          FROM public.comm_whatsapp_chats c
          JOIN LATERAL (
            SELECT
              m.direction,
              m.message_at,
              m.id,
              m.source,
              m.metadata
            FROM public.comm_whatsapp_messages m
            WHERE m.chat_id = c.id
              AND public.comm_whatsapp_message_preview_text(m.media_caption, m.text_content, m.message_type) IS NOT NULL
            ORDER BY m.message_at DESC, m.id DESC
            LIMIT 1
          ) latest_message ON true
          WHERE c.lead_id = l.id
          ORDER BY latest_message.message_at DESC, latest_message.id DESC
          LIMIT 1
        ) latest ON true
        WHERE cardinality(ts.values) > 0
          AND NOT COALESCE(l.skip_automation, false)
          AND COALESCE(status_config.nome, l.status) = ANY(ts.values)
          AND latest.last_direction = 'outbound'
          AND latest.last_message_at IS NOT NULL
          AND latest.last_message_at <= now() - make_interval(hours => v_duration_hours)
          AND NOT public.auto_contact_message_is_same_flow_output(
            l.id,
            v_flow->>'id',
            latest.last_message_source,
            latest.last_message_metadata,
            latest.last_message_at
          )
          AND NOT EXISTS (
            SELECT 1
            FROM public.auto_contact_flow_jobs job
            WHERE job.lead_id = l.id
              AND job.flow_id = v_flow->>'id'
              AND job.status IN ('pending', 'processing')
          )
          AND NOT EXISTS (
            SELECT 1
            FROM public.auto_contact_flow_jobs skipped_job
            WHERE skipped_job.lead_id = l.id
              AND skipped_job.status = 'skipped'
              AND skipped_job.last_error LIKE 'invalid_number%'
              AND skipped_job.updated_at > now() - interval '30 days'
          )
          AND (v_cutover_at IS NULL OR latest.last_message_at >= v_cutover_at)
        ORDER BY l.created_at DESC
        LIMIT 20
      LOOP
        IF v_lead_count >= 20 THEN
          EXIT;
        END IF;

        PERFORM net.http_post(
          url := v_function_url,
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_service_role_key
          ),
          body := jsonb_build_object(
            'lead_id', v_lead.id,
            'flow_id', v_flow->>'id',
            'inactivity_started_at', v_lead.inactivity_started_at,
            'trigger_message_id', v_lead.outbound_msg_id
          ),
          timeout_milliseconds := 10000
        );

        v_lead_count := v_lead_count + 1;
        v_total_leads := v_total_leads + 1;
      END LOOP;
    END LOOP;

    INSERT INTO public.automation_run_log (function_name, status, details)
    VALUES (
      'check_auto_contact_inactivity_triggers',
      'ok',
      jsonb_build_object(
        'flows_scanned', v_flow_count,
        'leads_dispatched', v_total_leads,
        'cap_per_tick', 20
      )
    );
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.automation_run_log (function_name, status, error, details)
    VALUES (
      'check_auto_contact_inactivity_triggers',
      'error',
      SQLERRM,
      jsonb_build_object('flows_scanned', v_flow_count, 'leads_dispatched', v_total_leads)
    );
    RAISE;
  END;
END;
$$;

REVOKE ALL ON FUNCTION public.check_auto_contact_inactivity_triggers() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_auto_contact_inactivity_triggers() TO service_role;

COMMIT;
