/*
  Optimize automation eligibility queries (fix statement timeout)

  The inactivity eligibility CTE joined the full comm_whatsapp_messages table
  and applied comm_whatsapp_message_preview_text per row, which exceeds the
  statement timeout at 30k+ messages. The chats table maintains
  last_message_at updated only for visible messages (persist_message gates it
  on v_has_visible_summary), so eligibility can use
  MAX(comm_whatsapp_chats.last_message_at) per lead - indexed, fast, and
  semantically equivalent for "last visible activity".

  Rewrites:
  1. check_auto_contact_inactivity_triggers (cron) - same behavior, fast query
  2. automation_flows_health() - fast eligibility count
*/

-- 1. Inactivity detector (optimized eligibility query)
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

    FOR v_flow IN
      SELECT flow.value
      FROM public.integration_settings settings
      CROSS JOIN LATERAL jsonb_array_elements(COALESCE(settings.settings->'flows', '[]'::jsonb)) AS flow(value)
      WHERE settings.slug = 'whatsapp_auto_contact'
        AND settings.settings->>'enabled' = 'true'
        AND settings.settings->>'autoSend' = 'true'
        AND flow.value->>'triggerType' = 'inactivity_duration'
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

      v_duration_hours := GREATEST(24, COALESCE(NULLIF(v_flow->>'triggerDurationHours', '')::integer, 24));
      v_lead_count := 0;

      FOR v_lead IN
        WITH chat_activity AS (
          SELECT c.lead_id, MAX(c.last_message_at) AS last_activity_at
          FROM public.comm_whatsapp_chats c
          WHERE c.lead_id IS NOT NULL
            AND c.deleted_at IS NULL
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
        WHERE cardinality(ts.values) > 0
          AND COALESCE(status_config.nome, l.status) = ANY(ts.values)
          AND GREATEST(
            COALESCE(a.last_activity_at, h.status_entered_at, l.updated_at, l.created_at),
            v_activated_at
          ) <= now() - make_interval(hours => v_duration_hours)
          AND NOT EXISTS (
            SELECT 1
            FROM public.auto_contact_flow_jobs j
            WHERE j.lead_id = l.id
              AND j.flow_id = v_flow->>'id'
              AND j.status IN ('pending', 'processing')
          )
          AND NOT EXISTS (
            SELECT 1
            FROM public.auto_contact_flow_jobs j2
            WHERE j2.lead_id = l.id
              AND j2.status = 'skipped'
              AND j2.last_error LIKE 'invalid_number%'
              AND j2.updated_at > now() - interval '30 days'
          )
        ORDER BY l.created_at ASC
      LOOP
        v_lead_count := v_lead_count + 1;
        v_total_leads := v_total_leads + 1;
        IF v_lead_count > 20 THEN
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
            'inactivity_started_at', v_lead.inactivity_started_at
          ),
          timeout_milliseconds := 10000
        );
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

-- 2. Health RPC (optimized eligibility count)
CREATE OR REPLACE FUNCTION public.automation_flows_health()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_result jsonb;
  v_inactivity_cron text;
  v_status_cron text;
  v_process_cron text;
  v_last_run timestamptz;
  v_last_status text;
  v_last_error text;
  v_pending integer;
  v_processing integer;
  v_completed_7d integer;
  v_skipped_7d integer;
  v_failed_7d integer;
  v_elegible integer;
  v_flows jsonb;
BEGIN
  SELECT command INTO v_inactivity_cron FROM cron.job WHERE jobname = 'check-auto-contact-inactivity-triggers' LIMIT 1;
  SELECT command INTO v_status_cron FROM cron.job WHERE jobname = 'check-status-duration-triggers' LIMIT 1;
  SELECT command INTO v_process_cron FROM cron.job WHERE jobname = 'process-auto-contact-flow-jobs' LIMIT 1;

  SELECT run_at, status, error INTO v_last_run, v_last_status, v_last_error
  FROM public.automation_run_log
  WHERE function_name = 'check_auto_contact_inactivity_triggers'
  ORDER BY run_at DESC LIMIT 1;

  SELECT count(*) INTO v_pending FROM public.auto_contact_flow_jobs WHERE status = 'pending';
  SELECT count(*) INTO v_processing FROM public.auto_contact_flow_jobs WHERE status = 'processing';
  SELECT count(*) INTO v_completed_7d FROM public.auto_contact_flow_jobs
    WHERE status = 'completed' AND updated_at > now() - interval '7 days';
  SELECT count(*) INTO v_skipped_7d FROM public.auto_contact_flow_jobs
    WHERE status = 'skipped' AND updated_at > now() - interval '7 days';
  SELECT count(*) INTO v_failed_7d FROM public.auto_contact_flow_jobs
    WHERE status = 'failed' AND updated_at > now() - interval '7 days';

  SELECT count(*) INTO v_elegible
  FROM (
    WITH chat_activity AS (
      SELECT c.lead_id, MAX(c.last_message_at) AS last_activity_at
      FROM public.comm_whatsapp_chats c
      WHERE c.lead_id IS NOT NULL
        AND c.deleted_at IS NULL
      GROUP BY c.lead_id
    ), status_entries AS (
      SELECT lead_id, MAX(created_at) AS status_entered_at
      FROM public.lead_status_history
      GROUP BY lead_id
    )
    SELECT DISTINCT l.id
    FROM public.leads l
    LEFT JOIN public.lead_status_config status_config ON status_config.id = l.status_id
    LEFT JOIN chat_activity a ON a.lead_id = l.id
    LEFT JOIN status_entries h ON h.lead_id = l.id
    CROSS JOIN LATERAL (
      SELECT flow.value AS f
      FROM public.integration_settings settings
      CROSS JOIN LATERAL jsonb_array_elements(COALESCE(settings.settings->'flows', '[]'::jsonb)) AS flow(value)
      WHERE settings.slug = 'whatsapp_auto_contact'
        AND settings.settings->>'enabled' = 'true'
        AND settings.settings->>'autoSend' = 'true'
        AND flow.value->>'triggerType' = 'inactivity_duration'
    ) flows
    WHERE COALESCE(status_config.nome, l.status) = ANY(
      ARRAY(SELECT jsonb_array_elements_text(COALESCE(flows.f->'triggerStatuses', '[]'::jsonb)))
    )
      AND GREATEST(
        COALESCE(a.last_activity_at, h.status_entered_at, l.updated_at, l.created_at),
        COALESCE(NULLIF(flows.f->>'triggerActivatedAt', '')::timestamptz, now())
      ) <= now() - make_interval(hours => GREATEST(24, COALESCE(NULLIF(flows.f->>'triggerDurationHours', '')::integer, 24)))
      AND NOT EXISTS (
        SELECT 1 FROM public.auto_contact_flow_jobs j
        WHERE j.lead_id = l.id AND j.flow_id = flows.f->>'id' AND j.status IN ('pending', 'processing')
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.auto_contact_flow_jobs j2
        WHERE j2.lead_id = l.id AND j2.status = 'skipped'
          AND j2.last_error LIKE 'invalid_number%' AND j2.updated_at > now() - interval '30 days'
      )
  ) eligible;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'flowId', f->>'id',
    'name', f->>'name',
    'triggerType', f->>'triggerType',
    'triggerActivatedAt', f->>'triggerActivatedAt',
    'dailySendLimit', COALESCE((f->'scheduling'->>'dailySendLimit')::int, 0),
    'triggerDurationHours', COALESCE((f->>'triggerDurationHours')::int, 24)
  )), '[]'::jsonb) INTO v_flows
  FROM public.integration_settings settings
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(settings.settings->'flows', '[]'::jsonb)) AS f(value)
  WHERE settings.slug = 'whatsapp_auto_contact';

  v_result := jsonb_build_object(
    'generatedAt', now(),
    'crons', jsonb_build_object(
      'inactivity', CASE WHEN v_inactivity_cron IS NULL THEN 'MISSING' ELSE 'active' END,
      'statusDuration', CASE WHEN v_status_cron IS NULL THEN 'MISSING' ELSE 'active' END,
      'processJobs', CASE WHEN v_process_cron IS NULL THEN 'MISSING' ELSE 'active' END
    ),
    'lastInactivityRun', jsonb_build_object(
      'runAt', v_last_run,
      'status', v_last_status,
      'error', v_last_error
    ),
    'jobs', jsonb_build_object(
      'pending', v_pending,
      'processing', v_processing,
      'completed7d', v_completed_7d,
      'skipped7d', v_skipped_7d,
      'failed7d', v_failed_7d
    ),
    'eligibleLeads', v_elegible,
    'flows', v_flows
  );

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.automation_flows_health() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.automation_flows_health() TO service_role, authenticated;
