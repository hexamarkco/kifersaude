BEGIN;

CREATE OR REPLACE FUNCTION public.comm_whatsapp_list_messages_page(
  p_chat_id uuid,
  p_before_message_at timestamptz DEFAULT NULL,
  p_before_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 50
)
RETURNS SETOF public.comm_whatsapp_messages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  IF NOT public.current_user_can_view_comm_whatsapp() THEN
    RAISE EXCEPTION 'Permissao insuficiente para visualizar mensagens do WhatsApp.' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT m.*
  FROM public.comm_whatsapp_messages m
  WHERE m.chat_id = p_chat_id
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
END;
$$;

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
  v_chat jsonb;
  v_lead jsonb;
  v_messages jsonb;
  v_message_count integer;
BEGIN
  IF NOT public.current_user_can_view_comm_whatsapp() THEN
    RAISE EXCEPTION 'Permissao insuficiente para visualizar conversa do WhatsApp.' USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'id', c.id,
    'channel_id', c.channel_id,
    'external_chat_id', c.external_chat_id,
    'phone_number', c.phone_number,
    'phone_digits', c.phone_digits,
    'display_name', c.display_name,
    'saved_contact_name', c.saved_contact_name,
    'push_name', c.push_name,
    'lead_id', c.lead_id,
    'lead_status', COALESCE(lsc.nome, l.status),
    'is_archived', c.is_archived,
    'archived_at', c.archived_at,
    'is_muted', c.is_muted,
    'muted_at', c.muted_at,
    'is_pinned', c.is_pinned,
    'pinned_at', c.pinned_at,
    'manual_unread', c.manual_unread,
    'manual_unread_at', c.manual_unread_at,
    'last_message_text', COALESCE(latest_message.preview_text, NULLIF(btrim(c.last_message_text), '')),
    'last_message_direction', CASE
      WHEN latest_message.preview_text IS NOT NULL THEN latest_message.direction
      ELSE COALESCE(NULLIF(btrim(c.last_message_direction), ''), latest_message.direction)
    END,
    'last_message_at', COALESCE(latest_message.message_at, c.last_message_at),
    'last_message_delivery_status', latest_message.delivery_status,
    'unread_count', c.unread_count,
    'status', c.status,
    'last_read_at', c.last_read_at,
    'deleted_at', c.deleted_at,
    'created_at', c.created_at,
    'updated_at', c.updated_at
  )
  INTO v_chat
  FROM public.comm_whatsapp_chats c
  LEFT JOIN public.leads l ON l.id = c.lead_id
  LEFT JOIN public.lead_status_config lsc ON lsc.id = l.status_id
  LEFT JOIN LATERAL (
    SELECT m.direction, m.message_at, m.delivery_status,
      COALESCE(NULLIF(btrim(m.media_caption), ''), NULLIF(btrim(m.text_content), ''), CASE
        WHEN m.message_type IN ('audio', 'voice') THEN '[Áudio]'
        WHEN m.message_type = 'image' THEN '[Imagem]'
        WHEN m.message_type = 'video' THEN '[Vídeo]'
        WHEN m.message_type = 'document' THEN '[Documento]'
        WHEN m.message_type IS NOT NULL THEN '[' || initcap(m.message_type) || ']'
        ELSE NULL
      END) AS preview_text
    FROM public.comm_whatsapp_messages m
    WHERE m.chat_id = c.id
    ORDER BY m.message_at DESC, m.created_at DESC, m.id DESC
    LIMIT 1
  ) latest_message ON true
  WHERE c.id = p_chat_id
    AND c.deleted_at IS NULL
  LIMIT 1;

  IF v_chat IS NULL THEN
    RAISE EXCEPTION 'Conversa do WhatsApp nao encontrada.' USING ERRCODE = 'P0002';
  END IF;

  SELECT jsonb_build_object(
    'id', l.id,
    'nome_completo', l.nome_completo,
    'telefone', l.telefone,
    'observacoes', l.observacoes,
    'status_nome', COALESCE(lsc.nome, l.status),
    'status_value', COALESCE(lsc.nome, l.status),
    'responsavel_label', ro.label,
    'responsavel_value', COALESCE(ro.value, '')
  )
  INTO v_lead
  FROM public.comm_whatsapp_chats c
  JOIN public.leads l ON l.id = c.lead_id
  LEFT JOIN public.lead_status_config lsc ON lsc.id = l.status_id
  LEFT JOIN public.lead_responsaveis ro ON ro.id = l.responsavel_id
  WHERE c.id = p_chat_id;

  WITH ranked AS (
    SELECT m.*
    FROM public.comm_whatsapp_messages m
    WHERE m.chat_id = p_chat_id
    ORDER BY m.message_at DESC, m.id DESC
    LIMIT v_limit + 1
  ), page AS (
    SELECT *
    FROM ranked
    ORDER BY message_at ASC, id ASC
    LIMIT v_limit
  )
  SELECT COALESCE(jsonb_agg(to_jsonb(page) ORDER BY page.message_at ASC, page.id ASC), '[]'::jsonb), (SELECT count(*) FROM ranked)
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

REVOKE ALL ON FUNCTION public.comm_whatsapp_list_messages_page(uuid, timestamptz, uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_list_messages_page(uuid, timestamptz, uuid, integer) TO authenticated;

REVOKE ALL ON FUNCTION public.comm_whatsapp_get_chat_thread(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_get_chat_thread(uuid, integer) TO authenticated;

COMMIT;
