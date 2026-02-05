/*
  # WhatsApp unread counts RPC
*/

CREATE OR REPLACE FUNCTION public.get_whatsapp_unread_counts(current_user_id uuid)
RETURNS TABLE (chat_id text, unread_count integer)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    m.chat_id,
    COUNT(*)::int AS unread_count
  FROM public.whatsapp_messages m
  LEFT JOIN public.whatsapp_message_reads r
    ON r.message_id = m.id
    AND r.user_id = current_user_id
  WHERE m.direction = 'inbound'
    AND r.message_id IS NULL
  GROUP BY m.chat_id;
$$;

REVOKE ALL ON FUNCTION public.get_whatsapp_unread_counts(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_whatsapp_unread_counts(uuid) TO authenticated;
