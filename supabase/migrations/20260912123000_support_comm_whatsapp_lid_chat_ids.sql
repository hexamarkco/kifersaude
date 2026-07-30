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
        WHEN raw ~* '@lid$' THEN regexp_replace(raw, '@lid$', '@lid', 'i')
        ELSE raw
      END AS chat_id
    FROM input
  )
  SELECT COALESCE(
    CASE
      WHEN raw IS NULL THEN ''
      WHEN chat_id ~* '@s\.whatsapp\.net$' THEN
        COALESCE(NULLIF(public.normalize_comm_whatsapp_phone(split_part(chat_id, '@', 1)), '') || '@s.whatsapp.net', chat_id)
      WHEN chat_id ~* '@lid$' THEN chat_id
      WHEN chat_id LIKE '%@%' THEN chat_id
      ELSE COALESCE(NULLIF(public.normalize_comm_whatsapp_phone(chat_id), '') || '@s.whatsapp.net', chat_id)
    END,
    ''
  )
  FROM normalized;
$$;

-- LID identifiers are valid direct-chat routing IDs but not phone numbers.
-- Preserve a resolver-provided phone when available; otherwise store an empty
-- value instead of turning the numeric LID prefix into a CRM lookup key.
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
  v_external_chat_id text := NULLIF(public.normalize_comm_whatsapp_chat_id(p_external_chat_id), '');
  v_phone_number text := NULLIF(public.normalize_comm_whatsapp_phone(COALESCE(p_phone_number, '')), '');
  v_display_name text := NULLIF(btrim(COALESCE(p_display_name, '')), '');
  v_direction text := COALESCE(NULLIF(btrim(COALESCE(p_direction, '')), ''), 'system');
  v_message_at timestamptz := COALESCE(p_last_message_at, p_status_updated_at, now());
  v_summary_text text := public.comm_whatsapp_message_preview_text(
    p_media_caption,
    COALESCE(p_text_content, p_last_message_text),
    COALESCE(NULLIF(btrim(COALESCE(p_message_type, '')), ''), 'text')
  );
  v_is_lid boolean := v_external_chat_id ~* '@lid$';
  v_lead_id uuid;
  v_lead_matches integer := 0;
  v_unread_count integer;
BEGIN
  IF v_external_chat_id IS NOT NULL THEN
    IF v_phone_number IS NULL AND v_is_lid THEN
      SELECT NULLIF(btrim(chat.phone_digits), '')
      INTO v_phone_number
      FROM public.comm_whatsapp_chats AS chat
      WHERE chat.channel_id = p_channel_id
        AND chat.external_chat_id = v_external_chat_id
      LIMIT 1;
    ELSIF v_phone_number IS NULL AND v_external_chat_id ~* '@s\.whatsapp\.net$' THEN
      v_phone_number := NULLIF(public.normalize_comm_whatsapp_phone(split_part(v_external_chat_id, '@', 1)), '');
    END IF;

    INSERT INTO public.comm_whatsapp_chats AS chat (
      channel_id, external_chat_id, phone_number, phone_digits, display_name, last_message_direction
    )
    VALUES (
      p_channel_id,
      v_external_chat_id,
      COALESCE(v_phone_number, ''),
      COALESCE(v_phone_number, ''),
      COALESCE(v_display_name, v_phone_number, 'Numero desconhecido'),
      'system'
    )
    ON CONFLICT (channel_id, external_chat_id) DO NOTHING;
  END IF;

  SELECT * INTO v_result
  FROM public.comm_whatsapp_persist_message_internal(
    p_channel_id, p_external_chat_id, v_phone_number, p_display_name, p_push_name,
    p_last_message_text, p_last_message_direction, p_last_message_at, p_increment_unread,
    p_external_message_id, p_direction, p_message_type, p_delivery_status, p_text_content,
    p_created_by, p_source, p_sender_name, p_sender_phone, p_status_updated_at,
    p_error_message, p_metadata, p_media_id, p_media_url, p_media_mime_type,
    p_media_file_name, p_media_size_bytes, p_media_duration_seconds, p_media_caption
  );

  IF v_is_lid AND v_phone_number IS NULL THEN
    UPDATE public.comm_whatsapp_chats AS chat
    SET phone_number = '',
        phone_digits = '',
        display_name = CASE
          WHEN chat.display_name IN ('00000000000', public.comm_whatsapp_format_phone_label('00000000000'))
            THEN 'Numero desconhecido'
          ELSE chat.display_name
        END,
        updated_at = now()
    WHERE chat.id = v_result.chat_id;
  END IF;

  IF v_phone_number IS NOT NULL THEN
    SELECT count(*), min(l.id::text)::uuid
    INTO v_lead_matches, v_lead_id
    FROM public.leads l
    WHERE COALESCE(l.arquivado, false) = false
      AND public.comm_whatsapp_phone_lookup_keys(l.telefone)
        && public.comm_whatsapp_phone_lookup_keys(v_phone_number);

    IF v_lead_matches = 1 THEN
      UPDATE public.comm_whatsapp_chats AS chat
      SET lead_id = v_lead_id,
          updated_at = now()
      WHERE chat.id = v_result.chat_id
        AND chat.lead_id IS NULL;
    END IF;
  END IF;

  IF v_result.inserted
    AND v_direction IN ('inbound', 'outbound')
    AND v_summary_text IS NOT NULL
  THEN
    UPDATE public.comm_whatsapp_chats AS chat
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

REVOKE ALL ON FUNCTION public.normalize_comm_whatsapp_chat_id(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.normalize_comm_whatsapp_chat_id(text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.comm_whatsapp_persist_message(
  uuid, text, text, text, text, text, text, timestamptz, boolean, text, text, text, text, text, uuid, text, text, text, timestamptz, text, jsonb, text, text, text, text, bigint, integer, text
) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_persist_message(
  uuid, text, text, text, text, text, text, timestamptz, boolean, text, text, text, text, text, uuid, text, text, text, timestamptz, text, jsonb, text, text, text, text, bigint, integer, text
) TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
