BEGIN;

ALTER TABLE public.ai_sandbox_conversations
  ADD COLUMN attendance_state jsonb NOT NULL DEFAULT '{}'::jsonb;

-- One transaction publishes the entire reply and advances only this sandbox's memory.
-- No real chats, leads, jobs, attendance events or delivery tables are touched.
CREATE FUNCTION public.commit_ai_sandbox_turn(
  p_conversation_id uuid, p_source_message_id uuid, p_expected_state jsonb,
  p_state jsonb, p_messages jsonb
) RETURNS text LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  current_state jsonb;
  latest_message public.ai_sandbox_messages%ROWTYPE;
  item jsonb;
  item_index integer := 0;
  persisted_at timestamptz := clock_timestamp();
BEGIN
  SELECT attendance_state INTO current_state FROM public.ai_sandbox_conversations
    WHERE id = p_conversation_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Conversa de teste não encontrada'; END IF;
  IF EXISTS (SELECT 1 FROM public.ai_sandbox_messages WHERE conversation_id = p_conversation_id
    AND role = 'ai' AND handoff_code IS NOT NULL) THEN RETURN 'handed_off'; END IF;
  IF p_source_message_id IS NOT NULL AND current_state->>'source_message_id' = p_source_message_id::text
    THEN RETURN 'duplicate'; END IF;
  IF current_state IS DISTINCT FROM p_expected_state THEN RETURN 'stale'; END IF;
  SELECT * INTO latest_message FROM public.ai_sandbox_messages WHERE conversation_id = p_conversation_id
    ORDER BY created_at DESC, id DESC LIMIT 1;
  IF p_source_message_id IS NULL THEN
    IF FOUND THEN RETURN 'stale'; END IF;
  ELSIF latest_message.id IS DISTINCT FROM p_source_message_id OR latest_message.role <> 'lead' THEN
    RETURN 'stale';
  END IF;
  IF jsonb_typeof(p_messages) IS DISTINCT FROM 'array' OR jsonb_array_length(p_messages) NOT BETWEEN 1 AND 20
    OR jsonb_typeof(p_state) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Turno de teste inválido'; END IF;
  IF p_source_message_id IS NOT NULL AND p_state->>'source_message_id' IS DISTINCT FROM p_source_message_id::text
    THEN RAISE EXCEPTION 'Memória não corresponde à mensagem recebida'; END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(p_messages) LOOP
    IF jsonb_typeof(item->'content') IS DISTINCT FROM 'string' OR length(trim(item->>'content')) = 0
      THEN RAISE EXCEPTION 'Resposta de teste vazia'; END IF;
    IF item->>'handoff_code' = 'QUALIFICACAO_COMPLETA'
      AND (p_state->'v2Decision'->>'handoffCode' IS DISTINCT FROM 'QUALIFICACAO_COMPLETA'
        OR NOT public.ai_autonomous_qualification_can_complete(p_state))
      THEN RAISE EXCEPTION 'Qualificação de teste incompleta'; END IF;
    INSERT INTO public.ai_sandbox_messages(conversation_id, role, content, handoff_reason, handoff_code, provider, model, created_at)
      VALUES (p_conversation_id, 'ai', item->>'content', item->>'handoff_reason', item->>'handoff_code',
        item->>'provider', item->>'model', persisted_at + item_index * interval '1 millisecond');
    item_index := item_index + 1;
  END LOOP;
  UPDATE public.ai_sandbox_conversations SET attendance_state = p_state, updated_at = clock_timestamp()
    WHERE id = p_conversation_id;
  RETURN 'saved';
END;
$$;
REVOKE ALL ON FUNCTION public.commit_ai_sandbox_turn(uuid,uuid,jsonb,jsonb,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.commit_ai_sandbox_turn(uuid,uuid,jsonb,jsonb,jsonb) TO service_role;

COMMIT;
