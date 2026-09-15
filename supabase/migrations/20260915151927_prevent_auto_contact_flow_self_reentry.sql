-- The flow's own outbound message is not a new inactivity trigger for that
-- same flow. Newer sends carry their flow id in message metadata; older rows
-- are attributed using the completed send job recorded at roughly the same
-- time as the message.
CREATE OR REPLACE FUNCTION public.auto_contact_message_is_same_flow_output(
  p_lead_id uuid,
  p_flow_id text,
  p_message_source text,
  p_message_metadata jsonb,
  p_message_at timestamptz
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_message_source IS DISTINCT FROM 'auto_contact' THEN false
    WHEN NULLIF(p_message_metadata->>'automation_flow_id', '') IS NOT NULL
      THEN p_message_metadata->>'automation_flow_id' = p_flow_id
    ELSE EXISTS (
      SELECT 1
      FROM public.auto_contact_flow_jobs job
      WHERE job.lead_id = p_lead_id
        AND job.flow_id = p_flow_id
        AND job.action_type = 'send_message'
        AND job.status = 'completed'
        AND job.updated_at BETWEEN p_message_at - interval '5 minutes'
                               AND p_message_at + interval '5 minutes'
    )
  END;
$$;

-- Keep the diagnostic count aligned with the scanner: a completed cycle can
-- start again after a later manual outbound, but never from its own output.
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
  v_lead_created_backlog_cron text;
  v_last_run timestamptz;
  v_last_status text;
  v_last_error text;
  v_last_backlog_run timestamptz;
  v_last_backlog_status text;
  v_last_backlog_error text;
  v_pending integer;
  v_processing integer;
  v_completed_7d integer;
  v_skipped_7d integer;
  v_failed_7d integer;
  v_elegible integer;
  v_backlog_elegible integer;
  v_flows jsonb;
  v_cutover_at timestamptz;
BEGIN
  SELECT command INTO v_inactivity_cron FROM cron.job WHERE jobname = 'check-auto-contact-inactivity-triggers' LIMIT 1;
  SELECT command INTO v_status_cron FROM cron.job WHERE jobname = 'check-status-duration-triggers' LIMIT 1;
  SELECT command INTO v_process_cron FROM cron.job WHERE jobname = 'process-auto-contact-flow-jobs' LIMIT 1;
  SELECT command INTO v_lead_created_backlog_cron FROM cron.job WHERE jobname = 'check-lead-created-backlog-triggers' LIMIT 1;

  SELECT run_at, status, error INTO v_last_run, v_last_status, v_last_error
  FROM public.automation_run_log
  WHERE function_name = 'check_auto_contact_inactivity_triggers'
  ORDER BY run_at DESC LIMIT 1;

  SELECT run_at, status, error INTO v_last_backlog_run, v_last_backlog_status, v_last_backlog_error
  FROM public.automation_run_log
  WHERE function_name = 'check_lead_created_backlog_triggers'
  ORDER BY run_at DESC LIMIT 1;

  SELECT count(*) INTO v_pending FROM public.auto_contact_flow_jobs WHERE status = 'pending';
  SELECT count(*) INTO v_processing FROM public.auto_contact_flow_jobs WHERE status = 'processing';
  SELECT count(*) INTO v_completed_7d FROM public.auto_contact_flow_jobs
    WHERE status = 'completed' AND updated_at > now() - interval '7 days';
  SELECT count(*) INTO v_skipped_7d FROM public.auto_contact_flow_jobs
    WHERE status = 'skipped' AND updated_at > now() - interval '7 days';
  SELECT count(*) INTO v_failed_7d FROM public.auto_contact_flow_jobs
    WHERE status = 'failed' AND updated_at > now() - interval '7 days';

  SELECT value::timestamptz INTO v_cutover_at
  FROM public.system_configurations
  WHERE category = 'automation' AND label = 'inactivity_enrollment_cutover_at'
  LIMIT 1;

  SELECT count(*) INTO v_elegible
  FROM (
    WITH last_visible_message AS (
      SELECT
        c.lead_id,
        m.direction AS last_direction,
        m.message_at AS last_message_at,
        m.source AS last_message_source,
        m.metadata AS last_message_metadata
      FROM public.comm_whatsapp_chats c
      JOIN public.comm_whatsapp_messages m ON m.chat_id = c.id
      WHERE c.lead_id IS NOT NULL
        AND public.comm_whatsapp_message_preview_text(m.media_caption, m.text_content, m.message_type) IS NOT NULL
    ), last_message_by_lead AS (
      SELECT DISTINCT ON (lvm.lead_id)
        lvm.lead_id,
        lvm.last_direction,
        lvm.last_message_at,
        lvm.last_message_source,
        lvm.last_message_metadata
      FROM last_visible_message lvm
      ORDER BY lvm.lead_id, lvm.last_message_at DESC
    )
    SELECT DISTINCT l.id, flows.f->>'id' AS flow_id
    FROM public.leads l
    LEFT JOIN public.lead_status_config status_config ON status_config.id = l.status_id
    LEFT JOIN last_message_by_lead latest ON latest.lead_id = l.id
    CROSS JOIN LATERAL (
      SELECT flow.value AS f
      FROM public.integration_settings settings
      CROSS JOIN LATERAL jsonb_array_elements(COALESCE(settings.settings->'flows', '[]'::jsonb)) AS flow(value)
      WHERE settings.slug = 'whatsapp_auto_contact'
        AND settings.settings->>'enabled' = 'true'
        AND settings.settings->>'autoSend' = 'true'
        AND flow.value->>'triggerType' = 'inactivity_duration'
        AND COALESCE(flow.value->>'ativo', 'true') != 'false'
    ) flows
    WHERE NOT COALESCE(l.skip_automation, false)
      AND COALESCE(status_config.nome, l.status) = ANY(
        ARRAY(SELECT jsonb_array_elements_text(COALESCE(flows.f->'triggerStatuses', '[]'::jsonb)))
      )
      AND latest.last_direction = 'outbound'
      AND GREATEST(
        latest.last_message_at,
        COALESCE(NULLIF(flows.f->>'triggerActivatedAt', '')::timestamptz, now())
      ) <= now() - make_interval(hours => GREATEST(1, COALESCE(NULLIF(flows.f->>'triggerDurationHours', '')::integer, 24)))
      AND NOT public.auto_contact_message_is_same_flow_output(
        l.id,
        flows.f->>'id',
        latest.last_message_source,
        latest.last_message_metadata,
        latest.last_message_at
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.auto_contact_flow_jobs job
        WHERE job.lead_id = l.id
          AND job.flow_id = flows.f->>'id'
          AND job.status IN ('pending', 'processing')
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.auto_contact_flow_jobs skipped_job
        WHERE skipped_job.lead_id = l.id
          AND skipped_job.status = 'skipped'
          AND skipped_job.last_error LIKE 'invalid_number%'
          AND skipped_job.updated_at > now() - interval '30 days'
      )
      AND (v_cutover_at IS NULL OR latest.last_message_at >= v_cutover_at)
  ) eligible;

  SELECT count(*) INTO v_backlog_elegible
  FROM public.leads l
  WHERE NOT COALESCE(l.skip_automation, false)
    AND COALESCE(l.canal, '') != 'whatsapp_campaign'
    AND l.created_at > now() - interval '72 hours'
    AND NOT EXISTS (
      SELECT 1 FROM public.auto_contact_flow_jobs job WHERE job.lead_id = l.id
    );

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'flowId', f->>'id',
    'name', f->>'name',
    'ativo', COALESCE((f->>'ativo')::boolean, true),
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
      'processJobs', CASE WHEN v_process_cron IS NULL THEN 'MISSING' ELSE 'active' END,
      'leadCreatedBacklog', CASE WHEN v_lead_created_backlog_cron IS NULL THEN 'MISSING' ELSE 'active' END
    ),
    'lastInactivityRun', jsonb_build_object(
      'runAt', v_last_run,
      'status', v_last_status,
      'error', v_last_error
    ),
    'lastLeadCreatedBacklogRun', jsonb_build_object(
      'runAt', v_last_backlog_run,
      'status', v_last_backlog_status,
      'error', v_last_backlog_error
    ),
    'jobs', jsonb_build_object(
      'pending', v_pending,
      'processing', v_processing,
      'completed7d', v_completed_7d,
      'skipped7d', v_skipped_7d,
      'failed7d', v_failed_7d
    ),
    'eligibleLeads', v_elegible,
    'eligibleLeadCreatedBacklog', v_backlog_elegible,
    'flows', v_flows
  );

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.automation_flows_health() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.automation_flows_health() TO service_role, authenticated;

REVOKE ALL ON FUNCTION public.auto_contact_message_is_same_flow_output(uuid, text, text, jsonb, timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auto_contact_message_is_same_flow_output(uuid, text, text, jsonb, timestamptz)
  TO service_role;

-- Keep the enrollment scanner's existing eligibility rules and active-job
-- guard, while preventing its own output from reopening the same flow cycle.
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

    SELECT value::timestamptz INTO v_cutover_at
    FROM public.system_configurations
    WHERE category = 'automation' AND label = 'inactivity_enrollment_cutover_at'
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
        WITH last_visible_message AS (
          SELECT
            c.lead_id,
            m.direction AS last_direction,
            m.message_at AS last_message_at,
            m.id AS last_message_id,
            m.source AS last_message_source,
            m.metadata AS last_message_metadata
          FROM public.comm_whatsapp_chats c
          JOIN public.comm_whatsapp_messages m ON m.chat_id = c.id
          WHERE c.lead_id IS NOT NULL
            AND public.comm_whatsapp_message_preview_text(m.media_caption, m.text_content, m.message_type) IS NOT NULL
          ORDER BY m.message_at DESC
        ),
        last_outbound AS (
          SELECT DISTINCT ON (lvm.lead_id)
            lvm.lead_id,
            lvm.last_message_at AS outbound_at,
            lvm.last_message_id AS outbound_msg_id
          FROM last_visible_message lvm
          WHERE lvm.last_direction = 'outbound'
          ORDER BY lvm.lead_id, lvm.last_message_at DESC
        ),
        last_direction_check AS (
          SELECT DISTINCT ON (lvm.lead_id)
            lvm.lead_id,
            lvm.last_direction,
            lvm.last_message_at,
            lvm.last_message_source,
            lvm.last_message_metadata
          FROM last_visible_message lvm
          ORDER BY lvm.lead_id, lvm.last_message_at DESC
        )
        SELECT
          l.id,
          lo.outbound_at AS inactivity_started_at,
          lo.outbound_msg_id
        FROM public.leads l
        LEFT JOIN public.lead_status_config status_config ON status_config.id = l.status_id
        LEFT JOIN last_outbound lo ON lo.lead_id = l.id
        LEFT JOIN last_direction_check ldc ON ldc.lead_id = l.id
        CROSS JOIN (
          SELECT ARRAY(
            SELECT jsonb_array_elements_text(COALESCE(v_flow->'triggerStatuses', '[]'::jsonb))
          ) AS values
        ) ts
        WHERE cardinality(ts.values) > 0
          AND NOT COALESCE(l.skip_automation, false)
          AND COALESCE(status_config.nome, l.status) = ANY(ts.values)
          AND ldc.last_direction = 'outbound'
          AND lo.outbound_at IS NOT NULL
          AND lo.outbound_at <= now() - make_interval(hours => v_duration_hours)
          AND NOT public.auto_contact_message_is_same_flow_output(
            l.id,
            v_flow->>'id',
            ldc.last_message_source,
            ldc.last_message_metadata,
            ldc.last_message_at
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
          AND (v_cutover_at IS NULL OR lo.outbound_at >= v_cutover_at)
        ORDER BY l.created_at DESC
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
            'inactivity_started_at', v_lead.inactivity_started_at,
            'trigger_message_id', v_lead.outbound_msg_id
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
