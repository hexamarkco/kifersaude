BEGIN;

-- New UI calls identify the selected chat explicitly. The old RPC only
-- received a phone number and could therefore associate a schedule with a
-- different channel (or a different duplicate chat) that used the same
-- number.
CREATE OR REPLACE FUNCTION public.create_scheduled_message_for_chat(
  p_channel_id uuid,
  p_phone_digits text,
  p_scheduled_at timestamptz,
  p_message_type text DEFAULT 'text',
  p_text_content text DEFAULT NULL,
  p_media_url text DEFAULT NULL,
  p_media_mime_type text DEFAULT NULL,
  p_media_file_name text DEFAULT NULL,
  p_recurrence text DEFAULT 'none',
  p_recurrence_config jsonb DEFAULT '{}'::jsonb,
  p_recurrence_ends_at timestamptz DEFAULT NULL,
  p_lead_id uuid DEFAULT NULL,
  p_contract_id uuid DEFAULT NULL,
  p_label text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_max_attempts integer DEFAULT 3,
  p_cancel_on_inbound_message boolean DEFAULT false,
  p_chat_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_new_id uuid;
  v_chat_id uuid;
  v_phone text;
  v_phone_digits text;
  v_display text;
BEGIN
  IF p_text_content IS NULL AND p_media_url IS NULL THEN
    RAISE EXCEPTION 'A mensagem precisa de texto ou midia.';
  END IF;

  IF p_scheduled_at < v_now THEN
    RAISE EXCEPTION 'A data de agendamento nao pode ser no passado.';
  END IF;

  IF p_recurrence NOT IN ('none', 'daily', 'weekly', 'monthly') THEN
    RAISE EXCEPTION 'Recorrencia invalida: %', p_recurrence;
  END IF;

  IF p_recurrence = 'none'
     AND p_recurrence_config IS NOT NULL
     AND p_recurrence_config <> '{}'::jsonb THEN
    RAISE EXCEPTION 'recurrence_config so deve ser preenchido quando ha recorrencia.';
  END IF;

  IF p_chat_id IS NOT NULL THEN
    SELECT id, phone_number, phone_digits, display_name
    INTO v_chat_id, v_phone, v_phone_digits, v_display
    FROM public.comm_whatsapp_chats
    WHERE id = p_chat_id
      AND channel_id = p_channel_id
    LIMIT 1;

    IF v_chat_id IS NULL THEN
      RAISE EXCEPTION 'A conversa selecionada nao pertence ao canal informado.';
    END IF;
  ELSE
    SELECT id, phone_number, phone_digits, display_name
    INTO v_chat_id, v_phone, v_phone_digits, v_display
    FROM public.comm_whatsapp_chats
    WHERE channel_id = p_channel_id
      AND phone_digits = p_phone_digits
    ORDER BY updated_at DESC
    LIMIT 1;
  END IF;

  v_phone_digits := COALESCE(v_phone_digits, p_phone_digits);
  v_phone := COALESCE(v_phone, v_phone_digits);
  v_display := COALESCE(v_display, v_phone);

  INSERT INTO public.comm_whatsapp_scheduled_messages (
    channel_id, chat_id, phone_digits, phone_number, display_name,
    message_type, text_content, media_url, media_mime_type, media_file_name,
    scheduled_at, recurrence, recurrence_config, recurrence_ends_at,
    next_run_at, status, cancel_on_inbound_message,
    lead_id, contract_id, created_by, label, notes, max_attempts
  ) VALUES (
    p_channel_id, v_chat_id, v_phone_digits, v_phone, v_display,
    p_message_type, p_text_content, p_media_url, p_media_mime_type, p_media_file_name,
    p_scheduled_at, p_recurrence, p_recurrence_config,
    CASE WHEN p_recurrence <> 'none' THEN p_recurrence_ends_at ELSE NULL END,
    CASE WHEN p_recurrence <> 'none' THEN p_scheduled_at ELSE NULL END,
    'scheduled', COALESCE(p_cancel_on_inbound_message, false),
    p_lead_id, p_contract_id, auth.uid(), p_label, p_notes, GREATEST(p_max_attempts, 1)
  )
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;

-- Keep the existing RPC contract for integrations that do not send a chat id,
-- but make its fallback lookup channel-safe through the new implementation.
CREATE OR REPLACE FUNCTION public.create_scheduled_message(
  p_channel_id uuid,
  p_phone_digits text,
  p_scheduled_at timestamptz,
  p_message_type text DEFAULT 'text',
  p_text_content text DEFAULT NULL,
  p_media_url text DEFAULT NULL,
  p_media_mime_type text DEFAULT NULL,
  p_media_file_name text DEFAULT NULL,
  p_recurrence text DEFAULT 'none',
  p_recurrence_config jsonb DEFAULT '{}'::jsonb,
  p_recurrence_ends_at timestamptz DEFAULT NULL,
  p_lead_id uuid DEFAULT NULL,
  p_contract_id uuid DEFAULT NULL,
  p_label text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_max_attempts integer DEFAULT 3,
  p_cancel_on_inbound_message boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.create_scheduled_message_for_chat(
    p_channel_id => p_channel_id,
    p_phone_digits => p_phone_digits,
    p_scheduled_at => p_scheduled_at,
    p_message_type => p_message_type,
    p_text_content => p_text_content,
    p_media_url => p_media_url,
    p_media_mime_type => p_media_mime_type,
    p_media_file_name => p_media_file_name,
    p_recurrence => p_recurrence,
    p_recurrence_config => p_recurrence_config,
    p_recurrence_ends_at => p_recurrence_ends_at,
    p_lead_id => p_lead_id,
    p_contract_id => p_contract_id,
    p_label => p_label,
    p_notes => p_notes,
    p_max_attempts => p_max_attempts,
    p_cancel_on_inbound_message => p_cancel_on_inbound_message,
    p_chat_id => NULL
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_scheduled_message_for_chat(
  uuid, text, timestamptz, text, text, text, text, text,
  text, jsonb, timestamptz, uuid, uuid, text, text, integer, boolean, uuid
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_scheduled_message_for_chat(
  uuid, text, timestamptz, text, text, text, text, text,
  text, jsonb, timestamptz, uuid, uuid, text, text, integer, boolean, uuid
) TO authenticated;

REVOKE ALL ON FUNCTION public.create_scheduled_message(
  uuid, text, timestamptz, text, text, text, text, text,
  text, jsonb, timestamptz, uuid, uuid, text, text, integer, boolean
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_scheduled_message(
  uuid, text, timestamptz, text, text, text, text, text,
  text, jsonb, timestamptz, uuid, uuid, text, text, integer, boolean
) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
