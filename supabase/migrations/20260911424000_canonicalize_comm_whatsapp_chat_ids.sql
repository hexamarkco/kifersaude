BEGIN;

CREATE OR REPLACE FUNCTION public.normalize_comm_whatsapp_chat_id(value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  WITH input AS (
    SELECT NULLIF(btrim(COALESCE(value, '')), '') AS raw
  ), normalized AS (
    SELECT
      raw,
      CASE
        WHEN raw ~* '@c\.us$' THEN regexp_replace(raw, '@c\.us$', '@s.whatsapp.net', 'i')
        WHEN raw ~* '@s\.whatsapp\.net$' THEN regexp_replace(raw, '(@s\.whatsapp\.net)+$', '@s.whatsapp.net', 'i')
        ELSE raw
      END AS chat_id
    FROM input
  )
  SELECT COALESCE(
    CASE
      WHEN raw IS NULL THEN ''
      WHEN chat_id ~* '@s\.whatsapp\.net$' THEN
        COALESCE(NULLIF(public.normalize_comm_whatsapp_phone(split_part(chat_id, '@', 1)), '') || '@s.whatsapp.net', chat_id)
      WHEN chat_id LIKE '%@%' THEN chat_id
      ELSE COALESCE(NULLIF(public.normalize_comm_whatsapp_phone(chat_id), '') || '@s.whatsapp.net', chat_id)
    END,
    ''
  )
  FROM normalized;
$$;

REVOKE ALL ON FUNCTION public.normalize_comm_whatsapp_chat_id(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.normalize_comm_whatsapp_chat_id(text) TO authenticated, service_role;

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
  v_external_chat_id text := NULLIF(public.normalize_comm_whatsapp_chat_id(p_external_chat_id), '');
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
    unread_count = CASE WHEN COALESCE(p_increment_unread, false) AND v_inserted AND v_has_visible_summary THEN public.comm_whatsapp_chats.unread_count + 1 ELSE public.comm_whatsapp_chats.unread_count END,
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

CREATE OR REPLACE FUNCTION public.comm_whatsapp_pending_follow_up_chats()
RETURNS TABLE(
  chat_id uuid,
  external_chat_id text,
  lead_id uuid,
  lead_name text,
  lead_phone text,
  reminder_id uuid,
  reminder_title text,
  reminder_due_at timestamptz,
  reminder_priority text,
  last_message_at timestamptz,
  last_message_text text
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    cwc.id,
    cwc.external_chat_id,
    l.id,
    l.nome_completo,
    l.telefone,
    r.id,
    r.titulo,
    r.data_lembrete,
    r.prioridade,
    cwc.last_message_at,
    cwc.last_message_text
  FROM reminders r
  JOIN leads l ON l.id = r.lead_id AND COALESCE(l.arquivado, false) = false
  JOIN LATERAL (
    SELECT chat.*
    FROM comm_whatsapp_chats chat
    WHERE chat.lead_id = l.id
      AND chat.deleted_at IS NULL
    ORDER BY
      CASE
        WHEN chat.external_chat_id = public.normalize_comm_whatsapp_chat_id(COALESCE(l.telefone, chat.external_chat_id)) THEN 0
        ELSE 1
      END,
      CASE
        WHEN chat.external_chat_id = public.normalize_comm_whatsapp_chat_id(chat.external_chat_id) THEN 0
        ELSE 1
      END,
      CASE WHEN NULLIF(btrim(COALESCE(chat.external_chat_id, '')), '') IS NULL THEN 1 ELSE 0 END,
      chat.last_message_at DESC NULLS LAST,
      chat.updated_at DESC NULLS LAST,
      chat.id ASC
    LIMIT 1
  ) cwc ON true
  WHERE COALESCE(r.lido, false) = false
    AND r.tipo = 'Follow-up'
    AND r.data_lembrete <= now()
  ORDER BY r.prioridade DESC, r.data_lembrete ASC, l.nome_completo ASC;
$$;

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
    AND NOT (
      c.external_chat_id <> public.normalize_comm_whatsapp_chat_id(c.external_chat_id)
      AND EXISTS (
        SELECT 1
        FROM public.comm_whatsapp_chats canonical
        WHERE canonical.channel_id = c.channel_id
          AND canonical.id <> c.id
          AND canonical.deleted_at IS NULL
          AND canonical.external_chat_id = public.normalize_comm_whatsapp_chat_id(c.external_chat_id)
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.comm_whatsapp_messages real_message
        WHERE real_message.chat_id = c.id
          AND NOT (
            real_message.direction = 'outbound'
            AND lower(COALESCE(real_message.delivery_status, '')) IN ('pending', 'queued', 'sending')
          )
      )
    )
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

WITH duplicate_legacy_chats AS (
  SELECT
    legacy.id AS legacy_chat_id,
    canonical.id AS canonical_chat_id,
    legacy.external_chat_id AS legacy_external_chat_id,
    canonical.external_chat_id AS canonical_external_chat_id
  FROM public.comm_whatsapp_chats legacy
  JOIN public.comm_whatsapp_chats canonical
    ON canonical.channel_id = legacy.channel_id
   AND canonical.id <> legacy.id
   AND canonical.deleted_at IS NULL
   AND canonical.external_chat_id = public.normalize_comm_whatsapp_chat_id(legacy.external_chat_id)
  WHERE legacy.deleted_at IS NULL
    AND legacy.external_chat_id <> public.normalize_comm_whatsapp_chat_id(legacy.external_chat_id)
    AND NOT EXISTS (
      SELECT 1
      FROM public.comm_whatsapp_messages real_message
      WHERE real_message.chat_id = legacy.id
        AND NOT (
          real_message.direction = 'outbound'
          AND lower(COALESCE(real_message.delivery_status, '')) IN ('pending', 'queued', 'sending')
        )
    )
), marked_messages AS (
  UPDATE public.comm_whatsapp_messages m
  SET
    delivery_status = 'failed',
    status_updated_at = now(),
    error_message = COALESCE(
      NULLIF(btrim(COALESCE(m.error_message, '')), ''),
      'Falha tecnica: envio foi registrado em chat legado sem DDI 55 e nao foi entregue pela Whapi. Use o chat canonico para novos envios.'
    ),
    metadata = COALESCE(m.metadata, '{}'::jsonb) || jsonb_build_object(
      'legacy_chat_canonicalized', true,
      'legacy_external_chat_id', d.legacy_external_chat_id,
      'canonical_chat_id', d.canonical_chat_id,
      'canonical_external_chat_id', d.canonical_external_chat_id
    )
  FROM duplicate_legacy_chats d
  WHERE m.chat_id = d.legacy_chat_id
    AND m.direction = 'outbound'
    AND lower(COALESCE(m.delivery_status, '')) IN ('pending', 'queued', 'sending')
  RETURNING m.external_message_id
), updated_send_requests AS (
  UPDATE public.comm_whatsapp_send_requests sr
  SET
    delivery_status = 'failed',
    error_message = COALESCE(
      NULLIF(btrim(COALESCE(sr.error_message, '')), ''),
      'Falha tecnica: envio direcionado para chat legado sem DDI 55.'
    ),
    updated_at = now()
  FROM marked_messages mm
  WHERE mm.external_message_id IS NOT NULL
    AND sr.external_message_id = mm.external_message_id
    AND lower(COALESCE(sr.delivery_status, '')) IN ('pending', 'queued', 'sending')
  RETURNING sr.id
)
UPDATE public.comm_whatsapp_chats legacy
SET
  deleted_at = COALESCE(legacy.deleted_at, now()),
  is_archived = true,
  archived_at = COALESCE(legacy.archived_at, now()),
  updated_at = now()
FROM duplicate_legacy_chats d
WHERE legacy.id = d.legacy_chat_id;

REVOKE ALL ON FUNCTION public.comm_whatsapp_persist_message(
  uuid, text, text, text, text, text, text, timestamptz, boolean, text, text, text, text, text, uuid, text, text, text, timestamptz, text, jsonb, text, text, text, text, bigint, integer, text
) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_persist_message(
  uuid, text, text, text, text, text, text, timestamptz, boolean, text, text, text, text, text, uuid, text, text, text, timestamptz, text, jsonb, text, text, text, text, bigint, integer, text
) TO service_role;

REVOKE ALL ON FUNCTION public.comm_whatsapp_pending_follow_up_chats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_pending_follow_up_chats() TO authenticated;

REVOKE ALL ON FUNCTION public.comm_whatsapp_list_chats(text, text, text, text, text, text[], integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_list_chats(text, text, text, text, text, text[], integer, integer) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
