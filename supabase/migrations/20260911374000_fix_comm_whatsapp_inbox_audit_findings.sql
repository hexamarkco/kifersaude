BEGIN;

-- Keep chat list queries server-side so active/unread chats are never hidden by
-- archived rows consuming the client-side limit.
CREATE INDEX IF NOT EXISTS idx_comm_whatsapp_chats_inbox_active_order
  ON public.comm_whatsapp_chats (channel_id, is_archived, is_pinned DESC, pinned_at DESC, last_message_at DESC, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_comm_whatsapp_chats_inbox_unread_active
  ON public.comm_whatsapp_chats (channel_id, is_archived, unread_count DESC, last_message_at DESC, updated_at DESC)
  WHERE unread_count > 0 OR manual_unread = true;

CREATE INDEX IF NOT EXISTS idx_comm_whatsapp_messages_status_external
  ON public.comm_whatsapp_messages (channel_id, external_message_id, delivery_status)
  WHERE external_message_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.comm_whatsapp_pending_message_statuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES public.comm_whatsapp_channels(id) ON DELETE CASCADE,
  external_message_id text NOT NULL,
  delivery_status text NOT NULL,
  status_updated_at timestamptz NOT NULL DEFAULT now(),
  error_message text,
  received_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (channel_id, external_message_id)
);

DROP TRIGGER IF EXISTS trg_comm_whatsapp_pending_message_statuses_updated_at ON public.comm_whatsapp_pending_message_statuses;
CREATE TRIGGER trg_comm_whatsapp_pending_message_statuses_updated_at
  BEFORE UPDATE ON public.comm_whatsapp_pending_message_statuses
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.comm_whatsapp_pending_message_statuses ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.comm_whatsapp_status_rank(p_status text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE lower(NULLIF(btrim(COALESCE(p_status, '')), ''))
    WHEN 'failed' THEN -1
    WHEN 'error' THEN -1
    WHEN 'pending' THEN 0
    WHEN 'queued' THEN 0
    WHEN 'sending' THEN 0
    WHEN 'sent' THEN 1
    WHEN 'received' THEN 1
    WHEN 'delivered' THEN 2
    WHEN 'read' THEN 3
    WHEN 'played' THEN 4
    WHEN 'deleted' THEN 5
    ELSE 0
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
      WHEN v_delivery_status IS NULL THEN m.delivery_status
      WHEN public.comm_whatsapp_status_rank(v_delivery_status) >= public.comm_whatsapp_status_rank(m.delivery_status) THEN v_delivery_status
      ELSE m.delivery_status
    END,
    status_updated_at = GREATEST(COALESCE(m.status_updated_at, '-infinity'::timestamptz), v_status_updated_at),
    error_message = CASE
      WHEN v_error_message IS NOT NULL THEN v_error_message
      WHEN COALESCE(v_delivery_status, m.delivery_status) IN ('sent', 'delivered', 'read', 'played', 'received') THEN NULL
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
        WHEN public.comm_whatsapp_status_rank(EXCLUDED.delivery_status) >= public.comm_whatsapp_status_rank(public.comm_whatsapp_pending_message_statuses.delivery_status)
          THEN EXCLUDED.delivery_status
        ELSE public.comm_whatsapp_pending_message_statuses.delivery_status
      END,
      status_updated_at = GREATEST(public.comm_whatsapp_pending_message_statuses.status_updated_at, EXCLUDED.status_updated_at),
      error_message = COALESCE(EXCLUDED.error_message, public.comm_whatsapp_pending_message_statuses.error_message),
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
        WHEN public.comm_whatsapp_status_rank(v_pending.delivery_status) >= public.comm_whatsapp_status_rank(m.delivery_status)
          THEN v_pending.delivery_status
        ELSE m.delivery_status
      END,
      status_updated_at = GREATEST(COALESCE(m.status_updated_at, '-infinity'::timestamptz), v_pending.status_updated_at),
      error_message = CASE
        WHEN v_pending.error_message IS NOT NULL THEN v_pending.error_message
        WHEN v_pending.delivery_status IN ('sent', 'delivered', 'read', 'played', 'received') THEN NULL
        ELSE m.error_message
      END
    WHERE m.id = NEW.id;

    DELETE FROM public.comm_whatsapp_pending_message_statuses p
    WHERE p.id = v_pending.id;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_comm_whatsapp_apply_pending_message_status ON public.comm_whatsapp_messages;
CREATE TRIGGER trg_comm_whatsapp_apply_pending_message_status
  AFTER INSERT OR UPDATE OF external_message_id ON public.comm_whatsapp_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.comm_whatsapp_apply_pending_message_status();

CREATE OR REPLACE FUNCTION public.comm_whatsapp_persist_message(
  p_channel_id uuid,
  p_external_chat_id text,
  p_phone_number text,
  p_display_name text,
  p_push_name text,
  p_last_message_text text,
  p_last_message_direction text,
  p_last_message_at timestamptz,
  p_increment_unread boolean,
  p_external_message_id text,
  p_direction text,
  p_message_type text,
  p_delivery_status text,
  p_text_content text,
  p_created_by uuid,
  p_source text,
  p_sender_name text,
  p_sender_phone text,
  p_status_updated_at timestamptz,
  p_error_message text,
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_media_id text DEFAULT NULL,
  p_media_url text DEFAULT NULL,
  p_media_mime_type text DEFAULT NULL,
  p_media_file_name text DEFAULT NULL,
  p_media_size_bytes bigint DEFAULT NULL,
  p_media_duration_seconds integer DEFAULT NULL,
  p_media_caption text DEFAULT NULL
)
RETURNS TABLE(
  chat_id uuid,
  message_id uuid,
  inserted boolean,
  unread_count integer,
  summary_updated boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_chat public.comm_whatsapp_chats%ROWTYPE;
  v_message_id uuid;
  v_inserted boolean := false;
  v_summary_updated boolean := false;
  v_external_chat_id text := NULLIF(btrim(COALESCE(p_external_chat_id, '')), '');
  v_phone_number text := NULLIF(public.normalize_comm_whatsapp_phone(COALESCE(p_phone_number, '')), '');
  v_display_name text := NULLIF(btrim(COALESCE(p_display_name, '')), '');
  v_push_name text := NULLIF(btrim(COALESCE(p_push_name, '')), '');
  v_external_message_id text := NULLIF(btrim(COALESCE(p_external_message_id, '')), '');
  v_direction text := COALESCE(NULLIF(btrim(COALESCE(p_direction, '')), ''), 'system');
  v_last_direction text := COALESCE(NULLIF(btrim(COALESCE(p_last_message_direction, '')), ''), v_direction);
  v_last_message_at timestamptz := COALESCE(p_last_message_at, p_status_updated_at, now());
  v_message_at timestamptz := COALESCE(p_last_message_at, p_status_updated_at, now());
  v_media_id text := NULLIF(btrim(COALESCE(p_media_id, '')), '');
  v_media_url text := NULLIF(btrim(COALESCE(p_media_url, '')), '');
  v_media_mime_type text := NULLIF(btrim(COALESCE(p_media_mime_type, '')), '');
  v_media_file_name text := NULLIF(btrim(COALESCE(p_media_file_name, '')), '');
  v_media_caption text := NULLIF(btrim(COALESCE(p_media_caption, '')), '');
  v_existing_message public.comm_whatsapp_messages%ROWTYPE;
  v_effective_metadata jsonb := COALESCE(p_metadata, '{}'::jsonb);
  v_existing_history jsonb := '[]'::jsonb;
  v_edit_timestamp timestamptz := COALESCE(p_status_updated_at, v_message_at, now());
BEGIN
  IF v_external_chat_id IS NULL THEN
    RAISE EXCEPTION 'Conversa externa obrigatoria.';
  END IF;

  IF v_phone_number IS NULL THEN
    v_phone_number := NULLIF(public.normalize_comm_whatsapp_phone(split_part(v_external_chat_id, '@', 1)), '');
  END IF;

  IF v_display_name IS NULL THEN
    v_display_name := COALESCE(v_phone_number, 'Numero desconhecido');
  END IF;

  INSERT INTO public.comm_whatsapp_chats (
    channel_id,
    external_chat_id,
    phone_number,
    phone_digits,
    display_name,
    push_name,
    last_message_text,
    last_message_direction,
    last_message_at,
    unread_count,
    is_archived,
    archived_at,
    is_muted,
    muted_at
  )
  VALUES (
    p_channel_id,
    v_external_chat_id,
    COALESCE(v_phone_number, '00000000000'),
    COALESCE(v_phone_number, '00000000000'),
    v_display_name,
    v_push_name,
    p_last_message_text,
    v_last_direction,
    v_last_message_at,
    0,
    false,
    NULL,
    false,
    NULL
  )
  ON CONFLICT (channel_id, external_chat_id) DO NOTHING;

  SELECT *
  INTO v_chat
  FROM public.comm_whatsapp_chats
  WHERE channel_id = p_channel_id
    AND external_chat_id = v_external_chat_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nao foi possivel localizar a conversa para persistencia.';
  END IF;

  IF v_external_message_id IS NOT NULL THEN
    INSERT INTO public.comm_whatsapp_messages (
      chat_id,
      channel_id,
      external_message_id,
      direction,
      message_type,
      delivery_status,
      text_content,
      message_at,
      created_by,
      source,
      sender_name,
      sender_phone,
      status_updated_at,
      error_message,
      metadata,
      media_id,
      media_url,
      media_mime_type,
      media_file_name,
      media_size_bytes,
      media_duration_seconds,
      media_caption
    )
    VALUES (
      v_chat.id,
      p_channel_id,
      v_external_message_id,
      v_direction,
      COALESCE(NULLIF(btrim(COALESCE(p_message_type, '')), ''), 'text'),
      COALESCE(NULLIF(btrim(COALESCE(p_delivery_status, '')), ''), 'pending'),
      p_text_content,
      v_message_at,
      p_created_by,
      NULLIF(btrim(COALESCE(p_source, '')), ''),
      NULLIF(btrim(COALESCE(p_sender_name, '')), ''),
      NULLIF(public.normalize_comm_whatsapp_phone(COALESCE(p_sender_phone, '')), ''),
      COALESCE(p_status_updated_at, v_message_at),
      NULLIF(btrim(COALESCE(p_error_message, '')), ''),
      COALESCE(p_metadata, '{}'::jsonb),
      v_media_id,
      v_media_url,
      v_media_mime_type,
      v_media_file_name,
      p_media_size_bytes,
      p_media_duration_seconds,
      v_media_caption
    )
    ON CONFLICT (channel_id, external_message_id) DO NOTHING
    RETURNING id INTO v_message_id;

    IF v_message_id IS NOT NULL THEN
      v_inserted := true;
    ELSE
      SELECT *
      INTO v_existing_message
      FROM public.comm_whatsapp_messages
      WHERE channel_id = p_channel_id
        AND external_message_id = v_external_message_id;

      IF FOUND THEN
        v_effective_metadata := COALESCE(v_existing_message.metadata, '{}'::jsonb) || COALESCE(p_metadata, '{}'::jsonb);

        IF jsonb_typeof(COALESCE(v_existing_message.metadata, '{}'::jsonb)->'edit_history') = 'array' THEN
          v_existing_history := COALESCE(v_existing_message.metadata, '{}'::jsonb)->'edit_history';
        END IF;

        IF p_text_content IS NOT NULL AND v_existing_message.text_content IS DISTINCT FROM p_text_content THEN
          v_effective_metadata := v_effective_metadata || jsonb_build_object(
            'edited', true,
            'edited_at', v_edit_timestamp,
            'original_text_content', COALESCE(
              NULLIF(COALESCE(v_existing_message.metadata, '{}'::jsonb)->>'original_text_content', ''),
              v_existing_message.text_content
            ),
            'edit_history', v_existing_history || jsonb_build_array(jsonb_build_object(
              'at', v_edit_timestamp,
              'previous_text', v_existing_message.text_content,
              'next_text', p_text_content
            ))
          );
        END IF;
      END IF;

      UPDATE public.comm_whatsapp_messages
      SET
        chat_id = v_chat.id,
        direction = v_direction,
        message_type = COALESCE(NULLIF(btrim(COALESCE(p_message_type, '')), ''), public.comm_whatsapp_messages.message_type),
        delivery_status = CASE
          WHEN NULLIF(btrim(COALESCE(p_delivery_status, '')), '') IS NULL THEN public.comm_whatsapp_messages.delivery_status
          WHEN public.comm_whatsapp_status_rank(p_delivery_status) >= public.comm_whatsapp_status_rank(public.comm_whatsapp_messages.delivery_status) THEN NULLIF(btrim(COALESCE(p_delivery_status, '')), '')
          ELSE public.comm_whatsapp_messages.delivery_status
        END,
        text_content = COALESCE(p_text_content, public.comm_whatsapp_messages.text_content),
        message_at = COALESCE(public.comm_whatsapp_messages.message_at, v_message_at),
        created_by = COALESCE(p_created_by, public.comm_whatsapp_messages.created_by),
        source = COALESCE(NULLIF(btrim(COALESCE(p_source, '')), ''), public.comm_whatsapp_messages.source),
        sender_name = COALESCE(NULLIF(btrim(COALESCE(p_sender_name, '')), ''), public.comm_whatsapp_messages.sender_name),
        sender_phone = COALESCE(NULLIF(public.normalize_comm_whatsapp_phone(COALESCE(p_sender_phone, '')), ''), public.comm_whatsapp_messages.sender_phone),
        status_updated_at = GREATEST(COALESCE(public.comm_whatsapp_messages.status_updated_at, '-infinity'::timestamptz), COALESCE(p_status_updated_at, v_message_at)),
        error_message = COALESCE(NULLIF(btrim(COALESCE(p_error_message, '')), ''), public.comm_whatsapp_messages.error_message),
        metadata = COALESCE(v_effective_metadata, public.comm_whatsapp_messages.metadata, '{}'::jsonb),
        media_id = COALESCE(v_media_id, public.comm_whatsapp_messages.media_id),
        media_url = COALESCE(v_media_url, public.comm_whatsapp_messages.media_url),
        media_mime_type = COALESCE(v_media_mime_type, public.comm_whatsapp_messages.media_mime_type),
        media_file_name = COALESCE(v_media_file_name, public.comm_whatsapp_messages.media_file_name),
        media_size_bytes = COALESCE(p_media_size_bytes, public.comm_whatsapp_messages.media_size_bytes),
        media_duration_seconds = COALESCE(p_media_duration_seconds, public.comm_whatsapp_messages.media_duration_seconds),
        media_caption = COALESCE(v_media_caption, public.comm_whatsapp_messages.media_caption)
      WHERE channel_id = p_channel_id
        AND external_message_id = v_external_message_id
      RETURNING id INTO v_message_id;
    END IF;
  ELSE
    INSERT INTO public.comm_whatsapp_messages (
      chat_id,
      channel_id,
      external_message_id,
      direction,
      message_type,
      delivery_status,
      text_content,
      message_at,
      created_by,
      source,
      sender_name,
      sender_phone,
      status_updated_at,
      error_message,
      metadata,
      media_id,
      media_url,
      media_mime_type,
      media_file_name,
      media_size_bytes,
      media_duration_seconds,
      media_caption
    )
    VALUES (
      v_chat.id,
      p_channel_id,
      NULL,
      v_direction,
      COALESCE(NULLIF(btrim(COALESCE(p_message_type, '')), ''), 'text'),
      COALESCE(NULLIF(btrim(COALESCE(p_delivery_status, '')), ''), 'pending'),
      p_text_content,
      v_message_at,
      p_created_by,
      NULLIF(btrim(COALESCE(p_source, '')), ''),
      NULLIF(btrim(COALESCE(p_sender_name, '')), ''),
      NULLIF(public.normalize_comm_whatsapp_phone(COALESCE(p_sender_phone, '')), ''),
      COALESCE(p_status_updated_at, v_message_at),
      NULLIF(btrim(COALESCE(p_error_message, '')), ''),
      COALESCE(p_metadata, '{}'::jsonb),
      v_media_id,
      v_media_url,
      v_media_mime_type,
      v_media_file_name,
      p_media_size_bytes,
      p_media_duration_seconds,
      v_media_caption
    )
    RETURNING id INTO v_message_id;

    v_inserted := true;
  END IF;

  v_summary_updated := v_chat.last_message_at IS NULL OR v_last_message_at >= v_chat.last_message_at;

  UPDATE public.comm_whatsapp_chats
  SET
    phone_number = COALESCE(v_phone_number, public.comm_whatsapp_chats.phone_number),
    phone_digits = COALESCE(v_phone_number, public.comm_whatsapp_chats.phone_digits),
    display_name = COALESCE(v_display_name, public.comm_whatsapp_chats.display_name),
    push_name = COALESCE(v_push_name, public.comm_whatsapp_chats.push_name),
    last_message_text = CASE
      WHEN v_summary_updated THEN p_last_message_text
      ELSE public.comm_whatsapp_chats.last_message_text
    END,
    last_message_direction = CASE
      WHEN v_summary_updated THEN v_last_direction
      ELSE public.comm_whatsapp_chats.last_message_direction
    END,
    last_message_at = CASE
      WHEN v_summary_updated THEN v_last_message_at
      ELSE public.comm_whatsapp_chats.last_message_at
    END,
    unread_count = CASE
      WHEN COALESCE(p_increment_unread, false)
        AND v_inserted
        AND (
          public.comm_whatsapp_chats.last_read_at IS NULL
          OR v_message_at > public.comm_whatsapp_chats.last_read_at
        )
        THEN public.comm_whatsapp_chats.unread_count + 1
      ELSE public.comm_whatsapp_chats.unread_count
    END,
    is_archived = CASE
      WHEN v_inserted
        AND v_direction = 'inbound'
        AND NOT public.comm_whatsapp_chats.is_muted
        AND (
          NOT public.comm_whatsapp_chats.is_archived
          OR public.comm_whatsapp_chats.archived_at IS NULL
          OR v_message_at > public.comm_whatsapp_chats.archived_at
        ) THEN false
      ELSE public.comm_whatsapp_chats.is_archived
    END,
    archived_at = CASE
      WHEN v_inserted
        AND v_direction = 'inbound'
        AND NOT public.comm_whatsapp_chats.is_muted
        AND (
          NOT public.comm_whatsapp_chats.is_archived
          OR public.comm_whatsapp_chats.archived_at IS NULL
          OR v_message_at > public.comm_whatsapp_chats.archived_at
        ) THEN NULL
      ELSE public.comm_whatsapp_chats.archived_at
    END,
    updated_at = now()
  WHERE id = v_chat.id
  RETURNING * INTO v_chat;

  SELECT *
  INTO v_chat
  FROM public.comm_whatsapp_refresh_chat_identity(v_chat.id);

  RETURN QUERY SELECT v_chat.id, v_message_id, v_inserted, v_chat.unread_count, v_summary_updated;
END;
$$;

CREATE OR REPLACE FUNCTION public.comm_whatsapp_update_chat_inbox_state(
  p_chat_id uuid,
  p_is_archived boolean DEFAULT NULL,
  p_is_muted boolean DEFAULT NULL,
  p_is_pinned boolean DEFAULT NULL,
  p_mark_as_unread boolean DEFAULT NULL
)
RETURNS SETOF public.comm_whatsapp_chats
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_chat public.comm_whatsapp_chats%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.current_user_can_edit_comm_whatsapp() THEN
    RAISE EXCEPTION 'Permissao insuficiente para atualizar conversa.';
  END IF;

  UPDATE public.comm_whatsapp_chats
  SET
    is_archived = COALESCE(p_is_archived, public.comm_whatsapp_chats.is_archived),
    archived_at = CASE
      WHEN p_is_archived IS NULL THEN public.comm_whatsapp_chats.archived_at
      WHEN p_is_archived THEN now()
      ELSE NULL
    END,
    is_muted = COALESCE(p_is_muted, public.comm_whatsapp_chats.is_muted),
    muted_at = CASE
      WHEN p_is_muted IS NULL THEN public.comm_whatsapp_chats.muted_at
      WHEN p_is_muted THEN COALESCE(public.comm_whatsapp_chats.muted_at, now())
      ELSE NULL
    END,
    is_pinned = COALESCE(p_is_pinned, public.comm_whatsapp_chats.is_pinned),
    pinned_at = CASE
      WHEN p_is_pinned IS NULL THEN public.comm_whatsapp_chats.pinned_at
      WHEN p_is_pinned THEN COALESCE(public.comm_whatsapp_chats.pinned_at, now())
      ELSE NULL
    END,
    manual_unread = CASE
      WHEN p_mark_as_unread IS NULL THEN public.comm_whatsapp_chats.manual_unread
      WHEN p_mark_as_unread AND public.comm_whatsapp_chats.unread_count = 0 THEN true
      ELSE false
    END,
    manual_unread_at = CASE
      WHEN p_mark_as_unread IS NULL THEN public.comm_whatsapp_chats.manual_unread_at
      WHEN p_mark_as_unread AND public.comm_whatsapp_chats.unread_count = 0 THEN COALESCE(public.comm_whatsapp_chats.manual_unread_at, now())
      ELSE NULL
    END,
    last_read_at = CASE
      WHEN p_mark_as_unread THEN NULL
      WHEN p_mark_as_unread = false THEN now()
      ELSE public.comm_whatsapp_chats.last_read_at
    END,
    unread_count = CASE
      WHEN p_mark_as_unread = false THEN 0
      ELSE public.comm_whatsapp_chats.unread_count
    END,
    updated_at = now()
  WHERE public.comm_whatsapp_chats.id = p_chat_id
  RETURNING * INTO v_chat;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conversa do WhatsApp nao encontrada.';
  END IF;

  RETURN QUERY SELECT v_chat.*;
END;
$$;

CREATE OR REPLACE FUNCTION public.comm_whatsapp_mark_chat_read(
  p_chat_id uuid,
  p_last_seen_message_at timestamptz,
  p_last_seen_message_id uuid
)
RETURNS TABLE(
  id uuid,
  unread_count integer,
  last_read_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seen_at timestamptz;
  v_next_read_at timestamptz;
BEGIN
  IF auth.uid() IS NULL OR NOT public.current_user_can_edit_comm_whatsapp() THEN
    RAISE EXCEPTION 'Permissao insuficiente para atualizar conversa.';
  END IF;

  IF p_chat_id IS NULL THEN
    RAISE EXCEPTION 'Conversa do WhatsApp nao informada.';
  END IF;

  IF p_last_seen_message_at IS NOT NULL THEN
    v_seen_at := p_last_seen_message_at;
  ELSIF p_last_seen_message_id IS NOT NULL THEN
    SELECT m.message_at
    INTO v_seen_at
    FROM public.comm_whatsapp_messages m
    WHERE m.id = p_last_seen_message_id
      AND m.chat_id = p_chat_id;
  ELSE
    SELECT MAX(m.message_at)
    INTO v_seen_at
    FROM public.comm_whatsapp_messages m
    WHERE m.chat_id = p_chat_id;
  END IF;

  v_next_read_at := COALESCE(v_seen_at, now());

  RETURN QUERY
  WITH updated AS (
    UPDATE public.comm_whatsapp_chats c
    SET
      last_read_at = GREATEST(COALESCE(c.last_read_at, '-infinity'::timestamptz), v_next_read_at),
      manual_unread = false,
      manual_unread_at = NULL,
      updated_at = now()
    WHERE c.id = p_chat_id
    RETURNING c.id, c.last_read_at
  ), unread AS (
    SELECT
      updated.id,
      COUNT(m.id)::integer AS unread_count,
      updated.last_read_at
    FROM updated
    LEFT JOIN public.comm_whatsapp_messages m
      ON m.chat_id = updated.id
      AND m.direction = 'inbound'
      AND m.message_at > updated.last_read_at
    GROUP BY updated.id, updated.last_read_at
  )
  UPDATE public.comm_whatsapp_chats c
  SET unread_count = unread.unread_count
  FROM unread
  WHERE c.id = unread.id
  RETURNING c.id, c.unread_count, c.last_read_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.comm_whatsapp_mark_chat_read(p_chat_id uuid)
RETURNS TABLE(
  id uuid,
  unread_count integer,
  last_read_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.comm_whatsapp_mark_chat_read(p_chat_id, NULL::timestamptz, NULL::uuid);
$$;

CREATE OR REPLACE FUNCTION public.comm_whatsapp_list_chats(
  p_search text DEFAULT NULL,
  p_activity_filter text DEFAULT 'all',
  p_lead_filter text DEFAULT 'all',
  p_saved_filter text DEFAULT 'all',
  p_archived_filter text DEFAULT 'active',
  p_lead_status_filters text[] DEFAULT NULL,
  p_limit integer DEFAULT 80,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  id uuid,
  channel_id uuid,
  external_chat_id text,
  phone_number text,
  phone_digits text,
  display_name text,
  saved_contact_name text,
  push_name text,
  lead_id uuid,
  lead_status text,
  is_archived boolean,
  archived_at timestamptz,
  is_muted boolean,
  muted_at timestamptz,
  is_pinned boolean,
  pinned_at timestamptz,
  manual_unread boolean,
  manual_unread_at timestamptz,
  last_message_text text,
  last_message_direction text,
  last_message_at timestamptz,
  unread_count integer,
  status text,
  last_read_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  WITH input AS (
    SELECT
      NULLIF(btrim(COALESCE(p_search, '')), '') AS search_text,
      regexp_replace(COALESCE(p_search, ''), '\D', '', 'g') AS search_digits,
      lower(NULLIF(btrim(COALESCE(p_activity_filter, 'all')), '')) AS activity_filter,
      lower(NULLIF(btrim(COALESCE(p_lead_filter, 'all')), '')) AS lead_filter,
      lower(NULLIF(btrim(COALESCE(p_saved_filter, 'all')), '')) AS saved_filter,
      lower(NULLIF(btrim(COALESCE(p_archived_filter, 'active')), '')) AS archived_filter,
      ARRAY(
        SELECT lower(btrim(value))
        FROM unnest(COALESCE(p_lead_status_filters, ARRAY[]::text[])) AS value
        WHERE btrim(value) <> ''
      ) AS lead_status_filters,
      LEAST(GREATEST(COALESCE(p_limit, 80), 1), 500) AS safe_limit,
      GREATEST(COALESCE(p_offset, 0), 0) AS safe_offset
  )
  SELECT
    c.id,
    c.channel_id,
    c.external_chat_id,
    c.phone_number,
    c.phone_digits,
    c.display_name,
    c.saved_contact_name,
    c.push_name,
    c.lead_id,
    l.status AS lead_status,
    c.is_archived,
    c.archived_at,
    c.is_muted,
    c.muted_at,
    c.is_pinned,
    c.pinned_at,
    c.manual_unread,
    c.manual_unread_at,
    c.last_message_text,
    c.last_message_direction,
    c.last_message_at,
    c.unread_count,
    c.status,
    c.last_read_at,
    c.created_at,
    c.updated_at
  FROM public.comm_whatsapp_chats c
  LEFT JOIN public.leads l ON l.id = c.lead_id
  CROSS JOIN input
  WHERE public.current_user_can_view_comm_whatsapp()
    AND (
      input.activity_filter IS NULL OR input.activity_filter = 'all'
      OR (input.activity_filter = 'unread' AND (c.unread_count > 0 OR c.manual_unread = true))
    )
    AND (
      input.lead_filter IS NULL OR input.lead_filter = 'all'
      OR (input.lead_filter = 'with_lead' AND c.lead_id IS NOT NULL)
      OR (input.lead_filter = 'without_lead' AND c.lead_id IS NULL)
    )
    AND (
      input.saved_filter IS NULL OR input.saved_filter = 'all'
      OR (input.saved_filter = 'saved' AND c.saved_contact_name IS NOT NULL)
      OR (input.saved_filter = 'unsaved' AND c.saved_contact_name IS NULL)
    )
    AND (
      input.archived_filter IS NULL OR input.archived_filter = 'all'
      OR (input.archived_filter = 'active' AND c.is_archived = false)
      OR (input.archived_filter = 'archived' AND c.is_archived = true)
    )
    AND (
      cardinality(input.lead_status_filters) = 0
      OR lower(COALESCE(l.status, '')) = ANY(input.lead_status_filters)
    )
    AND (
      input.search_text IS NULL
      OR c.display_name ILIKE '%' || input.search_text || '%'
      OR c.saved_contact_name ILIKE '%' || input.search_text || '%'
      OR c.push_name ILIKE '%' || input.search_text || '%'
      OR c.phone_number ILIKE '%' || input.search_text || '%'
      OR (input.search_digits <> '' AND c.phone_digits ILIKE '%' || input.search_digits || '%')
    )
  ORDER BY c.is_pinned DESC, c.pinned_at DESC NULLS LAST, c.last_message_at DESC NULLS LAST, c.updated_at DESC
  LIMIT (SELECT safe_limit FROM input)
  OFFSET (SELECT safe_offset FROM input);
$$;

CREATE OR REPLACE FUNCTION public.comm_whatsapp_search_messages(
  p_search text,
  p_chat_ids uuid[] DEFAULT NULL,
  p_archived_filter text DEFAULT 'all',
  p_limit integer DEFAULT 30
)
RETURNS TABLE(
  message jsonb,
  chat jsonb
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  WITH input AS (
    SELECT
      NULLIF(btrim(COALESCE(p_search, '')), '') AS search_text,
      lower(NULLIF(btrim(COALESCE(p_archived_filter, 'all')), '')) AS archived_filter,
      LEAST(GREATEST(COALESCE(p_limit, 30), 1), 100) AS safe_limit
  )
  SELECT
    to_jsonb(m) AS message,
    to_jsonb(c) || jsonb_build_object('lead_status', l.status) AS chat
  FROM public.comm_whatsapp_messages m
  JOIN public.comm_whatsapp_chats c ON c.id = m.chat_id
  LEFT JOIN public.leads l ON l.id = c.lead_id
  CROSS JOIN input
  WHERE public.current_user_can_view_comm_whatsapp()
    AND input.search_text IS NOT NULL
    AND (p_chat_ids IS NULL OR m.chat_id = ANY(p_chat_ids))
    AND (
      input.archived_filter IS NULL OR input.archived_filter = 'all'
      OR (input.archived_filter = 'active' AND c.is_archived = false)
      OR (input.archived_filter = 'archived' AND c.is_archived = true)
    )
    AND (
      m.text_content ILIKE '%' || input.search_text || '%'
      OR m.media_caption ILIKE '%' || input.search_text || '%'
      OR m.transcription_text ILIKE '%' || input.search_text || '%'
    )
  ORDER BY m.message_at DESC, m.created_at DESC, m.id DESC
  LIMIT (SELECT safe_limit FROM input);
$$;

WITH latest_status_receipts AS (
  SELECT DISTINCT ON (r.channel_id, r.resource_id)
    r.channel_id,
    r.resource_id AS external_message_id,
    NULLIF(btrim(r.summary->>'status'), '') AS delivery_status,
    r.received_at AS status_updated_at,
    NULLIF(btrim(COALESCE(r.summary->>'error', r.summary->>'details', '')), '') AS error_message
  FROM public.comm_whatsapp_event_receipts r
  WHERE r.event_type = 'status'
    AND NULLIF(btrim(COALESCE(r.resource_id, '')), '') IS NOT NULL
    AND NULLIF(btrim(r.summary->>'status'), '') IS NOT NULL
  ORDER BY r.channel_id, r.resource_id, r.received_at DESC
)
UPDATE public.comm_whatsapp_messages m
SET
  delivery_status = CASE
    WHEN public.comm_whatsapp_status_rank(latest_status_receipts.delivery_status) >= public.comm_whatsapp_status_rank(m.delivery_status)
      THEN latest_status_receipts.delivery_status
    ELSE m.delivery_status
  END,
  status_updated_at = GREATEST(COALESCE(m.status_updated_at, '-infinity'::timestamptz), latest_status_receipts.status_updated_at),
  error_message = CASE
    WHEN latest_status_receipts.error_message IS NOT NULL THEN latest_status_receipts.error_message
    WHEN latest_status_receipts.delivery_status IN ('sent', 'delivered', 'read', 'played', 'received') THEN NULL
    ELSE m.error_message
  END
FROM latest_status_receipts
WHERE m.channel_id = latest_status_receipts.channel_id
  AND m.external_message_id = latest_status_receipts.external_message_id
  AND public.comm_whatsapp_status_rank(latest_status_receipts.delivery_status) >= public.comm_whatsapp_status_rank(m.delivery_status);

WITH latest_status_receipts AS (
  SELECT DISTINCT ON (r.channel_id, r.resource_id)
    r.channel_id,
    r.resource_id AS external_message_id,
    NULLIF(btrim(r.summary->>'status'), '') AS delivery_status,
    r.received_at AS status_updated_at,
    NULLIF(btrim(COALESCE(r.summary->>'error', r.summary->>'details', '')), '') AS error_message
  FROM public.comm_whatsapp_event_receipts r
  WHERE r.event_type = 'status'
    AND NULLIF(btrim(COALESCE(r.resource_id, '')), '') IS NOT NULL
    AND NULLIF(btrim(r.summary->>'status'), '') IS NOT NULL
  ORDER BY r.channel_id, r.resource_id, r.received_at DESC
)
INSERT INTO public.comm_whatsapp_pending_message_statuses (
  channel_id,
  external_message_id,
  delivery_status,
  status_updated_at,
  error_message,
  received_at
)
SELECT
  latest_status_receipts.channel_id,
  latest_status_receipts.external_message_id,
  latest_status_receipts.delivery_status,
  latest_status_receipts.status_updated_at,
  latest_status_receipts.error_message,
  now()
FROM latest_status_receipts
WHERE NOT EXISTS (
  SELECT 1
  FROM public.comm_whatsapp_messages m
  WHERE m.channel_id = latest_status_receipts.channel_id
    AND m.external_message_id = latest_status_receipts.external_message_id
)
ON CONFLICT (channel_id, external_message_id)
DO UPDATE SET
  delivery_status = CASE
    WHEN public.comm_whatsapp_status_rank(EXCLUDED.delivery_status) >= public.comm_whatsapp_status_rank(public.comm_whatsapp_pending_message_statuses.delivery_status)
      THEN EXCLUDED.delivery_status
    ELSE public.comm_whatsapp_pending_message_statuses.delivery_status
  END,
  status_updated_at = GREATEST(public.comm_whatsapp_pending_message_statuses.status_updated_at, EXCLUDED.status_updated_at),
  error_message = COALESCE(EXCLUDED.error_message, public.comm_whatsapp_pending_message_statuses.error_message),
  updated_at = now();

WITH recalculated AS (
  SELECT
    c.id,
    COUNT(m.id)::integer AS unread_count
  FROM public.comm_whatsapp_chats c
  LEFT JOIN public.comm_whatsapp_messages m
    ON m.chat_id = c.id
    AND m.direction = 'inbound'
    AND c.last_read_at IS NOT NULL
    AND m.message_at > c.last_read_at
  WHERE c.last_read_at IS NOT NULL
  GROUP BY c.id
)
UPDATE public.comm_whatsapp_chats c
SET unread_count = recalculated.unread_count
FROM recalculated
WHERE c.id = recalculated.id
  AND c.unread_count IS DISTINCT FROM recalculated.unread_count;

REVOKE ALL ON FUNCTION public.comm_whatsapp_persist_message(
  uuid, text, text, text, text, text, text, timestamptz, boolean, text, text, text, text, text, uuid, text, text, text, timestamptz, text, jsonb, text, text, text, text, bigint, integer, text
) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_persist_message(
  uuid, text, text, text, text, text, text, timestamptz, boolean, text, text, text, text, text, uuid, text, text, text, timestamptz, text, jsonb, text, text, text, text, bigint, integer, text
) TO service_role;

REVOKE ALL ON FUNCTION public.comm_whatsapp_update_message_status(uuid, text, text, timestamptz, text) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_update_message_status(uuid, text, text, timestamptz, text) TO service_role;

REVOKE ALL ON FUNCTION public.comm_whatsapp_refresh_chat_identity(uuid) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_refresh_chat_identity(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.comm_whatsapp_refresh_channel_chat_identities(uuid) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_refresh_channel_chat_identities(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.comm_whatsapp_list_chats(text, text, text, text, text, text[], integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_list_chats(text, text, text, text, text, text[], integer, integer) TO authenticated;

REVOKE ALL ON FUNCTION public.comm_whatsapp_search_messages(text, uuid[], text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_search_messages(text, uuid[], text, integer) TO authenticated;

REVOKE ALL ON FUNCTION public.comm_whatsapp_update_chat_inbox_state(uuid, boolean, boolean, boolean, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_update_chat_inbox_state(uuid, boolean, boolean, boolean, boolean) TO authenticated;

REVOKE ALL ON FUNCTION public.comm_whatsapp_mark_chat_read(uuid, timestamptz, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_mark_chat_read(uuid, timestamptz, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.comm_whatsapp_mark_chat_read(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_mark_chat_read(uuid) TO authenticated;

COMMIT;
