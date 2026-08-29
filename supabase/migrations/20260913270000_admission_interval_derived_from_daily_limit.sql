/*
  # Intervalo de admissao derivado direto de novos contatos/dia + janela

  `pacing_per_minute` era um numero solto que o usuario tinha que escolher
  sem saber muito bem o que significava. O espacamento entre admissoes de
  contatos novos deveria ser 100% derivado de "novos contatos por dia"
  dividido pela duracao da janela de envio - sem exigir nenhum campo extra.

  Esta migracao para de olhar pacing_per_minute na hora de espacar admissoes
  e passa a calcular o intervalo minimo direto a partir de daily_send_limit
  e send_window_start/send_window_end (ou 24h corridas se nao houver janela),
  igual ao que a tela agora mostra como "1 novo contato a cada N min".

  A coluna pacing_per_minute continua existindo (NOT NULL, mantida por
  compatibilidade), mas deixa de ser usada por esta funcao.
*/

BEGIN;

CREATE OR REPLACE FUNCTION public.reserve_comm_whatsapp_campaign_dispatch(
  p_campaign_id uuid,
  p_target_id uuid,
  p_lock_token text,
  p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE (
  result text,
  event_id uuid,
  attempts integer,
  retry_at timestamptz,
  reason text,
  reserved_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_campaign public.comm_whatsapp_campaigns%ROWTYPE;
  v_attempts integer;
  v_event_id uuid;
  v_last_dispatch_at timestamptz;
  v_min_interval interval;
  v_daily_dispatches integer;
  v_daily_retry_at timestamptz;
  v_is_first_step boolean;
  v_window_minutes integer;
  v_start_minutes integer;
  v_end_minutes integer;
BEGIN
  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'O payload da reserva de campanha deve ser um objeto JSON.';
  END IF;

  -- Serialize all permits for one campaign. This protects both the rolling
  -- quota and the pace when cron and dashboard workers overlap.
  SELECT *
  INTO v_campaign
  FROM public.comm_whatsapp_campaigns
  WHERE id = p_campaign_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Campanha nao encontrada.';
  END IF;

  SELECT target.attempts
  INTO v_attempts
  FROM public.comm_whatsapp_campaign_targets AS target
  WHERE target.id = p_target_id
    AND target.campaign_id = p_campaign_id
    AND target.status = 'sending'
    AND target.lock_token = p_lock_token
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY
    SELECT 'lease_lost'::text, NULL::uuid, NULL::integer, NULL::timestamptz,
      'A reserva do alvo expirou ou foi assumida por outro worker.'::text, NULL::timestamptz;
    RETURN;
  END IF;

  -- So a primeira mensagem da sequencia (estagio 1) conta como "admissao"
  -- de um contato novo. O restante do estagio 1 e os estagios seguintes
  -- ficam de fora do espacamento e do limite diario, mas continuam
  -- respeitando a janela de horario e seus proprios intervalos entre
  -- estagios normalmente.
  v_is_first_step := COALESCE((p_payload ->> 'stepIndex')::int, -1) = 0;

  IF v_is_first_step AND v_campaign.daily_send_limit IS NOT NULL AND v_campaign.daily_send_limit > 0 THEN
    IF v_campaign.send_window_start IS NOT NULL AND v_campaign.send_window_end IS NOT NULL
       AND v_campaign.send_window_start <> v_campaign.send_window_end THEN
      v_start_minutes := EXTRACT(HOUR FROM v_campaign.send_window_start)::int * 60
        + EXTRACT(MINUTE FROM v_campaign.send_window_start)::int;
      v_end_minutes := EXTRACT(HOUR FROM v_campaign.send_window_end)::int * 60
        + EXTRACT(MINUTE FROM v_campaign.send_window_end)::int;
      v_window_minutes := CASE
        WHEN v_start_minutes < v_end_minutes THEN v_end_minutes - v_start_minutes
        ELSE (24 * 60 - v_start_minutes) + v_end_minutes
      END;
    ELSE
      v_window_minutes := 24 * 60;
    END IF;

    v_min_interval := make_interval(mins => GREATEST(v_window_minutes / v_campaign.daily_send_limit, 1));

    SELECT MAX(dispatch.created_at)
    INTO v_last_dispatch_at
    FROM public.comm_whatsapp_campaign_events AS dispatch
    WHERE dispatch.campaign_id = p_campaign_id
      AND dispatch.event_type = 'target_provider_send_started'
      AND COALESCE((dispatch.payload ->> 'stepIndex')::int, -1) = 0
      AND COALESCE(dispatch.payload ->> 'dispatch_permit_state', 'reserved') <> 'released';

    IF v_last_dispatch_at IS NOT NULL AND v_last_dispatch_at + v_min_interval > v_now THEN
      RETURN QUERY
      SELECT 'rate_limited'::text, NULL::uuid, NULL::integer,
        v_last_dispatch_at + v_min_interval,
        'A campanha atingiu o intervalo configurado entre novos contatos.'::text,
        NULL::timestamptz;
      RETURN;
    END IF;
  END IF;

  IF v_campaign.daily_send_limit IS NOT NULL AND v_is_first_step THEN
    SELECT COUNT(*)::integer, MIN(dispatch.created_at + interval '24 hours')
    INTO v_daily_dispatches, v_daily_retry_at
    FROM public.comm_whatsapp_campaign_events AS dispatch
    WHERE dispatch.campaign_id = p_campaign_id
      AND dispatch.event_type = 'target_provider_send_started'
      AND dispatch.created_at >= v_now - interval '24 hours'
      AND COALESCE((dispatch.payload ->> 'stepIndex')::int, -1) = 0
      AND COALESCE(dispatch.payload ->> 'dispatch_permit_state', 'reserved') <> 'released';

    IF v_daily_dispatches >= v_campaign.daily_send_limit THEN
      RETURN QUERY
      SELECT 'daily_limited'::text, NULL::uuid, NULL::integer,
        COALESCE(v_daily_retry_at, v_now + interval '24 hours'),
        'A campanha atingiu o limite diario de novos contatos.'::text,
        NULL::timestamptz;
      RETURN;
    END IF;
  END IF;

  v_attempts := v_attempts + 1;

  UPDATE public.comm_whatsapp_campaign_targets AS target
  SET attempts = v_attempts,
      last_attempt_at = v_now,
      locked_at = v_now,
      error_message = NULL,
      updated_at = v_now
  WHERE target.id = p_target_id
    AND target.status = 'sending'
    AND target.lock_token = p_lock_token;

  IF NOT FOUND THEN
    RETURN QUERY
    SELECT 'lease_lost'::text, NULL::uuid, NULL::integer, NULL::timestamptz,
      'A reserva do alvo expirou ou foi assumida por outro worker.'::text, NULL::timestamptz;
    RETURN;
  END IF;

  INSERT INTO public.comm_whatsapp_campaign_events (
    campaign_id,
    target_id,
    event_type,
    payload,
    created_at
  )
  VALUES (
    p_campaign_id,
    p_target_id,
    'target_provider_send_started',
    p_payload || jsonb_build_object(
      'dispatch_permit_state', 'reserved',
      'reserved_at', v_now
    ),
    v_now
  )
  RETURNING id INTO v_event_id;

  RETURN QUERY
  SELECT 'reserved'::text, v_event_id, v_attempts, NULL::timestamptz,
    NULL::text, v_now;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_comm_whatsapp_campaign_dispatch(uuid, uuid, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reserve_comm_whatsapp_campaign_dispatch(uuid, uuid, text, jsonb) TO service_role;

COMMIT;
