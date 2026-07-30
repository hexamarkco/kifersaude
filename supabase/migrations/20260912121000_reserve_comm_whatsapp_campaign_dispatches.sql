BEGIN;

-- The worker must reserve a provider dispatch in the same transaction that
-- checks campaign-wide quota and pacing. Target locks alone cannot prevent
-- concurrent workers from exceeding either limit.
CREATE INDEX IF NOT EXISTS idx_comm_whatsapp_campaign_dispatch_events
  ON public.comm_whatsapp_campaign_events (campaign_id, created_at DESC)
  WHERE event_type = 'target_provider_send_started';

CREATE OR REPLACE FUNCTION public.claim_comm_whatsapp_campaign_targets(
  p_campaign_id uuid,
  p_limit integer DEFAULT 25,
  p_lock_token text DEFAULT gen_random_uuid()::text,
  p_lock_ttl interval DEFAULT interval '15 minutes'
)
RETURNS SETOF public.comm_whatsapp_campaign_targets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH due_targets AS (
    SELECT target.id
    FROM public.comm_whatsapp_campaign_targets AS target
    WHERE target.campaign_id = p_campaign_id
      AND (
        target.status IN ('pending', 'scheduled')
        OR (target.status = 'sending' AND target.locked_at < now() - p_lock_ttl)
      )
      AND COALESCE(target.next_retry_at, target.next_send_at, '-infinity'::timestamptz) <= now()
      AND (target.locked_at IS NULL OR target.locked_at < now() - p_lock_ttl)
      AND NOT EXISTS (
        SELECT 1
        FROM public.comm_whatsapp_campaign_events AS pending_event
        WHERE pending_event.target_id = target.id
          AND pending_event.event_type IN (
            'target_provider_send_started',
            'target_provider_accepted_persistence_pending'
          )
          AND NOT (pending_event.payload ? 'recovered_at')
          AND NOT (pending_event.payload ? 'resolved_at')
      )
    ORDER BY COALESCE(target.next_send_at, target.created_at), target.created_at
    FOR UPDATE SKIP LOCKED
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 25), 1), 100)
  )
  UPDATE public.comm_whatsapp_campaign_targets AS target
  SET status = 'sending',
      locked_at = now(),
      lock_token = p_lock_token,
      error_message = NULL,
      updated_at = now()
  FROM due_targets
  WHERE target.id = due_targets.id
  RETURNING target.*;
END;
$$;

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

  IF v_campaign.daily_send_limit IS NOT NULL THEN
    SELECT COUNT(*)::integer, MIN(dispatch.created_at + interval '24 hours')
    INTO v_daily_dispatches, v_daily_retry_at
    FROM public.comm_whatsapp_campaign_events AS dispatch
    WHERE dispatch.campaign_id = p_campaign_id
      AND dispatch.event_type = 'target_provider_send_started'
      AND dispatch.created_at >= v_now - interval '24 hours'
      AND COALESCE(dispatch.payload ->> 'dispatch_permit_state', 'reserved') <> 'released';

    IF v_daily_dispatches >= v_campaign.daily_send_limit THEN
      RETURN QUERY
      SELECT 'daily_limited'::text, NULL::uuid, NULL::integer,
        COALESCE(v_daily_retry_at, v_now + interval '24 hours'),
        'A campanha atingiu o limite diario de envios.'::text,
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

REVOKE ALL ON FUNCTION public.claim_comm_whatsapp_campaign_targets(uuid, integer, text, interval) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_comm_whatsapp_campaign_targets(uuid, integer, text, interval) TO service_role;

REVOKE ALL ON FUNCTION public.reserve_comm_whatsapp_campaign_dispatch(uuid, uuid, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reserve_comm_whatsapp_campaign_dispatch(uuid, uuid, text, jsonb) TO service_role;

COMMIT;
