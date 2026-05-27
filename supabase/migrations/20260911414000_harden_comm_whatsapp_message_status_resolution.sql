BEGIN;

CREATE OR REPLACE FUNCTION public.comm_whatsapp_should_apply_status(
  p_current_status text,
  p_next_status text
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN NULLIF(btrim(COALESCE(p_next_status, '')), '') IS NULL THEN false
    WHEN NULLIF(btrim(COALESCE(p_current_status, '')), '') IS NULL THEN true
    WHEN lower(NULLIF(btrim(COALESCE(p_next_status, '')), '')) IN ('failed', 'error') THEN
      lower(NULLIF(btrim(COALESCE(p_current_status, '')), '')) IN ('pending', 'queued', 'sending')
    ELSE public.comm_whatsapp_status_rank(p_next_status) >= public.comm_whatsapp_status_rank(p_current_status)
  END;
$$;

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
  v_delivery_status text := NULLIF(btrim(COALESCE(p_delivery_status, '')), '');
  v_status_updated_at timestamptz := COALESCE(p_status_updated_at, now());
  v_error_message text := NULLIF(btrim(COALESCE(p_error_message, '')), '');
BEGIN
  IF p_channel_id IS NULL OR v_external_message_id IS NULL THEN
    RETURN false;
  END IF;

  UPDATE public.comm_whatsapp_messages m
  SET
    delivery_status = CASE
      WHEN public.comm_whatsapp_should_apply_status(m.delivery_status, v_delivery_status) THEN v_delivery_status
      ELSE m.delivery_status
    END,
    status_updated_at = GREATEST(COALESCE(m.status_updated_at, '-infinity'::timestamptz), v_status_updated_at),
    error_message = CASE
      WHEN v_error_message IS NOT NULL AND public.comm_whatsapp_should_apply_status(m.delivery_status, v_delivery_status) THEN v_error_message
      WHEN public.comm_whatsapp_should_apply_status(m.delivery_status, v_delivery_status)
        AND v_delivery_status IN ('sent', 'delivered', 'read', 'played', 'received') THEN NULL
      ELSE m.error_message
    END
  WHERE m.channel_id = p_channel_id
    AND m.external_message_id = v_external_message_id;

  IF FOUND THEN
    DELETE FROM public.comm_whatsapp_pending_message_statuses p
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
      received_at
    )
    VALUES (
      p_channel_id,
      v_external_message_id,
      v_delivery_status,
      v_status_updated_at,
      v_error_message,
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
          AND EXCLUDED.delivery_status IN ('sent', 'delivered', 'read', 'played', 'received') THEN NULL
        ELSE public.comm_whatsapp_pending_message_statuses.error_message
      END,
      received_at = GREATEST(public.comm_whatsapp_pending_message_statuses.received_at, EXCLUDED.received_at),
      updated_at = now();
  END IF;

  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.comm_whatsapp_apply_pending_message_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pending public.comm_whatsapp_pending_message_statuses%ROWTYPE;
BEGIN
  IF NEW.external_message_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT *
  INTO v_pending
  FROM public.comm_whatsapp_pending_message_statuses p
  WHERE p.channel_id = NEW.channel_id
    AND p.external_message_id = NEW.external_message_id
  FOR UPDATE;

  IF FOUND THEN
    UPDATE public.comm_whatsapp_messages m
    SET
      delivery_status = CASE
        WHEN public.comm_whatsapp_should_apply_status(m.delivery_status, v_pending.delivery_status)
          THEN v_pending.delivery_status
        ELSE m.delivery_status
      END,
      status_updated_at = GREATEST(COALESCE(m.status_updated_at, '-infinity'::timestamptz), v_pending.status_updated_at),
      error_message = CASE
        WHEN v_pending.error_message IS NOT NULL
          AND public.comm_whatsapp_should_apply_status(m.delivery_status, v_pending.delivery_status) THEN v_pending.error_message
        WHEN public.comm_whatsapp_should_apply_status(m.delivery_status, v_pending.delivery_status)
          AND v_pending.delivery_status IN ('sent', 'delivered', 'read', 'played', 'received') THEN NULL
        ELSE m.error_message
      END
    WHERE m.id = NEW.id;

    DELETE FROM public.comm_whatsapp_pending_message_statuses p
    WHERE p.id = v_pending.id;
  END IF;

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_should_apply_status(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_should_apply_status(text, text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.comm_whatsapp_update_message_status(uuid, text, text, timestamptz, text) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_update_message_status(uuid, text, text, timestamptz, text) TO service_role;

COMMIT;
