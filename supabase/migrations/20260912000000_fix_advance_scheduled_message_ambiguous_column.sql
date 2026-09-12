-- Fix: column reference "next_run_at" is ambiguous
-- The function output parameter `next_run_at` collides with the table column
-- in the RETURNING clause. The Edge Function ignores the return value, so
-- remove the ambiguous column from RETURNING.

CREATE OR REPLACE FUNCTION public.advance_scheduled_message(
  p_message_id           uuid,
  p_new_status           text,
  p_external_message_id  text DEFAULT NULL,
  p_delivery_status      text DEFAULT NULL,
  p_error_message        text DEFAULT NULL,
  p_next_retry_at        timestamptz DEFAULT NULL
)
RETURNS TABLE (
  message_id   uuid,
  old_status   text,
  new_status   text,
  next_run_at  timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now         timestamptz := clock_timestamp();
  v_msg         public.comm_whatsapp_scheduled_messages%ROWTYPE;
  v_next_run    timestamptz;
  v_interval    interval;
BEGIN
  SELECT * INTO v_msg
  FROM public.comm_whatsapp_scheduled_messages
  WHERE id = p_message_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  old_status := v_msg.status;
  new_status := p_new_status;

  IF NOT (
    (p_new_status = 'sending'   AND v_msg.status = 'scheduled')
    OR (p_new_status = 'sending'   AND v_msg.status = 'failed')
    OR (p_new_status = 'sent'      AND v_msg.status = 'sending')
    OR (p_new_status = 'failed'    AND v_msg.status = 'sending')
    OR (p_new_status = 'cancelled' AND v_msg.status IN ('scheduled', 'failed'))
    OR (p_new_status = 'expired'   AND v_msg.status = 'scheduled')
  ) THEN
    RAISE EXCEPTION 'Transicao de status invalida: % -> %', v_msg.status, p_new_status;
  END IF;

  v_next_run := NULL;
  IF p_new_status = 'sent' AND v_msg.recurrence <> 'none' THEN
    IF v_msg.recurrence_ends_at IS NULL OR v_msg.recurrence_ends_at > v_now THEN
      v_interval := CASE v_msg.recurrence
        WHEN 'daily'   THEN make_interval(days  => COALESCE((v_msg.recurrence_config->>'interval')::int, 1))
        WHEN 'weekly'  THEN make_interval(days  => 7 * COALESCE((v_msg.recurrence_config->>'interval')::int, 1))
        WHEN 'monthly' THEN make_interval(months => COALESCE((v_msg.recurrence_config->>'interval')::int, 1))
        ELSE NULL
      END;

      IF v_interval IS NOT NULL THEN
        v_next_run := v_msg.scheduled_at + v_interval;

        IF v_msg.recurrence_ends_at IS NOT NULL AND v_next_run > v_msg.recurrence_ends_at THEN
          v_next_run := NULL;
        END IF;
      END IF;
    END IF;
  END IF;

  UPDATE public.comm_whatsapp_scheduled_messages
  SET
    status              = CASE
                            WHEN p_new_status = 'sent' AND v_msg.recurrence <> 'none' AND v_next_run IS NULL THEN 'expired'
                            ELSE p_new_status
                          END,
    external_message_id = COALESCE(p_external_message_id, external_message_id),
    delivery_status     = COALESCE(p_delivery_status, delivery_status),
    error_message       = p_error_message,
    next_retry_at       = p_next_retry_at,
    attempts            = v_msg.attempts + 1,
    last_attempt_at     = v_now,
    sent_at             = CASE WHEN p_new_status = 'sent' THEN v_now ELSE sent_at END,
    next_run_at         = CASE
                            WHEN p_new_status = 'sent' AND v_msg.recurrence <> 'none' THEN v_next_run
                            ELSE next_run_at
                          END,
    updated_at          = v_now
  WHERE id = p_message_id
  RETURNING
    comm_whatsapp_scheduled_messages.id,
    v_msg.status,
    comm_whatsapp_scheduled_messages.status,
    NULL::timestamptz;
END;
$$;

REVOKE ALL ON FUNCTION public.advance_scheduled_message(
  uuid, text, text, text, text, timestamptz
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.advance_scheduled_message(
  uuid, text, text, text, text, timestamptz
) TO service_role;
