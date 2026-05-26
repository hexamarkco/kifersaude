BEGIN;

CREATE OR REPLACE FUNCTION public.comm_whatsapp_is_hidden_preview_text(
  p_value text,
  p_message_type text DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  WITH normalized AS (
    SELECT lower(btrim(COALESCE(p_value, ''))) AS value,
      lower(btrim(COALESCE(p_message_type, ''))) AS message_type
  ), marker AS (
    SELECT value, CASE
      WHEN message_type = 'text' THEN '[mensagem]'
      WHEN message_type = 'image' THEN '[imagem]'
      WHEN message_type IN ('video', 'gif', 'short') THEN '[video]'
      WHEN message_type IN ('audio', 'voice') THEN '[audio]'
      WHEN message_type = 'document' THEN '[documento]'
      WHEN message_type = 'link_preview' THEN '[link]'
      WHEN message_type IN ('location', 'live_location') THEN '[localizacao]'
      WHEN message_type = 'sticker' THEN '[sticker]'
      WHEN message_type IN ('contact', 'contact_list') THEN '[contato]'
      WHEN message_type = 'poll' THEN '[enquete]'
      WHEN message_type = 'reply' THEN '[resposta]'
      WHEN message_type IN ('interactive', 'hsm', 'carousel') THEN '[mensagem interativa]'
      WHEN message_type <> '' THEN '[' || message_type || ']'
      ELSE NULL
    END AS message_marker
    FROM normalized
  )
  SELECT value <> '' AND (
    value IN (
      '[mensagem]', '[mensagem sem texto]', '[mensagem sem conteudo]', '[mensagem sem conteúdo]',
      '[payload invalido]', '[payload inválido]', '[acao]', '[ação]', '[action]', '[reacao]', '[reação]',
      '[reaction]', '[atualizacao de midia]', '[atualização de mídia]', '[media update]', '[voto em enquete]'
    )
    OR (message_marker IS NOT NULL AND value = message_marker AND value NOT IN (
      '[imagem]', '[video]', '[documento]', '[audio]', '[link]', '[localizacao]', '[sticker]', '[contato]', '[enquete]', '[resposta]', '[mensagem interativa]'
    ))
    OR (value ~ '^\[[^\]]+\]$' AND value NOT IN (
      '[imagem]', '[video]', '[documento]', '[audio]', '[link]', '[localizacao]', '[sticker]', '[contato]', '[enquete]', '[resposta]', '[mensagem interativa]'
    ))
  )
  FROM marker;
$$;

CREATE OR REPLACE FUNCTION public.comm_whatsapp_message_preview_text(
  p_media_caption text,
  p_text_content text,
  p_message_type text
)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  WITH candidate AS (
    SELECT NULLIF(btrim(COALESCE(p_media_caption, '')), '') AS caption,
      NULLIF(btrim(COALESCE(p_text_content, '')), '') AS text_content,
      lower(btrim(COALESCE(p_message_type, ''))) AS message_type
  )
  SELECT NULLIF(
    COALESCE(
      CASE WHEN caption IS NOT NULL AND NOT public.comm_whatsapp_is_hidden_preview_text(caption, message_type) THEN caption END,
      CASE WHEN text_content IS NOT NULL AND NOT public.comm_whatsapp_is_hidden_preview_text(text_content, message_type) THEN text_content END,
      CASE
        WHEN message_type IN ('audio', 'voice') THEN '[Áudio]'
        WHEN message_type = 'image' THEN '[Imagem]'
        WHEN message_type IN ('video', 'gif', 'short') THEN '[Vídeo]'
        WHEN message_type = 'document' THEN '[Documento]'
        WHEN message_type = 'link_preview' THEN '[Link]'
        WHEN message_type IN ('location', 'live_location') THEN '[Localização]'
        WHEN message_type = 'sticker' THEN '[Sticker]'
        WHEN message_type IN ('contact', 'contact_list') THEN '[Contato]'
        WHEN message_type = 'poll' THEN '[Enquete]'
        WHEN message_type = 'reply' THEN '[Resposta]'
        WHEN message_type IN ('interactive', 'hsm', 'carousel') THEN '[Mensagem interativa]'
        ELSE NULL
      END
    ),
    ''
  )
  FROM candidate;
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

CREATE OR REPLACE FUNCTION public.comm_whatsapp_persist_message(
  p_channel_id uuid,
  p_external_chat_id text,
  p_phone_number text,
  p_display_name text,
  p_push_name text,
  p_last_message_text text,
  p_last_message_direction text,
  p_last_message_at timestamptz,
  p_increment_unread boolean,
  p_external_message_id text,
  p_direction text,
  p_message_type text,
  p_delivery_status text,
  p_text_content text,
  p_created_by uuid,
  p_source text,
  p_sender_name text,
  p_sender_phone text,
  p_status_updated_at timestamptz,
  p_error_message text,
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_media_id text DEFAULT NULL,
  p_media_url text DEFAULT NULL,
  p_media_mime_type text DEFAULT NULL,
  p_media_file_name text DEFAULT NULL,
  p_media_size_bytes bigint DEFAULT NULL,
  p_media_duration_seconds integer DEFAULT NULL,
  p_media_caption text DEFAULT NULL
)
RETURNS TABLE(
  chat_id uuid,
  message_id uuid,
  inserted boolean,
  unread_count integer,
  summary_updated boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_chat public.comm_whatsapp_chats%ROWTYPE;
  v_message_id uuid;
  v_inserted boolean := false;
  v_summary_updated boolean := false;
  v_external_chat_id text := NULLIF(btrim(COALESCE(p_external_chat_id, '')), '');
  v_phone_number text := NULLIF(public.normalize_comm_whatsapp_phone(COALESCE(p_phone_number, '')), '');
  v_display_name text := NULLIF(btrim(COALESCE(p_display_name, '')), '');
  v_push_name text := NULLIF(btrim(COALESCE(p_push_name, '')), '');
  v_external_message_id text := NULLIF(btrim(COALESCE(p_external_message_id, '')), '');
  v_direction text := COALESCE(NULLIF(btrim(COALESCE(p_direction, '')), ''), 'system');
  v_last_direction text := COALESCE(NULLIF(btrim(COALESCE(p_last_message_direction, '')), ''), v_direction);
  v_last_message_at timestamptz := COALESCE(p_last_message_at, p_status_updated_at, now());
  v_message_at timestamptz := COALESCE(p_last_message_at, p_status_updated_at, now());
  v_media_id text := NULLIF(btrim(COALESCE(p_media_id, '')), '');
  v_media_url text := NULLIF(btrim(COALESCE(p_media_url, '')), '');
  v_media_mime_type text := NULLIF(btrim(COALESCE(p_media_mime_type, '')), '');
  v_media_file_name text := NULLIF(btrim(COALESCE(p_media_file_name, '')), '');
  v_media_caption text := NULLIF(btrim(COALESCE(p_media_caption, '')), '');
  v_existing_message public.comm_whatsapp_messages%ROWTYPE;
  v_effective_metadata jsonb := COALESCE(p_metadata, '{}'::jsonb);
  v_existing_history jsonb := '[]'::jsonb;
  v_edit_timestamp timestamptz := COALESCE(p_status_updated_at, v_message_at, now());
  v_message_type text := COALESCE(NULLIF(btrim(COALESCE(p_message_type, '')), ''), 'text');
  v_summary_text text := public.comm_whatsapp_message_preview_text(p_media_caption, COALESCE(p_text_content, p_last_message_text), v_message_type);
  v_has_visible_summary boolean := v_summary_text IS NOT NULL;
BEGIN
  IF v_external_chat_id IS NULL THEN
    RAISE EXCEPTION 'Conversa externa obrigatoria.';
  END IF;

  IF v_phone_number IS NULL THEN
    v_phone_number := NULLIF(public.normalize_comm_whatsapp_phone(split_part(v_external_chat_id, '@', 1)), '');
  END IF;

  IF v_display_name IS NULL THEN
    v_display_name := COALESCE(v_phone_number, 'Numero desconhecido');
  END IF;

  INSERT INTO public.comm_whatsapp_chats (
    channel_id, external_chat_id, phone_number, phone_digits, display_name, push_name,
    last_message_text, last_message_direction, last_message_at, unread_count, is_archived, archived_at, is_muted, muted_at
  )
  VALUES (
    p_channel_id, v_external_chat_id, COALESCE(v_phone_number, '00000000000'), COALESCE(v_phone_number, '00000000000'),
    v_display_name, v_push_name, v_summary_text, CASE WHEN v_has_visible_summary THEN v_last_direction ELSE NULL END,
    CASE WHEN v_has_visible_summary THEN v_last_message_at ELSE NULL END, 0, false, NULL, false, NULL
  )
  ON CONFLICT (channel_id, external_chat_id) DO NOTHING;

  SELECT * INTO v_chat
  FROM public.comm_whatsapp_chats
  WHERE channel_id = p_channel_id AND external_chat_id = v_external_chat_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nao foi possivel localizar a conversa para persistencia.';
  END IF;

  IF v_external_message_id IS NOT NULL THEN
    INSERT INTO public.comm_whatsapp_messages (
      chat_id, channel_id, external_message_id, direction, message_type, delivery_status, text_content, message_at,
      created_by, source, sender_name, sender_phone, status_updated_at, error_message, metadata,
      media_id, media_url, media_mime_type, media_file_name, media_size_bytes, media_duration_seconds, media_caption
    )
    VALUES (
      v_chat.id, p_channel_id, v_external_message_id, v_direction, v_message_type,
      COALESCE(NULLIF(btrim(COALESCE(p_delivery_status, '')), ''), 'pending'), p_text_content, v_message_at,
      p_created_by, NULLIF(btrim(COALESCE(p_source, '')), ''), NULLIF(btrim(COALESCE(p_sender_name, '')), ''),
      NULLIF(public.normalize_comm_whatsapp_phone(COALESCE(p_sender_phone, '')), ''), COALESCE(p_status_updated_at, v_message_at),
      NULLIF(btrim(COALESCE(p_error_message, '')), ''), COALESCE(p_metadata, '{}'::jsonb),
      v_media_id, v_media_url, v_media_mime_type, v_media_file_name, p_media_size_bytes, p_media_duration_seconds, v_media_caption
    )
    ON CONFLICT (channel_id, external_message_id) DO NOTHING
    RETURNING id INTO v_message_id;

    IF v_message_id IS NOT NULL THEN
      v_inserted := true;
    ELSE
      SELECT * INTO v_existing_message
      FROM public.comm_whatsapp_messages
      WHERE channel_id = p_channel_id AND external_message_id = v_external_message_id;

      IF FOUND THEN
        v_effective_metadata := COALESCE(v_existing_message.metadata, '{}'::jsonb) || COALESCE(p_metadata, '{}'::jsonb);

        IF jsonb_typeof(COALESCE(v_existing_message.metadata, '{}'::jsonb)->'edit_history') = 'array' THEN
          v_existing_history := COALESCE(v_existing_message.metadata, '{}'::jsonb)->'edit_history';
        END IF;

        IF p_text_content IS NOT NULL AND v_existing_message.text_content IS DISTINCT FROM p_text_content THEN
          v_effective_metadata := v_effective_metadata || jsonb_build_object(
            'edited', true,
            'edited_at', v_edit_timestamp,
            'original_text_content', COALESCE(NULLIF(COALESCE(v_existing_message.metadata, '{}'::jsonb)->>'original_text_content', ''), v_existing_message.text_content),
            'edit_history', v_existing_history || jsonb_build_array(jsonb_build_object('at', v_edit_timestamp, 'previous_text', v_existing_message.text_content, 'next_text', p_text_content))
          );
        END IF;
      END IF;

      UPDATE public.comm_whatsapp_messages
      SET
        chat_id = v_chat.id,
        direction = v_direction,
        message_type = COALESCE(NULLIF(btrim(COALESCE(p_message_type, '')), ''), public.comm_whatsapp_messages.message_type),
        delivery_status = COALESCE(NULLIF(btrim(COALESCE(p_delivery_status, '')), ''), public.comm_whatsapp_messages.delivery_status),
        text_content = COALESCE(p_text_content, public.comm_whatsapp_messages.text_content),
        message_at = COALESCE(public.comm_whatsapp_messages.message_at, v_message_at),
        created_by = COALESCE(p_created_by, public.comm_whatsapp_messages.created_by),
        source = COALESCE(NULLIF(btrim(COALESCE(p_source, '')), ''), public.comm_whatsapp_messages.source),
        sender_name = COALESCE(NULLIF(btrim(COALESCE(p_sender_name, '')), ''), public.comm_whatsapp_messages.sender_name),
        sender_phone = COALESCE(NULLIF(public.normalize_comm_whatsapp_phone(COALESCE(p_sender_phone, '')), ''), public.comm_whatsapp_messages.sender_phone),
        status_updated_at = COALESCE(p_status_updated_at, v_message_at),
        error_message = COALESCE(NULLIF(btrim(COALESCE(p_error_message, '')), ''), public.comm_whatsapp_messages.error_message),
        metadata = COALESCE(v_effective_metadata, public.comm_whatsapp_messages.metadata, '{}'::jsonb),
        media_id = COALESCE(v_media_id, public.comm_whatsapp_messages.media_id),
        media_url = COALESCE(v_media_url, public.comm_whatsapp_messages.media_url),
        media_mime_type = COALESCE(v_media_mime_type, public.comm_whatsapp_messages.media_mime_type),
        media_file_name = COALESCE(v_media_file_name, public.comm_whatsapp_messages.media_file_name),
        media_size_bytes = COALESCE(p_media_size_bytes, public.comm_whatsapp_messages.media_size_bytes),
        media_duration_seconds = COALESCE(p_media_duration_seconds, public.comm_whatsapp_messages.media_duration_seconds),
        media_caption = COALESCE(v_media_caption, public.comm_whatsapp_messages.media_caption)
      WHERE channel_id = p_channel_id AND external_message_id = v_external_message_id
      RETURNING id INTO v_message_id;
    END IF;
  ELSE
    INSERT INTO public.comm_whatsapp_messages (
      chat_id, channel_id, external_message_id, direction, message_type, delivery_status, text_content, message_at,
      created_by, source, sender_name, sender_phone, status_updated_at, error_message, metadata,
      media_id, media_url, media_mime_type, media_file_name, media_size_bytes, media_duration_seconds, media_caption
    )
    VALUES (
      v_chat.id, p_channel_id, NULL, v_direction, v_message_type,
      COALESCE(NULLIF(btrim(COALESCE(p_delivery_status, '')), ''), 'pending'), p_text_content, v_message_at,
      p_created_by, NULLIF(btrim(COALESCE(p_source, '')), ''), NULLIF(btrim(COALESCE(p_sender_name, '')), ''),
      NULLIF(public.normalize_comm_whatsapp_phone(COALESCE(p_sender_phone, '')), ''), COALESCE(p_status_updated_at, v_message_at),
      NULLIF(btrim(COALESCE(p_error_message, '')), ''), COALESCE(p_metadata, '{}'::jsonb),
      v_media_id, v_media_url, v_media_mime_type, v_media_file_name, p_media_size_bytes, p_media_duration_seconds, v_media_caption
    )
    RETURNING id INTO v_message_id;

    v_inserted := true;
  END IF;

  v_summary_updated := v_has_visible_summary AND (v_chat.last_message_at IS NULL OR v_last_message_at >= v_chat.last_message_at);

  UPDATE public.comm_whatsapp_chats
  SET
    phone_number = COALESCE(v_phone_number, public.comm_whatsapp_chats.phone_number),
    phone_digits = COALESCE(v_phone_number, public.comm_whatsapp_chats.phone_digits),
    display_name = COALESCE(v_display_name, public.comm_whatsapp_chats.display_name),
    push_name = COALESCE(v_push_name, public.comm_whatsapp_chats.push_name),
    last_message_text = CASE WHEN v_summary_updated THEN v_summary_text ELSE public.comm_whatsapp_chats.last_message_text END,
    last_message_direction = CASE WHEN v_summary_updated THEN v_last_direction ELSE public.comm_whatsapp_chats.last_message_direction END,
    last_message_at = CASE WHEN v_summary_updated THEN v_last_message_at ELSE public.comm_whatsapp_chats.last_message_at END,
    unread_count = CASE WHEN COALESCE(p_increment_unread, false) AND v_inserted THEN public.comm_whatsapp_chats.unread_count + 1 ELSE public.comm_whatsapp_chats.unread_count END,
    is_archived = CASE WHEN v_inserted AND NOT public.comm_whatsapp_chats.is_muted THEN false ELSE public.comm_whatsapp_chats.is_archived END,
    archived_at = CASE WHEN v_inserted AND NOT public.comm_whatsapp_chats.is_muted THEN NULL ELSE public.comm_whatsapp_chats.archived_at END,
    updated_at = now()
  WHERE id = v_chat.id
  RETURNING * INTO v_chat;

  SELECT * INTO v_chat
  FROM public.comm_whatsapp_refresh_chat_identity(v_chat.id);

  RETURN QUERY SELECT v_chat.id, v_message_id, v_inserted, v_chat.unread_count, v_summary_updated;
END;
$$;

WITH latest_visible AS (
  SELECT DISTINCT ON (m.chat_id)
    m.chat_id,
    public.comm_whatsapp_message_preview_text(m.media_caption, m.text_content, m.message_type) AS preview_text,
    m.direction,
    m.message_at
  FROM public.comm_whatsapp_messages m
  WHERE public.comm_whatsapp_message_preview_text(m.media_caption, m.text_content, m.message_type) IS NOT NULL
  ORDER BY m.chat_id, m.message_at DESC, m.created_at DESC, m.id DESC
)
UPDATE public.comm_whatsapp_chats c
SET
  last_message_text = lv.preview_text,
  last_message_direction = lv.direction,
  last_message_at = lv.message_at,
  updated_at = now()
FROM latest_visible lv
WHERE lv.chat_id = c.id
  AND (
    NULLIF(btrim(COALESCE(c.last_message_text, '')), '') IS NULL
    OR public.comm_whatsapp_is_hidden_preview_text(c.last_message_text, NULL)
  );

REVOKE ALL ON FUNCTION public.comm_whatsapp_is_hidden_preview_text(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_is_hidden_preview_text(text, text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.comm_whatsapp_message_preview_text(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_message_preview_text(text, text, text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.comm_whatsapp_get_chat_thread(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_get_chat_thread(uuid, integer) TO authenticated;

COMMIT;
