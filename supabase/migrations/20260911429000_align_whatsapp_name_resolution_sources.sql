BEGIN;

UPDATE public.comm_whatsapp_phone_contacts_cache
SET
  saved = false,
  updated_at = now()
WHERE contact_id LIKE 'chat:%'
  AND saved = true;

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
    'display_name', COALESCE(NULLIF(btrim(real_saved_contact.display_name), ''), NULLIF(btrim(l.nome_completo), ''), NULLIF(btrim(c.display_name), ''), NULLIF(btrim(c.push_name), ''), public.comm_whatsapp_format_phone_label(c.phone_number)),
    'saved_contact_name', real_saved_contact.display_name,
    'push_name', c.push_name,
    'lead_id', c.lead_id,
    'lead_name', l.nome_completo,
    'lead_status', COALESCE(lsc.nome, l.status),
    'is_archived', c.is_archived,
    'archived_at', c.archived_at,
    'is_muted', c.is_muted,
    'muted_at', c.muted_at,
    'is_pinned', c.is_pinned,
    'pinned_at', c.pinned_at,
    'manual_unread', c.manual_unread,
    'manual_unread_at', c.manual_unread_at,
    'last_message_text', COALESCE(latest_message.preview_text, chat_preview.preview_text),
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
    SELECT NULLIF(btrim(pc.display_name), '') AS display_name
    FROM public.comm_whatsapp_phone_contacts_cache pc
    WHERE pc.channel_id = c.channel_id
      AND pc.saved = true
      AND public.comm_whatsapp_is_valid_display_name(pc.display_name)
      AND public.comm_whatsapp_phone_lookup_keys(pc.phone_digits) && public.comm_whatsapp_phone_lookup_keys(c.phone_digits)
    ORDER BY
      CASE
        WHEN pc.contact_id LIKE 'manual:%' THEN 0
        WHEN pc.contact_id LIKE 'chat:%' THEN 2
        ELSE 1
      END,
      pc.updated_at DESC,
      pc.last_synced_at DESC,
      pc.id DESC
    LIMIT 1
  ) real_saved_contact ON true
  LEFT JOIN LATERAL (
    SELECT CASE
      WHEN public.comm_whatsapp_is_hidden_preview_text(c.last_message_text, NULL) THEN NULL
      ELSE NULLIF(btrim(c.last_message_text), '')
    END AS preview_text
  ) chat_preview ON true
  LEFT JOIN LATERAL (
    SELECT candidate.direction, candidate.message_at, candidate.preview_text, candidate.delivery_status
    FROM (
      SELECT m.direction, m.message_at, m.delivery_status,
        public.comm_whatsapp_message_preview_text(m.media_caption, m.text_content, m.message_type) AS preview_text,
        m.created_at,
        m.id
      FROM public.comm_whatsapp_messages m
      WHERE m.chat_id = c.id
    ) candidate
    WHERE candidate.preview_text IS NOT NULL
    ORDER BY candidate.message_at DESC, candidate.created_at DESC, candidate.id DESC
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

DO $$
DECLARE
  v_chat record;
BEGIN
  FOR v_chat IN
    SELECT id
    FROM public.comm_whatsapp_chats
    WHERE deleted_at IS NULL
  LOOP
    PERFORM * FROM public.comm_whatsapp_refresh_chat_identity(v_chat.id);
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_get_chat_thread(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_get_chat_thread(uuid, integer) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
