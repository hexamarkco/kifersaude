/*
  # Ritmo por minuto passa a espacar admissao de contato, nao toda mensagem

  `pacing_per_minute` exigia um intervalo minimo entre QUALQUER despacho da
  campanha (qualquer estagio, qualquer contato), entao follow-ups de
  contatos ja admitidos competiam pelo mesmo ritmo que a admissao de
  contatos novos. Agora, no mesmo espirito da mudanca anterior no limite
  diario, o ritmo so gate/mede o intervalo entre admissoes (stepIndex = 0):
  uma vez admitido, o resto da sequencia do contato sai assim que estiver
  no horario, sem esperar o ritmo configurado.
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
  -- ficam de fora tanto do ritmo por minuto quanto do limite diario, mas
  -- continuam respeitando a janela de horario e seus proprios intervalos
  -- configurados entre estagios normalmente.
  v_is_first_step := COALESCE((p_payload ->> 'stepIndex')::int, -1) = 0;

  IF v_is_first_step THEN
    v_min_interval := make_interval(secs => 60.0 / GREATEST(v_campaign.pacing_per_minute, 1));

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
        'A campanha atingiu o ritmo configurado de admissao de contatos.'::text,
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
