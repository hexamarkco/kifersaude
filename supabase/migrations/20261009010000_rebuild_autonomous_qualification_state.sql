/*
  # Persisted qualification state and hard stop at Aguardando cotacao

  The autonomous attendant previously kept only the chat switch and inferred
  completion from free text. This migration gives the worker a durable state
  and makes the commercial status win over every generic inbound trigger.
*/

BEGIN;

CREATE TABLE IF NOT EXISTS public.ai_autonomous_qualification_states (
  chat_id uuid PRIMARY KEY REFERENCES public.comm_whatsapp_chats(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES public.leads(id) ON DELETE CASCADE,
  state jsonb NOT NULL DEFAULT '{}'::jsonb,
  version bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_autonomous_qualification_states_lead
  ON public.ai_autonomous_qualification_states (lead_id);

ALTER TABLE public.ai_autonomous_qualification_states ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage autonomous qualification states"
  ON public.ai_autonomous_qualification_states;
CREATE POLICY "Service role can manage autonomous qualification states"
  ON public.ai_autonomous_qualification_states
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can view autonomous qualification states"
  ON public.ai_autonomous_qualification_states;
CREATE POLICY "Authenticated users can view autonomous qualification states"
  ON public.ai_autonomous_qualification_states
  FOR SELECT
  TO authenticated
  USING (public.current_user_can_view_comm_whatsapp());

DROP TRIGGER IF EXISTS trg_ai_autonomous_qualification_states_updated_at
  ON public.ai_autonomous_qualification_states;
CREATE TRIGGER trg_ai_autonomous_qualification_states_updated_at
  BEFORE UPDATE ON public.ai_autonomous_qualification_states
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.ai_autonomous_attendance_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL REFERENCES public.comm_whatsapp_chats(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  correlation_id text,
  commercial_status text,
  autonomous_status text,
  qualification_status text,
  decision jsonb NOT NULL DEFAULT '{}'::jsonb,
  qualification_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_autonomous_attendance_events_chat_created
  ON public.ai_autonomous_attendance_events (chat_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.ai_autonomous_reply_locks (
  chat_id uuid PRIMARY KEY REFERENCES public.comm_whatsapp_chats(id) ON DELETE CASCADE,
  owner_id text NOT NULL,
  lease_until timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_autonomous_reply_locks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage autonomous reply locks"
  ON public.ai_autonomous_reply_locks;
CREATE POLICY "Service role can manage autonomous reply locks"
  ON public.ai_autonomous_reply_locks
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.try_acquire_ai_autonomous_reply_lock(
  p_chat_id uuid,
  p_owner_id text,
  p_lease_seconds integer DEFAULT 120
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_acquired boolean := false;
BEGIN
  INSERT INTO public.ai_autonomous_reply_locks (chat_id, owner_id, lease_until, updated_at)
  VALUES (
    p_chat_id,
    p_owner_id,
    now() + make_interval(secs => GREATEST(COALESCE(p_lease_seconds, 120), 30)),
    now()
  )
  ON CONFLICT (chat_id) DO UPDATE
    SET owner_id = EXCLUDED.owner_id,
        lease_until = EXCLUDED.lease_until,
        updated_at = now()
    WHERE public.ai_autonomous_reply_locks.lease_until <= now()
       OR public.ai_autonomous_reply_locks.owner_id = p_owner_id;

  SELECT locks.owner_id = p_owner_id
    INTO v_acquired
    FROM public.ai_autonomous_reply_locks AS locks
   WHERE locks.chat_id = p_chat_id;

  RETURN COALESCE(v_acquired, false);
END;
$$;

CREATE OR REPLACE FUNCTION public.release_ai_autonomous_reply_lock(
  p_chat_id uuid,
  p_owner_id text
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.ai_autonomous_reply_locks
   WHERE chat_id = p_chat_id
     AND owner_id = p_owner_id;
$$;

REVOKE ALL ON FUNCTION public.try_acquire_ai_autonomous_reply_lock(uuid, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.try_acquire_ai_autonomous_reply_lock(uuid, text, integer) TO service_role;
REVOKE ALL ON FUNCTION public.release_ai_autonomous_reply_lock(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.release_ai_autonomous_reply_lock(uuid, text) TO service_role;

CREATE TABLE IF NOT EXISTS public.ai_autonomous_reply_delivery_keys (
  idempotency_key text PRIMARY KEY,
  chat_id uuid NOT NULL REFERENCES public.comm_whatsapp_chats(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES public.ai_autonomous_reply_jobs(id) ON DELETE CASCADE,
  message_index integer NOT NULL CHECK (message_index >= 0),
  status text NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved', 'sent', 'unknown')),
  external_message_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_autonomous_reply_delivery_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage autonomous reply delivery keys"
  ON public.ai_autonomous_reply_delivery_keys;
CREATE POLICY "Service role can manage autonomous reply delivery keys"
  ON public.ai_autonomous_reply_delivery_keys
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP TRIGGER IF EXISTS trg_ai_autonomous_reply_delivery_keys_updated_at
  ON public.ai_autonomous_reply_delivery_keys;
CREATE TRIGGER trg_ai_autonomous_reply_delivery_keys_updated_at
  BEFORE UPDATE ON public.ai_autonomous_reply_delivery_keys
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.claim_ai_autonomous_reply_delivery_key(
  p_idempotency_key text,
  p_chat_id uuid,
  p_job_id uuid,
  p_message_index integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted integer;
BEGIN
  INSERT INTO public.ai_autonomous_reply_delivery_keys (
    idempotency_key,
    chat_id,
    job_id,
    message_index
  )
  VALUES (p_idempotency_key, p_chat_id, p_job_id, p_message_index)
  ON CONFLICT (idempotency_key) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted = 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_ai_autonomous_reply_delivery_key_sent(
  p_idempotency_key text,
  p_job_id uuid,
  p_external_message_id text
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.ai_autonomous_reply_delivery_keys
     SET status = 'sent',
         external_message_id = p_external_message_id,
         updated_at = now()
   WHERE idempotency_key = p_idempotency_key
     AND job_id = p_job_id;
$$;

REVOKE ALL ON FUNCTION public.claim_ai_autonomous_reply_delivery_key(text, uuid, uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_ai_autonomous_reply_delivery_key(text, uuid, uuid, integer) TO service_role;
REVOKE ALL ON FUNCTION public.mark_ai_autonomous_reply_delivery_key_sent(text, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_ai_autonomous_reply_delivery_key_sent(text, uuid, text) TO service_role;

ALTER TABLE public.ai_autonomous_attendance_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage autonomous attendance events"
  ON public.ai_autonomous_attendance_events;
CREATE POLICY "Service role can manage autonomous attendance events"
  ON public.ai_autonomous_attendance_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can view autonomous attendance events"
  ON public.ai_autonomous_attendance_events;
CREATE POLICY "Authenticated users can view autonomous attendance events"
  ON public.ai_autonomous_attendance_events
  FOR SELECT
  TO authenticated
  USING (public.current_user_can_view_comm_whatsapp());

CREATE OR REPLACE FUNCTION public.ai_lead_is_waiting_for_quote(p_lead_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.leads AS leads
    LEFT JOIN public.lead_status_config AS statuses ON statuses.id = leads.status_id
    WHERE leads.id = p_lead_id
      AND (
        lower(trim(COALESCE(statuses.nome, leads.status, ''))) IN ('aguardando cotacao', 'aguardando cotação')
      )
  );
$$;

REVOKE ALL ON FUNCTION public.ai_lead_is_waiting_for_quote(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ai_lead_is_waiting_for_quote(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.upsert_ai_autonomous_qualification_state(
  p_chat_id uuid,
  p_lead_id uuid,
  p_state jsonb
)
RETURNS TABLE (
  state jsonb,
  version bigint,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_chat_id uuid;
  v_chat_lead_id uuid;
BEGIN
  v_chat_id := public.comm_whatsapp_lock_canonical_chat_uuid(p_chat_id);
  IF v_chat_id IS NULL THEN
    RAISE EXCEPTION 'Conversa do WhatsApp nao encontrada.' USING ERRCODE = 'P0002';
  END IF;

  SELECT chats.lead_id
    INTO v_chat_lead_id
    FROM public.comm_whatsapp_chats AS chats
   WHERE chats.id = v_chat_id
   FOR UPDATE;

  IF v_chat_lead_id IS DISTINCT FROM p_lead_id THEN
    RAISE EXCEPTION 'Lead do estado de qualificacao nao corresponde ao chat.' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.ai_autonomous_qualification_states AS qualification_states (
    chat_id,
    lead_id,
    state,
    version
  )
  VALUES (v_chat_id, p_lead_id, COALESCE(p_state, '{}'::jsonb), 1)
  ON CONFLICT (chat_id) DO UPDATE
    SET lead_id = EXCLUDED.lead_id,
        state = EXCLUDED.state,
        version = qualification_states.version + 1,
        updated_at = now();

  RETURN QUERY
  SELECT qualification_states.state, qualification_states.version, qualification_states.updated_at
  FROM public.ai_autonomous_qualification_states AS qualification_states
  WHERE qualification_states.chat_id = v_chat_id;
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_ai_autonomous_qualification_state(uuid, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_ai_autonomous_qualification_state(uuid, uuid, jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.record_ai_autonomous_attendance_event(
  p_chat_id uuid,
  p_lead_id uuid,
  p_event_type text,
  p_correlation_id text DEFAULT NULL,
  p_commercial_status text DEFAULT NULL,
  p_autonomous_status text DEFAULT NULL,
  p_qualification_status text DEFAULT NULL,
  p_decision jsonb DEFAULT '{}'::jsonb,
  p_qualification_state jsonb DEFAULT '{}'::jsonb,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.ai_autonomous_attendance_events (
    chat_id,
    lead_id,
    event_type,
    correlation_id,
    commercial_status,
    autonomous_status,
    qualification_status,
    decision,
    qualification_state,
    metadata
  )
  VALUES (
    p_chat_id,
    p_lead_id,
    NULLIF(trim(COALESCE(p_event_type, '')), ''),
    NULLIF(trim(COALESCE(p_correlation_id, '')), ''),
    p_commercial_status,
    p_autonomous_status,
    p_qualification_status,
    COALESCE(p_decision, '{}'::jsonb),
    COALESCE(p_qualification_state, '{}'::jsonb),
    COALESCE(p_metadata, '{}'::jsonb)
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_ai_autonomous_attendance_event(uuid, uuid, text, text, text, text, text, jsonb, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_ai_autonomous_attendance_event(uuid, uuid, text, text, text, text, text, jsonb, jsonb, jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.schedule_ai_autonomous_reply_job(
  p_chat_id uuid,
  p_delay_seconds integer DEFAULT 15
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_status text;
  v_lead_id uuid;
BEGIN
  SELECT chats.autonomous_attendance_status, chats.lead_id
    INTO v_status, v_lead_id
    FROM public.comm_whatsapp_chats AS chats
    WHERE chats.id = p_chat_id
    FOR UPDATE;

  IF v_status IS DISTINCT FROM 'active' OR v_lead_id IS NULL THEN
    RETURN;
  END IF;

  IF public.ai_lead_is_waiting_for_quote(v_lead_id) THEN
    UPDATE public.comm_whatsapp_chats AS chats
       SET autonomous_attendance_status = 'handed_off',
           updated_at = now()
     WHERE chats.id = p_chat_id
       AND chats.autonomous_attendance_status = 'active';

    UPDATE public.ai_autonomous_reply_jobs AS jobs
       SET status = 'cancelled',
           last_error = 'Job invalidado porque o lead esta aguardando cotacao',
           updated_at = now()
     WHERE jobs.chat_id = p_chat_id
       AND jobs.status IN ('pending', 'processing');
    RETURN;
  END IF;

  INSERT INTO public.ai_autonomous_reply_jobs (chat_id, lead_id, scheduled_at)
  VALUES (p_chat_id, v_lead_id, now() + make_interval(secs => GREATEST(p_delay_seconds, 1)))
  ON CONFLICT (chat_id) WHERE status = 'pending'
  DO UPDATE SET scheduled_at = EXCLUDED.scheduled_at, updated_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.schedule_ai_autonomous_reply_job(uuid, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.prepare_ai_autonomous_attendance_reply(
  p_chat_id uuid,
  p_lead_id uuid
)
RETURNS TABLE (
  can_reply boolean,
  moved_to_attendance boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_chat_id uuid;
  v_chat_lead_id uuid;
  v_attendance_status text;
  v_current_status_id uuid;
  v_contact_initial_status_id uuid;
  v_attendance_status_id uuid;
BEGIN
  v_chat_id := public.comm_whatsapp_lock_canonical_chat_uuid(p_chat_id);
  IF v_chat_id IS NULL THEN
    RAISE EXCEPTION 'Conversa do WhatsApp nao encontrada.' USING ERRCODE = 'P0002';
  END IF;

  SELECT chats.lead_id, chats.autonomous_attendance_status
    INTO v_chat_lead_id, v_attendance_status
    FROM public.comm_whatsapp_chats AS chats
   WHERE chats.id = v_chat_id
   FOR UPDATE;

  IF v_chat_lead_id IS DISTINCT FROM p_lead_id OR v_attendance_status IS DISTINCT FROM 'active' THEN
    RETURN QUERY SELECT false, false;
    RETURN;
  END IF;

  IF public.ai_lead_is_waiting_for_quote(p_lead_id) THEN
    UPDATE public.comm_whatsapp_chats AS chats
       SET autonomous_attendance_status = 'handed_off',
           updated_at = now()
     WHERE chats.id = v_chat_id;
    RETURN QUERY SELECT false, false;
    RETURN;
  END IF;

  SELECT leads.status_id
    INTO v_current_status_id
    FROM public.leads AS leads
   WHERE leads.id = p_lead_id
   FOR UPDATE;

  SELECT statuses.id
    INTO v_contact_initial_status_id
    FROM public.lead_status_config AS statuses
   WHERE lower(trim(statuses.nome)) = 'contato inicial'
   ORDER BY statuses.ordem ASC NULLS LAST, statuses.created_at ASC
   LIMIT 1;

  IF v_contact_initial_status_id IS NULL
     OR v_current_status_id IS DISTINCT FROM v_contact_initial_status_id THEN
    RETURN QUERY SELECT true, false;
    RETURN;
  END IF;

  SELECT statuses.id
    INTO v_attendance_status_id
    FROM public.lead_status_config AS statuses
   WHERE lower(trim(statuses.nome)) = 'atendimento'
   ORDER BY statuses.ordem ASC NULLS LAST, statuses.created_at ASC
   LIMIT 1;

  IF v_attendance_status_id IS NULL THEN
    RAISE EXCEPTION 'Status Atendimento nao encontrado.' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.leads AS leads
     SET status_id = v_attendance_status_id
   WHERE leads.id = p_lead_id;

  RETURN QUERY SELECT true, true;
END;
$$;

REVOKE ALL ON FUNCTION public.prepare_ai_autonomous_attendance_reply(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.prepare_ai_autonomous_attendance_reply(uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.comm_whatsapp_set_autonomous_attendance_status(
  p_chat_id uuid,
  p_status text
)
RETURNS SETOF public.comm_whatsapp_chats
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_chat_id uuid;
  v_chat public.comm_whatsapp_chats%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.current_user_can_edit_comm_whatsapp() THEN
    RAISE EXCEPTION 'Permissao insuficiente para atualizar conversa.';
  END IF;

  IF p_status NOT IN ('inactive', 'active', 'handed_off') THEN
    RAISE EXCEPTION 'Status invalido para atualizacao manual do atendimento autonomo.';
  END IF;

  v_chat_id := public.comm_whatsapp_lock_canonical_chat_uuid(p_chat_id);
  IF v_chat_id IS NULL THEN
    RAISE EXCEPTION 'Conversa do WhatsApp nao encontrada.' USING ERRCODE = 'P0002';
  END IF;

  IF p_status = 'active' THEN
    SELECT chats.* INTO v_chat
    FROM public.comm_whatsapp_chats AS chats
    WHERE chats.id = v_chat_id
      AND chats.deleted_at IS NULL
      AND chats.merged_into_chat_id IS NULL
      AND chats.lead_id IS NOT NULL
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Conversa do WhatsApp nao encontrada ou sem lead vinculado.' USING ERRCODE = 'P0002';
    END IF;

    IF public.ai_lead_is_waiting_for_quote(v_chat.lead_id) THEN
      RAISE EXCEPTION 'O atendimento autonomo nao pode ser reativado enquanto o lead aguarda cotacao.' USING ERRCODE = '22023';
    END IF;

    UPDATE public.comm_whatsapp_chats AS chats
       SET autonomous_attendance_status = 'active',
           updated_at = now()
     WHERE chats.id = v_chat_id
     RETURNING chats.* INTO v_chat;

    INSERT INTO public.ai_autonomous_reply_jobs (chat_id, lead_id, scheduled_at)
    VALUES (v_chat_id, v_chat.lead_id, now() + interval '30 seconds')
    ON CONFLICT (chat_id) WHERE status = 'pending'
    DO UPDATE SET
      lead_id = EXCLUDED.lead_id,
      scheduled_at = EXCLUDED.scheduled_at,
      last_error = NULL,
      updated_at = now();
  ELSE
    UPDATE public.ai_autonomous_reply_jobs AS jobs
       SET status = 'cancelled',
           last_error = 'Atendimento assumido manualmente pelo humano',
           updated_at = now()
     WHERE jobs.chat_id = v_chat_id
       AND jobs.status IN ('pending', 'processing');

    UPDATE public.comm_whatsapp_chats AS chats
       SET autonomous_attendance_status = p_status,
           updated_at = now()
     WHERE chats.id = v_chat_id
       AND chats.deleted_at IS NULL
       AND chats.merged_into_chat_id IS NULL
     RETURNING chats.* INTO v_chat;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Conversa do WhatsApp nao encontrada.' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  RETURN NEXT v_chat;
END;
$$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_set_autonomous_attendance_status(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_set_autonomous_attendance_status(uuid, text) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
