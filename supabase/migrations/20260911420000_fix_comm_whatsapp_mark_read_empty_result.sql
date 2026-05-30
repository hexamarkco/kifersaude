BEGIN;

-- Fix 1: persist_message — only increment unread_count for messages with visible
-- preview text, matching the filter already used by mark_chat_read recalculation.
-- This prevents hidden-preview messages (reactions, media updates, poll votes, etc.)
-- from creating phantom unread counts.

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
  v_message_type text := COALESCE(NULLIF(btrim(COALESCE(p_message_type, '')), ''), 'text');
  v_summary_text text := public.comm_whatsapp_message_preview_text(p_media_caption, COALESCE(p_text_content, p_last_message_text), v_message_type);
  v_has_visible_summary boolean := v_summary_text IS NOT NULL;
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
    channel_id, external_chat_id, phone_number, phone_digits, display_name, push_name,
    last_message_text, last_message_direction, last_message_at, unread_count, is_archived, archived_at, is_muted, muted_at
  )
  VALUES (
    p_channel_id, v_external_chat_id, COALESCE(v_phone_number, '00000000000'), COALESCE(v_phone_number, '00000000000'),
    v_display_name, v_push_name, v_summary_text, CASE WHEN v_has_visible_summary THEN v_last_direction ELSE NULL END,
    CASE WHEN v_has_visible_summary THEN v_last_message_at ELSE NULL END, 0, false, NULL, false, NULL
  )
  ON CONFLICT (channel_id, external_chat_id) DO NOTHING;

  SELECT * INTO v_chat
  FROM public.comm_whatsapp_chats
  WHERE channel_id = p_channel_id AND external_chat_id = v_external_chat_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nao foi possivel localizar a conversa para persistencia.';
  END IF;

  IF v_external_message_id IS NOT NULL THEN
    INSERT INTO public.comm_whatsapp_messages (
      chat_id, channel_id, external_message_id, direction, message_type, delivery_status, text_content, message_at,
      created_by, source, sender_name, sender_phone, status_updated_at, error_message, metadata,
      media_id, media_url, media_mime_type, media_file_name, media_size_bytes, media_duration_seconds, media_caption
    )
    VALUES (
      v_chat.id, p_channel_id, v_external_message_id, v_direction, v_message_type,
      COALESCE(NULLIF(btrim(COALESCE(p_delivery_status, '')), ''), 'pending'), p_text_content, v_message_at,
      p_created_by, NULLIF(btrim(COALESCE(p_source, '')), ''), NULLIF(btrim(COALESCE(p_sender_name, '')), ''),
      NULLIF(public.normalize_comm_whatsapp_phone(COALESCE(p_sender_phone, '')), ''), COALESCE(p_status_updated_at, v_message_at),
      NULLIF(btrim(COALESCE(p_error_message, '')), ''), COALESCE(p_metadata, '{}'::jsonb),
      v_media_id, v_media_url, v_media_mime_type, v_media_file_name, p_media_size_bytes, p_media_duration_seconds, v_media_caption
    )
    ON CONFLICT (channel_id, external_message_id) DO NOTHING
    RETURNING id INTO v_message_id;

    IF v_message_id IS NOT NULL THEN
      v_inserted := true;
    ELSE
      SELECT * INTO v_existing_message
      FROM public.comm_whatsapp_messages
      WHERE channel_id = p_channel_id AND external_message_id = v_external_message_id;

      IF FOUND THEN
        v_effective_metadata := COALESCE(v_existing_message.metadata, '{}'::jsonb) || COALESCE(p_metadata, '{}'::jsonb);

        IF jsonb_typeof(COALESCE(v_existing_message.metadata, '{}'::jsonb)->'edit_history') = 'array' THEN
          v_existing_history := COALESCE(v_existing_message.metadata, '{}'::jsonb)->'edit_history';
        END IF;

        IF p_text_content IS NOT NULL AND v_existing_message.text_content IS DISTINCT FROM p_text_content THEN
          v_effective_metadata := v_effective_metadata || jsonb_build_object(
            'edited', true,
            'edited_at', v_edit_timestamp,
            'original_text_content', COALESCE(NULLIF(COALESCE(v_existing_message.metadata, '{}'::jsonb)->>'original_text_content', ''), v_existing_message.text_content),
            'edit_history', v_existing_history || jsonb_build_array(jsonb_build_object('at', v_edit_timestamp, 'previous_text', v_existing_message.text_content, 'next_text', p_text_content))
          );
        END IF;
      END IF;

      UPDATE public.comm_whatsapp_messages
      SET
        chat_id = v_chat.id,
        direction = v_direction,
        message_type = COALESCE(NULLIF(btrim(COALESCE(p_message_type, '')), ''), public.comm_whatsapp_messages.message_type),
        delivery_status = COALESCE(NULLIF(btrim(COALESCE(p_delivery_status, '')), ''), public.comm_whatsapp_messages.delivery_status),
        text_content = COALESCE(p_text_content, public.comm_whatsapp_messages.text_content),
        message_at = COALESCE(public.comm_whatsapp_messages.message_at, v_message_at),
        created_by = COALESCE(p_created_by, public.comm_whatsapp_messages.created_by),
        source = COALESCE(NULLIF(btrim(COALESCE(p_source, '')), ''), public.comm_whatsapp_messages.source),
        sender_name = COALESCE(NULLIF(btrim(COALESCE(p_sender_name, '')), ''), public.comm_whatsapp_messages.sender_name),
        sender_phone = COALESCE(NULLIF(public.normalize_comm_whatsapp_phone(COALESCE(p_sender_phone, '')), ''), public.comm_whatsapp_messages.sender_phone),
        status_updated_at = COALESCE(p_status_updated_at, v_message_at),
        error_message = COALESCE(NULLIF(btrim(COALESCE(p_error_message, '')), ''), public.comm_whatsapp_messages.error_message),
        metadata = COALESCE(v_effective_metadata, public.comm_whatsapp_messages.metadata, '{}'::jsonb),
        media_id = COALESCE(v_media_id, public.comm_whatsapp_messages.media_id),
        media_url = COALESCE(v_media_url, public.comm_whatsapp_messages.media_url),
        media_mime_type = COALESCE(v_media_mime_type, public.comm_whatsapp_messages.media_mime_type),
        media_file_name = COALESCE(v_media_file_name, public.comm_whatsapp_messages.media_file_name),
        media_size_bytes = COALESCE(p_media_size_bytes, public.comm_whatsapp_messages.media_size_bytes),
        media_duration_seconds = COALESCE(p_media_duration_seconds, public.comm_whatsapp_messages.media_duration_seconds),
        media_caption = COALESCE(v_media_caption, public.comm_whatsapp_messages.media_caption)
      WHERE channel_id = p_channel_id AND external_message_id = v_external_message_id
      RETURNING id INTO v_message_id;
    END IF;
  ELSE
    INSERT INTO public.comm_whatsapp_messages (
      chat_id, channel_id, external_message_id, direction, message_type, delivery_status, text_content, message_at,
      created_by, source, sender_name, sender_phone, status_updated_at, error_message, metadata,
      media_id, media_url, media_mime_type, media_file_name, media_size_bytes, media_duration_seconds, media_caption
    )
    VALUES (
      v_chat.id, p_channel_id, NULL, v_direction, v_message_type,
      COALESCE(NULLIF(btrim(COALESCE(p_delivery_status, '')), ''), 'pending'), p_text_content, v_message_at,
      p_created_by, NULLIF(btrim(COALESCE(p_source, '')), ''), NULLIF(btrim(COALESCE(p_sender_name, '')), ''),
      NULLIF(public.normalize_comm_whatsapp_phone(COALESCE(p_sender_phone, '')), ''), COALESCE(p_status_updated_at, v_message_at),
      NULLIF(btrim(COALESCE(p_error_message, '')), ''), COALESCE(p_metadata, '{}'::jsonb),
      v_media_id, v_media_url, v_media_mime_type, v_media_file_name, p_media_size_bytes, p_media_duration_seconds, v_media_caption
    )
    RETURNING id INTO v_message_id;

    v_inserted := true;
  END IF;

  v_summary_updated := v_has_visible_summary AND (v_chat.last_message_at IS NULL OR v_last_message_at >= v_chat.last_message_at);

  UPDATE public.comm_whatsapp_chats
  SET
    phone_number = COALESCE(v_phone_number, public.comm_whatsapp_chats.phone_number),
    phone_digits = COALESCE(v_phone_number, public.comm_whatsapp_chats.phone_digits),
    display_name = COALESCE(v_display_name, public.comm_whatsapp_chats.display_name),
    push_name = COALESCE(v_push_name, public.comm_whatsapp_chats.push_name),
    last_message_text = CASE WHEN v_summary_updated THEN v_summary_text ELSE public.comm_whatsapp_chats.last_message_text END,
    last_message_direction = CASE WHEN v_summary_updated THEN v_last_direction ELSE public.comm_whatsapp_chats.last_message_direction END,
    last_message_at = CASE WHEN v_summary_updated THEN v_last_message_at ELSE public.comm_whatsapp_chats.last_message_at END,
    unread_count = CASE WHEN COALESCE(p_increment_unread, false) AND v_inserted AND v_has_visible_summary THEN public.comm_whatsapp_chats.unread_count + 1 ELSE public.comm_whatsapp_chats.unread_count END,
    is_archived = CASE WHEN v_inserted AND NOT public.comm_whatsapp_chats.is_muted THEN false ELSE public.comm_whatsapp_chats.is_archived END,
    archived_at = CASE WHEN v_inserted AND NOT public.comm_whatsapp_chats.is_muted THEN NULL ELSE public.comm_whatsapp_chats.archived_at END,
    updated_at = now()
  WHERE id = v_chat.id
  RETURNING * INTO v_chat;

  SELECT * INTO v_chat
  FROM public.comm_whatsapp_refresh_chat_identity(v_chat.id);

  RETURN QUERY SELECT v_chat.id, v_message_id, v_inserted, v_chat.unread_count, v_summary_updated;
END;
$$;


-- Fix 2: Rewrite mark_chat_read to avoid RETURN QUERY with data-modifying CTEs.
-- PostgREST can have difficulty serializing the result of compound DML statements
-- inside RETURN QUERY.  Separate the UPDATEs and use a simple SELECT for the return.

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
    WHERE m.chat_id = p_chat_id
      AND public.comm_whatsapp_message_preview_text(m.media_caption, m.text_content, m.message_type) IS NOT NULL;
  END IF;

  v_next_read_at := COALESCE(v_seen_at, now());

  -- Step 1: advance last_read_at and clear manual_unread
  UPDATE public.comm_whatsapp_chats c
  SET
    last_read_at = GREATEST(COALESCE(c.last_read_at, '-infinity'::timestamptz), v_next_read_at),
    manual_unread = false,
    manual_unread_at = NULL,
    updated_at = now()
  WHERE c.id = p_chat_id;

  -- Step 2: recalculate unread_count (only messages with visible preview count)
  -- and return the updated row via a simple RETURN QUERY SELECT.
  RETURN QUERY
  WITH unread AS (
    SELECT COUNT(*)::integer AS cnt
    FROM public.comm_whatsapp_messages m
    WHERE m.chat_id = p_chat_id
      AND m.direction = 'inbound'
      AND m.message_at > v_next_read_at
      AND public.comm_whatsapp_message_preview_text(m.media_caption, m.text_content, m.message_type) IS NOT NULL
  )
  UPDATE public.comm_whatsapp_chats c
  SET unread_count = unread.cnt
  FROM unread
  WHERE c.id = p_chat_id
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

NOTIFY pgrst, 'reload schema';

COMMIT;
