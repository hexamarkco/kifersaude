/*
  Definitive fix for auto-contact automation pipeline

  Recurring failure class: cron functions silently abort on runtime errors
  (e.g. referencing a non-existent `leads.ativo` column), repo drift vs remote
  patched functions, and cron scheduling drift. This migration closes the loop:

  1. Creates `automation_run_log` so every cron execution is recorded
     (status, error, details) - failures are never silent again.
  2. Rewrites `check_auto_contact_inactivity_triggers`:
     - drops the non-existent `leads.ativo` reference
     - drops `leads.arquivado` exclusion (archived chats/leads must still
       receive flow messages - operational rule)
     - keeps GREATEST(inactivity_ref, triggerActivatedAt) activation semantics
     - keeps visible-messages-only activity window
     - adds invalid-number guard (30 days) to avoid re-scheduling loops
     - reads credentials from app.settings GUC first, system_configurations
       as fallback
     - wraps the whole run in BEGIN/EXCEPTION: errors are logged to
       automation_run_log and re-raised
  3. Applies the same fixes to `check_status_duration_triggers`.
  4. Re-asserts the three automation cron jobs (idempotent), so missing or
     drifted crons are recreated by this migration.
  5. Adds `automation_flows_health()` - a single-call health/diagnostic RPC
     used by the deploy verification script.
*/

-- 1. Run log
CREATE TABLE IF NOT EXISTS public.automation_run_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  function_name text NOT NULL,
  run_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'ok',
  error text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_automation_run_log_function_run
  ON public.automation_run_log (function_name, run_at DESC);

ALTER TABLE public.automation_run_log ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.automation_run_log FROM PUBLIC;
GRANT SELECT ON TABLE public.automation_run_log TO service_role, authenticated;

-- 2. Inactivity detector (definitive)
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
          SELECT c.lead_id, MAX(m.message_at) AS last_activity_at
          FROM public.comm_whatsapp_chats c
          INNER JOIN public.comm_whatsapp_messages m ON m.chat_id = c.id
          WHERE c.lead_id IS NOT NULL
            AND public.comm_whatsapp_message_preview_text(m.media_caption, m.text_content, m.message_type) IS NOT NULL
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

COMMENT ON FUNCTION public.check_auto_contact_inactivity_triggers()
  IS 'Schedules inactivity follow-up flows; every run is recorded in automation_run_log.';

-- 3. Status duration detector (same fixes)
CREATE OR REPLACE FUNCTION public.check_status_duration_triggers()
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

    v_function_url := rtrim(v_supabase_url, '/') || '/functions/v1/leads-api?action=check-status-duration';

    FOR v_flow IN
      SELECT flow.value
      FROM public.integration_settings settings
      CROSS JOIN LATERAL jsonb_array_elements(COALESCE(settings.settings->'flows', '[]'::jsonb)) AS flow(value)
      WHERE settings.slug = 'whatsapp_auto_contact'
        AND settings.settings->>'enabled' = 'true'
        AND settings.settings->>'autoSend' = 'true'
        AND flow.value->>'triggerType' = 'status_duration'
        AND COALESCE(flow.value->>'ativo', 'true') != 'false'
    LOOP
      v_flow_count := v_flow_count + 1;
      v_duration_hours := GREATEST(1, COALESCE(NULLIF(v_flow->>'triggerDurationHours', '')::integer, 24));

      FOR v_lead IN
        WITH status_entries AS (
          SELECT lead_id, MAX(created_at) AS status_entered_at
          FROM public.lead_status_history
          GROUP BY lead_id
        ), trigger_statuses AS (
          SELECT ARRAY(
            SELECT jsonb_array_elements_text(COALESCE(v_flow->'triggerStatuses', '[]'::jsonb))
          ) AS values
        )
        SELECT l.id
        FROM public.leads l
        LEFT JOIN public.lead_status_config status_config ON status_config.id = l.status_id
        LEFT JOIN status_entries h ON h.lead_id = l.id
        CROSS JOIN trigger_statuses ts
        WHERE cardinality(ts.values) > 0
          AND COALESCE(status_config.nome, l.status) = ANY(ts.values)
          AND COALESCE(h.status_entered_at, l.updated_at, l.created_at)
            <= now() - make_interval(hours => v_duration_hours)
          AND NOT EXISTS (
            SELECT 1
            FROM public.auto_contact_flow_executions
            WHERE lead_id = l.id AND flow_id = v_flow->>'id'
          )
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
        v_total_leads := v_total_leads + 1;

        PERFORM net.http_post(
          url := v_function_url,
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_service_role_key
          ),
          body := jsonb_build_object(
            'lead_id', v_lead.id,
            'flow_id', v_flow->>'id'
          ),
          timeout_milliseconds := 10000
        );
      END LOOP;
    END LOOP;

    INSERT INTO public.automation_run_log (function_name, status, details)
    VALUES (
      'check_status_duration_triggers',
      'ok',
      jsonb_build_object('flows_scanned', v_flow_count, 'leads_dispatched', v_total_leads)
    );
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.automation_run_log (function_name, status, error, details)
    VALUES (
      'check_status_duration_triggers',
      'error',
      SQLERRM,
      jsonb_build_object('flows_scanned', v_flow_count, 'leads_dispatched', v_total_leads)
    );
    RAISE;
  END;
END;
$$;

-- 4. Re-assert automation cron jobs (idempotent)
DO $$
DECLARE
  v_supabase_url text;
  v_service_role_key text;
  v_process_url text;
BEGIN
  IF to_regclass('cron.job') IS NULL THEN
    RAISE NOTICE 'pg_cron unavailable; skipping automation cron reassert.';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'net' AND p.proname = 'http_post'
  ) THEN
    RAISE NOTICE 'net.http_post unavailable; skipping automation cron reassert.';
    RETURN;
  END IF;

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
    RAISE NOTICE 'Supabase config missing; skipping automation cron reassert.';
    RETURN;
  END IF;

  v_process_url := rtrim(v_supabase_url, '/') || '/functions/v1/leads-api?action=process-flow-jobs';

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'check-auto-contact-inactivity-triggers') THEN
    PERFORM cron.unschedule('check-auto-contact-inactivity-triggers');
  END IF;
  PERFORM cron.schedule(
    'check-auto-contact-inactivity-triggers',
    '*/5 * * * *',
    'SELECT public.check_auto_contact_inactivity_triggers();'
  );

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'check-status-duration-triggers') THEN
    PERFORM cron.unschedule('check-status-duration-triggers');
  END IF;
  PERFORM cron.schedule(
    'check-status-duration-triggers',
    '*/5 * * * *',
    'SELECT public.check_status_duration_triggers();'
  );

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-auto-contact-flow-jobs') THEN
    PERFORM cron.unschedule('process-auto-contact-flow-jobs');
  END IF;
  PERFORM cron.schedule(
    'process-auto-contact-flow-jobs',
    '* * * * *',
    format(
      'SELECT net.http_post(url := %L, headers := jsonb_build_object(''Content-Type'', ''application/json'', ''Authorization'', %L), body := jsonb_build_object(''source'', ''cron''), timeout_milliseconds := 30000);',
      v_process_url,
      'Bearer ' || v_service_role_key
    )
  );

  RAISE NOTICE 'Automation crons reasserted: inactivity(5m), status(5m), process-jobs(1m).';
END $$;

-- 5. Health/diagnostic RPC
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
      SELECT c.lead_id, MAX(m.message_at) AS last_activity_at
      FROM public.comm_whatsapp_chats c
      INNER JOIN public.comm_whatsapp_messages m ON m.chat_id = c.id
      WHERE c.lead_id IS NOT NULL
        AND public.comm_whatsapp_message_preview_text(m.media_caption, m.text_content, m.message_type) IS NOT NULL
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
