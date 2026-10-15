BEGIN;

-- Only the stalled Contato Inicial and Atendimento flows should finalize as Reativação.
DO $assert_status$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.lead_status_config
    WHERE lower(trim(nome)) = 'reativação'
  ) THEN
    RAISE EXCEPTION 'Status Reativação não encontrado.';
  END IF;
END;
$assert_status$;

CREATE OR REPLACE FUNCTION public.auto_contact_flow_completed_without_response(
  p_lead_id uuid,
  p_flow_id text,
  p_final_step_order integer
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.auto_contact_flow_jobs completed
    WHERE completed.lead_id = p_lead_id
      AND completed.flow_id = p_flow_id
      AND completed.step_order = p_final_step_order
      AND completed.status = 'completed'
      AND NOT EXISTS (
        SELECT 1
        FROM public.comm_whatsapp_chats chat
        JOIN public.comm_whatsapp_messages inbound ON inbound.chat_id = chat.id
        WHERE chat.lead_id = completed.lead_id
          AND inbound.direction = 'inbound'
          AND public.comm_whatsapp_message_preview_text(
            inbound.media_caption,
            inbound.text_content,
            inbound.message_type
          ) IS NOT NULL
          AND inbound.message_at > COALESCE(completed.trigger_message_at, completed.updated_at)
      )
  );
$$;

REVOKE ALL ON FUNCTION public.auto_contact_flow_completed_without_response(uuid, text, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auto_contact_flow_completed_without_response(uuid, text, integer)
  TO service_role;

-- Populate the existing flow setting so operators can see the same final status the worker applies.
WITH rewritten_settings AS (
  SELECT
    settings.id,
    jsonb_set(
      settings.settings,
      '{flows}',
      (
        SELECT COALESCE(jsonb_agg(
          CASE
            WHEN flow.value->>'triggerType' = 'inactivity_duration'
              AND (
                flow.value->'triggerStatuses' @> '["Contato Inicial"]'::jsonb
                OR flow.value->'triggerStatuses' @> '["Atendimento"]'::jsonb
              )
              AND NOT EXISTS (
                SELECT 1
                FROM jsonb_array_elements_text(COALESCE(flow.value->'triggerStatuses', '[]'::jsonb)) AS status(value)
                WHERE status.value NOT IN ('Contato Inicial', 'Atendimento')
              )
            THEN jsonb_set(flow.value, '{finalStatus}', to_jsonb('Reativação'::text), true)
            ELSE flow.value
          END
          ORDER BY flow.ordinality
        ), '[]'::jsonb)
        FROM jsonb_array_elements(COALESCE(settings.settings->'flows', '[]'::jsonb))
          WITH ORDINALITY AS flow(value, ordinality)
      ),
      true
    ) AS next_settings
  FROM public.integration_settings settings
  WHERE settings.slug = 'whatsapp_auto_contact'
    AND EXISTS (
      SELECT 1
      FROM jsonb_array_elements(COALESCE(settings.settings->'flows', '[]'::jsonb)) AS flow(value)
      WHERE flow.value->>'triggerType' = 'inactivity_duration'
        AND (
          flow.value->'triggerStatuses' @> '["Contato Inicial"]'::jsonb
          OR flow.value->'triggerStatuses' @> '["Atendimento"]'::jsonb
        )
        AND NOT EXISTS (
          SELECT 1
          FROM jsonb_array_elements_text(COALESCE(flow.value->'triggerStatuses', '[]'::jsonb)) AS status(value)
          WHERE status.value NOT IN ('Contato Inicial', 'Atendimento')
        )
    )
)
UPDATE public.integration_settings settings
SET settings = rewritten_settings.next_settings
FROM rewritten_settings
WHERE settings.id = rewritten_settings.id
  AND settings.settings IS DISTINCT FROM rewritten_settings.next_settings;

-- Move leads whose final inactivity step already completed without a later visible reply.
CREATE TEMP TABLE stalled_inactivity_leads_to_reactivate ON COMMIT DROP AS
WITH target_flows AS (
  SELECT
    flow.value->>'id' AS flow_id,
    ARRAY(
      SELECT jsonb_array_elements_text(COALESCE(flow.value->'triggerStatuses', '[]'::jsonb))
    ) AS trigger_statuses,
    jsonb_array_length(COALESCE(flow.value->'steps', '[]'::jsonb)) - 1 AS final_step_order
  FROM public.integration_settings settings
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(settings.settings->'flows', '[]'::jsonb)) AS flow(value)
  WHERE settings.slug = 'whatsapp_auto_contact'
    AND flow.value->>'triggerType' = 'inactivity_duration'
    AND (
      flow.value->'triggerStatuses' @> '["Contato Inicial"]'::jsonb
      OR flow.value->'triggerStatuses' @> '["Atendimento"]'::jsonb
    )
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements_text(COALESCE(flow.value->'triggerStatuses', '[]'::jsonb)) AS status(value)
      WHERE status.value NOT IN ('Contato Inicial', 'Atendimento')
    )
), completed_final_steps AS (
  SELECT DISTINCT ON (job.lead_id, job.flow_id)
    job.lead_id,
    job.flow_id,
    job.updated_at
  FROM target_flows flow
  JOIN public.auto_contact_flow_jobs job
    ON job.flow_id = flow.flow_id
   AND job.step_order = flow.final_step_order
  WHERE job.status = 'completed'
    AND public.auto_contact_flow_completed_without_response(
      job.lead_id,
      job.flow_id,
      flow.final_step_order
    )
  ORDER BY job.lead_id, job.flow_id, job.updated_at DESC
)
SELECT DISTINCT completed.lead_id, completed.flow_id
FROM completed_final_steps completed
JOIN target_flows flow ON flow.flow_id = completed.flow_id
JOIN public.leads lead ON lead.id = completed.lead_id
WHERE COALESCE(
  (SELECT status.nome FROM public.lead_status_config status WHERE status.id = lead.status_id),
  lead.status
) = ANY(flow.trigger_statuses);

UPDATE public.leads lead
SET status_id = status.id
FROM stalled_inactivity_leads_to_reactivate stalled
CROSS JOIN LATERAL (
  SELECT id
  FROM public.lead_status_config
  WHERE lower(trim(nome)) = 'reativação'
  ORDER BY id
  LIMIT 1
) status
WHERE lead.id = stalled.lead_id
  AND COALESCE(
    (SELECT current_status.nome FROM public.lead_status_config current_status WHERE current_status.id = lead.status_id),
    lead.status
  ) IN ('Contato Inicial', 'Atendimento');

UPDATE public.auto_contact_flow_jobs job
SET status = 'skipped',
    last_error = 'Lead movido para Reativação após concluir o fluxo sem resposta'
FROM stalled_inactivity_leads_to_reactivate stalled
WHERE job.lead_id = stalled.lead_id
  AND job.flow_id = stalled.flow_id
  AND job.status = 'pending';
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
          AND NOT public.auto_contact_flow_completed_without_response(
            l.id,
            v_flow->>'id',
            jsonb_array_length(COALESCE(v_flow->'steps', '[]'::jsonb)) - 1
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

  SELECT NULLIF(trim(both '"' FROM config_value::text), '')::timestamptz INTO v_cutover_at
  FROM public.system_configurations
  WHERE config_key = 'inactivity_enrollment_cutover_at'
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
      AND NOT public.auto_contact_flow_completed_without_response(
        l.id,
        flows.f->>'id',
        jsonb_array_length(COALESCE(flows.f->'steps', '[]'::jsonb)) - 1
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
REVOKE ALL ON FUNCTION public.automation_flows_health() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.automation_flows_health() TO service_role;
REVOKE ALL ON FUNCTION public.check_auto_contact_inactivity_triggers() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_auto_contact_inactivity_triggers() TO service_role;

COMMIT;
