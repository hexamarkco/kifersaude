-- Respeita `leads.skip_automation` em TODOS os pontos de execucao do fluxo
-- de abordagem (cron de inatividade, check-inactivity-duration, trigger de
-- auto-contact e runAutoContactFlowEngine), permitindo criar um lead manual
-- sem que ele entre no fluxo de abordagem (ja abordado manualmente).
--
-- Antes: o trigger zerava o flag no INSERT e o cron/leads-api ignoravam o
-- flag. Agora o flag persiste e bloqueia a entrada em qualquer fluxo.

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
  has_label boolean := false;
  has_value boolean := false;
  has_config_key boolean := false;
  has_config_value boolean := false;
BEGIN
  IF COALESCE(NEW.skip_automation, false) THEN
    RAISE LOG 'Skipping auto-contact trigger for skip_automation lead %', NEW.id;
    RETURN NEW;
  END IF;

  IF COALESCE(NEW.canal, '') = 'whatsapp_campaign' THEN
    IF TG_OP = 'INSERT' AND NOT COALESCE(NEW.skip_automation, false) THEN
      UPDATE public.leads
      SET skip_automation = true
      WHERE id = NEW.id
        AND NOT COALESCE(skip_automation, false);
    END IF;

    RAISE LOG 'Skipping auto-contact trigger for campaign lead %', NEW.id;
    RETURN NEW;
  END IF;

  is_status_change := (
    TG_OP = 'UPDATE'
    AND (
      OLD.status IS DISTINCT FROM NEW.status
      OR OLD.status_id IS DISTINCT FROM NEW.status_id
    )
  );

  IF TG_OP = 'UPDATE' AND NOT is_status_change THEN
    RAISE LOG 'Skipping auto-contact trigger for non-status lead update %', NEW.id;
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    event_type := 'lead_created';
  ELSIF is_status_change THEN
    event_type := 'status_changed';
  ELSE
    event_type := 'update';
  END IF;

  BEGIN
    function_url := NULLIF(trim(both '"' FROM COALESCE(current_setting('app.settings.supabase_url', true), '')), '');
  EXCEPTION WHEN OTHERS THEN
    function_url := NULL;
  END;

  BEGIN
    service_role_key := NULLIF(trim(both '"' FROM COALESCE(current_setting('app.settings.supabase_service_role_key', true), '')), '');
  EXCEPTION WHEN OTHERS THEN
    service_role_key := NULL;
  END;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'system_configurations'
      AND column_name = 'label'
  ) INTO has_label;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'system_configurations'
      AND column_name = 'value'
  ) INTO has_value;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'system_configurations'
      AND column_name = 'config_key'
  ) INTO has_config_key;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'system_configurations'
      AND column_name = 'config_value'
  ) INTO has_config_value;

  IF function_url IS NULL AND has_label AND has_value THEN
    SELECT NULLIF(trim(both '"' FROM value), '') INTO function_url
    FROM public.system_configurations
    WHERE label = 'supabase_url'
    LIMIT 1;
  END IF;

  IF service_role_key IS NULL AND has_label AND has_value THEN
    SELECT NULLIF(trim(both '"' FROM value), '') INTO service_role_key
    FROM public.system_configurations
    WHERE label = 'supabase_service_role_key'
    LIMIT 1;
  END IF;

  IF function_url IS NULL AND has_config_key AND has_config_value THEN
    EXECUTE $sql$
      SELECT NULLIF(trim(both '"' FROM config_value::text), '')
      FROM public.system_configurations
      WHERE config_key = 'supabase_url'
      LIMIT 1
    $sql$ INTO function_url;
  END IF;

  IF service_role_key IS NULL AND has_config_key AND has_config_value THEN
    EXECUTE $sql$
      SELECT NULLIF(trim(both '"' FROM config_value::text), '')
      FROM public.system_configurations
      WHERE config_key = 'supabase_service_role_key'
      LIMIT 1
    $sql$ INTO service_role_key;
  END IF;

  IF function_url IS NOT NULL THEN
    function_url := rtrim(function_url, '/') || '/functions/v1/leads-api?action=auto-contact';
  END IF;

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
    ),
    timeout_milliseconds := 30000
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

-- Cron de inatividade: exclui leads com skip_automation ativo.
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
          AND NOT COALESCE(l.skip_automation, false)
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

-- Consistencia do diagnostico: elegiveis nao incluem leads com skip_automation.
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
        AND COALESCE(flow.value->>'ativo', 'true') != 'false'
    ) flows
    WHERE NOT COALESCE(l.skip_automation, false)
      AND COALESCE(status_config.nome, l.status) = ANY(
        ARRAY(SELECT jsonb_array_elements_text(COALESCE(flows.f->'triggerStatuses', '[]'::jsonb)))
      )
      AND GREATEST(
        COALESCE(a.last_activity_at, h.status_entered_at, l.updated_at, l.created_at),
        COALESCE(NULLIF(flows.f->>'triggerActivatedAt', '')::timestamptz, now())
      ) <= now() - make_interval(hours => GREATEST(1, COALESCE(NULLIF(flows.f->>'triggerDurationHours', '')::integer, 24)))
      AND NOT EXISTS (
        SELECT 1 FROM public.auto_contact_flow_jobs j
        WHERE j.lead_id = l.id AND j.flow_id = flows.f->>'id' AND j.status IN ('pending', 'processing')
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.auto_contact_flow_jobs j3
        WHERE j3.lead_id = l.id AND j3.flow_id = flows.f->>'id' AND j3.status = 'completed'
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
