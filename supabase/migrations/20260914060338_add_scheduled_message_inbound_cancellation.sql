/*
  # Optional cancellation of scheduled WhatsApp messages after an inbound reply

  A sender may opt in per scheduled message. Once the contact sends an inbound
  message after that schedule was created, the pending message (or a retry)
  is cancelled. The trigger makes this immediate; the worker-side guard covers
  replies that arrived while a webhook transaction was being processed.
*/

BEGIN;

ALTER TABLE public.comm_whatsapp_scheduled_messages
  ADD COLUMN IF NOT EXISTS cancel_on_inbound_message boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_scheduled_messages_inbound_cancellation
  ON public.comm_whatsapp_scheduled_messages (channel_id, chat_id, created_at)
  WHERE cancel_on_inbound_message
    AND status IN ('scheduled', 'failed')
    AND chat_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_comm_whatsapp_messages_inbound_chat_message_at
  ON public.comm_whatsapp_messages (channel_id, chat_id, message_at)
  WHERE direction = 'inbound';

-- Recreate, rather than overload, the RPC. The new final parameter has a
-- default, so existing callers that omit it keep their current behaviour.
DROP FUNCTION IF EXISTS public.create_scheduled_message(
  uuid, text, timestamptz, text, text, text, text, text,
  text, jsonb, timestamptz, uuid, uuid, text, text, integer
);

CREATE OR REPLACE FUNCTION public.create_scheduled_message(
  p_channel_id uuid,
  p_phone_digits text,
  p_scheduled_at timestamptz,
  p_message_type text DEFAULT 'text',
  p_text_content text DEFAULT NULL,
  p_media_url text DEFAULT NULL,
  p_media_mime_type text DEFAULT NULL,
  p_media_file_name text DEFAULT NULL,
  p_recurrence text DEFAULT 'none',
  p_recurrence_config jsonb DEFAULT '{}'::jsonb,
  p_recurrence_ends_at timestamptz DEFAULT NULL,
  p_lead_id uuid DEFAULT NULL,
  p_contract_id uuid DEFAULT NULL,
  p_label text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_max_attempts integer DEFAULT 3,
  p_cancel_on_inbound_message boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_new_id uuid;
  v_chat_id uuid;
  v_phone text;
  v_display text;
  v_phone_num text;
BEGIN
  IF p_text_content IS NULL AND p_media_url IS NULL THEN
    RAISE EXCEPTION 'A mensagem precisa de texto ou midia.';
  END IF;

  IF p_scheduled_at < v_now THEN
    RAISE EXCEPTION 'A data de agendamento nao pode ser no passado.';
  END IF;

  IF p_recurrence NOT IN ('none', 'daily', 'weekly', 'monthly') THEN
    RAISE EXCEPTION 'Recorrencia invalida: %', p_recurrence;
  END IF;

  IF p_recurrence = 'none'
     AND p_recurrence_config IS NOT NULL
     AND p_recurrence_config <> '{}'::jsonb THEN
    RAISE EXCEPTION 'recurrence_config so deve ser preenchido quando ha recorrencia.';
  END IF;

  SELECT id, phone_number, display_name
  INTO v_chat_id, v_phone, v_display
  FROM public.comm_whatsapp_chats
  WHERE phone_digits = p_phone_digits
  ORDER BY updated_at DESC
  LIMIT 1;

  v_phone_num := COALESCE(v_phone, p_phone_digits);
  v_display := COALESCE(v_display, v_phone_num);

  INSERT INTO public.comm_whatsapp_scheduled_messages (
    channel_id, chat_id, phone_digits, phone_number, display_name,
    message_type, text_content, media_url, media_mime_type, media_file_name,
    scheduled_at, recurrence, recurrence_config, recurrence_ends_at,
    next_run_at, status, cancel_on_inbound_message,
    lead_id, contract_id, created_by, label, notes, max_attempts
  ) VALUES (
    p_channel_id, v_chat_id, p_phone_digits, v_phone_num, v_display,
    p_message_type, p_text_content, p_media_url, p_media_mime_type, p_media_file_name,
    p_scheduled_at, p_recurrence, p_recurrence_config,
    CASE WHEN p_recurrence <> 'none' THEN p_recurrence_ends_at ELSE NULL END,
    CASE WHEN p_recurrence <> 'none' THEN p_scheduled_at ELSE NULL END,
    'scheduled', COALESCE(p_cancel_on_inbound_message, false),
    p_lead_id, p_contract_id, auth.uid(), p_label, p_notes, GREATEST(p_max_attempts, 1)
  )
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_scheduled_message(
  uuid, text, timestamptz, text, text, text, text, text,
  text, jsonb, timestamptz, uuid, uuid, text, text, integer, boolean
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_scheduled_message(
  uuid, text, timestamptz, text, text, text, text, text,
  text, jsonb, timestamptz, uuid, uuid, text, text, integer, boolean
) TO authenticated;

CREATE OR REPLACE FUNCTION public.cancel_scheduled_messages_on_inbound()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := clock_timestamp();
BEGIN
  UPDATE public.comm_whatsapp_scheduled_messages AS scheduled
  SET
    status = 'cancelled',
    cancelled_at = v_now,
    cancelled_reason = 'Cancelada porque o contato respondeu antes do envio.',
    updated_at = v_now
  WHERE scheduled.channel_id = NEW.channel_id
    AND scheduled.chat_id = NEW.chat_id
    AND scheduled.cancel_on_inbound_message
    AND scheduled.status IN ('scheduled', 'failed')
    AND NEW.message_at >= scheduled.created_at;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_scheduled_messages_on_inbound()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_cancel_scheduled_messages_on_inbound
  ON public.comm_whatsapp_messages;
CREATE TRIGGER trg_cancel_scheduled_messages_on_inbound
  AFTER INSERT OR UPDATE OF direction ON public.comm_whatsapp_messages
  FOR EACH ROW
  WHEN (NEW.direction = 'inbound')
  EXECUTE FUNCTION public.cancel_scheduled_messages_on_inbound();

CREATE OR REPLACE FUNCTION public.poll_scheduled_messages(
  p_batch_size integer DEFAULT 10
)
RETURNS TABLE (
  message_id uuid,
  channel_id uuid,
  chat_id uuid,
  phone_digits text,
  phone_number text,
  display_name text,
  message_type text,
  text_content text,
  media_url text,
  media_mime_type text,
  media_file_name text,
  scheduled_at timestamptz,
  recurrence text,
  recurrence_config jsonb,
  attempts integer,
  max_attempts integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := clock_timestamp();
BEGIN
  UPDATE public.comm_whatsapp_scheduled_messages AS scheduled
  SET
    status = 'cancelled',
    cancelled_at = v_now,
    cancelled_reason = 'Cancelada porque o contato respondeu antes do envio.',
    updated_at = v_now
  WHERE scheduled.cancel_on_inbound_message
    AND scheduled.status IN ('scheduled', 'failed')
    AND scheduled.chat_id IS NOT NULL
    AND (
      (
        scheduled.status = 'scheduled'
        AND (
          (scheduled.recurrence = 'none' AND scheduled.scheduled_at <= v_now)
          OR (
            scheduled.recurrence <> 'none'
            AND scheduled.next_run_at IS NOT NULL
            AND scheduled.next_run_at <= v_now
          )
        )
      )
      OR (
        scheduled.status = 'failed'
        AND scheduled.next_retry_at IS NOT NULL
        AND scheduled.next_retry_at <= v_now
      )
    )
    AND EXISTS (
      SELECT 1
      FROM public.comm_whatsapp_messages AS inbound
      WHERE inbound.channel_id = scheduled.channel_id
        AND inbound.chat_id = scheduled.chat_id
        AND inbound.direction = 'inbound'
        AND inbound.message_at >= scheduled.created_at
    );

  RETURN QUERY
  WITH due_messages AS (
    SELECT sm.id
    FROM public.comm_whatsapp_scheduled_messages AS sm
    WHERE sm.attempts < sm.max_attempts
      AND (
        (
          sm.status = 'scheduled'
          AND (
            (sm.recurrence = 'none' AND sm.scheduled_at <= v_now)
            OR (sm.recurrence <> 'none' AND sm.next_run_at IS NOT NULL AND sm.next_run_at <= v_now)
          )
        )
        OR (
          sm.status = 'failed'
          AND sm.next_retry_at IS NOT NULL
          AND sm.next_retry_at <= v_now
        )
      )
    ORDER BY COALESCE(sm.next_retry_at, sm.next_run_at, sm.scheduled_at), sm.id
    LIMIT GREATEST(LEAST(p_batch_size, 10), 1)
    FOR UPDATE SKIP LOCKED
  ), claimed_messages AS (
    UPDATE public.comm_whatsapp_scheduled_messages AS sm
    SET
      status = 'sending',
      last_attempt_at = v_now,
      updated_at = v_now
    FROM due_messages AS due
    WHERE sm.id = due.id
    RETURNING sm.*
  )
  SELECT
    claimed.id,
    claimed.channel_id,
    claimed.chat_id,
    claimed.phone_digits,
    claimed.phone_number,
    claimed.display_name,
    claimed.message_type,
    claimed.text_content,
    claimed.media_url,
    claimed.media_mime_type,
    claimed.media_file_name,
    claimed.scheduled_at,
    claimed.recurrence,
    claimed.recurrence_config,
    claimed.attempts,
    claimed.max_attempts
  FROM claimed_messages AS claimed;
END;
$$;

REVOKE ALL ON FUNCTION public.poll_scheduled_messages(integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.poll_scheduled_messages(integer) TO service_role;

COMMIT;
