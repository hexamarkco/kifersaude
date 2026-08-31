-- Arquivar chat e uma acao manual da Inbox. Eventos outbound recem-enviados
-- podem chegar depois do clique de arquivar (persistencia do envio, eco do
-- webhook ou status), mas nao devem reabrir a conversa. Apenas inbound real,
-- visivel e contabilizado como nao-lido pode desarquivar automaticamente.

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

  -- Divergencias de identidade sao registradas para reconciliacao, mas nao
  -- podem abortar a mensagem ja persistida pelo lock interno.
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

NOTIFY pgrst, 'reload schema';
