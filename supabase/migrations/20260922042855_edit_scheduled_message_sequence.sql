BEGIN;

CREATE OR REPLACE FUNCTION public.update_scheduled_message_sequence(
  p_sequence_id uuid,
  p_scheduled_at timestamptz,
  p_steps jsonb,
  p_label text DEFAULT NULL,
  p_cancel_on_inbound_message boolean DEFAULT true
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sequence public.comm_whatsapp_scheduled_sequences%ROWTYPE;
  v_step jsonb;
  v_action jsonb;
  v_actions jsonb;
  v_step_id uuid;
  v_index integer := 0;
  v_action_index integer;
  v_step_delay integer;
  v_message jsonb;
  v_message_type text;
  v_text text;
  v_media_url text;
  v_media_mime text;
  v_media_file text;
  v_action_type text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.current_user_can_edit_comm_whatsapp() THEN
    RAISE EXCEPTION 'Usuário sem permissão para editar sequência de mensagens.';
  END IF;

  SELECT * INTO v_sequence
    FROM public.comm_whatsapp_scheduled_sequences
   WHERE id = p_sequence_id
   FOR UPDATE;

  IF NOT FOUND OR v_sequence.status <> 'scheduled' OR v_sequence.current_step_index <> 0 THEN
    RAISE EXCEPTION 'Somente sequências ainda não iniciadas podem ser editadas.';
  END IF;
  IF p_scheduled_at IS NULL OR p_scheduled_at <= clock_timestamp() THEN
    RAISE EXCEPTION 'A primeira etapa precisa estar no futuro.';
  END IF;
  IF jsonb_typeof(p_steps) IS DISTINCT FROM 'array' OR jsonb_array_length(p_steps) = 0 THEN
    RAISE EXCEPTION 'A sequência precisa ter ao menos uma etapa.';
  END IF;
  IF jsonb_array_length(p_steps) > 30 THEN
    RAISE EXCEPTION 'A sequência pode ter no máximo 30 etapas.';
  END IF;

  PERFORM s.id
    FROM public.comm_whatsapp_scheduled_sequence_steps s
   WHERE s.sequence_id = p_sequence_id
   FOR UPDATE;

  IF NOT EXISTS (
    SELECT 1
      FROM public.comm_whatsapp_scheduled_sequence_steps s
     WHERE s.sequence_id = p_sequence_id
  ) OR EXISTS (
    SELECT 1
      FROM public.comm_whatsapp_scheduled_sequence_steps s
     WHERE s.sequence_id = p_sequence_id
       AND (s.status <> 'pending' OR s.attempts <> 0 OR s.started_at IS NOT NULL)
  ) THEN
    RAISE EXCEPTION 'A sequência já começou e não pode mais ser editada.';
  END IF;

  PERFORM a.id
    FROM public.comm_whatsapp_scheduled_sequence_actions a
    JOIN public.comm_whatsapp_scheduled_sequence_steps s ON s.id = a.step_id
   WHERE s.sequence_id = p_sequence_id
   FOR UPDATE OF a;

  IF EXISTS (
    SELECT 1
      FROM public.comm_whatsapp_scheduled_sequence_actions a
      JOIN public.comm_whatsapp_scheduled_sequence_steps s ON s.id = a.step_id
     WHERE s.sequence_id = p_sequence_id
       AND (a.status <> 'pending' OR a.executed_at IS NOT NULL)
  ) THEN
    RAISE EXCEPTION 'A sequência já possui ações executadas e não pode mais ser editada.';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.comm_whatsapp_scheduled_messages m
     WHERE m.sequence_id = p_sequence_id
        OR m.sequence_step_id IN (
          SELECT s.id
            FROM public.comm_whatsapp_scheduled_sequence_steps s
           WHERE s.sequence_id = p_sequence_id
        )
  ) THEN
    RAISE EXCEPTION 'A sequência já possui mensagens processadas e não pode mais ser editada.';
  END IF;

  FOR v_step IN SELECT value FROM jsonb_array_elements(p_steps)
  LOOP
    v_actions := COALESCE(v_step->'actions', '[]'::jsonb);
    IF jsonb_typeof(v_actions) IS DISTINCT FROM 'array' THEN
      RAISE EXCEPTION 'As ações de cada etapa devem ser uma lista.';
    END IF;

    v_step_delay := GREATEST(COALESCE((v_step->>'delay_seconds')::integer, 0), 0);
    v_message := CASE WHEN jsonb_typeof(v_step->'message') = 'object' THEN v_step->'message' ELSE '{}'::jsonb END;
    v_message_type := NULLIF(btrim(v_message->>'message_type'), '');
    v_text := NULLIF(btrim(v_message->>'text_content'), '');
    v_media_url := NULLIF(btrim(v_message->>'media_url'), '');

    IF v_message_type IS NOT NULL AND v_text IS NULL AND v_media_url IS NULL THEN
      RAISE EXCEPTION 'A etapa % possui mensagem sem texto ou mídia.', v_index + 1;
    END IF;
    IF v_message_type IS NULL AND jsonb_array_length(v_actions) = 0 THEN
      RAISE EXCEPTION 'A etapa % precisa ter mensagem ou ação.', v_index + 1;
    END IF;

    v_index := v_index + 1;
  END LOOP;

  UPDATE public.comm_whatsapp_scheduled_sequences
     SET scheduled_at = p_scheduled_at,
         label = NULLIF(btrim(p_label), ''),
         cancel_on_inbound_message = COALESCE(p_cancel_on_inbound_message, true),
         last_error = NULL,
         updated_at = clock_timestamp()
   WHERE id = p_sequence_id;

  DELETE FROM public.comm_whatsapp_scheduled_sequence_steps
   WHERE sequence_id = p_sequence_id;

  v_index := 0;
  FOR v_step IN SELECT value FROM jsonb_array_elements(p_steps)
  LOOP
    v_step_delay := GREATEST(COALESCE((v_step->>'delay_seconds')::integer, 0), 0);
    v_message := CASE WHEN jsonb_typeof(v_step->'message') = 'object' THEN v_step->'message' ELSE '{}'::jsonb END;
    v_message_type := NULLIF(btrim(v_message->>'message_type'), '');
    v_text := NULLIF(btrim(v_message->>'text_content'), '');
    v_media_url := NULLIF(btrim(v_message->>'media_url'), '');
    v_media_mime := NULLIF(btrim(v_message->>'media_mime_type'), '');
    v_media_file := NULLIF(btrim(v_message->>'media_file_name'), '');

    INSERT INTO public.comm_whatsapp_scheduled_sequence_steps (
      sequence_id, step_index, delay_seconds, due_at, reminder_id,
      message_type, text_content, media_url, media_mime_type, media_file_name
    ) VALUES (
      p_sequence_id, v_index, v_step_delay,
      CASE WHEN v_index = 0 THEN p_scheduled_at ELSE NULL END,
      NULLIF(v_step->>'reminder_id', '')::uuid,
      v_message_type, v_text, v_media_url, v_media_mime, v_media_file
    ) RETURNING id INTO v_step_id;

    v_action_index := 0;
    FOR v_action IN SELECT value FROM jsonb_array_elements(COALESCE(v_step->'actions', '[]'::jsonb))
    LOOP
      v_action_type := NULLIF(btrim(v_action->>'type'), '');
      IF v_action_type IS NULL OR v_action_type NOT IN ('update_status', 'complete_reminder', 'create_reminder', 'cancel_sequence') THEN
        RAISE EXCEPTION 'Ação inválida na etapa %.', v_index + 1;
      END IF;
      IF v_action_type IN ('update_status', 'complete_reminder', 'create_reminder') AND v_sequence.lead_id IS NULL THEN
        RAISE EXCEPTION 'A etapa % possui uma ação de CRM sem lead vinculado.', v_index + 1;
      END IF;

      INSERT INTO public.comm_whatsapp_scheduled_sequence_actions (
        step_id, action_index, action_type, config
      ) VALUES (
        v_step_id, v_action_index, v_action_type, COALESCE(v_action - 'type', '{}'::jsonb)
      );
      v_action_index := v_action_index + 1;
    END LOOP;
    v_index := v_index + 1;
  END LOOP;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.update_scheduled_message_sequence(uuid, timestamptz, jsonb, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_scheduled_message_sequence(uuid, timestamptz, jsonb, text, boolean) TO authenticated;

COMMIT;
