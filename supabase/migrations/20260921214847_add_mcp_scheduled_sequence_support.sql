BEGIN;

ALTER TABLE public.comm_whatsapp_scheduled_sequences
  ADD COLUMN IF NOT EXISTS mcp_client_request_id text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_scheduled_sequences_mcp_request
  ON public.comm_whatsapp_scheduled_sequences (channel_id, mcp_client_request_id)
  WHERE mcp_client_request_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.create_scheduled_message_sequence_for_mcp(
  p_channel_id uuid,
  p_phone_digits text,
  p_scheduled_at timestamptz,
  p_steps jsonb,
  p_created_by uuid,
  p_mcp_client_request_id text,
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
  v_display text;
  v_step_delay integer;
  v_message jsonb;
  v_message_type text;
  v_text text;
  v_media_url text;
  v_media_mime text;
  v_media_file text;
  v_action_type text;
  v_actions jsonb;
BEGIN
  IF p_created_by IS NULL OR NULLIF(btrim(p_mcp_client_request_id), '') IS NULL THEN
    RAISE EXCEPTION 'A identidade e o client_request_id do MCP são obrigatórios.';
  END IF;
  IF p_scheduled_at <= clock_timestamp() + interval '1 minute' THEN
    RAISE EXCEPTION 'A primeira etapa precisa estar pelo menos um minuto no futuro.';
  END IF;
  IF p_scheduled_at > clock_timestamp() + interval '366 days' THEN
    RAISE EXCEPTION 'A sequência não pode ultrapassar 366 dias.';
  END IF;
  IF jsonb_typeof(p_steps) <> 'array' OR jsonb_array_length(p_steps) = 0 THEN
    RAISE EXCEPTION 'A sequência precisa ter ao menos uma etapa.';
  END IF;
  IF jsonb_array_length(p_steps) > 30 THEN
    RAISE EXCEPTION 'A sequência pode ter no máximo 30 etapas.';
  END IF;

  SELECT id
    INTO v_sequence_id
    FROM public.comm_whatsapp_scheduled_sequences
   WHERE channel_id = p_channel_id
     AND mcp_client_request_id = btrim(p_mcp_client_request_id)
   LIMIT 1;
  IF v_sequence_id IS NOT NULL THEN
    RETURN v_sequence_id;
  END IF;

  IF v_chat_id IS NULL THEN
    RAISE EXCEPTION 'A sequência MCP precisa estar vinculada a uma conversa.';
  END IF;

  SELECT phone_number, display_name
    INTO v_phone, v_display
    FROM public.comm_whatsapp_chats
   WHERE id = v_chat_id
     AND channel_id = p_channel_id
     AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conversa de WhatsApp não encontrada.';
  END IF;

  INSERT INTO public.comm_whatsapp_scheduled_sequences (
    channel_id, chat_id, phone_digits, phone_number, display_name,
    lead_id, contract_id, reminder_id, label, status, scheduled_at,
    cancel_on_inbound_message, created_by, mcp_client_request_id
  ) VALUES (
    p_channel_id, v_chat_id, p_phone_digits, COALESCE(v_phone, p_phone_digits),
    COALESCE(v_display, p_phone_digits), p_lead_id, p_contract_id, p_reminder_id,
    NULLIF(btrim(p_label), ''), 'scheduled', p_scheduled_at,
    COALESCE(p_cancel_on_inbound_message, true), p_created_by, btrim(p_mcp_client_request_id)
  ) RETURNING id INTO v_sequence_id;

  FOR v_step IN SELECT value FROM jsonb_array_elements(p_steps)
  LOOP
    IF jsonb_typeof(v_step) <> 'object' THEN
      RAISE EXCEPTION 'Cada etapa deve ser um objeto.';
    END IF;
    v_step_delay := COALESCE((v_step->>'delay_seconds')::integer, 0);
    IF v_step_delay < 0 OR v_step_delay > 31622400 THEN
      RAISE EXCEPTION 'O delay de cada etapa deve estar entre 0 e 366 dias.';
    END IF;
    IF v_index = 0 AND v_step_delay <> 0 THEN
      RAISE EXCEPTION 'A primeira etapa deve usar delay_seconds igual a zero.';
    END IF;

    v_message := CASE WHEN jsonb_typeof(v_step->'message') = 'object' THEN v_step->'message' ELSE '{}'::jsonb END;
    v_message_type := NULLIF(btrim(v_message->>'message_type'), '');
    v_text := NULLIF(btrim(v_message->>'text_content'), '');
    v_media_url := NULLIF(btrim(v_message->>'media_url'), '');
    v_media_mime := NULLIF(btrim(v_message->>'media_mime_type'), '');
    v_media_file := NULLIF(btrim(v_message->>'media_file_name'), '');
    v_actions := COALESCE(v_step->'actions', '[]'::jsonb);

    IF v_message_type IS NOT NULL AND v_message_type NOT IN ('text', 'image', 'video', 'document', 'audio', 'voice') THEN
      RAISE EXCEPTION 'Tipo de mensagem inválido na etapa %.', v_index + 1;
    END IF;
    IF v_message_type IS NOT NULL AND v_text IS NULL AND v_media_url IS NULL THEN
      RAISE EXCEPTION 'A etapa % possui mensagem sem texto ou mídia.', v_index + 1;
    END IF;
    IF jsonb_typeof(v_actions) <> 'array' THEN
      RAISE EXCEPTION 'actions deve ser uma lista na etapa %.', v_index + 1;
    END IF;
    IF v_message_type IS NULL AND jsonb_array_length(v_actions) = 0 THEN
      RAISE EXCEPTION 'A etapa % precisa ter mensagem ou ação.', v_index + 1;
    END IF;
    IF jsonb_array_length(v_actions) > 10 THEN
      RAISE EXCEPTION 'Cada etapa pode ter no máximo 10 ações.';
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
    FOR v_action IN SELECT value FROM jsonb_array_elements(v_actions)
    LOOP
      IF jsonb_typeof(v_action) <> 'object' THEN
        RAISE EXCEPTION 'Cada ação deve ser um objeto na etapa %.', v_index + 1;
      END IF;
      v_action_type := NULLIF(btrim(v_action->>'type'), '');
      IF v_action_type NOT IN ('update_status', 'complete_reminder', 'create_reminder', 'cancel_sequence') THEN
        RAISE EXCEPTION 'Ação inválida na etapa %.', v_index + 1;
      END IF;
      IF v_action_type IN ('update_status', 'complete_reminder', 'create_reminder') AND p_lead_id IS NULL THEN
        RAISE EXCEPTION 'A etapa % possui uma ação de CRM sem lead vinculado.', v_index + 1;
      END IF;
      INSERT INTO public.comm_whatsapp_scheduled_sequence_actions (
        step_id, action_index, action_type, config
      ) VALUES (v_step_id, v_action_index, v_action_type, v_action - 'type');
      v_action_index := v_action_index + 1;
    END LOOP;
    v_index := v_index + 1;
  END LOOP;

  RETURN v_sequence_id;
EXCEPTION
  WHEN unique_violation THEN
    SELECT id
      INTO v_sequence_id
      FROM public.comm_whatsapp_scheduled_sequences
     WHERE channel_id = p_channel_id
       AND mcp_client_request_id = btrim(p_mcp_client_request_id)
     LIMIT 1;
    IF v_sequence_id IS NOT NULL THEN RETURN v_sequence_id; END IF;
    RAISE;
END;
$$;

REVOKE ALL ON FUNCTION public.create_scheduled_message_sequence_for_mcp(
  uuid, text, timestamptz, jsonb, uuid, text, uuid, uuid, uuid, uuid, text, boolean
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_scheduled_message_sequence_for_mcp(
  uuid, text, timestamptz, jsonb, uuid, text, uuid, uuid, uuid, uuid, text, boolean
) TO service_role;

COMMIT;
