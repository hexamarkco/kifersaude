BEGIN;

-- A listagem do Inbox precisa expor os campos de identidade do chat. Sem
-- lead_link_source, o badge "Auto" ficava dependente de payloads parciais do
-- realtime e podia aparecer/sumir entre refetches.
DROP FUNCTION IF EXISTS public.comm_whatsapp_list_chats(text, text, text, text, text, text[], text[], integer, integer);

CREATE OR REPLACE FUNCTION public.comm_whatsapp_list_chats(
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
  id uuid,
  channel_id uuid,
  external_chat_id text,
  phone_number text,
  phone_digits text,
  display_name text,
  saved_contact_name text,
  push_name text,
  lead_id uuid,
  lead_name text,
  lead_status text,
  lead_responsavel_id uuid,
  lead_responsavel text,
  merged_into_chat_id uuid,
  lead_link_source text,
  lead_linked_at timestamptz,
  lead_linked_by uuid,
  auto_link_blocked boolean,
  identity_conflict boolean,
  is_archived boolean,
  archived_at timestamptz,
  is_muted boolean,
  muted_at timestamptz,
  is_pinned boolean,
  pinned_at timestamptz,
  manual_unread boolean,
  manual_unread_at timestamptz,
  last_message_text text,
  last_message_direction text,
  last_message_at timestamptz,
  last_message_delivery_status text,
  unread_count integer,
  status text,
  autonomous_attendance_status text,
  last_read_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '15s'
STABLE
AS $$
  WITH input AS (
    SELECT
      NULLIF(btrim(COALESCE(p_search, '')), '') AS search_text,
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
    WHERE public.current_user_can_view_comm_whatsapp()
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
        OR (input.saved_filter = 'saved' AND NULLIF(btrim(c.saved_contact_name), '') IS NOT NULL)
        OR (input.saved_filter = 'unsaved' AND NULLIF(btrim(c.saved_contact_name), '') IS NULL)
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
        OR c.display_name ILIKE '%' || input.search_text || '%'
        OR c.saved_contact_name ILIKE '%' || input.search_text || '%'
        OR c.push_name ILIKE '%' || input.search_text || '%'
        OR l.nome_completo ILIKE '%' || input.search_text || '%'
        OR c.phone_number ILIKE '%' || input.search_text || '%'
        OR (input.search_digits <> '' AND c.phone_digits ILIKE '%' || input.search_digits || '%')
      )
    ORDER BY c.is_pinned DESC, c.pinned_at DESC NULLS LAST, c.last_message_at DESC NULLS LAST, c.updated_at DESC
    LIMIT (SELECT safe_limit FROM input)
    OFFSET (SELECT safe_offset FROM input)
  ),
  page_delivery AS MATERIALIZED (
    SELECT DISTINCT ON (m.chat_id) m.chat_id, m.delivery_status
    FROM public.comm_whatsapp_messages m
    WHERE m.chat_id IN (SELECT id FROM page)
    ORDER BY m.chat_id, m.message_at DESC, m.created_at DESC, m.id DESC
  )
  SELECT
    c.id,
    c.channel_id,
    c.external_chat_id,
    c.phone_number,
    c.phone_digits,
    COALESCE(NULLIF(btrim(c.saved_contact_name), ''), NULLIF(btrim(c.resolved_lead_name), ''), c.display_name) AS display_name,
    c.saved_contact_name,
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
  LEFT JOIN page_delivery pd ON pd.chat_id = c.id
  ORDER BY c.is_pinned DESC, c.pinned_at DESC NULLS LAST, c.last_message_at DESC NULLS LAST, c.updated_at DESC;
$$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_list_chats(text, text, text, text, text, text[], text[], integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_list_chats(text, text, text, text, text, text[], text[], integer, integer) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
