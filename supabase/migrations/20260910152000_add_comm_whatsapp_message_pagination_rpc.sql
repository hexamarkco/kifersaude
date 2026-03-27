BEGIN;

CREATE INDEX IF NOT EXISTS idx_comm_whatsapp_messages_chat_message_page
  ON public.comm_whatsapp_messages (chat_id, message_at DESC, id DESC);

CREATE OR REPLACE FUNCTION public.comm_whatsapp_list_messages_page(
  p_chat_id uuid,
  p_before_message_at timestamptz DEFAULT NULL,
  p_before_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 50
)
RETURNS SETOF public.comm_whatsapp_messages
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT m.*
  FROM public.comm_whatsapp_messages m
  WHERE m.chat_id = p_chat_id
    AND public.current_user_can_view_comm_whatsapp()
    AND (
      p_before_message_at IS NULL
      OR m.message_at < p_before_message_at
      OR (
        m.message_at = p_before_message_at
        AND p_before_id IS NOT NULL
        AND m.id < p_before_id
      )
    )
  ORDER BY m.message_at DESC, m.id DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 201);
$$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_list_messages_page(uuid, timestamptz, uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_list_messages_page(uuid, timestamptz, uuid, integer) TO authenticated;

COMMIT;
