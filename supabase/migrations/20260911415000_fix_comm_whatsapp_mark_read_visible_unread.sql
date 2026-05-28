BEGIN;

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
      AND public.comm_whatsapp_message_preview_text(m.media_caption, m.text_content, m.message_type) IS NOT NULL
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

COMMIT;
