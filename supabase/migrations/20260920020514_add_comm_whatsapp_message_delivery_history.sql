BEGIN;

-- Guarda as transições de entrega junto da mensagem. O status atual continua
-- em delivery_status para manter os contratos existentes; este histórico é
-- apenas a trilha temporal usada pelos dados da mensagem.
CREATE OR REPLACE FUNCTION public.comm_whatsapp_append_delivery_status_history(
  p_history jsonb,
  p_status text,
  p_status_at timestamptz,
  p_error_message text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_history jsonb := CASE
    WHEN jsonb_typeof(COALESCE(p_history, '[]'::jsonb)) = 'array' THEN COALESCE(p_history, '[]'::jsonb)
    ELSE '[]'::jsonb
  END;
  v_status text := lower(NULLIF(btrim(COALESCE(p_status, '')), ''));
  v_event jsonb;
BEGIN
  IF v_status IS NULL OR p_status_at IS NULL THEN
    RETURN v_history;
  END IF;

  -- Webhooks e refreshes podem reenviar o mesmo status. Como o status é
  -- monotônico, uma ocorrência por status é suficiente para a linha do tempo.
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(v_history) AS item
    WHERE lower(COALESCE(item->>'status', '')) = v_status
  ) THEN
    RETURN v_history;
  END IF;

  v_event := jsonb_build_object('status', v_status, 'at', p_status_at);
  IF NULLIF(btrim(COALESCE(p_error_message, '')), '') IS NOT NULL THEN
    v_event := v_event || jsonb_build_object('error', btrim(p_error_message));
  END IF;

  RETURN v_history || jsonb_build_array(v_event);
END;
$$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_append_delivery_status_history(jsonb, text, timestamptz, text) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.comm_whatsapp_merge_delivery_status_history(
  p_history jsonb,
  p_incoming_history jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_history jsonb := CASE
    WHEN jsonb_typeof(COALESCE(p_history, '[]'::jsonb)) = 'array' THEN COALESCE(p_history, '[]'::jsonb)
    ELSE '[]'::jsonb
  END;
  v_event jsonb;
  v_at timestamptz;
BEGIN
  IF jsonb_typeof(COALESCE(p_incoming_history, '[]'::jsonb)) <> 'array' THEN
    RETURN v_history;
  END IF;

  FOR v_event IN SELECT value FROM jsonb_array_elements(p_incoming_history)
  LOOP
    BEGIN
      v_at := NULLIF(btrim(COALESCE(v_event->>'at', '')), '')::timestamptz;
    EXCEPTION WHEN others THEN
      v_at := NULL;
    END;

    v_history := public.comm_whatsapp_append_delivery_status_history(
      v_history,
      v_event->>'status',
      v_at,
      v_event->>'error'
    );
  END LOOP;

  RETURN v_history;
END;
$$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_merge_delivery_status_history(jsonb, jsonb) FROM PUBLIC;

-- Mensagens antigas não têm como recuperar os webhooks já recebidos. Ainda
-- assim, o horário de envio e o último status conhecido ficam disponíveis no
-- modal sem inventar horários intermediários.
UPDATE public.comm_whatsapp_messages AS m
SET metadata = jsonb_set(
  COALESCE(m.metadata, '{}'::jsonb),
  '{delivery_status_history}',
  public.comm_whatsapp_append_delivery_status_history(
    public.comm_whatsapp_append_delivery_status_history(
      '[]'::jsonb,
      'sent',
      COALESCE(m.message_at, m.status_updated_at, m.created_at),
      NULL
    ),
    CASE WHEN lower(COALESCE(m.delivery_status, '')) <> 'sent' THEN m.delivery_status ELSE NULL END,
    CASE WHEN lower(COALESCE(m.delivery_status, '')) <> 'sent' THEN COALESCE(m.status_updated_at, m.message_at, m.created_at) ELSE NULL END,
    m.error_message
  ),
  true
)
WHERE m.direction = 'outbound'
  AND jsonb_typeof(COALESCE(m.metadata, '{}'::jsonb)->'delivery_status_history') IS DISTINCT FROM 'array';

ALTER TABLE public.comm_whatsapp_pending_message_statuses
  ADD COLUMN IF NOT EXISTS delivery_status_history jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE OR REPLACE FUNCTION public.comm_whatsapp_seed_delivery_status_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_history jsonb;
BEGIN
  IF NEW.direction <> 'outbound' THEN
    RETURN NULL;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF lower(COALESCE(OLD.delivery_status, '')) = lower(COALESCE(NEW.delivery_status, '')) THEN
      RETURN NULL;
    END IF;
  END IF;

  v_history := public.comm_whatsapp_append_delivery_status_history(
    CASE
      WHEN jsonb_typeof(COALESCE(NEW.metadata, '{}'::jsonb)->'delivery_status_history') = 'array'
        THEN COALESCE(NEW.metadata, '{}'::jsonb)->'delivery_status_history'
      ELSE '[]'::jsonb
    END,
    NEW.delivery_status,
    COALESCE(NEW.status_updated_at, NEW.message_at, NEW.created_at),
    NEW.error_message
  );

  UPDATE public.comm_whatsapp_messages
  SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{delivery_status_history}', v_history, true)
  WHERE id = NEW.id
    AND metadata IS DISTINCT FROM jsonb_set(COALESCE(metadata, '{}'::jsonb), '{delivery_status_history}', v_history, true);

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_seed_delivery_status_history() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_comm_whatsapp_seed_delivery_status_history ON public.comm_whatsapp_messages;
CREATE TRIGGER trg_comm_whatsapp_seed_delivery_status_history
  AFTER INSERT OR UPDATE OF delivery_status ON public.comm_whatsapp_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.comm_whatsapp_seed_delivery_status_history();

CREATE OR REPLACE FUNCTION public.comm_whatsapp_update_message_status(
  p_channel_id uuid,
  p_external_message_id text,
  p_delivery_status text,
  p_status_updated_at timestamptz DEFAULT NULL,
  p_error_message text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_external_message_id text := NULLIF(btrim(COALESCE(p_external_message_id, '')), '');
  v_delivery_status text := lower(NULLIF(btrim(COALESCE(p_delivery_status, '')), ''));
  v_status_updated_at timestamptz := COALESCE(p_status_updated_at, now());
  v_error_message text := NULLIF(btrim(COALESCE(p_error_message, '')), '');
  v_message public.comm_whatsapp_messages%ROWTYPE;
  v_should_apply boolean;
BEGIN
  IF p_channel_id IS NULL OR v_external_message_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT *
  INTO v_message
  FROM public.comm_whatsapp_messages AS m
  WHERE m.channel_id = p_channel_id
    AND m.external_message_id = v_external_message_id
  FOR UPDATE;

  IF FOUND THEN
    v_should_apply := public.comm_whatsapp_should_apply_status(v_message.delivery_status, v_delivery_status);

    UPDATE public.comm_whatsapp_messages AS m
    SET
      delivery_status = CASE WHEN v_should_apply THEN v_delivery_status ELSE m.delivery_status END,
      status_updated_at = GREATEST(COALESCE(m.status_updated_at, '-infinity'::timestamptz), v_status_updated_at),
      error_message = CASE
        WHEN v_error_message IS NOT NULL AND v_should_apply THEN v_error_message
        WHEN v_should_apply AND v_delivery_status IN ('sent', 'delivered', 'read', 'played', 'received', 'seen', 'viewed') THEN NULL
        ELSE m.error_message
      END,
      metadata = CASE
        WHEN v_should_apply AND lower(COALESCE(m.delivery_status, '')) <> v_delivery_status THEN jsonb_set(
          COALESCE(m.metadata, '{}'::jsonb),
          '{delivery_status_history}',
          public.comm_whatsapp_append_delivery_status_history(
            CASE
              WHEN jsonb_typeof(COALESCE(m.metadata, '{}'::jsonb)->'delivery_status_history') = 'array'
                THEN COALESCE(m.metadata, '{}'::jsonb)->'delivery_status_history'
              ELSE '[]'::jsonb
            END,
            v_delivery_status,
            v_status_updated_at,
            v_error_message
          ),
          true
        )
        ELSE m.metadata
      END
    WHERE m.id = v_message.id;

    DELETE FROM public.comm_whatsapp_pending_message_statuses AS p
    WHERE p.channel_id = p_channel_id
      AND p.external_message_id = v_external_message_id;

    RETURN true;
  END IF;

  IF v_delivery_status IS NOT NULL THEN
    INSERT INTO public.comm_whatsapp_pending_message_statuses (
      channel_id,
      external_message_id,
      delivery_status,
      status_updated_at,
      error_message,
      delivery_status_history,
      received_at
    )
    VALUES (
      p_channel_id,
      v_external_message_id,
      v_delivery_status,
      v_status_updated_at,
      v_error_message,
      public.comm_whatsapp_append_delivery_status_history('[]'::jsonb, v_delivery_status, v_status_updated_at, v_error_message),
      now()
    )
    ON CONFLICT (channel_id, external_message_id)
    DO UPDATE SET
      delivery_status = CASE
        WHEN public.comm_whatsapp_should_apply_status(public.comm_whatsapp_pending_message_statuses.delivery_status, EXCLUDED.delivery_status)
          THEN EXCLUDED.delivery_status
        ELSE public.comm_whatsapp_pending_message_statuses.delivery_status
      END,
      status_updated_at = GREATEST(public.comm_whatsapp_pending_message_statuses.status_updated_at, EXCLUDED.status_updated_at),
      error_message = CASE
        WHEN EXCLUDED.error_message IS NOT NULL
          AND public.comm_whatsapp_should_apply_status(public.comm_whatsapp_pending_message_statuses.delivery_status, EXCLUDED.delivery_status)
          THEN EXCLUDED.error_message
        WHEN public.comm_whatsapp_should_apply_status(public.comm_whatsapp_pending_message_statuses.delivery_status, EXCLUDED.delivery_status)
          AND EXCLUDED.delivery_status IN ('sent', 'delivered', 'read', 'played', 'received', 'seen', 'viewed') THEN NULL
        ELSE public.comm_whatsapp_pending_message_statuses.error_message
      END,
      delivery_status_history = CASE
        WHEN public.comm_whatsapp_should_apply_status(public.comm_whatsapp_pending_message_statuses.delivery_status, EXCLUDED.delivery_status)
          AND lower(public.comm_whatsapp_pending_message_statuses.delivery_status) <> lower(EXCLUDED.delivery_status)
          THEN public.comm_whatsapp_pending_message_statuses.delivery_status_history || EXCLUDED.delivery_status_history
        ELSE public.comm_whatsapp_pending_message_statuses.delivery_status_history
      END,
      received_at = GREATEST(public.comm_whatsapp_pending_message_statuses.received_at, EXCLUDED.received_at),
      updated_at = now();
  END IF;

  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_update_message_status(uuid, text, text, timestamptz, text) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_update_message_status(uuid, text, text, timestamptz, text) TO service_role;

CREATE OR REPLACE FUNCTION public.comm_whatsapp_apply_pending_message_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pending public.comm_whatsapp_pending_message_statuses%ROWTYPE;
  v_pending_history jsonb;
BEGIN
  IF NEW.external_message_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT *
  INTO v_pending
  FROM public.comm_whatsapp_pending_message_statuses AS p
  WHERE p.channel_id = NEW.channel_id
    AND p.external_message_id = NEW.external_message_id
  FOR UPDATE;

  IF FOUND THEN
    v_pending_history := CASE
      WHEN jsonb_typeof(COALESCE(v_pending.delivery_status_history, '[]'::jsonb)) = 'array'
        AND jsonb_array_length(COALESCE(v_pending.delivery_status_history, '[]'::jsonb)) > 0
        THEN v_pending.delivery_status_history
      ELSE public.comm_whatsapp_append_delivery_status_history('[]'::jsonb, v_pending.delivery_status, v_pending.status_updated_at, v_pending.error_message)
    END;

    UPDATE public.comm_whatsapp_messages AS m
    SET
      delivery_status = CASE
        WHEN public.comm_whatsapp_should_apply_status(m.delivery_status, v_pending.delivery_status)
          THEN v_pending.delivery_status
        ELSE m.delivery_status
      END,
      status_updated_at = GREATEST(COALESCE(m.status_updated_at, '-infinity'::timestamptz), v_pending.status_updated_at),
      error_message = CASE
        WHEN v_pending.error_message IS NOT NULL THEN v_pending.error_message
        WHEN v_pending.delivery_status IN ('sent', 'delivered', 'read', 'played', 'received', 'seen', 'viewed') THEN NULL
        ELSE m.error_message
      END,
      metadata = jsonb_set(
        COALESCE(m.metadata, '{}'::jsonb),
        '{delivery_status_history}',
        public.comm_whatsapp_merge_delivery_status_history(
          CASE
          WHEN jsonb_typeof(COALESCE(m.metadata, '{}'::jsonb)->'delivery_status_history') = 'array'
            THEN COALESCE(m.metadata, '{}'::jsonb)->'delivery_status_history'
          ELSE '[]'::jsonb
          END,
          v_pending_history
        ),
        true
      )
    WHERE m.id = NEW.id;

    DELETE FROM public.comm_whatsapp_pending_message_statuses AS p
    WHERE p.id = v_pending.id;
  END IF;

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_apply_pending_message_status() FROM PUBLIC;

COMMIT;
