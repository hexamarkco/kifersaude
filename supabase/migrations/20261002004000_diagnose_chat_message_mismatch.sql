-- Diagnostico: chats com last_message_text mas sem mensagens reais
-- (e vice-versa). Executar ANTES do fix para quantificar o impacto.
CREATE OR REPLACE FUNCTION public.comm_whatsapp_diagnose_chat_message_mismatch()
RETURNS TABLE (
  chat_id uuid,
  external_chat_id text,
  display_name text,
  last_message_at timestamptz,
  message_count bigint,
  issue text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  -- Chats com last_message_text mas ZERO mensagens
  SELECT
    c.id, c.external_chat_id, c.display_name, c.last_message_at,
    0::bigint AS issue_count,
    'last_message_text_set_but_no_messages' AS issue
  FROM public.comm_whatsapp_chats c
  WHERE c.last_message_text IS NOT NULL
    AND c.merged_into_chat_id IS NULL
    AND c.deleted_at IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.comm_whatsapp_messages m
      WHERE m.chat_id = c.id
    )
  UNION ALL
  -- Chats com mensagens mas last_message_text NULL
  SELECT
    c.id, c.external_chat_id, c.display_name, c.last_message_at,
    count(*) AS issue_count,
    'messages_exist_but_last_message_text_null' AS issue
  FROM public.comm_whatsapp_chats c
  JOIN public.comm_whatsapp_messages m ON m.chat_id = c.id
  WHERE c.last_message_text IS NULL
    AND c.merged_into_chat_id IS NULL
    AND c.deleted_at IS NULL
  GROUP BY c.id, c.external_chat_id, c.display_name, c.last_message_at
  UNION ALL
  -- Mensagens em chats NAO-canonicos (resolucao canonica aponta para outro chat)
  SELECT
    m.chat_id AS chat_id,
    c_outer.external_chat_id,
    c_outer.display_name,
    c_outer.last_message_at,
    count(*) AS issue_count,
    'messages_on_non_canonical_chat' AS issue
  FROM public.comm_whatsapp_messages m
  JOIN public.comm_whatsapp_chats c_outer ON c_outer.id = m.chat_id
  WHERE public.comm_whatsapp_resolve_chat_uuid(m.chat_id) IS DISTINCT FROM m.chat_id
  GROUP BY m.chat_id, c_outer.external_chat_id, c_outer.display_name, c_outer.last_message_at;
$$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_diagnose_chat_message_mismatch() FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_diagnose_chat_message_mismatch() TO service_role;

NOTIFY pgrst, 'reload schema';
