BEGIN;

ALTER TABLE public.comm_whatsapp_chats
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_comm_whatsapp_chats_deleted_at
  ON public.comm_whatsapp_chats (deleted_at)
  WHERE deleted_at IS NOT NULL;

CREATE OR REPLACE FUNCTION public.comm_whatsapp_list_chats(
  p_search text DEFAULT NULL,
  p_activity_filter text DEFAULT 'all',
  p_lead_filter text DEFAULT 'all',
  p_saved_filter text DEFAULT 'all',
  p_archived_filter text DEFAULT 'active',
  p_lead_status_filters text[] DEFAULT NULL,
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
  lead_status text,
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
  last_read_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
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
      LEAST(GREATEST(COALESCE(p_limit, 80), 1), 500) AS safe_limit,
      GREATEST(COALESCE(p_offset, 0), 0) AS safe_offset
  )
  SELECT
    c.id,
    c.channel_id,
    c.external_chat_id,
    c.phone_number,
    c.phone_digits,
    c.display_name,
    c.saved_contact_name,
    c.push_name,
    c.lead_id,
    COALESCE(lsc.nome, l.status) AS lead_status,
    c.is_archived,
    c.archived_at,
    c.is_muted,
    c.muted_at,
    c.is_pinned,
    c.pinned_at,
    c.manual_unread,
    c.manual_unread_at,
    COALESCE(latest_message.preview_text, chat_preview.preview_text) AS last_message_text,
    CASE
      WHEN latest_message.preview_text IS NOT NULL THEN latest_message.direction
      ELSE COALESCE(NULLIF(btrim(c.last_message_direction), ''), latest_message.direction)
    END AS last_message_direction,
    COALESCE(latest_message.message_at, c.last_message_at) AS last_message_at,
    latest_message.delivery_status AS last_message_delivery_status,
    c.unread_count,
    c.status,
    c.last_read_at,
    c.created_at,
    c.updated_at
  FROM public.comm_whatsapp_chats c
  LEFT JOIN public.leads l ON l.id = c.lead_id
  LEFT JOIN public.lead_status_config lsc ON lsc.id = l.status_id
  LEFT JOIN LATERAL (
    SELECT NULLIF(
      CASE
        WHEN lower(btrim(COALESCE(c.last_message_text, ''))) IN (
          '[mensagem]', '[mensagem sem texto]', '[mensagem sem conteudo]', '[mensagem sem conteúdo]',
          '[payload invalido]', '[payload inválido]', '[acao]', '[ação]', '[action]', '[reacao]', '[reação]',
          '[reaction]', '[atualizacao de midia]', '[atualização de mídia]', '[media update]', '[voto em enquete]'
        ) THEN ''
        ELSE btrim(COALESCE(c.last_message_text, ''))
      END,
      ''
    ) AS preview_text
  ) chat_preview ON true
  LEFT JOIN LATERAL (
    SELECT candidate.direction, candidate.message_at, candidate.preview_text, candidate.delivery_status
    FROM (
      SELECT
        m.direction,
        m.message_at,
        m.delivery_status,
        NULLIF(
          CASE
            WHEN lower(btrim(COALESCE(NULLIF(btrim(m.media_caption), ''), NULLIF(btrim(m.text_content), ''), ''))) IN (
              '[mensagem]', '[mensagem sem texto]', '[mensagem sem conteudo]', '[mensagem sem conteúdo]',
              '[payload invalido]', '[payload inválido]', '[acao]', '[ação]', '[action]', '[reacao]', '[reação]',
              '[reaction]', '[atualizacao de midia]', '[atualização de mídia]', '[media update]', '[voto em enquete]'
            ) THEN ''
            ELSE COALESCE(
              NULLIF(btrim(m.media_caption), ''),
              NULLIF(btrim(m.text_content), ''),
              CASE
                WHEN m.message_type IN ('audio', 'voice') THEN '[Áudio]'
                WHEN m.message_type = 'image' THEN '[Imagem]'
                WHEN m.message_type = 'video' THEN '[Vídeo]'
                WHEN m.message_type = 'document' THEN '[Documento]'
                WHEN m.message_type IS NOT NULL THEN '[' || initcap(m.message_type) || ']'
                ELSE NULL
              END
            )
          END,
          ''
        ) AS preview_text,
        m.created_at,
        m.id
      FROM public.comm_whatsapp_messages m
      WHERE m.chat_id = c.id
    ) candidate
    WHERE candidate.preview_text IS NOT NULL
    ORDER BY candidate.message_at DESC, candidate.created_at DESC, candidate.id DESC
    LIMIT 1
  ) latest_message ON true
  CROSS JOIN input
  WHERE public.current_user_can_view_comm_whatsapp()
    AND c.deleted_at IS NULL
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
      OR (input.saved_filter = 'saved' AND c.saved_contact_name IS NOT NULL)
      OR (input.saved_filter = 'unsaved' AND c.saved_contact_name IS NULL)
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
      input.search_text IS NULL
      OR c.display_name ILIKE '%' || input.search_text || '%'
      OR c.saved_contact_name ILIKE '%' || input.search_text || '%'
      OR c.push_name ILIKE '%' || input.search_text || '%'
      OR c.phone_number ILIKE '%' || input.search_text || '%'
      OR (input.search_digits <> '' AND c.phone_digits ILIKE '%' || input.search_digits || '%')
    )
  ORDER BY c.is_pinned DESC, c.pinned_at DESC NULLS LAST, COALESCE(latest_message.message_at, c.last_message_at) DESC NULLS LAST, c.updated_at DESC
  LIMIT (SELECT safe_limit FROM input)
  OFFSET (SELECT safe_offset FROM input);
$$;

CREATE OR REPLACE FUNCTION public.comm_whatsapp_search_messages(
  p_search text,
  p_chat_ids uuid[] DEFAULT NULL,
  p_archived_filter text DEFAULT 'all',
  p_limit integer DEFAULT 30
)
RETURNS TABLE(
  message jsonb,
  chat jsonb
)
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
    to_jsonb(m) AS message,
    to_jsonb(c) || jsonb_build_object('lead_status', l.status) AS chat
  FROM public.comm_whatsapp_messages m
  JOIN public.comm_whatsapp_chats c ON c.id = m.chat_id
  LEFT JOIN public.leads l ON l.id = c.lead_id
  CROSS JOIN input
  WHERE public.current_user_can_view_comm_whatsapp()
    AND c.deleted_at IS NULL
    AND input.search_text IS NOT NULL
    AND (p_chat_ids IS NULL OR m.chat_id = ANY(p_chat_ids))
    AND (
      input.archived_filter IS NULL OR input.archived_filter = 'all'
      OR (input.archived_filter = 'active' AND c.is_archived = false)
      OR (input.archived_filter = 'archived' AND c.is_archived = true)
    )
    AND (
      m.text_content ILIKE '%' || input.search_text || '%'
      OR m.media_caption ILIKE '%' || input.search_text || '%'
      OR m.transcription_text ILIKE '%' || input.search_text || '%'
    )
  ORDER BY m.message_at DESC, m.created_at DESC, m.id DESC
  LIMIT (SELECT safe_limit FROM input);
$$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_list_chats(text, text, text, text, text, text[], integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_list_chats(text, text, text, text, text, text[], integer, integer) TO authenticated;

REVOKE ALL ON FUNCTION public.comm_whatsapp_search_messages(text, uuid[], text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_search_messages(text, uuid[], text, integer) TO authenticated;

COMMIT;
