/*
  # Limite diario de disparos conta contatos novos, nao mensagens

  `daily_send_limit` contava toda mensagem enviada pela campanha (qualquer
  estagio, qualquer contato) numa janela movel de 24h. Isso nao correspondia
  ao que o rotulo "Limite a cada 24h" sugere: o usuario espera um teto de
  quantos CONTATOS NOVOS comecam a receber a campanha por dia, sem que o
  restante da sequencia deles (resto do estagio 1 e os estagios seguintes)
  conte de novo contra esse teto.

  A primeira mensagem fisica de qualquer contato sempre tem step_index = 0
  (compartilhado entre todos os alvos; variantes A/B tambem usam step_index
  0), entao basta restringir a contagem e o proprio gate a reservas cujo
  payload.stepIndex seja 0.
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

  v_min_interval := make_interval(secs => 60.0 / GREATEST(v_campaign.pacing_per_minute, 1));

  SELECT MAX(dispatch.created_at)
  INTO v_last_dispatch_at
  FROM public.comm_whatsapp_campaign_events AS dispatch
  WHERE dispatch.campaign_id = p_campaign_id
    AND dispatch.event_type = 'target_provider_send_started'
    AND COALESCE(dispatch.payload ->> 'dispatch_permit_state', 'reserved') <> 'released';

  IF v_last_dispatch_at IS NOT NULL AND v_last_dispatch_at + v_min_interval > v_now THEN
    RETURN QUERY
    SELECT 'rate_limited'::text, NULL::uuid, NULL::integer,
      v_last_dispatch_at + v_min_interval,
      'A campanha atingiu o ritmo configurado de envios.'::text,
      NULL::timestamptz;
    RETURN;
  END IF;

  -- So a primeira mensagem da sequencia (estagio 1) conta como "admissao"
  -- de um contato novo. O restante do estagio 1 e os estagios seguintes
  -- ficam de fora do teto diario, mas continuam respeitando o ritmo/minuto
  -- e a janela de horario normalmente.
  v_is_first_step := COALESCE((p_payload ->> 'stepIndex')::int, -1) = 0;

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
