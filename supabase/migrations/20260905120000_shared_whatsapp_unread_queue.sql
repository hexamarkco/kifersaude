/*
  # Shared WhatsApp unread queue

  Makes unread counts shared across attendants:
  - inbound message is pending only when newer than the latest outbound
    message or explicit read marker in that chat
  - adds RPC to mark an entire chat as read in one call
*/

CREATE OR REPLACE FUNCTION public.get_whatsapp_unread_counts(current_user_id uuid)
RETURNS TABLE (chat_id text, unread_count integer)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH inbound_messages AS (
    SELECT
      m.chat_id,
      COALESCE(m.timestamp, m.created_at) AS message_at
    FROM public.whatsapp_messages m
    WHERE m.direction = 'inbound'
      AND COALESCE(m.is_deleted, false) = false
  ),
  last_outbound AS (
    SELECT
      m.chat_id,
      MAX(COALESCE(m.timestamp, m.created_at)) AS last_outbound_at
    FROM public.whatsapp_messages m
    WHERE m.direction = 'outbound'
      AND COALESCE(m.is_deleted, false) = false
    GROUP BY m.chat_id
  ),
  last_read_by_anyone AS (
    SELECT
      m.chat_id,
      MAX(COALESCE(m.timestamp, m.created_at)) AS last_read_at
    FROM public.whatsapp_message_reads r
    JOIN public.whatsapp_messages m ON m.id = r.message_id
    WHERE m.direction = 'inbound'
      AND COALESCE(m.is_deleted, false) = false
    GROUP BY m.chat_id
  ),
  cutoff_by_chat AS (
    SELECT
      chats.chat_id,
      GREATEST(
        COALESCE(last_outbound.last_outbound_at, '-infinity'::timestamptz),
        COALESCE(last_read_by_anyone.last_read_at, '-infinity'::timestamptz)
      ) AS cutoff_at
    FROM (
      SELECT DISTINCT m.chat_id
      FROM public.whatsapp_messages m
    ) chats
    LEFT JOIN last_outbound ON last_outbound.chat_id = chats.chat_id
    LEFT JOIN last_read_by_anyone ON last_read_by_anyone.chat_id = chats.chat_id
  )
  SELECT
    inbound_messages.chat_id,
    COUNT(*)::int AS unread_count
  FROM inbound_messages
  LEFT JOIN cutoff_by_chat ON cutoff_by_chat.chat_id = inbound_messages.chat_id
  WHERE inbound_messages.message_at > COALESCE(cutoff_by_chat.cutoff_at, '-infinity'::timestamptz)
  GROUP BY inbound_messages.chat_id
  HAVING COUNT(*) > 0;
$$;

REVOKE ALL ON FUNCTION public.get_whatsapp_unread_counts(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_whatsapp_unread_counts(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_whatsapp_chat_read(current_user_id uuid, chat_ids text[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requester_id uuid;
BEGIN
  requester_id := auth.uid();
  IF requester_id IS NULL THEN
    requester_id := current_user_id;
  END IF;

  IF requester_id IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado';
  END IF;

  IF current_user_id IS NOT NULL AND current_user_id <> requester_id THEN
    RAISE EXCEPTION 'Usuario nao autorizado';
  END IF;

  INSERT INTO public.whatsapp_message_reads (message_id, user_id, read_at)
  SELECT
    m.id,
    requester_id,
    now()
  FROM public.whatsapp_messages m
  WHERE m.direction = 'inbound'
    AND COALESCE(m.is_deleted, false) = false
    AND m.chat_id = ANY(COALESCE(chat_ids, ARRAY[]::text[]))
  ON CONFLICT (message_id, user_id)
  DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_whatsapp_chat_read(uuid, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_whatsapp_chat_read(uuid, text[]) TO authenticated;
