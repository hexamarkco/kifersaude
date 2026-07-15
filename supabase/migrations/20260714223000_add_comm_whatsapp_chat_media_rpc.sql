BEGIN;

CREATE INDEX IF NOT EXISTS comm_whatsapp_messages_chat_media_page_idx
  ON public.comm_whatsapp_messages (chat_id, message_at DESC, id DESC)
  WHERE media_id IS NOT NULL OR media_url IS NOT NULL;

CREATE OR REPLACE FUNCTION public.comm_whatsapp_list_chat_media_page(
  p_chat_id uuid,
  p_media_type text DEFAULT 'all',
  p_before_message_at timestamptz DEFAULT NULL,
  p_before_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 40
)
RETURNS SETOF public.comm_whatsapp_messages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  IF NOT public.current_user_can_view_comm_whatsapp() THEN
    RAISE EXCEPTION 'Permissao insuficiente para visualizar arquivos do WhatsApp.' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT m.*
  FROM public.comm_whatsapp_messages m
  WHERE m.chat_id = p_chat_id
    AND (m.media_id IS NOT NULL OR m.media_url IS NOT NULL)
    AND m.message_type IN ('image', 'video', 'document', 'audio', 'voice')
    AND (
      p_media_type = 'all'
      OR (p_media_type = 'image' AND m.message_type = 'image')
      OR (p_media_type = 'video' AND m.message_type = 'video')
      OR (p_media_type = 'document' AND m.message_type = 'document')
      OR (p_media_type = 'audio' AND m.message_type IN ('audio', 'voice'))
    )
    AND (
      p_before_message_at IS NULL
      OR m.message_at < p_before_message_at
      OR (m.message_at = p_before_message_at AND p_before_id IS NOT NULL AND m.id < p_before_id)
    )
  ORDER BY m.message_at DESC, m.id DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 40), 1), 101);
END;
$$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_list_chat_media_page(uuid, text, timestamptz, uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_list_chat_media_page(uuid, text, timestamptz, uuid, integer) TO authenticated;

COMMIT;
