BEGIN;

-- Message search returned the raw chat row while the regular Inbox list and
-- thread used the saved-contact projection. Selecting a search result could
-- therefore reintroduce the old WhatsApp name in the local Inbox state.
CREATE OR REPLACE FUNCTION public.comm_whatsapp_search_messages(
  p_search text,
  p_chat_ids uuid[] DEFAULT NULL,
  p_archived_filter text DEFAULT 'all',
  p_limit integer DEFAULT 30
)
RETURNS TABLE(message jsonb, chat jsonb)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  WITH input AS (
    SELECT
      NULLIF(btrim(COALESCE(p_search, '')), '') AS search_text,
      lower(NULLIF(btrim(COALESCE(p_archived_filter, 'all')), '')) AS archived_filter,
      LEAST(GREATEST(COALESCE(p_limit, 30), 1), 100) AS safe_limit
  )
  SELECT
    to_jsonb(message) AS message,
    to_jsonb(chat_row) || jsonb_build_object(
      'display_name', COALESCE(saved_contact.display_name, chat_row.display_name),
      'saved_contact_name', COALESCE(saved_contact.display_name, chat_row.saved_contact_name),
      'lead_status', lead.status
    ) AS chat
  FROM public.comm_whatsapp_messages AS message
  JOIN public.comm_whatsapp_chats AS chat_row ON chat_row.id = message.chat_id
  LEFT JOIN public.leads AS lead ON lead.id = chat_row.lead_id
  LEFT JOIN LATERAL (
    SELECT public.comm_whatsapp_preferred_saved_contact_name(
      chat_row.channel_id,
      chat_row.id,
      chat_row.phone_digits
    ) AS display_name
  ) AS saved_contact ON true
  CROSS JOIN input
  WHERE public.current_user_can_view_comm_whatsapp()
    AND chat_row.deleted_at IS NULL
    AND chat_row.merged_into_chat_id IS NULL
    AND input.search_text IS NOT NULL
    AND (
      p_chat_ids IS NULL
      OR EXISTS (
        SELECT 1
        FROM unnest(p_chat_ids) AS requested(chat_id)
        WHERE public.comm_whatsapp_resolve_chat_uuid(requested.chat_id) = chat_row.id
      )
    )
    AND (
      input.archived_filter IS NULL OR input.archived_filter = 'all'
      OR (input.archived_filter = 'active' AND chat_row.is_archived = false)
      OR (input.archived_filter = 'archived' AND chat_row.is_archived = true)
    )
    AND (
      message.text_content ILIKE '%' || input.search_text || '%'
      OR message.media_caption ILIKE '%' || input.search_text || '%'
      OR message.transcription_text ILIKE '%' || input.search_text || '%'
    )
  ORDER BY message.message_at DESC, message.created_at DESC, message.id DESC
  LIMIT (SELECT safe_limit FROM input);
$$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_search_messages(text, uuid[], text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_search_messages(text, uuid[], text, integer) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
