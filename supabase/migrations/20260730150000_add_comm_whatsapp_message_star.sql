-- Suporte a "estrelar" mensagens no WhatsApp inbox.
-- Estende comm_whatsapp_apply_message_mutation com o tipo 'star',
-- persistindo o estado da estrela em metadata (starred / starred_at),
-- seguindo o mesmo padrao de reactions/edit/delete.

CREATE OR REPLACE FUNCTION public.comm_whatsapp_apply_message_mutation(
  p_channel_id uuid,
  p_target_external_message_id text,
  p_mutation_type text,
  p_event_external_message_id text DEFAULT NULL,
  p_occurred_at timestamptz DEFAULT NULL,
  p_payload jsonb DEFAULT '{}'::jsonb,
  p_dedupe_key text DEFAULT NULL
)
RETURNS TABLE (
  chat_id uuid,
  applied boolean,
  queued boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target_external_message_id text := NULLIF(btrim(COALESCE(p_target_external_message_id, '')), '');
  v_mutation_type text := lower(NULLIF(btrim(COALESCE(p_mutation_type, '')), ''));
  v_event_external_message_id text := NULLIF(btrim(COALESCE(p_event_external_message_id, '')), '');
  v_occurred_at timestamptz := COALESCE(p_occurred_at, clock_timestamp());
  v_payload jsonb := COALESCE(p_payload, '{}'::jsonb);
  v_dedupe_key text := NULLIF(btrim(COALESCE(p_dedupe_key, '')), '');
  v_message public.comm_whatsapp_messages%ROWTYPE;
  v_metadata jsonb;
  v_original_text text;
  v_history jsonb;
  v_existing_at timestamptz;
  v_actor_key text;
  v_emoji text;
  v_reactions jsonb;
  v_without_actor jsonb;
  v_actor_reaction jsonb;
  v_existing_reaction_at timestamptz;
  v_starred boolean;
  v_existing_starred_at timestamptz;
BEGIN
  IF p_channel_id IS NULL OR v_target_external_message_id IS NULL THEN
    RAISE EXCEPTION 'Canal e mensagem alvo sao obrigatorios para aplicar mutacao.';
  END IF;

  IF v_mutation_type NOT IN ('edit', 'delete', 'reaction', 'star') THEN
    RAISE EXCEPTION 'Tipo de mutacao invalido.';
  END IF;

  IF jsonb_typeof(v_payload) <> 'object' THEN
    RAISE EXCEPTION 'O payload da mutacao deve ser um objeto JSON.';
  END IF;

  -- Keep a target insert and an out-of-order mutation in the same critical section.
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'comm-whatsapp-message-mutation:' || p_channel_id::text || ':' || v_target_external_message_id,
    0
  ));

  IF v_dedupe_key IS NULL THEN
    v_dedupe_key := COALESCE(
      v_event_external_message_id,
      v_mutation_type || ':' || v_target_external_message_id || ':' || v_occurred_at::text
    );
  END IF;

  SELECT *
  INTO v_message
  FROM public.comm_whatsapp_messages AS message
  WHERE message.channel_id = p_channel_id
    AND message.external_message_id = v_target_external_message_id
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.comm_whatsapp_pending_message_mutations (
      channel_id,
      target_external_message_id,
      event_external_message_id,
      mutation_type,
      dedupe_key,
      occurred_at,
      payload
    )
    VALUES (
      p_channel_id,
      v_target_external_message_id,
      v_event_external_message_id,
      v_mutation_type,
      v_dedupe_key,
      v_occurred_at,
      v_payload
    )
    ON CONFLICT (channel_id, dedupe_key) DO UPDATE
    SET occurred_at = GREATEST(
          public.comm_whatsapp_pending_message_mutations.occurred_at,
          EXCLUDED.occurred_at
        ),
        payload = EXCLUDED.payload,
        event_external_message_id = COALESCE(
          EXCLUDED.event_external_message_id,
          public.comm_whatsapp_pending_message_mutations.event_external_message_id
        ),
        updated_at = now();

    RETURN QUERY SELECT NULL::uuid, false, true;
    RETURN;
  END IF;

  v_metadata := COALESCE(v_message.metadata, '{}'::jsonb);

  IF v_mutation_type = 'edit' THEN
    BEGIN
      v_existing_at := NULLIF(v_metadata ->> 'edited_at', '')::timestamptz;
    EXCEPTION WHEN OTHERS THEN
      v_existing_at := NULL;
    END;

    IF COALESCE(v_metadata ->> 'deleted', 'false') <> 'true'
      AND (v_existing_at IS NULL OR v_existing_at <= v_occurred_at)
    THEN
      v_original_text := NULLIF(btrim(COALESCE(
        v_metadata ->> 'original_text_content',
        v_payload ->> 'original_text',
        v_message.text_content,
        v_message.media_caption,
        ''
      )), '');
      v_history := CASE
        WHEN jsonb_typeof(v_metadata -> 'edit_history') = 'array' THEN v_metadata -> 'edit_history'
        ELSE '[]'::jsonb
      END || jsonb_build_array(jsonb_build_object(
        'at', v_occurred_at,
        'previous_text', COALESCE(v_message.text_content, v_message.media_caption),
        'next_text', v_payload ->> 'edited_text',
        'action_type', v_payload ->> 'action_type'
      ));

      IF jsonb_array_length(v_history) > 10 THEN
        SELECT COALESCE(jsonb_agg(history.value ORDER BY history.ordinality), '[]'::jsonb)
        INTO v_history
        FROM (
          SELECT value, ordinality
          FROM jsonb_array_elements(v_history) WITH ORDINALITY
          ORDER BY ordinality DESC
          LIMIT 10
        ) AS history;
      END IF;

      UPDATE public.comm_whatsapp_messages AS message
      SET text_content = v_payload ->> 'edited_text',
          media_caption = CASE
            WHEN lower(COALESCE(message.message_type, '')) IN ('image', 'video', 'gif', 'short', 'document', 'audio', 'voice', 'sticker')
              THEN v_payload ->> 'edited_text'
            ELSE message.media_caption
          END,
          status_updated_at = GREATEST(COALESCE(message.status_updated_at, '-infinity'::timestamptz), v_occurred_at),
          metadata = v_metadata || jsonb_build_object(
            'edited', true,
            'edited_at', v_occurred_at,
            'original_text_content', v_original_text,
            'edit_action_type', v_payload ->> 'action_type',
            'edit_history', v_history
          )
      WHERE message.id = v_message.id;

      UPDATE public.comm_whatsapp_chats AS chat
      SET last_message_text = v_payload ->> 'edited_text',
          updated_at = now()
      WHERE chat.id = v_message.chat_id
        AND chat.last_message_at = v_message.message_at;
    END IF;
  ELSIF v_mutation_type = 'delete' THEN
    BEGIN
      v_existing_at := NULLIF(v_metadata ->> 'deleted_at', '')::timestamptz;
    EXCEPTION WHEN OTHERS THEN
      v_existing_at := NULL;
    END;

    IF v_existing_at IS NULL OR v_existing_at <= v_occurred_at THEN
      v_original_text := NULLIF(btrim(COALESCE(
        v_metadata ->> 'deleted_original_text_content',
        v_payload ->> 'original_text',
        v_message.text_content,
        v_message.media_caption,
        ''
      )), '');

      UPDATE public.comm_whatsapp_messages AS message
      SET delivery_status = 'deleted',
          status_updated_at = GREATEST(COALESCE(message.status_updated_at, '-infinity'::timestamptz), v_occurred_at),
          error_message = NULL,
          metadata = v_metadata || jsonb_build_object(
            'deleted', true,
            'deleted_at', v_occurred_at,
            'deleted_action_type', v_payload ->> 'action_type',
            'deleted_by', v_payload ->> 'deleted_by',
            'deleted_original_text_content', v_original_text,
            'deleted_source_message_id', v_event_external_message_id
          )
      WHERE message.id = v_message.id;

      UPDATE public.comm_whatsapp_chats AS chat
      SET last_message_text = '[Mensagem apagada]',
          updated_at = now()
      WHERE chat.id = v_message.chat_id
        AND chat.last_message_at = v_message.message_at;
    END IF;
  ELSIF v_mutation_type = 'star' THEN
    v_starred := COALESCE((v_payload ->> 'starred')::boolean, true);
    BEGIN
      v_existing_starred_at := NULLIF(v_metadata ->> 'starred_at', '')::timestamptz;
    EXCEPTION WHEN OTHERS THEN
      v_existing_starred_at := NULL;
    END;

    IF COALESCE(v_metadata ->> 'deleted', 'false') <> 'true'
      AND (v_existing_starred_at IS NULL OR v_existing_starred_at <= v_occurred_at)
    THEN
      UPDATE public.comm_whatsapp_messages AS message
      SET metadata = v_metadata || jsonb_build_object(
            'starred', v_starred,
            'starred_at', v_occurred_at
          ),
          status_updated_at = GREATEST(COALESCE(message.status_updated_at, '-infinity'::timestamptz), v_occurred_at)
      WHERE message.id = v_message.id;
    END IF;
  ELSE
    v_actor_key := NULLIF(btrim(COALESCE(v_payload ->> 'actor_key', '')), '');
    v_emoji := NULLIF(btrim(COALESCE(v_payload ->> 'emoji', '')), '');
    IF v_actor_key IS NULL THEN
      RAISE EXCEPTION 'Reacao sem autor.';
    END IF;

    v_reactions := CASE
      WHEN jsonb_typeof(v_metadata -> 'reactions') = 'array' THEN v_metadata -> 'reactions'
      ELSE '[]'::jsonb
    END;
    SELECT reaction.value
    INTO v_actor_reaction
    FROM jsonb_array_elements(v_reactions) AS reaction(value)
    WHERE reaction.value ->> 'actor_key' = v_actor_key
    LIMIT 1;

    BEGIN
      v_existing_reaction_at := NULLIF(v_actor_reaction ->> 'reacted_at', '')::timestamptz;
    EXCEPTION WHEN OTHERS THEN
      v_existing_reaction_at := NULL;
    END;

    IF COALESCE(v_metadata ->> 'deleted', 'false') <> 'true'
      AND (v_existing_reaction_at IS NULL OR v_existing_reaction_at <= v_occurred_at)
    THEN
      SELECT COALESCE(jsonb_agg(reaction.value), '[]'::jsonb)
      INTO v_without_actor
      FROM jsonb_array_elements(v_reactions) AS reaction(value)
      WHERE COALESCE(reaction.value ->> 'actor_key', '') <> v_actor_key;

      IF v_emoji IS NOT NULL THEN
        v_reactions := v_without_actor || jsonb_build_array(jsonb_build_object(
          'actor_key', v_actor_key,
          'emoji', v_emoji,
          'from_me', COALESCE((v_payload ->> 'from_me')::boolean, false),
          'from', NULLIF(v_payload ->> 'from', ''),
          'from_name', NULLIF(v_payload ->> 'from_name', ''),
          'reacted_at', v_occurred_at,
          'target_external_message_id', v_target_external_message_id
        ));
      ELSE
        v_reactions := v_without_actor;
      END IF;

      UPDATE public.comm_whatsapp_messages AS message
      SET metadata = v_metadata || jsonb_build_object(
            'reactions', v_reactions,
            'last_reaction_at', v_occurred_at
          ),
          status_updated_at = GREATEST(COALESCE(message.status_updated_at, '-infinity'::timestamptz), v_occurred_at)
      WHERE message.id = v_message.id;
    END IF;
  END IF;

  IF v_event_external_message_id IS NOT NULL
    AND v_event_external_message_id <> v_target_external_message_id
  THEN
    DELETE FROM public.comm_whatsapp_messages AS event_message
    WHERE event_message.channel_id = p_channel_id
      AND event_message.external_message_id = v_event_external_message_id
      AND event_message.message_type = 'action';
  END IF;

  DELETE FROM public.comm_whatsapp_pending_message_mutations AS pending
  WHERE pending.channel_id = p_channel_id
    AND pending.dedupe_key = v_dedupe_key;

  RETURN QUERY SELECT v_message.chat_id, true, false;
END;
$$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_apply_message_mutation(uuid, text, text, text, timestamptz, jsonb, text) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_apply_message_mutation(uuid, text, text, text, timestamptz, jsonb, text) TO service_role;
