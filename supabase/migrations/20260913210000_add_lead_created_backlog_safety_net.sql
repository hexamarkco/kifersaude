/*
  Rede de seguranca para o fluxo de abordagem (triggerType='lead_created')

  Problema: diferente dos fluxos de inatividade e status_duration (que tem
  cron proprio varrendo a tabela `leads` a cada 5min em busca de elegiveis),
  o fluxo de abordagem depende 100% do trigger sincrono de INSERT/UPDATE em
  `leads` (`trigger_auto_send_lead_messages`) disparar um `net.http_post`
  para `leads-api?action=auto-contact` com sucesso. Se essa chamada falhar
  ou nunca completar (cold start, erro transitorio na function, WHAPI fora
  do ar no instante exato, deploy em andamento etc.), nenhum job e criado em
  `auto_contact_flow_jobs` e o lead fica orfao para sempre: nenhum cron
  existente varre `leads` procurando leads sem job de abordagem, entao a
  falha e silenciosa e so e percebida quando alguem nota que o status nao
  avancou para "Contato Inicial" e corrige manualmente.

  Fix: adiciona `check_lead_created_backlog_triggers()`, nos mesmos moldes
  de `check_status_duration_triggers`, rodando a cada 5min: procura leads
  criados nas ultimas 72h, sem `skip_automation`, fora de campanha e SEM
  nenhuma linha em `auto_contact_flow_jobs` (ou seja, nunca tentados), e
  redispara a avaliacao do fluxo de abordagem via nova action
  `check-lead-created-backlog` do `leads-api` (reusa `runAutoContactFlowEngine`,
  a mesma logica de matching/agendamento do trigger original).
*/

CREATE OR REPLACE FUNCTION public.check_lead_created_backlog_triggers()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_supabase_url text;
  v_service_role_key text;
  v_function_url text;
  v_lead record;
  v_lead_count integer := 0;
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

  BEGIN
    IF v_supabase_url IS NULL OR v_service_role_key IS NULL THEN
      RAISE EXCEPTION 'Supabase configuration missing (app.settings GUC and system_configurations)';
    END IF;

    -- Sem fluxo de abordagem (lead_created) ativo configurado: nada a fazer.
    IF NOT EXISTS (
      SELECT 1
      FROM public.integration_settings settings
      CROSS JOIN LATERAL jsonb_array_elements(COALESCE(settings.settings->'flows', '[]'::jsonb)) AS flow(value)
      WHERE settings.slug = 'whatsapp_auto_contact'
        AND settings.settings->>'enabled' = 'true'
        AND settings.settings->>'autoSend' = 'true'
        AND flow.value->>'triggerType' = 'lead_created'
        AND COALESCE(flow.value->>'ativo', 'true') != 'false'
    ) THEN
      INSERT INTO public.automation_run_log (function_name, status, details)
      VALUES ('check_lead_created_backlog_triggers', 'ok', jsonb_build_object('leads_dispatched', 0, 'reason', 'no_active_flow'));
      RETURN;
    END IF;

    v_function_url := rtrim(v_supabase_url, '/') || '/functions/v1/leads-api?action=check-lead-created-backlog';

    -- Leads recentes que nunca ganharam nenhum job de automacao: o disparo
    -- sincrono do trigger de INSERT falhou ou nao chegou a criar o job.
    -- Janela de 72h limita o rastreio para nao reconsultar para sempre leads
    -- que legitimamente nunca vao casar com um fluxo (numero invalido,
    -- condicao de fluxo nao atendida etc.).
    FOR v_lead IN
      SELECT l.id
      FROM public.leads l
      WHERE NOT COALESCE(l.skip_automation, false)
        AND COALESCE(l.canal, '') != 'whatsapp_campaign'
        AND l.created_at > now() - interval '72 hours'
        AND NOT EXISTS (
          SELECT 1 FROM public.auto_contact_flow_jobs j WHERE j.lead_id = l.id
        )
      ORDER BY l.created_at ASC
      LIMIT 30
    LOOP
      v_lead_count := v_lead_count + 1;

      PERFORM net.http_post(
        url := v_function_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_service_role_key
        ),
        body := jsonb_build_object('lead_id', v_lead.id),
        timeout_milliseconds := 10000
      );
    END LOOP;

    INSERT INTO public.automation_run_log (function_name, status, details)
    VALUES (
      'check_lead_created_backlog_triggers',
      'ok',
      jsonb_build_object('leads_dispatched', v_lead_count)
    );
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.automation_run_log (function_name, status, error, details)
    VALUES (
      'check_lead_created_backlog_triggers',
      'error',
      SQLERRM,
      jsonb_build_object('leads_dispatched', v_lead_count)
    );
    RAISE;
  END;
END;
$$;

COMMENT ON FUNCTION public.check_lead_created_backlog_triggers()
  IS 'Rede de seguranca do fluxo de abordagem (lead_created): reagenda leads recentes que nao receberam nenhum job de automacao porque o disparo sincrono do trigger de INSERT falhou.';

-- Cron (idempotente)
DO $$
DECLARE
  v_supabase_url text;
  v_service_role_key text;
BEGIN
  IF to_regclass('cron.job') IS NULL THEN
    RAISE NOTICE 'pg_cron unavailable; skipping check-lead-created-backlog-triggers schedule.';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'net' AND p.proname = 'http_post'
  ) THEN
    RAISE NOTICE 'net.http_post unavailable; skipping check-lead-created-backlog-triggers schedule.';
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'check-lead-created-backlog-triggers') THEN
    PERFORM cron.unschedule('check-lead-created-backlog-triggers');
  END IF;

  PERFORM cron.schedule(
    'check-lead-created-backlog-triggers',
    '*/5 * * * *',
    'SELECT public.check_lead_created_backlog_triggers();'
  );

  RAISE NOTICE 'check-lead-created-backlog-triggers cron scheduled (5min).';
END $$;

-- automation_flows_health() passa a reportar tambem o novo cron/backlog,
-- mantendo o resto do corpo identico ao definido em
-- 20260912170000_responded_predicate_includes_deleted_chats.sql.
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

  SELECT count(*) INTO v_elegible
  FROM (
    WITH chat_activity AS (
      SELECT c.lead_id, MAX(c.last_message_at) AS last_activity_at
      FROM public.comm_whatsapp_chats c
      WHERE c.lead_id IS NOT NULL
        AND c.deleted_at IS NULL
      GROUP BY c.lead_id
    ), outbound_activity AS (
      SELECT c.lead_id, MIN(m.message_at) AS first_outbound_at
      FROM public.comm_whatsapp_chats c
      JOIN public.comm_whatsapp_messages m ON m.chat_id = c.id
      WHERE c.lead_id IS NOT NULL
        AND m.direction = 'outbound'
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
    LEFT JOIN outbound_activity o ON o.lead_id = l.id
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
      AND NOT EXISTS (
        SELECT 1
        FROM public.comm_whatsapp_chats sc
        JOIN public.comm_whatsapp_messages m ON m.chat_id = sc.id
        WHERE sc.lead_id = l.id
          AND m.direction = 'inbound'
          AND public.comm_whatsapp_message_preview_text(m.media_caption, m.text_content, m.message_type) IS NOT NULL
          AND m.message_at > COALESCE(o.first_outbound_at, 'infinity'::timestamptz)
      )
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

  SELECT count(*) INTO v_backlog_elegible
  FROM public.leads l
  WHERE NOT COALESCE(l.skip_automation, false)
    AND COALESCE(l.canal, '') != 'whatsapp_campaign'
    AND l.created_at > now() - interval '72 hours'
    AND NOT EXISTS (
      SELECT 1 FROM public.auto_contact_flow_jobs j WHERE j.lead_id = l.id
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
