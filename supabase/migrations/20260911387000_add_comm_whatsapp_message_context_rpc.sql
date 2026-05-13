BEGIN;

CREATE OR REPLACE FUNCTION public.comm_whatsapp_list_message_context(
  p_chat_id uuid,
  p_message_id uuid,
  p_before_limit integer DEFAULT 40,
  p_after_limit integer DEFAULT 40
)
RETURNS SETOF public.comm_whatsapp_messages
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  WITH input AS (
    SELECT
      LEAST(GREATEST(COALESCE(p_before_limit, 40), 0), 100) AS before_limit,
      LEAST(GREATEST(COALESCE(p_after_limit, 40), 0), 100) AS after_limit
  ),
  target AS (
    SELECT m.*
    FROM public.comm_whatsapp_messages m
    WHERE m.chat_id = p_chat_id
      AND m.id = p_message_id
      AND public.current_user_can_view_comm_whatsapp()
    LIMIT 1
  ),
  older AS (
    SELECT m.*
    FROM public.comm_whatsapp_messages m
    CROSS JOIN target t
    CROSS JOIN input
    WHERE m.chat_id = p_chat_id
      AND (
        m.message_at < t.message_at
        OR (m.message_at = t.message_at AND m.id < t.id)
      )
    ORDER BY m.message_at DESC, m.id DESC
    LIMIT (SELECT before_limit FROM input)
  ),
  newer AS (
    SELECT m.*
    FROM public.comm_whatsapp_messages m
    CROSS JOIN target t
    CROSS JOIN input
    WHERE m.chat_id = p_chat_id
      AND (
        m.message_at > t.message_at
        OR (m.message_at = t.message_at AND m.id > t.id)
      )
    ORDER BY m.message_at ASC, m.id ASC
    LIMIT (SELECT after_limit FROM input)
  )
  SELECT *
  FROM (
    SELECT * FROM older
    UNION ALL
    SELECT * FROM target
    UNION ALL
    SELECT * FROM newer
  ) context_messages
  ORDER BY message_at ASC, id ASC;
$$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_list_message_context(uuid, uuid, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_list_message_context(uuid, uuid, integer, integer) TO authenticated;

COMMIT;
