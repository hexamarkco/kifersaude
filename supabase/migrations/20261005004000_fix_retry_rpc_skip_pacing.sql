/*
  Fix: Skip pacing and daily limit for retry reservations.

  The retry RPC (reserve_comm_whatsapp_campaign_stage_dispatch_retry) should
  skip both pacing and daily limit checks because:
  1. Retries are continuations of the same burst, not new pacing events
  2. Slots were already consumed by the original reservation
*/

BEGIN;

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
