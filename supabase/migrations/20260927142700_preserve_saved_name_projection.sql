BEGIN;

-- A chat can retain its saved name even when the corresponding contact-cache
-- row was deleted or not yet rebuilt. The previous projection fell back
-- directly to c.display_name, allowing a provider name to reappear between
-- refreshes. Keep the persisted saved name ahead of the provider value.
CREATE OR REPLACE FUNCTION public.comm_whatsapp_list_chats_with_presence(
  p_search text DEFAULT NULL,
  p_activity_filter text DEFAULT 'all',
  p_lead_filter text DEFAULT 'all',
  p_saved_filter text DEFAULT 'all',
  p_archived_filter text DEFAULT 'active',
  p_lead_status_filters text[] DEFAULT NULL,
  p_lead_responsavel_filters text[] DEFAULT NULL,
  p_limit integer DEFAULT 80,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  id uuid, channel_id uuid, external_chat_id text, is_group boolean,
  presence_status text, presence_last_seen_at timestamptz, presence_updated_at timestamptz,
  phone_number text, phone_digits text, display_name text,
  saved_contact_name text, push_name text, lead_id uuid, lead_name text,
  lead_status text, lead_responsavel_id uuid, lead_responsavel text,
  merged_into_chat_id uuid, lead_link_source text, lead_linked_at timestamptz,
  lead_linked_by uuid, auto_link_blocked boolean, identity_conflict boolean,
  is_archived boolean, archived_at timestamptz, is_muted boolean, muted_at timestamptz,
  is_pinned boolean, pinned_at timestamptz, manual_unread boolean,
  manual_unread_at timestamptz, last_message_text text, last_message_direction text,
  last_message_at timestamptz, last_message_delivery_status text,
  unread_count integer, status text, autonomous_attendance_status text,
  last_read_at timestamptz, created_at timestamptz, updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id, c.channel_id, c.external_chat_id,
    COALESCE(chat.is_group, false),
    presence.status, presence.last_seen_at, presence.observed_at,
    c.phone_number, c.phone_digits,
    COALESCE(saved_contact.display_name, NULLIF(btrim(c.saved_contact_name), ''), c.display_name),
    COALESCE(saved_contact.display_name, NULLIF(btrim(c.saved_contact_name), '')),
    c.push_name, c.lead_id, c.lead_name,
    c.lead_status, c.lead_responsavel_id, c.lead_responsavel,
    c.merged_into_chat_id, c.lead_link_source, c.lead_linked_at,
    c.lead_linked_by, c.auto_link_blocked, c.identity_conflict,
    c.is_archived, c.archived_at, c.is_muted, c.muted_at,
    c.is_pinned, c.pinned_at, c.manual_unread, c.manual_unread_at,
    c.last_message_text, c.last_message_direction, c.last_message_at,
    c.last_message_delivery_status, c.unread_count, c.status,
    c.autonomous_attendance_status, c.last_read_at, c.created_at, c.updated_at
  FROM public.comm_whatsapp_list_chats(
    p_search, p_activity_filter, p_lead_filter, p_saved_filter,
    p_archived_filter, p_lead_status_filters, p_lead_responsavel_filters,
    p_limit, p_offset
  ) c
  LEFT JOIN public.comm_whatsapp_chats chat ON chat.id = c.id
  LEFT JOIN LATERAL (
    SELECT public.comm_whatsapp_preferred_saved_contact_name(
      c.channel_id,
      c.id,
      c.phone_digits
    ) AS display_name
  ) saved_contact ON true
  LEFT JOIN LATERAL (
    SELECT p.status, p.last_seen_at, p.observed_at
    FROM public.comm_whatsapp_presences p
    WHERE p.channel_id = c.channel_id
      AND (
        p.chat_id = c.id
        OR p.external_entry_id = c.external_chat_id
        OR p.external_entry_id = c.phone_digits
      )
    ORDER BY (p.chat_id = c.id) DESC, p.observed_at DESC, p.updated_at DESC
    LIMIT 1
  ) presence ON true
  WHERE public.current_user_can_view_comm_whatsapp();
$$;

CREATE OR REPLACE FUNCTION public.comm_whatsapp_list_chats_with_groups(
  p_search text DEFAULT NULL,
  p_activity_filter text DEFAULT 'all',
  p_lead_filter text DEFAULT 'all',
  p_saved_filter text DEFAULT 'all',
  p_archived_filter text DEFAULT 'active',
  p_lead_status_filters text[] DEFAULT NULL,
  p_lead_responsavel_filters text[] DEFAULT NULL,
  p_limit integer DEFAULT 80,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  id uuid, channel_id uuid, external_chat_id text, is_group boolean,
  phone_number text, phone_digits text, display_name text,
  saved_contact_name text, push_name text, lead_id uuid, lead_name text,
  lead_status text, lead_responsavel_id uuid, lead_responsavel text,
  merged_into_chat_id uuid, lead_link_source text, lead_linked_at timestamptz,
  lead_linked_by uuid, auto_link_blocked boolean, identity_conflict boolean,
  is_archived boolean, archived_at timestamptz, is_muted boolean, muted_at timestamptz,
  is_pinned boolean, pinned_at timestamptz, manual_unread boolean,
  manual_unread_at timestamptz, last_message_text text, last_message_direction text,
  last_message_at timestamptz, last_message_delivery_status text,
  unread_count integer, status text, autonomous_attendance_status text,
  last_read_at timestamptz, created_at timestamptz, updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id, c.channel_id, c.external_chat_id, COALESCE(chat.is_group, false),
    c.phone_number, c.phone_digits,
    COALESCE(saved_contact.display_name, NULLIF(btrim(c.saved_contact_name), ''), c.display_name),
    COALESCE(saved_contact.display_name, NULLIF(btrim(c.saved_contact_name), '')),
    c.push_name, c.lead_id, c.lead_name,
    c.lead_status, c.lead_responsavel_id, c.lead_responsavel,
    c.merged_into_chat_id, c.lead_link_source, c.lead_linked_at,
    c.lead_linked_by, c.auto_link_blocked, c.identity_conflict,
    c.is_archived, c.archived_at, c.is_muted, c.muted_at,
    c.is_pinned, c.pinned_at, c.manual_unread, c.manual_unread_at,
    c.last_message_text, c.last_message_direction, c.last_message_at,
    c.last_message_delivery_status, c.unread_count, c.status,
    c.autonomous_attendance_status, c.last_read_at, c.created_at, c.updated_at
  FROM public.comm_whatsapp_list_chats(
    p_search, p_activity_filter, p_lead_filter, p_saved_filter,
    p_archived_filter, p_lead_status_filters, p_lead_responsavel_filters,
    p_limit, p_offset
  ) c
  LEFT JOIN public.comm_whatsapp_chats chat ON chat.id = c.id
  LEFT JOIN LATERAL (
    SELECT public.comm_whatsapp_preferred_saved_contact_name(
      c.channel_id,
      c.id,
      c.phone_digits
    ) AS display_name
  ) saved_contact ON true
  WHERE public.current_user_can_view_comm_whatsapp();
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
