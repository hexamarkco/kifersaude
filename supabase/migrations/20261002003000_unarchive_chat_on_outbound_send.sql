-- Quando o usuario envia uma mensagem para um chat arquivado (nao silenciado),
-- o chat deve ser desarquivado automaticamente. A protecao contra ecos
-- outbound (mensagem antiga que chega depois do archive) e feita por
-- v_result.inserted (dedup) e v_message_at > archived_at (mensagem posterior
-- ao archive).

-- =========================================================================
-- 1. Wrapper: comm_whatsapp_persist_message
-- =========================================================================
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
  v_result record;
  v_input_external_chat_id text := NULLIF(public.normalize_comm_whatsapp_chat_id(p_external_chat_id), '');
  v_resolved_external_chat_id text;
  v_canonical_chat_id uuid;
  v_next_chat_id uuid;
  v_phone_number text := NULLIF(public.normalize_comm_whatsapp_phone(COALESCE(p_phone_number, '')), '');
  v_display_name text := NULLIF(btrim(COALESCE(p_display_name, '')), '');
  v_direction text := COALESCE(NULLIF(btrim(COALESCE(p_direction, '')), ''), 'system');
  v_message_at timestamptz := COALESCE(p_last_message_at, p_status_updated_at, now());
  v_summary_text text := public.comm_whatsapp_message_preview_text(
    p_media_caption,
    COALESCE(p_text_content, p_last_message_text),
    COALESCE(NULLIF(btrim(COALESCE(p_message_type, '')), ''), 'text')
  );
  v_input_is_lid boolean := false;
  v_lid_digits text;
  v_unread_count integer;
BEGIN
  IF p_channel_id IS NULL OR v_input_external_chat_id IS NULL THEN
    RAISE EXCEPTION 'Canal e identificador externo sao obrigatorios.';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('comm-whatsapp-identity:' || p_channel_id::text || ':' || v_input_external_chat_id, 0)
  );

  v_input_is_lid := v_input_external_chat_id ~* '@lid$';
  v_lid_digits := regexp_replace(split_part(v_input_external_chat_id, '@', 1), '\D', '', 'g');
  IF v_input_is_lid AND v_phone_number = v_lid_digits THEN
    v_phone_number := NULL;
  END IF;

  v_canonical_chat_id := public.comm_whatsapp_resolve_canonical_chat_uuid(p_channel_id, v_input_external_chat_id);
  IF v_canonical_chat_id IS NOT NULL THEN
    SELECT external_chat_id,
           COALESCE(v_phone_number, NULLIF(btrim(phone_digits), ''))
    INTO v_resolved_external_chat_id, v_phone_number
    FROM public.comm_whatsapp_chats
    WHERE id = v_canonical_chat_id;
  ELSE
    v_resolved_external_chat_id := v_input_external_chat_id;
  END IF;

  IF v_phone_number IS NULL AND v_resolved_external_chat_id ~* '@s\.whatsapp\.net$' THEN
    v_phone_number := NULLIF(public.normalize_comm_whatsapp_phone(split_part(v_resolved_external_chat_id, '@', 1)), '');
  END IF;

  INSERT INTO public.comm_whatsapp_chats (
    channel_id, external_chat_id, phone_number, phone_digits, display_name, last_message_direction
  )
  VALUES (
    p_channel_id,
    v_resolved_external_chat_id,
    COALESCE(v_phone_number, ''),
    COALESCE(v_phone_number, ''),
    COALESCE(
      v_display_name,
      CASE WHEN v_phone_number IS NULL THEN NULL ELSE public.comm_whatsapp_format_phone_label(v_phone_number) END,
      'Contato privado'
    ),
    'system'
  )
  ON CONFLICT (channel_id, external_chat_id) DO NOTHING;

  v_canonical_chat_id := COALESCE(
    public.comm_whatsapp_resolve_canonical_chat_uuid(p_channel_id, v_input_external_chat_id),
    public.comm_whatsapp_resolve_canonical_chat_uuid(p_channel_id, v_resolved_external_chat_id)
  );

  LOOP
    SELECT
      chat.merged_into_chat_id,
      chat.external_chat_id,
      COALESCE(v_phone_number, NULLIF(btrim(chat.phone_digits), ''))
    INTO v_next_chat_id, v_resolved_external_chat_id, v_phone_number
    FROM public.comm_whatsapp_chats AS chat
    WHERE chat.id = v_canonical_chat_id
      AND chat.channel_id = p_channel_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Chat canonico nao encontrado durante persistencia.';
    END IF;

    EXIT WHEN v_next_chat_id IS NULL;
    v_canonical_chat_id := public.comm_whatsapp_resolve_chat_uuid(v_next_chat_id);
  END LOOP;

  SELECT * INTO v_result
  FROM public.comm_whatsapp_persist_message_internal(
    p_channel_id, v_resolved_external_chat_id, v_phone_number, p_display_name, p_push_name,
    p_last_message_text, p_last_message_direction, p_last_message_at, p_increment_unread,
    p_external_message_id, p_direction, p_message_type, p_delivery_status, p_text_content,
    p_created_by, p_source, p_sender_name, p_sender_phone, p_status_updated_at,
    p_error_message, p_metadata, p_media_id, p_media_url, p_media_mime_type,
    p_media_file_name, p_media_size_bytes, p_media_duration_seconds, p_media_caption
  );

  IF public.comm_whatsapp_resolve_chat_uuid(v_result.chat_id) IS DISTINCT FROM v_canonical_chat_id THEN
    INSERT INTO public.comm_whatsapp_identity_conflicts (
      dedupe_key, channel_id, chat_id, conflict_type, status, details
    ) VALUES (
      'persist-mismatch:' || p_channel_id::text || ':' || COALESCE(v_result.chat_id::text, 'null') || ':' || COALESCE(v_canonical_chat_id::text, 'null'),
      p_channel_id,
      v_result.chat_id,
      'identifier_conflict',
      'open',
      jsonb_build_object(
        'source', 'comm_whatsapp_persist_message',
        'input_external_chat_id', v_input_external_chat_id,
        'resolved_external_chat_id', v_resolved_external_chat_id,
        'locked_canonical_chat_id', v_canonical_chat_id,
        'persisted_chat_id', v_result.chat_id,
        'external_message_id', p_external_message_id
      )
    )
    ON CONFLICT (dedupe_key) DO NOTHING;
  ELSE
    v_result.chat_id := v_canonical_chat_id;
  END IF;

  IF v_input_is_lid AND v_phone_number IS NULL THEN
    UPDATE public.comm_whatsapp_chats chat
    SET phone_number = '',
        phone_digits = '',
        display_name = CASE
          WHEN regexp_replace(COALESCE(chat.display_name, ''), '\D', '', 'g') = v_lid_digits
            THEN COALESCE(NULLIF(btrim(chat.push_name), ''), 'Contato privado')
          ELSE chat.display_name
        END,
        updated_at = now()
    WHERE chat.id = v_result.chat_id;
  END IF;

  PERFORM public.comm_whatsapp_register_chat_identifier(
    p_channel_id,
    v_result.chat_id,
    v_input_external_chat_id,
    COALESCE(NULLIF(btrim(p_source), ''), 'message'),
    false,
    jsonb_build_object('external_message_id', p_external_message_id)
  );

  IF v_phone_number IS NOT NULL THEN
    PERFORM public.comm_whatsapp_try_auto_link_chat(v_result.chat_id, v_phone_number, 'auto_phone');
  END IF;

  PERFORM public.comm_whatsapp_refresh_chat_identity(v_result.chat_id);

  -- Desarquivamento em inbound real (nao-lido, visivel, nao silenciado)
  IF v_result.inserted
    AND v_direction = 'inbound'
    AND COALESCE(p_increment_unread, false)
    AND v_summary_text IS NOT NULL
  THEN
    UPDATE public.comm_whatsapp_chats chat
    SET is_archived = false, archived_at = NULL, updated_at = now()
    WHERE chat.id = v_result.chat_id
      AND chat.is_archived
      AND NOT chat.is_muted
      AND (chat.archived_at IS NULL OR v_message_at > chat.archived_at)
    RETURNING chat.unread_count INTO v_unread_count;
  END IF;

  -- Desarquivamento em envio do usuario (outbound novo, nao silenciado)
  IF v_result.inserted
    AND v_direction = 'outbound'
    AND v_summary_text IS NOT NULL
  THEN
    UPDATE public.comm_whatsapp_chats chat
    SET is_archived = false, archived_at = NULL, updated_at = now()
    WHERE chat.id = v_result.chat_id
      AND chat.is_archived
      AND NOT chat.is_muted
      AND (chat.archived_at IS NULL OR v_message_at > chat.archived_at)
    RETURNING chat.unread_count INTO v_unread_count;
  END IF;

  RETURN QUERY SELECT
    v_result.chat_id,
    v_result.message_id,
    v_result.inserted,
    COALESCE(v_unread_count, v_result.unread_count),
    v_result.summary_updated;
END;
$$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_persist_message(
  uuid, text, text, text, text, text, text, timestamptz, boolean, text, text, text, text, text, uuid, text, text, text, timestamptz, text, jsonb, text, text, text, text, bigint, integer, text
) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_persist_message(
  uuid, text, text, text, text, text, text, timestamptz, boolean, text, text, text, text, text, uuid, text, text, text, timestamptz, text, jsonb, text, text, text, text, bigint, integer, text
) TO service_role;

-- =========================================================================
-- 2. Internal: comm_whatsapp_persist_message_internal
--    Incluir outbound na condicao de desarquivamento do CASE de is_archived
--    no UPDATE do chat (consistencia com o wrapper).
-- =========================================================================
CREATE OR REPLACE FUNCTION public.comm_whatsapp_persist_message_internal(
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
  v_input_delivery_status text := NULLIF(btrim(COALESCE(p_delivery_status, '')), '');
  v_delivery_status text := COALESCE(
    v_input_delivery_status,
    CASE
      WHEN v_direction = 'outbound' AND v_external_message_id IS NOT NULL THEN 'sent'
      ELSE 'pending'
    END
  );
  v_error_message text := NULLIF(btrim(COALESCE(p_error_message, '')), '');
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

  IF v_external_message_id IS NOT NULL THEN
    SELECT * INTO v_existing_message
    FROM public.comm_whatsapp_messages
    WHERE channel_id = p_channel_id AND external_message_id = v_external_message_id
    LIMIT 1
    FOR UPDATE;

    IF FOUND THEN
      v_message_id := v_existing_message.id;
      v_inserted := false;

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

      UPDATE public.comm_whatsapp_messages
      SET
        chat_id = v_chat.id,
        direction = v_direction,
        message_type = COALESCE(NULLIF(btrim(COALESCE(p_message_type, '')), ''), public.comm_whatsapp_messages.message_type),
        delivery_status = CASE
          WHEN public.comm_whatsapp_should_apply_status(public.comm_whatsapp_messages.delivery_status, v_delivery_status) THEN v_delivery_status
          ELSE public.comm_whatsapp_messages.delivery_status
        END,
        text_content = COALESCE(p_text_content, public.comm_whatsapp_messages.text_content),
        message_at = COALESCE(public.comm_whatsapp_messages.message_at, v_message_at),
        created_by = COALESCE(p_created_by, public.comm_whatsapp_messages.created_by),
        source = COALESCE(NULLIF(btrim(COALESCE(p_source, '')), ''), public.comm_whatsapp_messages.source),
        sender_name = COALESCE(NULLIF(btrim(COALESCE(p_sender_name, '')), ''), public.comm_whatsapp_messages.sender_name),
        sender_phone = COALESCE(NULLIF(public.normalize_comm_whatsapp_phone(COALESCE(p_sender_phone, '')), ''), public.comm_whatsapp_messages.sender_phone),
        status_updated_at = GREATEST(COALESCE(public.comm_whatsapp_messages.status_updated_at, '-infinity'::timestamptz), COALESCE(p_status_updated_at, v_message_at)),
        error_message = CASE
          WHEN v_error_message IS NOT NULL AND public.comm_whatsapp_should_apply_status(public.comm_whatsapp_messages.delivery_status, v_delivery_status) THEN v_error_message
          WHEN public.comm_whatsapp_should_apply_status(public.comm_whatsapp_messages.delivery_status, v_delivery_status)
            AND lower(v_delivery_status) IN ('sent', 'delivered', 'read', 'played', 'received', 'seen', 'viewed') THEN NULL
          ELSE public.comm_whatsapp_messages.error_message
        END,
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
    v_message_id := NULL;
    v_inserted := false;

    IF v_media_id IS NOT NULL OR (v_message_type = 'text' AND NULLIF(btrim(COALESCE(p_text_content, '')), '') IS NOT NULL) THEN
      SELECT existing.id INTO v_message_id
      FROM public.comm_whatsapp_messages AS existing
      WHERE existing.chat_id = v_chat.id
        AND existing.direction = v_direction
        AND existing.message_type = v_message_type
        AND (
          (v_media_id IS NOT NULL AND existing.media_id IS NOT NULL AND existing.media_id = v_media_id)
          OR (v_media_id IS NULL AND NULLIF(btrim(COALESCE(existing.text_content, '')), '') = NULLIF(btrim(COALESCE(p_text_content, '')), ''))
        )
      ORDER BY existing.message_at ASC, existing.id ASC
      LIMIT 1;
    END IF;

    IF v_message_id IS NULL THEN
      INSERT INTO public.comm_whatsapp_messages (
        chat_id, channel_id, external_message_id, direction, message_type, delivery_status, text_content, message_at,
        created_by, source, sender_name, sender_phone, status_updated_at, error_message, metadata,
        media_id, media_url, media_mime_type, media_file_name, media_size_bytes, media_duration_seconds, media_caption
      )
      VALUES (
        v_chat.id, p_channel_id, NULL, v_direction, v_message_type,
        v_delivery_status, p_text_content, v_message_at,
        p_created_by, NULLIF(btrim(COALESCE(p_source, '')), ''), NULLIF(btrim(COALESCE(p_sender_name, '')), ''),
        NULLIF(public.normalize_comm_whatsapp_phone(COALESCE(p_sender_phone, '')), ''), COALESCE(p_status_updated_at, v_message_at),
        v_error_message, COALESCE(p_metadata, '{}'::jsonb),
        v_media_id, v_media_url, v_media_mime_type, v_media_file_name, p_media_size_bytes, p_media_duration_seconds, v_media_caption
      )
      RETURNING id INTO v_message_id;

      v_inserted := (v_message_id IS NOT NULL);
    END IF;
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
    is_archived = CASE
      WHEN v_inserted
        AND v_has_visible_summary
        AND NOT public.comm_whatsapp_chats.is_muted
        AND public.comm_whatsapp_chats.is_archived
        AND (public.comm_whatsapp_chats.archived_at IS NULL OR v_message_at > public.comm_whatsapp_chats.archived_at)
        THEN false
      ELSE public.comm_whatsapp_chats.is_archived
    END,
    archived_at = CASE
      WHEN v_inserted
        AND v_has_visible_summary
        AND NOT public.comm_whatsapp_chats.is_muted
        AND public.comm_whatsapp_chats.is_archived
        AND (public.comm_whatsapp_chats.archived_at IS NULL OR v_message_at > public.comm_whatsapp_chats.archived_at)
        THEN NULL
      ELSE public.comm_whatsapp_chats.archived_at
    END,
    updated_at = now()
  WHERE id = v_chat.id
  RETURNING * INTO v_chat;

  SELECT * INTO v_chat
  FROM public.comm_whatsapp_refresh_chat_identity(v_chat.id);

  RETURN QUERY SELECT v_chat.id, v_message_id, v_inserted, v_chat.unread_count, v_summary_updated;
END;
$$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_persist_message_internal(
  uuid, text, text, text, text, text, text, timestamptz, boolean, text, text, text, text, text, uuid, text, text, text, timestamptz, text, jsonb, text, text, text, text, bigint, integer, text
) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_persist_message_internal(
  uuid, text, text, text, text, text, text, timestamptz, boolean, text, text, text, text, text, uuid, text, text, text, timestamptz, text, jsonb, text, text, text, text, bigint, integer, text
) TO service_role;

NOTIFY pgrst, 'reload schema';
