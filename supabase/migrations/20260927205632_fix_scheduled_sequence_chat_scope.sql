BEGIN;

-- Keep sequence creation tied to the selected conversation. The previous
-- implementation could resolve a phone number from another WhatsApp channel
-- when p_chat_id was omitted, and did not validate the channel when it was
-- provided by the UI.
CREATE OR REPLACE FUNCTION public.create_scheduled_message_sequence(
  p_channel_id uuid,
  p_phone_digits text,
  p_scheduled_at timestamptz,
  p_steps jsonb,
  p_chat_id uuid DEFAULT NULL,
  p_lead_id uuid DEFAULT NULL,
  p_contract_id uuid DEFAULT NULL,
  p_reminder_id uuid DEFAULT NULL,
  p_label text DEFAULT NULL,
  p_cancel_on_inbound_message boolean DEFAULT true
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sequence_id uuid;
  v_step jsonb;
  v_action jsonb;
  v_step_id uuid;
  v_index integer := 0;
  v_action_index integer;
  v_chat_id uuid := p_chat_id;
  v_phone text;
  v_phone_digits text;
  v_display text;
  v_step_delay integer;
  v_message jsonb;
  v_message_type text;
  v_text text;
  v_media_url text;
  v_media_mime text;
  v_media_file text;
  v_action_type text;
  v_lead_exists boolean;
BEGIN
  IF auth.uid() IS NULL OR NOT public.current_user_can_edit_comm_whatsapp() THEN
    RAISE EXCEPTION 'Usuário sem permissão para criar sequência de mensagens.';
  END IF;
  IF p_scheduled_at <= clock_timestamp() THEN
    RAISE EXCEPTION 'A primeira etapa precisa estar no futuro.';
  END IF;
  IF jsonb_typeof(p_steps) <> 'array' OR jsonb_array_length(p_steps) = 0 THEN
    RAISE EXCEPTION 'A sequência precisa ter ao menos uma etapa.';
  END IF;
  IF jsonb_array_length(p_steps) > 30 THEN
    RAISE EXCEPTION 'A sequência pode ter no máximo 30 etapas.';
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.leads WHERE id = p_lead_id)
    INTO v_lead_exists;
  IF p_lead_id IS NOT NULL AND NOT v_lead_exists THEN
    RAISE EXCEPTION 'Lead não encontrado.';
  END IF;

  IF v_chat_id IS NULL THEN
    SELECT id, phone_digits, phone_number, display_name
      INTO v_chat_id, v_phone_digits, v_phone, v_display
      FROM public.comm_whatsapp_chats
     WHERE channel_id = p_channel_id
       AND phone_digits = p_phone_digits
       AND deleted_at IS NULL
     ORDER BY updated_at DESC
     LIMIT 1;
  ELSE
    SELECT phone_digits, phone_number, display_name
      INTO v_phone_digits, v_phone, v_display
      FROM public.comm_whatsapp_chats
     WHERE id = v_chat_id
       AND channel_id = p_channel_id
       AND deleted_at IS NULL;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Conversa de WhatsApp não encontrada no canal selecionado.';
    END IF;
  END IF;

  INSERT INTO public.comm_whatsapp_scheduled_sequences (
    channel_id, chat_id, phone_digits, phone_number, display_name,
    lead_id, contract_id, reminder_id, label, status, scheduled_at,
    cancel_on_inbound_message, created_by
  ) VALUES (
    p_channel_id, v_chat_id, COALESCE(v_phone_digits, p_phone_digits),
    COALESCE(v_phone, p_phone_digits), COALESCE(v_display, p_phone_digits),
    p_lead_id, p_contract_id, p_reminder_id, NULLIF(btrim(p_label), ''),
    'scheduled', p_scheduled_at, COALESCE(p_cancel_on_inbound_message, true),
    auth.uid()
  ) RETURNING id INTO v_sequence_id;

  FOR v_step IN SELECT value FROM jsonb_array_elements(p_steps)
  LOOP
    v_step_delay := GREATEST(COALESCE((v_step->>'delay_seconds')::integer, 0), 0);
    v_message := CASE WHEN jsonb_typeof(v_step->'message') = 'object' THEN v_step->'message' ELSE '{}'::jsonb END;
    v_message_type := NULLIF(btrim(v_message->>'message_type'), '');
    v_text := NULLIF(btrim(v_message->>'text_content'), '');
    v_media_url := NULLIF(btrim(v_message->>'media_url'), '');
    v_media_mime := NULLIF(btrim(v_message->>'media_mime_type'), '');
    v_media_file := NULLIF(btrim(v_message->>'media_file_name'), '');

    IF v_message_type IS NOT NULL AND v_text IS NULL AND v_media_url IS NULL THEN
      RAISE EXCEPTION 'A etapa % possui mensagem sem texto ou mídia.', v_index + 1;
    END IF;
    IF v_message_type IS NULL AND jsonb_array_length(COALESCE(v_step->'actions', '[]'::jsonb)) = 0 THEN
      RAISE EXCEPTION 'A etapa % precisa ter mensagem ou ação.', v_index + 1;
    END IF;

    INSERT INTO public.comm_whatsapp_scheduled_sequence_steps (
      sequence_id, step_index, delay_seconds, due_at, reminder_id,
      message_type, text_content, media_url, media_mime_type, media_file_name
    ) VALUES (
      v_sequence_id, v_index, v_step_delay,
      CASE WHEN v_index = 0 THEN p_scheduled_at ELSE NULL END,
      NULLIF(v_step->>'reminder_id', '')::uuid,
      v_message_type, v_text, v_media_url, v_media_mime, v_media_file
    ) RETURNING id INTO v_step_id;

    v_action_index := 0;
    FOR v_action IN SELECT value FROM jsonb_array_elements(COALESCE(v_step->'actions', '[]'::jsonb))
    LOOP
      v_action_type := NULLIF(btrim(v_action->>'type'), '');
      IF v_action_type NOT IN ('update_status', 'complete_reminder', 'create_reminder', 'cancel_sequence') THEN
        RAISE EXCEPTION 'Ação inválida na etapa %.', v_index + 1;
      END IF;
      IF v_action_type IN ('update_status', 'complete_reminder', 'create_reminder') AND p_lead_id IS NULL THEN
        RAISE EXCEPTION 'A etapa % possui uma ação de CRM sem lead vinculado.', v_index + 1;
      END IF;
      INSERT INTO public.comm_whatsapp_scheduled_sequence_actions (
        step_id, action_index, action_type, config
      ) VALUES (v_step_id, v_action_index, v_action_type, COALESCE(v_action - 'type', '{}'::jsonb));
      v_action_index := v_action_index + 1;
    END LOOP;
    v_index := v_index + 1;
  END LOOP;

  RETURN v_sequence_id;
END;
$$;

COMMIT;
