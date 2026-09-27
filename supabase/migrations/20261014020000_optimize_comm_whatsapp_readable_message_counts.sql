-- Marking a chat as read recalculates the visible inbound message count.
-- Keep only messages that can contribute to that count in a partial index so
-- the RPC does not evaluate the immutable preview function for every message
-- in large chats.
CREATE INDEX IF NOT EXISTS idx_comm_whatsapp_messages_readable_inbound_chat_at
  ON public.comm_whatsapp_messages (chat_id, message_at DESC)
  WHERE direction = 'inbound'
    AND public.comm_whatsapp_message_preview_text(media_caption, text_content, message_type) IS NOT NULL;
