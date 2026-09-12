/*
  # Scheduled WhatsApp Messages

  Adds one-off and recurring scheduled messages for the WhatsApp inbox.
  A worker (pg_cron + Edge Function) polls `comm_whatsapp_scheduled_messages`
  for rows whose `scheduled_at` (or `next_run_at` for recurrences) is due,
  sends them through Whapi via `comm-whatsapp-send`, and transitions status.

  ## Tables
  - `comm_whatsapp_scheduled_messages` – core scheduling + payload row

  ## RPCs
  - `create_scheduled_message()` – atomic creation with validation
  - `poll_scheduled_messages()` – worker poll for due messages
  - `advance_scheduled_message()` – atomic state machine for worker
  - `cancel_scheduled_message()` – user-facing cancellation
*/

BEGIN;

-- ─────────────────────────────────────────────────────────────────────
-- 1. Table
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.comm_whatsapp_scheduled_messages (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Channel + destination
  channel_id            uuid        NOT NULL REFERENCES public.comm_whatsapp_channels(id) ON DELETE CASCADE,
  chat_id               uuid        REFERENCES public.comm_whatsapp_chats(id) ON DELETE SET NULL,
  phone_digits          text        NOT NULL,
  phone_number          text,
  display_name          text,

  -- Message content (mirrors comm-whatsapp-send SendMessageBody)
  message_type          text        NOT NULL DEFAULT 'text',
  text_content          text,
  media_url             text,
  media_mime_type       text,
  media_file_name       text,
  media_size_bytes      bigint,

  -- Scheduling
  scheduled_at          timestamptz NOT NULL,
  recurrence            text        NOT NULL DEFAULT 'none',
  recurrence_config     jsonb       NOT NULL DEFAULT '{}'::jsonb,
  next_run_at           timestamptz,
  recurrence_ends_at    timestamptz,

  -- Status + retry
  status                text        NOT NULL DEFAULT 'scheduled',
  attempts              integer     NOT NULL DEFAULT 0,
  max_attempts          integer     NOT NULL DEFAULT 3,
  last_attempt_at       timestamptz,
  next_retry_at         timestamptz,
  error_message         text,
  external_message_id   text,
  delivery_status       text,

  -- Lifecycle timestamps
  sent_at               timestamptz,
  cancelled_at          timestamptz,
  cancelled_reason      text,

  -- Ownership / context
  created_by            uuid        REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  lead_id               uuid        REFERENCES public.leads(id) ON DELETE SET NULL,
  contract_id           uuid        REFERENCES public.contracts(id) ON DELETE SET NULL,

  -- Metadata
  label                 text,
  notes                 text,
  metadata              jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT comm_whatsapp_scheduled_messages_type_check
    CHECK (message_type IN ('text', 'image', 'video', 'document', 'audio', 'voice')),
  CONSTRAINT comm_whatsapp_scheduled_messages_status_check
    CHECK (status IN ('scheduled', 'sending', 'sent', 'failed', 'cancelled', 'expired')),
  CONSTRAINT comm_whatsapp_scheduled_messages_recurrence_check
    CHECK (recurrence IN ('none', 'daily', 'weekly', 'monthly')),
  CONSTRAINT comm_whatsapp_scheduled_messages_attempts_check
    CHECK (attempts >= 0 AND max_attempts >= 1),
  CONSTRAINT comm_whatsapp_scheduled_messages_media_or_text_check
    CHECK (
      length(btrim(COALESCE(text_content, ''))) > 0
      OR media_url IS NOT NULL
    ),
  CONSTRAINT comm_whatsapp_scheduled_messages_next_run_check
    CHECK (
      (recurrence = 'none' AND next_run_at IS NULL)
      OR (recurrence <> 'none')
    ),
  CONSTRAINT comm_whatsapp_scheduled_messages_recurrence_config_is_object
    CHECK (jsonb_typeof(recurrence_config) = 'object'),
  CONSTRAINT comm_whatsapp_scheduled_messages_metadata_is_object
    CHECK (jsonb_typeof(metadata) = 'object')
);

-- ─────────────────────────────────────────────────────────────────────
-- 2. Indexes (optimised for worker polling queries)
-- ─────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_scheduled_messages_due_oneoff
  ON public.comm_whatsapp_scheduled_messages (scheduled_at)
  WHERE status = 'scheduled' AND recurrence = 'none';

CREATE INDEX IF NOT EXISTS idx_scheduled_messages_due_recurring
  ON public.comm_whatsapp_scheduled_messages (next_run_at)
  WHERE status = 'scheduled' AND recurrence <> 'none' AND next_run_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_scheduled_messages_retry
  ON public.comm_whatsapp_scheduled_messages (next_retry_at)
  WHERE status = 'failed' AND next_retry_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_scheduled_messages_stale_sending
  ON public.comm_whatsapp_scheduled_messages (created_at)
  WHERE status = 'sending' AND external_message_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_scheduled_messages_phone_digits
  ON public.comm_whatsapp_scheduled_messages (phone_digits);

CREATE INDEX IF NOT EXISTS idx_scheduled_messages_channel_status
  ON public.comm_whatsapp_scheduled_messages (channel_id, status, scheduled_at);

CREATE INDEX IF NOT EXISTS idx_scheduled_messages_created_by
  ON public.comm_whatsapp_scheduled_messages (created_by, status, scheduled_at DESC);

CREATE INDEX IF NOT EXISTS idx_scheduled_messages_lead_id
  ON public.comm_whatsapp_scheduled_messages (lead_id)
  WHERE lead_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_scheduled_messages_contract_id
  ON public.comm_whatsapp_scheduled_messages (contract_id)
  WHERE contract_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────
-- 3. updated_at trigger
-- ─────────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_scheduled_messages_updated_at ON public.comm_whatsapp_scheduled_messages;
CREATE TRIGGER trg_scheduled_messages_updated_at
  BEFORE UPDATE ON public.comm_whatsapp_scheduled_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.set_comm_whatsapp_campaign_updated_at();

-- ─────────────────────────────────────────────────────────────────────
-- 4. Row Level Security
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.comm_whatsapp_scheduled_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view scheduled messages"
  ON public.comm_whatsapp_scheduled_messages;
CREATE POLICY "Users can view scheduled messages"
  ON public.comm_whatsapp_scheduled_messages
  FOR SELECT
  TO authenticated
  USING (public.current_user_can_view_comm_whatsapp());

DROP POLICY IF EXISTS "Users can manage scheduled messages"
  ON public.comm_whatsapp_scheduled_messages;
CREATE POLICY "Users can manage scheduled messages"
  ON public.comm_whatsapp_scheduled_messages
  FOR ALL
  TO authenticated
  USING (public.current_user_can_edit_comm_whatsapp())
  WITH CHECK (public.current_user_can_edit_comm_whatsapp());

DROP POLICY IF EXISTS "Service role can manage scheduled messages"
  ON public.comm_whatsapp_scheduled_messages;
CREATE POLICY "Service role can manage scheduled messages"
  ON public.comm_whatsapp_scheduled_messages
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────
-- 5. RPC: create a scheduled message (validates input atomically)
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_scheduled_message(
  p_channel_id       uuid,
  p_phone_digits     text,
  p_scheduled_at     timestamptz,
  p_message_type     text        DEFAULT 'text',
  p_text_content     text        DEFAULT NULL,
  p_media_url        text        DEFAULT NULL,
  p_media_mime_type  text        DEFAULT NULL,
  p_media_file_name  text        DEFAULT NULL,
  p_recurrence       text        DEFAULT 'none',
  p_recurrence_config jsonb      DEFAULT '{}'::jsonb,
  p_recurrence_ends_at timestamptz DEFAULT NULL,
  p_lead_id          uuid        DEFAULT NULL,
  p_contract_id      uuid        DEFAULT NULL,
  p_label            text        DEFAULT NULL,
  p_notes            text        DEFAULT NULL,
  p_max_attempts     integer     DEFAULT 3
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now       timestamptz := clock_timestamp();
  v_new_id    uuid;
  v_chat_id   uuid;
  v_phone     text;
  v_display   text;
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

  IF p_recurrence = 'none' AND (p_recurrence_config IS NOT NULL AND p_recurrence_config <> '{}'::jsonb) THEN
    RAISE EXCEPTION 'recurrence_config so deve ser preenchido quando ha recorrencia.';
  END IF;

  SELECT id, phone_number, display_name
  INTO v_chat_id, v_phone, v_display
  FROM public.comm_whatsapp_chats
  WHERE phone_digits = p_phone_digits
  ORDER BY updated_at DESC
  LIMIT 1;

  v_phone_num := COALESCE(v_phone, p_phone_digits);
  v_display   := COALESCE(v_display, v_phone_num);

  INSERT INTO public.comm_whatsapp_scheduled_messages (
    channel_id, chat_id, phone_digits, phone_number, display_name,
    message_type, text_content, media_url, media_mime_type, media_file_name,
    scheduled_at, recurrence, recurrence_config, recurrence_ends_at,
    next_run_at, status,
    lead_id, contract_id, created_by, label, notes, max_attempts
  ) VALUES (
    p_channel_id, v_chat_id, p_phone_digits, v_phone_num, v_display,
    p_message_type, p_text_content, p_media_url, p_media_mime_type, p_media_file_name,
    p_scheduled_at, p_recurrence, p_recurrence_config,
    CASE WHEN p_recurrence <> 'none' THEN p_recurrence_ends_at ELSE NULL END,
    CASE WHEN p_recurrence <> 'none' THEN p_scheduled_at ELSE NULL END,
    'scheduled',
    p_lead_id, p_contract_id, auth.uid(), p_label, p_notes, GREATEST(p_max_attempts, 1)
  )
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_scheduled_message(
  uuid, text, timestamptz, text, text, text, text, text,
  text, jsonb, timestamptz, uuid, uuid, text, text, integer
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_scheduled_message(
  uuid, text, timestamptz, text, text, text, text, text,
  text, jsonb, timestamptz, uuid, uuid, text, text, integer
) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- 6. RPC: poll due scheduled messages (for worker)
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.poll_scheduled_messages(
  p_batch_size integer DEFAULT 10
)
RETURNS TABLE (
  message_id         uuid,
  channel_id         uuid,
  chat_id            uuid,
  phone_digits       text,
  phone_number       text,
  display_name       text,
  message_type       text,
  text_content       text,
  media_url          text,
  media_mime_type    text,
  media_file_name    text,
  scheduled_at       timestamptz,
  recurrence         text,
  recurrence_config  jsonb,
  attempts           integer,
  max_attempts       integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    sm.id,
    sm.channel_id,
    sm.chat_id,
    sm.phone_digits,
    sm.phone_number,
    sm.display_name,
    sm.message_type,
    sm.text_content,
    sm.media_url,
    sm.media_mime_type,
    sm.media_file_name,
    sm.scheduled_at,
    sm.recurrence,
    sm.recurrence_config,
    sm.attempts,
    sm.max_attempts
  FROM public.comm_whatsapp_scheduled_messages sm
  WHERE sm.status = 'scheduled'
    AND sm.attempts < sm.max_attempts
    AND (
      (sm.recurrence = 'none' AND sm.scheduled_at <= clock_timestamp())
      OR (sm.recurrence <> 'none' AND sm.next_run_at IS NOT NULL AND sm.next_run_at <= clock_timestamp())
    )
    AND (sm.next_retry_at IS NULL OR sm.next_retry_at <= clock_timestamp())
  ORDER BY sm.scheduled_at ASC
  LIMIT p_batch_size;
END;
$$;

REVOKE ALL ON FUNCTION public.poll_scheduled_messages(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.poll_scheduled_messages(integer) TO service_role;

-- ─────────────────────────────────────────────────────────────────────
-- 7. RPC: mark scheduled message as sent/failed
-- ─────────────────────────────────────────────────────────────────────
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
    comm_whatsapp_scheduled_messages.next_run_at;
END;
$$;

REVOKE ALL ON FUNCTION public.advance_scheduled_message(
  uuid, text, text, text, text, timestamptz
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.advance_scheduled_message(
  uuid, text, text, text, text, timestamptz
) TO service_role;

-- ─────────────────────────────────────────────────────────────────────
-- 8. RPC: cancel a scheduled message
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cancel_scheduled_message(
  p_message_id uuid,
  p_reason     text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := clock_timestamp();
BEGIN
  UPDATE public.comm_whatsapp_scheduled_messages
  SET
    status           = 'cancelled',
    cancelled_at     = v_now,
    cancelled_reason = p_reason,
    updated_at       = v_now
  WHERE id = p_message_id
    AND status IN ('scheduled', 'failed');

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_scheduled_message(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_scheduled_message(uuid, text) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- 9. pg_cron: schedule worker to run every minute
-- ─────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  function_url text;
  service_role_key text;
BEGIN
  IF to_regclass('cron.job') IS NULL THEN
    RAISE NOTICE 'cron.job table not found, skipping scheduled messages worker setup.';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'net'
      AND p.proname = 'http_post'
  ) THEN
    RAISE NOTICE 'net.http_post not available, skipping scheduled messages worker setup.';
    RETURN;
  END IF;

  BEGIN
    function_url := NULLIF(trim(both '"' FROM COALESCE(current_setting('app.settings.supabase_url', true), '')), '');
  EXCEPTION WHEN OTHERS THEN
    function_url := NULL;
  END;

  BEGIN
    service_role_key := NULLIF(trim(both '"' FROM COALESCE(current_setting('app.settings.supabase_service_role_key', true), '')), '');
  EXCEPTION WHEN OTHERS THEN
    service_role_key := NULL;
  END;

  IF function_url IS NULL OR service_role_key IS NULL THEN
    RAISE NOTICE 'Scheduled messages worker not configured (missing supabase_url or service role key).';
    RETURN;
  END IF;

  function_url := rtrim(function_url, '/') || '/functions/v1/process-scheduled-messages';

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-scheduled-messages') THEN
    PERFORM cron.unschedule('process-scheduled-messages');
  END IF;

  PERFORM cron.schedule(
    'process-scheduled-messages',
    '* * * * *',
    format(
      'SELECT net.http_post(url := %L, headers := jsonb_build_object(''Content-Type'', ''application/json'', ''Authorization'', %L), body := jsonb_build_object(''action'', ''process''));',
      function_url,
      'Bearer ' || service_role_key
    )
  );
END $$;

COMMIT;