/*
  # Campaign step dispatches + stage-level atomic reserve

  Adds `comm_whatsapp_campaign_step_dispatches` — a durable lifecycle row
  per physical message (target + step_index) — and
  `reserve_comm_whatsapp_campaign_stage_dispatch` which atomically:

    1. Serialises the campaign (FOR UPDATE)
    2. Validates pacing against the LAST stage reservation timestamp
    3. Validates daily_send_limit including pending slots from this reservation
    4. Inserts N step_dispatch rows as 'pending' (not sending)
    5. Records a 'stage_dispatch_reserved' pacing marker
  all within one transaction.

  The existing `reserve_comm_whatsapp_campaign_dispatch` remains untouched for
  the single-message (non-burst) path.
*/

BEGIN;

-- ─────────────────────────────────────────────────────────────────────
-- 1. Step dispatches table
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.comm_whatsapp_campaign_step_dispatches (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id           uuid        NOT NULL REFERENCES public.comm_whatsapp_campaigns(id) ON DELETE CASCADE,
  target_id             uuid        NOT NULL REFERENCES public.comm_whatsapp_campaign_targets(id) ON DELETE CASCADE,
  step_index            integer     NOT NULL,
  stage_index           integer     NOT NULL,
  dispatch_key          text        NOT NULL,  -- '{campaign_id}:{target_id}:{step_index}'
  status                text        NOT NULL DEFAULT 'pending',
  -- pending = reservado (slots consumidos no daily limit), request ainda nao enviado
  -- sending = request ao provider pode ter sido iniciado
  -- sent    = provider aceitou + persistencia local concluida
  -- failed  = erro definitivo
  -- uncertain = provider pode ter aceito, sem checkpoint local
  -- cancelled = cancelado por opt-out/erro definitivo em step anterior do mesmo burst
  -- skipped  = step nao aplicavel (ex.: status_change nao executado)
  attempts              integer     NOT NULL DEFAULT 0,
  external_message_id   text,
  delivery_status       text,
  error_message         text,
  next_retry_at         timestamptz,
  provider_accepted_at  timestamptz,
  persisted_at          timestamptz,
  resolved_at           timestamptz,
  resolution            text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT comm_whatsapp_campaign_step_dispatches_key_unique
    UNIQUE (dispatch_key),
  CONSTRAINT comm_whatsapp_campaign_step_dispatches_status_check
    CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'uncertain', 'cancelled', 'skipped'))
);

CREATE INDEX IF NOT EXISTS idx_step_dispatches_lookup
  ON public.comm_whatsapp_campaign_step_dispatches (campaign_id, target_id, step_index);

CREATE INDEX IF NOT EXISTS idx_step_dispatches_pending_retry
  ON public.comm_whatsapp_campaign_step_dispatches (target_id, next_retry_at)
  WHERE status = 'failed' AND next_retry_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_step_dispatches_sending_age
  ON public.comm_whatsapp_campaign_step_dispatches (created_at)
  WHERE status = 'sending' AND external_message_id IS NULL;

-- ─────────────────────────────────────────────────────────────────────
-- 2. Pacing marker index (stage_dispatch_reserved events)
-- ─────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_comm_whatsapp_campaign_stage_reserved_events
  ON public.comm_whatsapp_campaign_events (campaign_id, created_at DESC)
  WHERE event_type = 'stage_dispatch_reserved';

-- ─────────────────────────────────────────────────────────────────────
-- 3. RPC: reserve_comm_whatsapp_campaign_stage_dispatch
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.reserve_comm_whatsapp_campaign_stage_dispatch(
  p_campaign_id uuid,
  p_target_id uuid,
  p_lock_token text,
  p_stage_index integer,
  p_expected_message_count integer,
  p_steps jsonb  -- [{step_index, stage_index, step_kind, message_text, media_url, ...}]
)
RETURNS TABLE (
  result text,
  retry_at timestamptz,
  reason text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_campaign public.comm_whatsapp_campaigns%ROWTYPE;
  v_min_interval interval;
  v_last_pacing_at timestamptz;
  v_daily_dispatches integer;
  v_daily_retry_at timestamptz;
  v_remaining integer;
  v_inserted integer := 0;
  v_step jsonb;
  v_step_index integer;
  v_stage_index integer;
  v_dispatch_key text;
BEGIN
  IF p_steps IS NULL OR jsonb_array_length(p_steps) = 0 THEN
    RAISE EXCEPTION 'A reserva de stage requer ao menos um step.';
  END IF;

  IF p_expected_message_count < 1 THEN
    RAISE EXCEPTION 'O numero esperado de mensagens deve ser >= 1.';
  END IF;

  -- ── 1. Serialise the campaign ──
  SELECT * INTO v_campaign
  FROM public.comm_whatsapp_campaigns
  WHERE id = p_campaign_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Campanha nao encontrada.';
  END IF;

  -- ── 2. Validate target lease ──
  IF NOT EXISTS (
    SELECT 1 FROM public.comm_whatsapp_campaign_targets
    WHERE id = p_target_id
      AND campaign_id = p_campaign_id
      AND status = 'sending'
      AND lock_token = p_lock_token
  ) THEN
    RETURN QUERY SELECT 'lease_lost'::text, NULL::timestamptz,
      'A reserva do alvo expirou ou foi assumida por outro worker.'::text;
    RETURN;
  END IF;

  -- ── 3. Pacing: use the LAST stage reservation timestamp ──
  --    (not send_started — that depends on the first message being sent)
  v_min_interval := make_interval(secs => 60.0 / GREATEST(v_campaign.pacing_per_minute, 1));

  SELECT MAX(ev.created_at)
  INTO v_last_pacing_at
  FROM public.comm_whatsapp_campaign_events AS ev
  WHERE ev.campaign_id = p_campaign_id
    AND ev.event_type IN ('stage_dispatch_reserved', 'target_provider_send_started')
    AND COALESCE(ev.payload->>'dispatch_permit_state', 'reserved') <> 'released';

  IF v_last_pacing_at IS NOT NULL AND v_last_pacing_at + v_min_interval > v_now THEN
    RETURN QUERY SELECT 'rate_limited'::text,
      v_last_pacing_at + v_min_interval,
      'A campanha ainda nao atingiu o intervalo minimo entre envios.'::text;
    RETURN;
  END IF;

  -- ── 4. Daily limit: count existing + this reservation ──
  IF v_campaign.daily_send_limit IS NOT NULL THEN
    -- Count all non-released, non-retry dispatches in the last 24h
    -- Retries are excluded because slots were already consumed by the original reservation.
    SELECT COUNT(*)::integer, MIN(ev.created_at + interval '24 hours')
    INTO v_daily_dispatches, v_daily_retry_at
    FROM public.comm_whatsapp_campaign_events AS ev
    WHERE ev.campaign_id = p_campaign_id
      AND ev.event_type IN ('stage_dispatch_reserved', 'target_provider_send_started')
      AND ev.created_at >= v_now - interval '24 hours'
      AND COALESCE(ev.payload->>'dispatch_permit_state', 'reserved') <> 'released'
      AND COALESCE(ev.payload->>'is_retry', 'false') <> 'true';

    v_remaining := GREATEST(v_campaign.daily_send_limit - v_daily_dispatches, 0);

    IF v_remaining < p_expected_message_count THEN
      RETURN QUERY SELECT 'daily_limited'::text,
        COALESCE(v_daily_retry_at, v_now + interval '24 hours'),
        format('Limite diario: restam %s slots, stage precisa de %s.', v_remaining, p_expected_message_count)::text;
      RETURN;
    END IF;
  END IF;

  -- ── 5. Insert step_dispatch rows as 'pending' (ON CONFLICT = idempotent) ──
  FOR v_step IN SELECT jsonb_array_elements(p_steps)
  LOOP
    v_step_index := (v_step->>'step_index')::integer;
    v_stage_index := COALESCE((v_step->>'stage_index')::integer, p_stage_index);
    v_dispatch_key := p_campaign_id || ':' || p_target_id || ':' || v_step_index;

    INSERT INTO public.comm_whatsapp_campaign_step_dispatches (
      campaign_id, target_id, step_index, stage_index, dispatch_key, status
    ) VALUES (
      p_campaign_id, p_target_id, v_step_index, v_stage_index, v_dispatch_key, 'pending'
    )
    ON CONFLICT (dispatch_key) DO UPDATE
      SET updated_at = v_now
    WHERE comm_whatsapp_campaign_step_dispatches.status IN ('pending', 'sending');

    IF FOUND THEN
      v_inserted := v_inserted + 1;
    END IF;
  END LOOP;

  -- ── 6. Record pacing marker atomically ──
  INSERT INTO public.comm_whatsapp_campaign_events (
    campaign_id, target_id, event_type, payload, created_at
  ) VALUES (
    p_campaign_id, p_target_id, 'stage_dispatch_reserved',
    jsonb_build_object(
      'stage_index', p_stage_index,
      'expected_message_count', p_expected_message_count,
      'dispatch_permit_state', 'reserved',
      'reserved_at', v_now
    ),
    v_now
  );

  RETURN QUERY SELECT 'reserved'::text, NULL::timestamptz, NULL::text;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_comm_whatsapp_campaign_stage_dispatch(
  uuid, uuid, text, integer, integer, jsonb
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reserve_comm_whatsapp_campaign_stage_dispatch(
  uuid, uuid, text, integer, integer, jsonb
) TO service_role;

-- ─────────────────────────────────────────────────────────────────────
-- 4. RPC: advance_step_dispatch — atomic transition for a single step
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.advance_step_dispatch(
  p_dispatch_key text,
  p_new_status text,
  p_external_message_id text DEFAULT NULL,
  p_delivery_status text DEFAULT NULL,
  p_error_message text DEFAULT NULL,
  p_next_retry_at timestamptz DEFAULT NULL,
  p_resolution text DEFAULT NULL
)
RETURNS TABLE (
  dispatch_id uuid,
  old_status text,
  new_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dispatch record;
BEGIN
  SELECT * INTO v_dispatch
  FROM public.comm_whatsapp_campaign_step_dispatches
  WHERE dispatch_key = p_dispatch_key
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  old_status := v_dispatch.status;
  new_status := p_new_status;

  UPDATE public.comm_whatsapp_campaign_step_dispatches
  SET status = p_new_status,
      external_message_id = COALESCE(p_external_message_id, external_message_id),
      delivery_status = COALESCE(p_delivery_status, delivery_status),
      error_message = p_error_message,
      next_retry_at = p_next_retry_at,
      resolution = COALESCE(p_resolution, resolution),
      resolved_at = CASE WHEN p_new_status IN ('sent', 'failed', 'uncertain', 'cancelled', 'skipped')
                         THEN clock_timestamp()
                         ELSE resolved_at END,
      provider_accepted_at = CASE WHEN p_new_status = 'sending' AND p_external_message_id IS NOT NULL
                                  THEN clock_timestamp()
                                  ELSE provider_accepted_at END,
      persisted_at = CASE WHEN p_new_status = 'sent'
                          THEN clock_timestamp()
                          ELSE persisted_at END,
      updated_at = clock_timestamp()
  WHERE dispatch_key = p_dispatch_key
    AND (
      -- Allow transitions from valid source states
      (p_new_status = 'sending'    AND status = 'pending')
      OR (p_new_status = 'sent'        AND status = 'sending')
      OR (p_new_status = 'failed'      AND status = 'sending')
      OR (p_new_status = 'uncertain'   AND status = 'sending')
      OR (p_new_status = 'cancelled'   AND status IN ('pending', 'sending'))
      OR (p_new_status = 'skipped'     AND status IN ('pending'))
      -- Retry: failed → sending
      OR (p_new_status = 'sending'     AND status = 'failed')
    )
  RETURNING id INTO dispatch_id;

  IF dispatch_id IS NULL THEN
    -- Transition was not valid (already in target state, or from invalid source)
    dispatch_id := v_dispatch.id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.advance_step_dispatch(
  text, text, text, text, text, timestamptz, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.advance_step_dispatch(
  text, text, text, text, text, timestamptz, text
) TO service_role;

-- ─────────────────────────────────────────────────────────────────────
-- 5. RPC: release_pending_stage_dispatches — abandon pending slots
--    after lease lost or timeout, WITHOUT having called the provider.
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.release_pending_stage_dispatches(
  p_target_id uuid,
  p_lock_token text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_released integer;
BEGIN
  -- Only release dispatches for a target whose lease is still held (or expired)
  -- and that never left 'pending' (no provider call was made).
  UPDATE public.comm_whatsapp_campaign_step_dispatches
  SET status = 'cancelled',
      resolved_at = clock_timestamp(),
      resolution = 'lease_lost_pending',
      updated_at = clock_timestamp()
  WHERE target_id = p_target_id
    AND status = 'pending';

  GET DIAGNOSTICS v_released = ROW_COUNT;
  RETURN v_released;
END;
$$;

REVOKE ALL ON FUNCTION public.release_pending_stage_dispatches(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.release_pending_stage_dispatches(uuid, text) TO service_role;

-- ─────────────────────────────────────────────────────────────────────
-- 6. RPC: cancel_future_pending_dispatches — cancel pending dispatches
--    AFTER a specific step_index, so the target can be re-claimed for
--    retry without deadlock from orphaned pending rows.
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cancel_future_pending_dispatches(
  p_target_id uuid,
  p_after_step_index integer
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cancelled integer;
BEGIN
  UPDATE public.comm_whatsapp_campaign_step_dispatches
  SET status = 'cancelled',
      resolved_at = clock_timestamp(),
      resolution = 'future_pending_after_failure',
      updated_at = clock_timestamp()
  WHERE target_id = p_target_id
    AND status = 'pending'
    AND step_index > p_after_step_index;

  GET DIAGNOSTICS v_cancelled = ROW_COUNT;
  RETURN v_cancelled;
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_future_pending_dispatches(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_future_pending_dispatches(uuid, integer) TO service_role;

-- ─────────────────────────────────────────────────────────────────────
-- 7. RPC: reserve_comm_whatsapp_campaign_stage_dispatch_retry
--    Same as reserve but skips daily limit check (slots were already
--    consumed by the original reservation). Only re-creates dispatches
--    for steps that are cancelled/missing (future steps after failure).
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.reserve_comm_whatsapp_campaign_stage_dispatch_retry(
  p_campaign_id uuid,
  p_target_id uuid,
  p_lock_token text,
  p_stage_index integer,
  p_steps jsonb
)
RETURNS TABLE (
  result text,
  retry_at timestamptz,
  reason text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_campaign public.comm_whatsapp_campaigns%ROWTYPE;
  v_min_interval interval;
  v_last_pacing_at timestamptz;
  v_step jsonb;
  v_step_index integer;
  v_stage_index integer;
  v_dispatch_key text;
BEGIN
  IF p_steps IS NULL OR jsonb_array_length(p_steps) = 0 THEN
    RAISE EXCEPTION 'O retry de stage requer ao menos um step.';
  END IF;

  -- Serialise the campaign
  SELECT * INTO v_campaign
  FROM public.comm_whatsapp_campaigns
  WHERE id = p_campaign_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Campanha nao encontrada.';
  END IF;

  -- Validate target lease
  IF NOT EXISTS (
    SELECT 1 FROM public.comm_whatsapp_campaign_targets
    WHERE id = p_target_id
      AND campaign_id = p_campaign_id
      AND status = 'sending'
      AND lock_token = p_lock_token
  ) THEN
    RETURN QUERY SELECT 'lease_lost'::text, NULL::timestamptz,
      'A reserva do alvo expirou ou foi assumida por outro worker.'::text;
    RETURN;
  END IF;

  -- NOTE: Pacing check SKIPPED for retries — retry is a continuation
  -- of the same burst, not a new pacing event.

  -- NOTE: Daily limit check SKIPPED for retries — slots were already
  -- consumed by the original stage_dispatch_reserved event.

  -- Insert step_dispatch rows as 'pending' (ON CONFLICT = idempotent)
  -- Only creates rows that don't exist or are in terminal state
  FOR v_step IN SELECT jsonb_array_elements(p_steps)
  LOOP
    v_step_index := (v_step->>'step_index')::integer;
    v_stage_index := COALESCE((v_step->>'stage_index')::integer, p_stage_index);
    v_dispatch_key := p_campaign_id || ':' || p_target_id || ':' || v_step_index;

    INSERT INTO public.comm_whatsapp_campaign_step_dispatches (
      campaign_id, target_id, step_index, stage_index, dispatch_key, status
    ) VALUES (
      p_campaign_id, p_target_id, v_step_index, v_stage_index, v_dispatch_key, 'pending'
    )
    ON CONFLICT (dispatch_key) DO UPDATE
      SET status = 'pending',
          updated_at = v_now,
          next_retry_at = NULL,
          error_message = NULL,
          resolved_at = NULL,
          resolution = NULL
    WHERE comm_whatsapp_campaign_step_dispatches.status IN ('cancelled', 'skipped');
  END LOOP;

  -- Record retry pacing marker (flagged as retry for audit)
  INSERT INTO public.comm_whatsapp_campaign_events (
    campaign_id, target_id, event_type, payload, created_at
  ) VALUES (
    p_campaign_id, p_target_id, 'stage_dispatch_reserved',
    jsonb_build_object(
      'stage_index', p_stage_index,
      'expected_message_count', jsonb_array_length(p_steps),
      'dispatch_permit_state', 'reserved',
      'reserved_at', v_now,
      'is_retry', true
    ),
    v_now
  );

  RETURN QUERY SELECT 'reserved'::text, NULL::timestamptz, NULL::text;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_comm_whatsapp_campaign_stage_dispatch_retry(
  uuid, uuid, text, integer, jsonb
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reserve_comm_whatsapp_campaign_stage_dispatch_retry(
  uuid, uuid, text, integer, jsonb
) TO service_role;

COMMIT;
