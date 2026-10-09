BEGIN;
-- Name matching must agree with the browser, including composed/decomposed accents.
CREATE OR REPLACE FUNCTION public.comm_whatsapp_normalize_search(p_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public
AS $function$
  SELECT btrim(regexp_replace(
    regexp_replace(
      lower(normalize(COALESCE(p_value, ''), NFD)),
      U&'[\0300-\036f\200b\200e\200f\202a-\202e\2066-\2069\feff]', '', 'g'
    ),
    U&'[[:space:]\00a0]+', ' ', 'g'
  ));
$function$;
REVOKE ALL ON FUNCTION public.comm_whatsapp_normalize_search(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_normalize_search(text) TO authenticated, service_role;

-- The canonical resolver checks normalized contact identifiers before returning
-- a persisted name. Support that path without normalizing the entire cache per chat.
CREATE INDEX IF NOT EXISTS idx_comm_whatsapp_contacts_saved_normalized_id
  ON public.comm_whatsapp_phone_contacts_cache
    (channel_id, public.normalize_comm_whatsapp_chat_id(contact_id))
  WHERE saved = true;

-- Search contact aliases once, then resolve canonical names only for the page.
CREATE OR REPLACE FUNCTION public.comm_whatsapp_list_chats(p_search text DEFAULT NULL::text, p_activity_filter text DEFAULT 'all'::text, p_lead_filter text DEFAULT 'all'::text, p_saved_filter text DEFAULT 'all'::text, p_archived_filter text DEFAULT 'active'::text, p_lead_status_filters text[] DEFAULT NULL::text[], p_lead_responsavel_filters text[] DEFAULT NULL::text[], p_limit integer DEFAULT 80, p_offset integer DEFAULT 0)
 RETURNS TABLE(id uuid, channel_id uuid, external_chat_id text, phone_number text, phone_digits text, display_name text, saved_contact_name text, push_name text, lead_id uuid, lead_name text, lead_status text, lead_responsavel_id uuid, lead_responsavel text, merged_into_chat_id uuid, lead_link_source text, lead_linked_at timestamp with time zone, lead_linked_by uuid, auto_link_blocked boolean, identity_conflict boolean, is_archived boolean, archived_at timestamp with time zone, is_muted boolean, muted_at timestamp with time zone, is_pinned boolean, pinned_at timestamp with time zone, manual_unread boolean, manual_unread_at timestamp with time zone, last_message_text text, last_message_direction text, last_message_at timestamp with time zone, last_message_delivery_status text, unread_count integer, status text, autonomous_attendance_status text, last_read_at timestamp with time zone, created_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '15s'
AS $function$
  WITH input AS (
    SELECT
      NULLIF(public.comm_whatsapp_normalize_search(p_search), '') AS search_text,
      regexp_replace(COALESCE(p_search, ''), '\D', '', 'g') AS search_digits,
      lower(NULLIF(btrim(COALESCE(p_activity_filter, 'all')), '')) AS activity_filter,
      lower(NULLIF(btrim(COALESCE(p_lead_filter, 'all')), '')) AS lead_filter,
      lower(NULLIF(btrim(COALESCE(p_saved_filter, 'all')), '')) AS saved_filter,
      lower(NULLIF(btrim(COALESCE(p_archived_filter, 'active')), '')) AS archived_filter,
      ARRAY(
        SELECT lower(btrim(value))
        FROM unnest(COALESCE(p_lead_status_filters, ARRAY[]::text[])) AS value
        WHERE btrim(value) <> ''
      ) AS lead_status_filters,
      ARRAY(
        SELECT btrim(value)
        FROM unnest(COALESCE(p_lead_responsavel_filters, ARRAY[]::text[])) AS value
        WHERE btrim(value) <> ''
      ) AS lead_responsavel_filters,
      LEAST(GREATEST(COALESCE(p_limit, 80), 1), 500) AS safe_limit,
      GREATEST(COALESCE(p_offset, 0), 0) AS safe_offset
  ),

  matching_contacts AS MATERIALIZED (
    SELECT contact.channel_id,
      public.comm_whatsapp_phone_lookup_keys(contact.phone_digits) AS phone_keys,
      public.normalize_comm_whatsapp_chat_id(contact.contact_id) AS contact_id
    FROM public.comm_whatsapp_phone_contacts_cache contact
    CROSS JOIN input
    WHERE input.search_text IS NOT NULL AND contact.saved = true
      AND public.comm_whatsapp_is_valid_display_name(
        COALESCE(NULLIF(btrim(contact.manual_override_name), ''), contact.display_name)
      )
      AND (
        public.comm_whatsapp_normalize_search(contact.display_name) LIKE '%' || input.search_text || '%'
        OR public.comm_whatsapp_normalize_search(contact.manual_override_name) LIKE '%' || input.search_text || '%'
      )
  ),
  matching_contact_chats AS MATERIALIZED (
    SELECT c.id
    FROM matching_contacts contact
    CROSS JOIN LATERAL unnest(contact.phone_keys) AS phone(key)
    JOIN public.comm_whatsapp_chats c ON c.channel_id = contact.channel_id AND c.phone_digits = phone.key
    UNION
    SELECT identifier.chat_id
    FROM matching_contacts contact
    JOIN public.comm_whatsapp_chat_identifiers identifier
      ON identifier.channel_id = contact.channel_id AND identifier.external_chat_id = contact.contact_id
  ),
  page AS MATERIALIZED (
    SELECT
      c.*,
      l.nome_completo AS resolved_lead_name,
      COALESCE(lsc.nome, l.status) AS resolved_lead_status,
      l.responsavel_id AS resolved_lead_responsavel_id,
      lr.label AS resolved_lead_responsavel
    FROM public.comm_whatsapp_chats c
    LEFT JOIN public.leads l ON l.id = c.lead_id
    LEFT JOIN public.lead_status_config lsc ON lsc.id = l.status_id
    LEFT JOIN public.lead_responsaveis lr ON lr.id = l.responsavel_id
    CROSS JOIN input
    WHERE (SELECT public.current_user_can_view_comm_whatsapp())
      AND c.deleted_at IS NULL
      AND c.merged_into_chat_id IS NULL
      AND (
        input.activity_filter IS NULL OR input.activity_filter = 'all'
        OR (input.activity_filter = 'unread' AND (c.unread_count > 0 OR c.manual_unread = true))
      )
      AND (
        input.lead_filter IS NULL OR input.lead_filter = 'all'
        OR (input.lead_filter = 'with_lead' AND c.lead_id IS NOT NULL)
        OR (input.lead_filter = 'without_lead' AND c.lead_id IS NULL)
      )
      AND (
        input.saved_filter IS NULL OR input.saved_filter = 'all'
        OR (
          input.saved_filter = 'saved'
          AND (
            NULLIF(btrim(c.saved_contact_name), '') IS NOT NULL
                         OR NULLIF(btrim(public.comm_whatsapp_preferred_saved_contact_name(
               c.channel_id,
               c.id,
               COALESCE(c.phone_digits, c.phone_number)
             )), '') IS NOT NULL
OR EXISTS (
              SELECT 1
              FROM public.comm_whatsapp_phone_contacts_cache contact
              WHERE contact.channel_id = c.channel_id
                AND contact.phone_digits = c.phone_digits
                AND contact.saved = true
                AND public.comm_whatsapp_is_valid_display_name(contact.display_name)
            )
          )
        )
        OR (
          input.saved_filter = 'unsaved'
          AND NULLIF(btrim(c.saved_contact_name), '') IS NULL
                       AND NULLIF(btrim(public.comm_whatsapp_preferred_saved_contact_name(
               c.channel_id,
               c.id,
               COALESCE(c.phone_digits, c.phone_number)
             )), '') IS NULL
AND NOT EXISTS (
            SELECT 1
            FROM public.comm_whatsapp_phone_contacts_cache contact
            WHERE contact.channel_id = c.channel_id
              AND contact.phone_digits = c.phone_digits
              AND contact.saved = true
              AND public.comm_whatsapp_is_valid_display_name(contact.display_name)
          )
        )
      )
      AND (
        input.archived_filter IS NULL OR input.archived_filter = 'all'
        OR (input.archived_filter = 'active' AND c.is_archived = false)
        OR (input.archived_filter = 'archived' AND c.is_archived = true)
      )
      AND (
        cardinality(input.lead_status_filters) = 0
        OR lower(COALESCE(lsc.nome, l.status, '')) = ANY(input.lead_status_filters)
      )
      AND (
        cardinality(input.lead_responsavel_filters) = 0
        OR l.responsavel_id::text = ANY(input.lead_responsavel_filters)
      )
      AND (
        input.search_text IS NULL
        OR public.comm_whatsapp_normalize_search(c.display_name) LIKE '%' || input.search_text || '%'
        OR public.comm_whatsapp_normalize_search(c.saved_contact_name) LIKE '%' || input.search_text || '%'
        OR public.comm_whatsapp_normalize_search(c.push_name) LIKE '%' || input.search_text || '%'
        OR public.comm_whatsapp_normalize_search(l.nome_completo) LIKE '%' || input.search_text || '%'
        OR c.phone_number LIKE '%' || input.search_text || '%'
        OR (input.search_digits <> '' AND c.phone_digits LIKE '%' || input.search_digits || '%')
        OR c.id IN (SELECT id FROM matching_contact_chats)
      )
    ORDER BY c.is_pinned DESC, c.pinned_at DESC NULLS LAST, c.last_message_at DESC NULLS LAST, c.updated_at DESC
    LIMIT (SELECT safe_limit FROM input)
    OFFSET (SELECT safe_offset FROM input)
  ),
  page_delivery AS MATERIALIZED (
    SELECT c.id AS chat_id, latest.delivery_status
    FROM page c
    LEFT JOIN LATERAL (
      SELECT m.delivery_status
      FROM public.comm_whatsapp_messages m
      WHERE m.chat_id = c.id
      ORDER BY m.message_at DESC, m.created_at DESC, m.id DESC
      LIMIT 1
    ) latest ON true
  )
  SELECT
    c.id,
    c.channel_id,
    c.external_chat_id,
    c.phone_number,
    c.phone_digits,
    COALESCE(
      saved_contact.display_name,
      NULLIF(btrim(c.saved_contact_name), ''),
      NULLIF(btrim(c.resolved_lead_name), ''),
      c.display_name
    ) AS display_name,
    saved_contact.display_name AS saved_contact_name,
    c.push_name,
    c.lead_id,
    c.resolved_lead_name AS lead_name,
    c.resolved_lead_status AS lead_status,
    c.resolved_lead_responsavel_id AS lead_responsavel_id,
    c.resolved_lead_responsavel AS lead_responsavel,
    c.merged_into_chat_id,
    c.lead_link_source,
    c.lead_linked_at,
    c.lead_linked_by,
    c.auto_link_blocked,
    c.identity_conflict,
    c.is_archived,
    c.archived_at,
    c.is_muted,
    c.muted_at,
    c.is_pinned,
    c.pinned_at,
    c.manual_unread,
    c.manual_unread_at,
    c.last_message_text,
    c.last_message_direction,
    c.last_message_at,
    pd.delivery_status AS last_message_delivery_status,
    c.unread_count,
    c.status,
    c.autonomous_attendance_status,
    c.last_read_at,
    c.created_at,
    c.updated_at
  FROM page c
  LEFT JOIN LATERAL (
    SELECT public.comm_whatsapp_preferred_saved_contact_name(
      c.channel_id,
      c.id,
      COALESCE(c.phone_digits, c.phone_number)
    ) AS display_name
  ) AS saved_contact ON true
  LEFT JOIN page_delivery pd ON pd.chat_id = c.id
  ORDER BY c.is_pinned DESC, c.pinned_at DESC NULLS LAST, c.last_message_at DESC NULLS LAST, c.updated_at DESC;
$function$;

-- Resolve each distinct result chat after the message limit, not every message.
CREATE OR REPLACE FUNCTION public.comm_whatsapp_search_messages(
  p_search text, p_chat_ids uuid[] DEFAULT NULL,
  p_archived_filter text DEFAULT 'all', p_limit integer DEFAULT 30
)
RETURNS TABLE(message jsonb, chat jsonb)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $function$
  WITH input AS (
    SELECT NULLIF(btrim(COALESCE(p_search, '')), '') AS search_text,
      lower(NULLIF(btrim(COALESCE(p_archived_filter, 'all')), '')) AS archived_filter,
      LEAST(GREATEST(COALESCE(p_limit, 30), 1), 100) AS safe_limit
  ),
  message_page AS MATERIALIZED (
    SELECT message.*
    FROM public.comm_whatsapp_messages message
    JOIN public.comm_whatsapp_chats chat_row ON chat_row.id = message.chat_id
    CROSS JOIN input
    WHERE (SELECT public.current_user_can_view_comm_whatsapp())
      AND chat_row.deleted_at IS NULL AND chat_row.merged_into_chat_id IS NULL
      AND input.search_text IS NOT NULL
      AND (p_chat_ids IS NULL OR EXISTS (
        SELECT 1 FROM unnest(p_chat_ids) AS requested(chat_id)
        WHERE public.comm_whatsapp_resolve_chat_uuid(requested.chat_id) = chat_row.id
      ))
      AND (input.archived_filter IS NULL OR input.archived_filter = 'all'
        OR (input.archived_filter = 'active' AND chat_row.is_archived = false)
        OR (input.archived_filter = 'archived' AND chat_row.is_archived = true))
      AND (message.text_content ILIKE '%' || input.search_text || '%'
        OR message.media_caption ILIKE '%' || input.search_text || '%'
        OR message.transcription_text ILIKE '%' || input.search_text || '%')
    ORDER BY message.message_at DESC, message.created_at DESC, message.id DESC
    LIMIT (SELECT safe_limit FROM input)
  ),
  page_chats AS MATERIALIZED (
    SELECT chat_row.*,
      public.comm_whatsapp_preferred_saved_contact_name(
        chat_row.channel_id, chat_row.id, chat_row.phone_digits
      ) AS canonical_saved_name
    FROM public.comm_whatsapp_chats chat_row
    WHERE chat_row.id IN (SELECT chat_id FROM message_page)
  )
  SELECT to_jsonb(message) AS message,
    (to_jsonb(chat_row) - 'canonical_saved_name') || jsonb_build_object(
      'display_name', COALESCE(chat_row.canonical_saved_name,
        NULLIF(btrim(chat_row.saved_contact_name), ''), NULLIF(btrim(lead.nome_completo), ''),
        chat_row.display_name),
      'saved_contact_name', COALESCE(chat_row.canonical_saved_name, chat_row.saved_contact_name),
      'lead_name', lead.nome_completo,
      'lead_status', COALESCE(status.nome, lead.status),
      'lead_responsavel_id', lead.responsavel_id
    ) AS chat
  FROM message_page message
  JOIN page_chats chat_row ON chat_row.id = message.chat_id
  LEFT JOIN public.leads lead ON lead.id = chat_row.lead_id
  LEFT JOIN public.lead_status_config status ON status.id = lead.status_id
  ORDER BY message.message_at DESC, message.created_at DESC, message.id DESC;
$function$;
REVOKE ALL ON FUNCTION public.comm_whatsapp_list_chats(text,text,text,text,text,text[],text[],integer,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_list_chats(text,text,text,text,text,text[],text[],integer,integer) TO authenticated;
REVOKE ALL ON FUNCTION public.comm_whatsapp_search_messages(text,uuid[],text,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_search_messages(text,uuid[],text,integer) TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
