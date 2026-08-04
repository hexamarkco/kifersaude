-- Aba "Estreladas" no drawer de arquivos da conversa.
-- Estende comm_whatsapp_list_chat_media_page para aceitar p_media_type = 'starred',
-- retornando mensagens com metadata.starred = true (qualquer tipo, excluindo apagadas).

CREATE OR REPLACE FUNCTION public.comm_whatsapp_list_chat_media_page(
  p_chat_id uuid,
  p_media_type text DEFAULT 'all',
  p_before_message_at timestamptz DEFAULT NULL,
  p_before_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 40
)
RETURNS SETOF public.comm_whatsapp_messages
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT message.*
  FROM public.comm_whatsapp_messages AS message
  WHERE message.chat_id = public.comm_whatsapp_resolve_chat_uuid(p_chat_id)
    AND public.current_user_can_view_comm_whatsapp()
    AND (
      p_media_type = 'starred'
      OR (
        (message.media_id IS NOT NULL OR message.media_url IS NOT NULL)
        AND message.message_type IN ('image', 'video', 'document', 'audio', 'voice')
      )
    )
    AND (
      p_media_type <> 'starred'
      OR (
        COALESCE(message.metadata ->> 'starred', '') = 'true'
        AND COALESCE(message.metadata ->> 'deleted', 'false') <> 'true'
        AND COALESCE(message.delivery_status, '') <> 'deleted'
      )
    )
    AND (
      p_media_type = 'all'
      OR p_media_type = 'starred'
      OR (p_media_type = 'image' AND message.message_type = 'image')
      OR (p_media_type = 'video' AND message.message_type = 'video')
      OR (p_media_type = 'document' AND message.message_type = 'document')
      OR (p_media_type = 'audio' AND message.message_type IN ('audio', 'voice'))
    )
    AND (
      p_before_message_at IS NULL
      OR message.message_at < p_before_message_at
      OR (message.message_at = p_before_message_at AND p_before_id IS NOT NULL AND message.id < p_before_id)
    )
  ORDER BY message.message_at DESC, message.id DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 40), 1), 101);
$$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_list_chat_media_page(uuid, text, timestamptz, uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_list_chat_media_page(uuid, text, timestamptz, uuid, integer) TO authenticated;
