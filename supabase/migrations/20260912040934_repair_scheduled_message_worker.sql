/*
  # Repair scheduled WhatsApp message delivery

  The original migration only created the cron job when legacy application
  settings were present. Production has no such settings, leaving scheduled
  messages indefinitely pending. This migration uses a purpose-scoped,
  database-held random token for the cron-to-Edge-Function call, atomically
  claims messages before sending, and polls every ten seconds.
*/

BEGIN;

CREATE TABLE IF NOT EXISTS public.comm_whatsapp_worker_tokens (
  purpose text PRIMARY KEY,
  token text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT comm_whatsapp_worker_tokens_purpose_check
    CHECK (purpose = 'process-scheduled-messages'),
  CONSTRAINT comm_whatsapp_worker_tokens_token_check
    CHECK (length(token) >= 32)
);

ALTER TABLE public.comm_whatsapp_worker_tokens ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.comm_whatsapp_worker_tokens FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.comm_whatsapp_worker_tokens TO service_role;

INSERT INTO public.comm_whatsapp_worker_tokens (purpose, token)
VALUES ('process-scheduled-messages', encode(gen_random_bytes(32), 'hex'))
ON CONFLICT (purpose) DO NOTHING;

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
BEGIN
  RETURN QUERY
  WITH due_messages AS (
    SELECT sm.id
    FROM public.comm_whatsapp_scheduled_messages AS sm
    WHERE sm.attempts < sm.max_attempts
      AND (
        (
          sm.status = 'scheduled'
          AND (
            (sm.recurrence = 'none' AND sm.scheduled_at <= clock_timestamp())
            OR (sm.recurrence <> 'none' AND sm.next_run_at IS NOT NULL AND sm.next_run_at <= clock_timestamp())
          )
        )
        OR (
          sm.status = 'failed'
          AND sm.next_retry_at IS NOT NULL
          AND sm.next_retry_at <= clock_timestamp()
        )
      )
    ORDER BY COALESCE(sm.next_retry_at, sm.next_run_at, sm.scheduled_at), sm.id
    LIMIT GREATEST(LEAST(p_batch_size, 10), 1)
    FOR UPDATE SKIP LOCKED
  ), claimed_messages AS (
    UPDATE public.comm_whatsapp_scheduled_messages AS sm
    SET
      status = 'sending',
      last_attempt_at = clock_timestamp(),
      updated_at = clock_timestamp()
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

REVOKE ALL ON FUNCTION public.poll_scheduled_messages(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.poll_scheduled_messages(integer) TO service_role;

CREATE OR REPLACE FUNCTION public.advance_scheduled_message(
  p_message_id uuid,
  p_new_status text,
  p_external_message_id text DEFAULT NULL,
  p_delivery_status text DEFAULT NULL,
  p_error_message text DEFAULT NULL,
  p_next_retry_at timestamptz DEFAULT NULL
)
RETURNS TABLE (
  message_id uuid,
  old_status text,
  new_status text,
  next_run_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_msg public.comm_whatsapp_scheduled_messages%ROWTYPE;
  v_next_run timestamptz;
  v_interval interval;
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
    (p_new_status = 'sent' AND v_msg.status = 'sending')
    OR (p_new_status = 'failed' AND v_msg.status = 'sending')
    OR (p_new_status = 'cancelled' AND v_msg.status IN ('scheduled', 'failed'))
    OR (p_new_status = 'expired' AND v_msg.status = 'scheduled')
  ) THEN
    RAISE EXCEPTION 'Transicao de status invalida: % -> %', v_msg.status, p_new_status;
  END IF;

  v_next_run := NULL;
  IF p_new_status = 'sent' AND v_msg.recurrence <> 'none' THEN
    IF v_msg.recurrence_ends_at IS NULL OR v_msg.recurrence_ends_at > v_now THEN
      v_interval := CASE v_msg.recurrence
        WHEN 'daily' THEN make_interval(days => COALESCE((v_msg.recurrence_config->>'interval')::int, 1))
        WHEN 'weekly' THEN make_interval(days => 7 * COALESCE((v_msg.recurrence_config->>'interval')::int, 1))
        WHEN 'monthly' THEN make_interval(months => COALESCE((v_msg.recurrence_config->>'interval')::int, 1))
        ELSE NULL
      END;

      IF v_interval IS NOT NULL THEN
        v_next_run := COALESCE(v_msg.next_run_at, v_msg.scheduled_at) + v_interval;
        IF v_msg.recurrence_ends_at IS NOT NULL AND v_next_run > v_msg.recurrence_ends_at THEN
          v_next_run := NULL;
        END IF;
      END IF;
    END IF;
  END IF;

  UPDATE public.comm_whatsapp_scheduled_messages AS sm
  SET
    status = CASE
      WHEN p_new_status = 'sent' AND v_msg.recurrence <> 'none' AND v_next_run IS NULL THEN 'expired'
      ELSE p_new_status
    END,
    external_message_id = COALESCE(p_external_message_id, sm.external_message_id),
    delivery_status = COALESCE(p_delivery_status, sm.delivery_status),
    error_message = p_error_message,
    next_retry_at = p_next_retry_at,
    attempts = v_msg.attempts + CASE WHEN p_new_status IN ('sent', 'failed') THEN 1 ELSE 0 END,
    sent_at = CASE WHEN p_new_status = 'sent' THEN v_now ELSE sm.sent_at END,
    next_run_at = CASE
      WHEN p_new_status = 'sent' AND v_msg.recurrence <> 'none' THEN v_next_run
      ELSE sm.next_run_at
    END,
    updated_at = v_now
  WHERE sm.id = p_message_id
  RETURNING
    sm.id,
    v_msg.status,
    sm.status,
    sm.next_run_at
  INTO message_id, old_status, new_status, next_run_at;

  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.advance_scheduled_message(uuid, text, text, text, text, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.advance_scheduled_message(uuid, text, text, text, text, timestamptz) TO service_role;

CREATE OR REPLACE FUNCTION public.invoke_scheduled_messages_worker()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, net
AS $$
DECLARE
  v_token text;
  v_request_id bigint;
BEGIN
  SELECT token INTO v_token
  FROM public.comm_whatsapp_worker_tokens
  WHERE purpose = 'process-scheduled-messages';

  IF v_token IS NULL THEN
    RAISE EXCEPTION 'Scheduled messages worker token is not configured.';
  END IF;

  SELECT net.http_post(
    url := 'https://eaxvvhamkmovkoqssahj.supabase.co/functions/v1/process-scheduled-messages',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Scheduled-Worker-Token', v_token
    ),
    body := jsonb_build_object('action', 'process', 'source', 'cron', 'limit', 10),
    timeout_milliseconds := 10000
  ) INTO v_request_id;

  RETURN v_request_id;
END;
$$;

REVOKE ALL ON FUNCTION public.invoke_scheduled_messages_worker() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.invoke_scheduled_messages_worker() TO postgres, service_role;

DO $$
BEGIN
  IF to_regclass('cron.job') IS NULL THEN
    RAISE EXCEPTION 'pg_cron is required to schedule WhatsApp messages.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc AS p
    JOIN pg_namespace AS n ON n.oid = p.pronamespace
    WHERE n.nspname = 'net' AND p.proname = 'http_post'
  ) THEN
    RAISE EXCEPTION 'pg_net is required to schedule WhatsApp messages.';
  END IF;

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-scheduled-messages') THEN
    PERFORM cron.unschedule('process-scheduled-messages');
  END IF;

  PERFORM cron.schedule(
    'process-scheduled-messages',
    '10 seconds',
    'SELECT public.invoke_scheduled_messages_worker();'
  );
END;
$$;

COMMIT;
