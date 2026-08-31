/*
  # Expor e permitir controlar o atendimento autonomo no Inbox real

  A coluna comm_whatsapp_chats.autonomous_attendance_status ja existe (ver
  20260929130000), mas nao aparecia nem no retorno de comm_whatsapp_list_chats
  nem de comm_whatsapp_get_chat_thread — o frontend do Inbox nao tinha como
  saber se a IA estava ativa naquele chat. Esta migracao:

  - Inclui a coluna nas duas RPCs de leitura.
  - Cria comm_whatsapp_set_autonomous_attendance_status(), pra permitir que
    um humano assuma o controle a qualquer momento (encerra o atendimento
    autonomo naquele chat especifico e cancela qualquer resposta da IA que
    estivesse agendada) sem precisar mexer direto no banco.
*/

BEGIN;

-- ---- comm_whatsapp_get_chat_thread: so adiciona o campo no jsonb ----

CREATE OR REPLACE FUNCTION public.comm_whatsapp_get_chat_thread(
  p_chat_id uuid,
  p_limit integer DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);
  v_chat_id uuid := public.comm_whatsapp_resolve_chat_uuid(p_chat_id);
  v_chat jsonb;
  v_lead jsonb;
  v_messages jsonb;
  v_message_count integer;
BEGIN
  IF NOT public.current_user_can_view_comm_whatsapp() THEN
    RAISE EXCEPTION 'Permissao insuficiente para visualizar conversa do WhatsApp.' USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'id', chat.id,
    'channel_id', chat.channel_id,
    'external_chat_id', chat.external_chat_id,
    'phone_number', chat.phone_number,
    'phone_digits', chat.phone_digits,
    'display_name', COALESCE(
      NULLIF(btrim(saved_contact.display_name), ''),
      NULLIF(btrim(lead.nome_completo), ''),
      NULLIF(btrim(chat.push_name), ''),
      NULLIF(btrim(chat.display_name), ''),
      CASE
        WHEN NULLIF(btrim(chat.phone_number), '') IS NULL THEN 'Contato privado'
        ELSE public.comm_whatsapp_format_phone_label(chat.phone_number)
      END
    ),
    'saved_contact_name', saved_contact.display_name,
    'push_name', chat.push_name,
    'lead_id', chat.lead_id,
    'lead_name', lead.nome_completo,
    'lead_status', COALESCE(status_config.nome, lead.status),
    'merged_into_chat_id', chat.merged_into_chat_id,
    'lead_link_source', chat.lead_link_source,
    'lead_linked_at', chat.lead_linked_at,
    'lead_linked_by', chat.lead_linked_by,
    'auto_link_blocked', chat.auto_link_blocked,
    'identity_conflict', chat.identity_conflict,
    'is_archived', chat.is_archived,
    'archived_at', chat.archived_at,
    'is_muted', chat.is_muted,
    'muted_at', chat.muted_at,
    'is_pinned', chat.is_pinned,
    'pinned_at', chat.pinned_at,
    'manual_unread', chat.manual_unread,
    'manual_unread_at', chat.manual_unread_at,
    'last_message_text', COALESCE(latest_message.preview_text, chat_preview.preview_text),
    'last_message_direction', CASE
      WHEN latest_message.preview_text IS NOT NULL THEN latest_message.direction
      ELSE COALESCE(NULLIF(btrim(chat.last_message_direction), ''), latest_message.direction)
    END,
    'last_message_at', COALESCE(latest_message.message_at, chat.last_message_at),
    'last_message_delivery_status', latest_message.delivery_status,
    'unread_count', chat.unread_count,
    'status', chat.status,
    'autonomous_attendance_status', chat.autonomous_attendance_status,
    'last_read_at', chat.last_read_at,
    'deleted_at', chat.deleted_at,
    'created_at', chat.created_at,
    'updated_at', chat.updated_at
  )
  INTO v_chat
  FROM public.comm_whatsapp_chats AS chat
  LEFT JOIN public.leads AS lead ON lead.id = chat.lead_id
  LEFT JOIN public.lead_status_config AS status_config ON status_config.id = lead.status_id
  LEFT JOIN LATERAL (
    SELECT NULLIF(btrim(contact.display_name), '') AS display_name
    FROM public.comm_whatsapp_phone_contacts_cache AS contact
    WHERE contact.channel_id = chat.channel_id
      AND contact.saved = true
      AND public.comm_whatsapp_is_valid_display_name(contact.display_name)
      AND (
        public.comm_whatsapp_phone_lookup_keys(contact.phone_digits)
          && public.comm_whatsapp_phone_lookup_keys(chat.phone_digits)
        OR EXISTS (
          SELECT 1
          FROM public.comm_whatsapp_chat_identifiers AS identifier
          WHERE identifier.chat_id = chat.id
            AND identifier.channel_id = chat.channel_id
            AND identifier.external_chat_id = public.normalize_comm_whatsapp_chat_id(contact.contact_id)
        )
      )
    ORDER BY
      CASE WHEN contact.contact_id LIKE 'manual:%' THEN 0 ELSE 1 END,
      contact.updated_at DESC,
      contact.last_synced_at DESC,
      contact.id DESC
    LIMIT 1
  ) AS saved_contact ON true
  LEFT JOIN LATERAL (
    SELECT CASE
      WHEN public.comm_whatsapp_is_hidden_preview_text(chat.last_message_text, NULL) THEN NULL
      ELSE NULLIF(btrim(chat.last_message_text), '')
    END AS preview_text
  ) AS chat_preview ON true
  LEFT JOIN LATERAL (
    SELECT candidate.direction, candidate.message_at, candidate.preview_text, candidate.delivery_status
    FROM (
      SELECT
        message.direction,
        message.message_at,
        message.delivery_status,
        public.comm_whatsapp_message_preview_text(
          message.media_caption,
          message.text_content,
          message.message_type
        ) AS preview_text,
        message.created_at,
        message.id
      FROM public.comm_whatsapp_messages AS message
      WHERE message.chat_id = chat.id
        AND COALESCE(message.delivery_status, '') <> 'deleted'
    ) AS candidate
    WHERE candidate.preview_text IS NOT NULL
    ORDER BY candidate.message_at DESC, candidate.created_at DESC, candidate.id DESC
    LIMIT 1
  ) AS latest_message ON true
  WHERE chat.id = v_chat_id
    AND chat.deleted_at IS NULL
    AND chat.merged_into_chat_id IS NULL
  LIMIT 1;

  IF v_chat IS NULL THEN
    RAISE EXCEPTION 'Conversa do WhatsApp nao encontrada.' USING ERRCODE = 'P0002';
  END IF;

  SELECT jsonb_build_object(
    'id', lead.id,
    'nome_completo', lead.nome_completo,
    'telefone', lead.telefone,
    'observacoes', lead.observacoes,
    'status_nome', COALESCE(status_config.nome, lead.status),
    'status_value', COALESCE(status_config.nome, lead.status),
    'responsavel_label', responsible.label,
    'responsavel_value', COALESCE(responsible.value, '')
  )
  INTO v_lead
  FROM public.comm_whatsapp_chats AS chat
  JOIN public.leads AS lead ON lead.id = chat.lead_id
  LEFT JOIN public.lead_status_config AS status_config ON status_config.id = lead.status_id
  LEFT JOIN public.lead_responsaveis AS responsible ON responsible.id = lead.responsavel_id
  WHERE chat.id = v_chat_id;

  WITH ranked AS (
    SELECT message.*
    FROM public.comm_whatsapp_messages AS message
    WHERE message.chat_id = v_chat_id
    ORDER BY message.message_at DESC, message.id DESC
    LIMIT v_limit + 1
  ),
  page AS (
    SELECT *
    FROM ranked
    ORDER BY message_at DESC, id DESC
    LIMIT v_limit
  )
  SELECT
    COALESCE(jsonb_agg(to_jsonb(page) ORDER BY page.message_at ASC, page.id ASC), '[]'::jsonb),
    (SELECT count(*) FROM ranked)
  INTO v_messages, v_message_count
  FROM page;

  RETURN jsonb_build_object(
    'chat', v_chat,
    'lead', v_lead,
    'messages', COALESCE(v_messages, '[]'::jsonb),
    'hasMore', COALESCE(v_message_count, 0) > v_limit,
    'generatedAt', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_get_chat_thread(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_get_chat_thread(uuid, integer) TO authenticated;

-- ---- comm_whatsapp_list_chats: muda o shape de retorno, precisa DROP ----

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

-- ---- Nova RPC: humano assume o controle (ou reativa) o atendimento autonomo ----

CREATE OR REPLACE FUNCTION public.comm_whatsapp_set_autonomous_attendance_status(
  p_chat_id uuid,
  p_status text
)
RETURNS SETOF public.comm_whatsapp_chats
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_chat_id uuid;
  v_chat public.comm_whatsapp_chats%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.current_user_can_edit_comm_whatsapp() THEN
    RAISE EXCEPTION 'Permissao insuficiente para atualizar conversa.';
  END IF;

  IF p_status NOT IN ('inactive', 'handed_off') THEN
    RAISE EXCEPTION 'Status invalido para atualizacao manual do atendimento autonomo.';
  END IF;

  v_chat_id := public.comm_whatsapp_lock_canonical_chat_uuid(p_chat_id);
  IF v_chat_id IS NULL THEN
    RAISE EXCEPTION 'Conversa do WhatsApp nao encontrada.' USING ERRCODE = 'P0002';
  END IF;

  -- Cancela qualquer resposta da IA ja agendada pra esse chat — o humano
  -- esta assumindo agora, a IA nao deve mais responder mesmo que um job
  -- ja estivesse na fila.
  UPDATE public.ai_autonomous_reply_jobs
  SET status = 'cancelled', last_error = 'Atendimento assumido manualmente pelo humano'
  WHERE chat_id = v_chat_id AND status = 'pending';

  UPDATE public.comm_whatsapp_chats
  SET autonomous_attendance_status = p_status,
      updated_at = now()
  WHERE public.comm_whatsapp_chats.id = v_chat_id
    AND public.comm_whatsapp_chats.deleted_at IS NULL
    AND public.comm_whatsapp_chats.merged_into_chat_id IS NULL
  RETURNING * INTO v_chat;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conversa do WhatsApp nao encontrada.' USING ERRCODE = 'P0002';
  END IF;

  RETURN NEXT v_chat;
END;
$$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_set_autonomous_attendance_status(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_set_autonomous_attendance_status(uuid, text) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
