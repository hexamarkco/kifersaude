BEGIN;

-- The persisted chat name is the operator's explicit decision. Return it
-- before scanning the contact cache, which is both safer for name stability
-- and much cheaper for the common saved-contact path.
CREATE OR REPLACE FUNCTION public.comm_whatsapp_preferred_saved_contact_name(
  p_channel_id uuid,
  p_chat_id uuid,
  p_phone_digits text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $function$
DECLARE
  v_saved_contact_name text;
  v_phone_digits text;
BEGIN
  SELECT
    NULLIF(btrim(chat.saved_contact_name), ''),
    COALESCE(
      NULLIF(btrim(p_phone_digits), ''),
      NULLIF(btrim(chat.phone_digits), ''),
      NULLIF(btrim(chat.phone_number), '')
    )
  INTO v_saved_contact_name, v_phone_digits
  FROM public.comm_whatsapp_chats AS chat
  WHERE chat.id = p_chat_id
    AND chat.channel_id = p_channel_id
    AND COALESCE(chat.is_group, false) = false;

  IF public.comm_whatsapp_is_valid_display_name(v_saved_contact_name) THEN
    RETURN v_saved_contact_name;
  END IF;

  RETURN (
    WITH lookup_keys AS MATERIALIZED (
      SELECT public.comm_whatsapp_phone_lookup_keys(v_phone_digits) AS keys
    ),
    cache_rows AS MATERIALIZED (
      SELECT
        contact.id,
        contact.channel_id,
        contact.contact_id,
        contact.phone_digits,
        public.comm_whatsapp_is_manual_contact_cache_row(contact.manual_override, contact.contact_id) AS is_manual,
        CASE
          WHEN public.comm_whatsapp_is_manual_contact_cache_row(contact.manual_override, contact.contact_id)
            THEN COALESCE(NULLIF(btrim(contact.manual_override_name), ''), NULLIF(btrim(contact.display_name), ''))
          ELSE NULLIF(btrim(contact.display_name), '')
        END AS display_name,
        contact.updated_at,
        contact.last_synced_at
      FROM public.comm_whatsapp_phone_contacts_cache AS contact
      WHERE contact.channel_id = p_channel_id
        AND contact.saved = true
    ),
    phone_matches AS MATERIALIZED (
      SELECT cache.*
      FROM cache_rows AS cache
      CROSS JOIN lookup_keys
      WHERE public.comm_whatsapp_is_valid_display_name(cache.display_name)
        AND cache.phone_digits = ANY(lookup_keys.keys)
    ),
    direct_identifier_matches AS MATERIALIZED (
      SELECT cache.*
      FROM cache_rows AS cache
      JOIN public.comm_whatsapp_chat_identifiers AS identifier
        ON identifier.channel_id = p_channel_id
       AND identifier.chat_id = p_chat_id
       AND cache.contact_id = identifier.external_chat_id
      WHERE public.comm_whatsapp_is_valid_display_name(cache.display_name)
    ),
    normalized_identifier_matches AS MATERIALIZED (
      SELECT cache.*
      FROM cache_rows AS cache
      JOIN public.comm_whatsapp_chat_identifiers AS identifier
        ON identifier.channel_id = p_channel_id
       AND identifier.chat_id = p_chat_id
       AND public.normalize_comm_whatsapp_chat_id(cache.contact_id) = identifier.external_chat_id
      WHERE NOT EXISTS (SELECT 1 FROM phone_matches)
        AND NOT EXISTS (SELECT 1 FROM direct_identifier_matches)
        AND public.comm_whatsapp_is_valid_display_name(cache.display_name)
    ),
    indexed_matches AS MATERIALIZED (
      SELECT * FROM phone_matches
      UNION ALL
      SELECT * FROM direct_identifier_matches
      UNION ALL
      SELECT * FROM normalized_identifier_matches
    ),
    fallback_matches AS MATERIALIZED (
      SELECT cache.*
      FROM cache_rows AS cache
      CROSS JOIN lookup_keys
      WHERE NOT EXISTS (SELECT 1 FROM indexed_matches)
        AND NULLIF(btrim(v_phone_digits), '') IS NOT NULL
        AND public.comm_whatsapp_is_valid_display_name(cache.display_name)
        AND public.comm_whatsapp_phone_lookup_keys(cache.phone_digits)
          && lookup_keys.keys
    ),
    candidates AS (
      SELECT DISTINCT ON (id)
        id, display_name, is_manual, updated_at, last_synced_at
      FROM (
        SELECT * FROM indexed_matches
        UNION ALL
        SELECT * FROM fallback_matches
      ) AS matches
      ORDER BY id
    )
    SELECT candidates.display_name
    FROM candidates
    WHERE public.comm_whatsapp_is_valid_display_name(candidates.display_name)
    ORDER BY
      candidates.is_manual DESC,
      candidates.updated_at DESC NULLS LAST,
      candidates.last_synced_at DESC NULLS LAST,
      candidates.id DESC
    LIMIT 1
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_preferred_saved_contact_name(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_preferred_saved_contact_name(uuid, uuid, text) TO authenticated, service_role;

-- comm_whatsapp_list_chats already returns the canonical display and saved
-- name. The presence and groups wrappers must reuse that projection instead
-- of calling the canonical resolver a second time for every row.
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
AS $function$
  SELECT
    c.id, c.channel_id, c.external_chat_id,
    COALESCE(chat.is_group, false),
    presence.status, presence.last_seen_at, presence.observed_at,
    c.phone_number, c.phone_digits,
    c.display_name,
    COALESCE(c.saved_contact_name, NULLIF(btrim(chat.saved_contact_name), '')),
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
$function$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_list_chats_with_presence(text, text, text, text, text, text[], text[], integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_list_chats_with_presence(text, text, text, text, text, text[], text[], integer, integer) TO authenticated;

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
AS $function$
  SELECT
    c.id, c.channel_id, c.external_chat_id, COALESCE(chat.is_group, false),
    c.phone_number, c.phone_digits,
    c.display_name,
    COALESCE(c.saved_contact_name, NULLIF(btrim(chat.saved_contact_name), '')),
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
  WHERE public.current_user_can_view_comm_whatsapp();
$function$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_list_chats_with_groups(text, text, text, text, text, text[], text[], integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_list_chats_with_groups(text, text, text, text, text, text[], text[], integer, integer) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
