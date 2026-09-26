BEGIN;

-- A lista e a busca do Inbox já usam o resolvedor que prioriza o contato
-- salvo atual. A abertura da conversa também precisa usar a mesma fonte;
-- caso contrário, um cache histórico pode trocar o nome no momento do clique.
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
    SELECT public.comm_whatsapp_preferred_saved_contact_name(
      chat.channel_id,
      chat.id,
      chat.phone_digits
    ) AS display_name
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

NOTIFY pgrst, 'reload schema';

COMMIT;
