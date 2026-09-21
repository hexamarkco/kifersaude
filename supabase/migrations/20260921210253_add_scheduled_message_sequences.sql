BEGIN;

-- Sequences are intentionally separate from the legacy one-message scheduler.
-- Existing scheduled rows keep their current worker and state machine.
CREATE TABLE IF NOT EXISTS public.comm_whatsapp_scheduled_sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES public.comm_whatsapp_channels(id) ON DELETE CASCADE,
  chat_id uuid REFERENCES public.comm_whatsapp_chats(id) ON DELETE SET NULL,
  phone_digits text NOT NULL,
  phone_number text,
  display_name text,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  contract_id uuid REFERENCES public.contracts(id) ON DELETE SET NULL,
  reminder_id uuid REFERENCES public.reminders(id) ON DELETE SET NULL,
  label text,
  status text NOT NULL DEFAULT 'scheduled',
  scheduled_at timestamptz NOT NULL,
  current_step_index integer NOT NULL DEFAULT 0,
  cancel_on_inbound_message boolean NOT NULL DEFAULT true,
  last_error text,
  paused_at timestamptz,
  cancelled_at timestamptz,
  completed_at timestamptz,
  created_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT comm_whatsapp_scheduled_sequences_status_check
    CHECK (status IN ('scheduled', 'running', 'paused', 'completed', 'cancelled')),
  CONSTRAINT comm_whatsapp_scheduled_sequences_step_check
    CHECK (current_step_index >= 0)
);

CREATE TABLE IF NOT EXISTS public.comm_whatsapp_scheduled_sequence_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id uuid NOT NULL REFERENCES public.comm_whatsapp_scheduled_sequences(id) ON DELETE CASCADE,
  step_index integer NOT NULL,
  delay_seconds integer NOT NULL DEFAULT 0,
  due_at timestamptz,
  reminder_id uuid REFERENCES public.reminders(id) ON DELETE SET NULL,
  message_type text,
  text_content text,
  media_url text,
  media_mime_type text,
  media_file_name text,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  next_retry_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT comm_whatsapp_scheduled_sequence_steps_unique
    UNIQUE (sequence_id, step_index),
  CONSTRAINT comm_whatsapp_scheduled_sequence_steps_delay_check
    CHECK (delay_seconds >= 0),
  CONSTRAINT comm_whatsapp_scheduled_sequence_steps_attempts_check
    CHECK (attempts >= 0),
  CONSTRAINT comm_whatsapp_scheduled_sequence_steps_status_check
    CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  CONSTRAINT comm_whatsapp_scheduled_sequence_steps_message_type_check
    CHECK (message_type IS NULL OR message_type IN ('text', 'image', 'video', 'document', 'audio', 'voice')),
  CONSTRAINT comm_whatsapp_scheduled_sequence_steps_content_check
    CHECK (message_type IS NULL OR length(btrim(COALESCE(text_content, ''))) > 0 OR media_url IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS public.comm_whatsapp_scheduled_sequence_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  step_id uuid NOT NULL REFERENCES public.comm_whatsapp_scheduled_sequence_steps(id) ON DELETE CASCADE,
  action_index integer NOT NULL,
  action_type text NOT NULL,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  executed_at timestamptz,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT comm_whatsapp_scheduled_sequence_actions_unique
    UNIQUE (step_id, action_index),
  CONSTRAINT comm_whatsapp_scheduled_sequence_actions_index_check
    CHECK (action_index >= 0),
  CONSTRAINT comm_whatsapp_scheduled_sequence_actions_type_check
    CHECK (action_type IN ('update_status', 'complete_reminder', 'create_reminder', 'cancel_sequence')),
  CONSTRAINT comm_whatsapp_scheduled_sequence_actions_status_check
    CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  CONSTRAINT comm_whatsapp_scheduled_sequence_actions_config_check
    CHECK (jsonb_typeof(config) = 'object')
);

ALTER TABLE public.comm_whatsapp_scheduled_messages
  ADD COLUMN IF NOT EXISTS sequence_id uuid REFERENCES public.comm_whatsapp_scheduled_sequences(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sequence_step_id uuid REFERENCES public.comm_whatsapp_scheduled_sequence_steps(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reminder_id uuid REFERENCES public.reminders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_scheduled_sequences_channel_status
  ON public.comm_whatsapp_scheduled_sequences (channel_id, status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_scheduled_sequences_lead
  ON public.comm_whatsapp_scheduled_sequences (lead_id, status, updated_at DESC)
  WHERE lead_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_scheduled_sequence_steps_due
  ON public.comm_whatsapp_scheduled_sequence_steps (status, due_at, next_retry_at)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_scheduled_sequence_steps_sequence
  ON public.comm_whatsapp_scheduled_sequence_steps (sequence_id, step_index);
CREATE INDEX IF NOT EXISTS idx_scheduled_sequence_actions_step
  ON public.comm_whatsapp_scheduled_sequence_actions (step_id, action_index);
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_sequence
  ON public.comm_whatsapp_scheduled_messages (sequence_id, sequence_step_id)
  WHERE sequence_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_comm_whatsapp_scheduled_sequences_updated_at
  ON public.comm_whatsapp_scheduled_sequences;
CREATE TRIGGER trg_comm_whatsapp_scheduled_sequences_updated_at
  BEFORE UPDATE ON public.comm_whatsapp_scheduled_sequences
  FOR EACH ROW
  EXECUTE FUNCTION public.set_comm_whatsapp_campaign_updated_at();

DROP TRIGGER IF EXISTS trg_comm_whatsapp_scheduled_sequence_steps_updated_at
  ON public.comm_whatsapp_scheduled_sequence_steps;
CREATE TRIGGER trg_comm_whatsapp_scheduled_sequence_steps_updated_at
  BEFORE UPDATE ON public.comm_whatsapp_scheduled_sequence_steps
  FOR EACH ROW
  EXECUTE FUNCTION public.set_comm_whatsapp_campaign_updated_at();

DROP TRIGGER IF EXISTS trg_comm_whatsapp_scheduled_sequence_actions_updated_at
  ON public.comm_whatsapp_scheduled_sequence_actions;
CREATE TRIGGER trg_comm_whatsapp_scheduled_sequence_actions_updated_at
  BEFORE UPDATE ON public.comm_whatsapp_scheduled_sequence_actions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_comm_whatsapp_campaign_updated_at();

ALTER TABLE public.comm_whatsapp_scheduled_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comm_whatsapp_scheduled_sequence_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comm_whatsapp_scheduled_sequence_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view scheduled sequences"
  ON public.comm_whatsapp_scheduled_sequences;
CREATE POLICY "Users can view scheduled sequences"
  ON public.comm_whatsapp_scheduled_sequences
  FOR SELECT TO authenticated
  USING (public.current_user_can_view_comm_whatsapp());

DROP POLICY IF EXISTS "Users can manage scheduled sequences"
  ON public.comm_whatsapp_scheduled_sequences;
CREATE POLICY "Users can manage scheduled sequences"
  ON public.comm_whatsapp_scheduled_sequences
  FOR ALL TO authenticated
  USING (public.current_user_can_edit_comm_whatsapp())
  WITH CHECK (public.current_user_can_edit_comm_whatsapp());

DROP POLICY IF EXISTS "Users can view scheduled sequence steps"
  ON public.comm_whatsapp_scheduled_sequence_steps;
CREATE POLICY "Users can view scheduled sequence steps"
  ON public.comm_whatsapp_scheduled_sequence_steps
  FOR SELECT TO authenticated
  USING (public.current_user_can_view_comm_whatsapp());

DROP POLICY IF EXISTS "Users can manage scheduled sequence steps"
  ON public.comm_whatsapp_scheduled_sequence_steps;
CREATE POLICY "Users can manage scheduled sequence steps"
  ON public.comm_whatsapp_scheduled_sequence_steps
  FOR ALL TO authenticated
  USING (public.current_user_can_edit_comm_whatsapp())
  WITH CHECK (public.current_user_can_edit_comm_whatsapp());

DROP POLICY IF EXISTS "Users can view scheduled sequence actions"
  ON public.comm_whatsapp_scheduled_sequence_actions;
CREATE POLICY "Users can view scheduled sequence actions"
  ON public.comm_whatsapp_scheduled_sequence_actions
  FOR SELECT TO authenticated
  USING (public.current_user_can_view_comm_whatsapp());

DROP POLICY IF EXISTS "Users can manage scheduled sequence actions"
  ON public.comm_whatsapp_scheduled_sequence_actions;
CREATE POLICY "Users can manage scheduled sequence actions"
  ON public.comm_whatsapp_scheduled_sequence_actions
  FOR ALL TO authenticated
  USING (public.current_user_can_edit_comm_whatsapp())
  WITH CHECK (public.current_user_can_edit_comm_whatsapp());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.comm_whatsapp_scheduled_sequences TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comm_whatsapp_scheduled_sequence_steps TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comm_whatsapp_scheduled_sequence_actions TO authenticated;
GRANT ALL ON public.comm_whatsapp_scheduled_sequences TO service_role;
GRANT ALL ON public.comm_whatsapp_scheduled_sequence_steps TO service_role;
GRANT ALL ON public.comm_whatsapp_scheduled_sequence_actions TO service_role;

CREATE OR REPLACE FUNCTION public.create_scheduled_message_sequence(
  p_channel_id uuid,
  p_phone_digits text,
  p_scheduled_at timestamptz,
  p_steps jsonb,
  p_chat_id uuid DEFAULT NULL,
  p_lead_id uuid DEFAULT NULL,
  p_contract_id uuid DEFAULT NULL,
  p_reminder_id uuid DEFAULT NULL,
  p_label text DEFAULT NULL,
  p_cancel_on_inbound_message boolean DEFAULT true
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sequence_id uuid;
  v_step jsonb;
  v_action jsonb;
  v_step_id uuid;
  v_index integer := 0;
  v_action_index integer;
  v_chat_id uuid := p_chat_id;
  v_phone text;
  v_display text;
  v_step_delay integer;
  v_message jsonb;
  v_message_type text;
  v_text text;
  v_media_url text;
  v_media_mime text;
  v_media_file text;
  v_action_type text;
  v_lead_exists boolean;
BEGIN
  IF auth.uid() IS NULL OR NOT public.current_user_can_edit_comm_whatsapp() THEN
    RAISE EXCEPTION 'Usuário sem permissão para criar sequência de mensagens.';
  END IF;
  IF p_scheduled_at <= clock_timestamp() THEN
    RAISE EXCEPTION 'A primeira etapa precisa estar no futuro.';
  END IF;
  IF jsonb_typeof(p_steps) <> 'array' OR jsonb_array_length(p_steps) = 0 THEN
    RAISE EXCEPTION 'A sequência precisa ter ao menos uma etapa.';
  END IF;
  IF jsonb_array_length(p_steps) > 30 THEN
    RAISE EXCEPTION 'A sequência pode ter no máximo 30 etapas.';
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.leads WHERE id = p_lead_id)
    INTO v_lead_exists;
  IF p_lead_id IS NOT NULL AND NOT v_lead_exists THEN
    RAISE EXCEPTION 'Lead não encontrado.';
  END IF;

  IF v_chat_id IS NULL THEN
    SELECT id, phone_number, display_name
      INTO v_chat_id, v_phone, v_display
      FROM public.comm_whatsapp_chats
     WHERE phone_digits = p_phone_digits
     ORDER BY updated_at DESC
     LIMIT 1;
  ELSE
    SELECT phone_number, display_name
      INTO v_phone, v_display
      FROM public.comm_whatsapp_chats
     WHERE id = v_chat_id;
  END IF;

  INSERT INTO public.comm_whatsapp_scheduled_sequences (
    channel_id, chat_id, phone_digits, phone_number, display_name,
    lead_id, contract_id, reminder_id, label, status, scheduled_at,
    cancel_on_inbound_message, created_by
  ) VALUES (
    p_channel_id, v_chat_id, p_phone_digits, COALESCE(v_phone, p_phone_digits),
    COALESCE(v_display, p_phone_digits), p_lead_id, p_contract_id, p_reminder_id,
    NULLIF(btrim(p_label), ''), 'scheduled', p_scheduled_at,
    COALESCE(p_cancel_on_inbound_message, true), auth.uid()
  ) RETURNING id INTO v_sequence_id;

  FOR v_step IN SELECT value FROM jsonb_array_elements(p_steps)
  LOOP
    v_step_delay := GREATEST(COALESCE((v_step->>'delay_seconds')::integer, 0), 0);
    v_message := CASE WHEN jsonb_typeof(v_step->'message') = 'object' THEN v_step->'message' ELSE '{}'::jsonb END;
    v_message_type := NULLIF(btrim(v_message->>'message_type'), '');
    v_text := NULLIF(btrim(v_message->>'text_content'), '');
    v_media_url := NULLIF(btrim(v_message->>'media_url'), '');
    v_media_mime := NULLIF(btrim(v_message->>'media_mime_type'), '');
    v_media_file := NULLIF(btrim(v_message->>'media_file_name'), '');

    IF v_message_type IS NOT NULL AND v_text IS NULL AND v_media_url IS NULL THEN
      RAISE EXCEPTION 'A etapa % possui mensagem sem texto ou mídia.', v_index + 1;
    END IF;
    IF v_message_type IS NULL AND jsonb_array_length(COALESCE(v_step->'actions', '[]'::jsonb)) = 0 THEN
      RAISE EXCEPTION 'A etapa % precisa ter mensagem ou ação.', v_index + 1;
    END IF;

    INSERT INTO public.comm_whatsapp_scheduled_sequence_steps (
      sequence_id, step_index, delay_seconds, due_at, reminder_id,
      message_type, text_content, media_url, media_mime_type, media_file_name
    ) VALUES (
      v_sequence_id, v_index, v_step_delay,
      CASE WHEN v_index = 0 THEN p_scheduled_at ELSE NULL END,
      NULLIF(v_step->>'reminder_id', '')::uuid,
      v_message_type, v_text, v_media_url, v_media_mime, v_media_file
    ) RETURNING id INTO v_step_id;

    v_action_index := 0;
    FOR v_action IN SELECT value FROM jsonb_array_elements(COALESCE(v_step->'actions', '[]'::jsonb))
    LOOP
      v_action_type := NULLIF(btrim(v_action->>'type'), '');
      IF v_action_type NOT IN ('update_status', 'complete_reminder', 'create_reminder', 'cancel_sequence') THEN
        RAISE EXCEPTION 'Ação inválida na etapa %.', v_index + 1;
      END IF;
      IF v_action_type IN ('update_status', 'complete_reminder', 'create_reminder') AND p_lead_id IS NULL THEN
        RAISE EXCEPTION 'A etapa % possui uma ação de CRM sem lead vinculado.', v_index + 1;
      END IF;
      INSERT INTO public.comm_whatsapp_scheduled_sequence_actions (
        step_id, action_index, action_type, config
      ) VALUES (v_step_id, v_action_index, v_action_type, COALESCE(v_action - 'type', '{}'::jsonb));
      v_action_index := v_action_index + 1;
    END LOOP;
    v_index := v_index + 1;
  END LOOP;

  RETURN v_sequence_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_scheduled_message_sequence(
  uuid, text, timestamptz, jsonb, uuid, uuid, uuid, uuid, text, boolean
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_scheduled_message_sequence(
  uuid, text, timestamptz, jsonb, uuid, uuid, uuid, uuid, text, boolean
) TO authenticated;

CREATE OR REPLACE FUNCTION public.claim_scheduled_message_sequence_steps(
  p_batch_size integer DEFAULT 10
)
RETURNS TABLE (
  step_id uuid,
  sequence_id uuid,
  step_index integer,
  delay_seconds integer,
  attempts integer,
  due_at timestamptz,
  reminder_id uuid,
  sequence_reminder_id uuid,
  channel_id uuid,
  chat_id uuid,
  phone_digits text,
  phone_number text,
  display_name text,
  lead_id uuid,
  contract_id uuid,
  label text,
  cancel_on_inbound_message boolean,
  message_type text,
  text_content text,
  media_url text,
  media_mime_type text,
  media_file_name text,
  action_id uuid,
  action_index integer,
  action_type text,
  action_config jsonb,
  action_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.comm_whatsapp_scheduled_sequence_steps
     SET status = 'pending', next_retry_at = NULL,
         last_error = COALESCE(last_error, 'Retomada após interrupção do processador.'),
         updated_at = clock_timestamp()
   WHERE status = 'processing'
     AND started_at < clock_timestamp() - interval '10 minutes';

  RETURN QUERY
  WITH due_steps AS (
    SELECT s.id
      FROM public.comm_whatsapp_scheduled_sequence_steps s
      JOIN public.comm_whatsapp_scheduled_sequences q ON q.id = s.sequence_id
     WHERE s.status = 'pending'
       AND q.status IN ('scheduled', 'running')
       AND s.due_at IS NOT NULL
       AND s.due_at <= clock_timestamp()
       AND (s.next_retry_at IS NULL OR s.next_retry_at <= clock_timestamp())
     ORDER BY s.due_at, s.sequence_id, s.step_index
     LIMIT GREATEST(LEAST(COALESCE(p_batch_size, 10), 20), 1)
     FOR UPDATE OF s SKIP LOCKED
  ), claimed AS (
    UPDATE public.comm_whatsapp_scheduled_sequence_steps s
       SET status = 'processing', attempts = s.attempts + 1,
           started_at = COALESCE(s.started_at, clock_timestamp()), updated_at = clock_timestamp()
      FROM due_steps d
     WHERE s.id = d.id
    RETURNING s.*
  )
  SELECT c.id, q.id, c.step_index, c.delay_seconds, c.attempts, c.due_at, c.reminder_id,
         q.reminder_id, q.channel_id, q.chat_id, q.phone_digits, q.phone_number,
         q.display_name, q.lead_id, q.contract_id, q.label, q.cancel_on_inbound_message,
         c.message_type, c.text_content, c.media_url, c.media_mime_type, c.media_file_name,
         a.id, a.action_index, a.action_type, a.config, a.status
    FROM claimed c
    JOIN public.comm_whatsapp_scheduled_sequences q ON q.id = c.sequence_id
    LEFT JOIN public.comm_whatsapp_scheduled_sequence_actions a ON a.step_id = c.id
   ORDER BY c.due_at, c.sequence_id, c.step_index, a.action_index;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_scheduled_message_sequence_steps(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_scheduled_message_sequence_steps(integer) TO service_role;

CREATE OR REPLACE FUNCTION public.cancel_scheduled_message_sequence(
  p_sequence_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_changed boolean := false;
BEGIN
  IF auth.uid() IS NULL OR NOT public.current_user_can_edit_comm_whatsapp() THEN
    RAISE EXCEPTION 'Usuário sem permissão para cancelar sequência.';
  END IF;
  UPDATE public.comm_whatsapp_scheduled_sequences
     SET status = 'cancelled', cancelled_at = clock_timestamp(), last_error = p_reason,
         updated_at = clock_timestamp()
   WHERE id = p_sequence_id AND status IN ('scheduled', 'running', 'paused')
  RETURNING true INTO v_changed;
  IF v_changed THEN
    UPDATE public.comm_whatsapp_scheduled_sequence_steps
       SET status = 'cancelled', last_error = p_reason, updated_at = clock_timestamp()
     WHERE sequence_id = p_sequence_id AND status IN ('pending', 'processing');
    UPDATE public.comm_whatsapp_scheduled_messages
       SET status = 'cancelled', cancelled_at = clock_timestamp(),
           cancelled_reason = COALESCE(p_reason, 'Sequência cancelada.'), updated_at = clock_timestamp()
     WHERE sequence_id = p_sequence_id AND status IN ('scheduled', 'failed');
  END IF;
  RETURN COALESCE(v_changed, false);
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_scheduled_message_sequence(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_scheduled_message_sequence(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.retry_scheduled_message_sequence(
  p_sequence_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_step_id uuid;
  v_changed boolean := false;
BEGIN
  IF auth.uid() IS NULL OR NOT public.current_user_can_edit_comm_whatsapp() THEN
    RAISE EXCEPTION 'Usuário sem permissão para retomar sequência.';
  END IF;
  SELECT id INTO v_step_id
    FROM public.comm_whatsapp_scheduled_sequence_steps
   WHERE sequence_id = p_sequence_id AND status = 'failed'
   ORDER BY step_index DESC LIMIT 1;
  IF v_step_id IS NULL THEN RETURN false; END IF;
  UPDATE public.comm_whatsapp_scheduled_sequence_actions
     SET status = 'pending', error_message = NULL, updated_at = clock_timestamp()
   WHERE step_id = v_step_id AND status = 'failed';
  UPDATE public.comm_whatsapp_scheduled_sequence_steps
     SET status = 'pending', due_at = clock_timestamp(), next_retry_at = NULL,
         last_error = NULL, updated_at = clock_timestamp()
   WHERE id = v_step_id;
  UPDATE public.comm_whatsapp_scheduled_sequences
     SET status = 'scheduled', last_error = NULL, paused_at = NULL, updated_at = clock_timestamp()
   WHERE id = p_sequence_id AND status = 'paused'
  RETURNING true INTO v_changed;
  RETURN COALESCE(v_changed, false);
END;
$$;

REVOKE ALL ON FUNCTION public.retry_scheduled_message_sequence(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.retry_scheduled_message_sequence(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.cancel_scheduled_message_sequences_on_inbound()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.comm_whatsapp_scheduled_sequences q
     SET status = 'cancelled', cancelled_at = clock_timestamp(),
         last_error = 'Cancelada porque o contato respondeu antes da próxima etapa.',
         updated_at = clock_timestamp()
   WHERE q.channel_id = NEW.channel_id
     AND q.chat_id = NEW.chat_id
     AND q.cancel_on_inbound_message
     AND q.status IN ('scheduled', 'running', 'paused')
     AND NEW.message_at >= q.created_at;

  UPDATE public.comm_whatsapp_scheduled_sequence_steps s
     SET status = 'cancelled', last_error = 'Cancelada por resposta inbound.', updated_at = clock_timestamp()
    FROM public.comm_whatsapp_scheduled_sequences q
   WHERE s.sequence_id = q.id AND q.channel_id = NEW.channel_id AND q.chat_id = NEW.chat_id
     AND q.cancel_on_inbound_message AND q.status = 'cancelled' AND s.status IN ('pending', 'processing');
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_scheduled_message_sequences_on_inbound() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_cancel_scheduled_message_sequences_on_inbound
  ON public.comm_whatsapp_messages;
CREATE TRIGGER trg_cancel_scheduled_message_sequences_on_inbound
  AFTER INSERT OR UPDATE OF direction ON public.comm_whatsapp_messages
  FOR EACH ROW
  WHEN (NEW.direction = 'inbound')
  EXECUTE FUNCTION public.cancel_scheduled_message_sequences_on_inbound();

COMMIT;
