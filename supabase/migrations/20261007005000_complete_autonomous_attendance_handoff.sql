/*
  # Complete autonomous-attendance handoff atomically

  The final qualification message hands the conversation to a human. In one
  transaction, stop autonomous attendance, cancel queued replies, and move the
  lead to its handoff status. This removes the window in which a new inbound
  message could remain queued after the attendant has promised a quotation.
*/

CREATE OR REPLACE FUNCTION public.complete_ai_autonomous_attendance_handoff(
  p_chat_id uuid,
  p_lead_id uuid,
  p_handoff_code text
)
RETURNS TABLE (
  chat_id uuid,
  lead_status_id uuid,
  status_applied boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_chat_id uuid;
  v_chat_lead_id uuid;
  v_target_status_name text;
  v_target_status_id uuid;
BEGIN
  IF p_handoff_code NOT IN ('QUALIFICACAO_COMPLETA', 'RECUSOU_COTACAO', 'FORA_DE_ESCOPO', 'PRECISA_HUMANO') THEN
    RAISE EXCEPTION 'Codigo de handoff invalido.' USING ERRCODE = '22023';
  END IF;

  v_chat_id := public.comm_whatsapp_lock_canonical_chat_uuid(p_chat_id);
  IF v_chat_id IS NULL THEN
    RAISE EXCEPTION 'Conversa do WhatsApp nao encontrada.' USING ERRCODE = 'P0002';
  END IF;

  SELECT lead_id
    INTO v_chat_lead_id
    FROM public.comm_whatsapp_chats
   WHERE id = v_chat_id
   FOR UPDATE;

  IF v_chat_lead_id IS DISTINCT FROM p_lead_id THEN
    RAISE EXCEPTION 'Lead do chat nao corresponde ao handoff.' USING ERRCODE = 'P0002';
  END IF;

  v_target_status_name := CASE p_handoff_code
    WHEN 'QUALIFICACAO_COMPLETA' THEN 'Aguardando cotação'
    WHEN 'RECUSOU_COTACAO' THEN 'Perdido'
    ELSE NULL
  END;

  IF v_target_status_name IS NOT NULL THEN
    SELECT id
      INTO v_target_status_id
      FROM public.lead_status_config
     WHERE lower(trim(nome)) = lower(v_target_status_name)
        OR (v_target_status_name = 'Aguardando cotação' AND lower(trim(nome)) = 'aguardando cotacao')
     ORDER BY ordem ASC NULLS LAST, created_at ASC
     LIMIT 1;
  END IF;

  UPDATE public.comm_whatsapp_chats
     SET autonomous_attendance_status = 'handed_off',
         updated_at = now()
   WHERE id = v_chat_id;

  UPDATE public.ai_autonomous_reply_jobs
     SET status = 'cancelled',
         last_error = 'Atendimento autonomo encerrado: handoff para atendimento manual',
         updated_at = now()
   WHERE chat_id = v_chat_id
     AND status = 'pending';

  IF v_target_status_id IS NOT NULL THEN
    UPDATE public.leads
       SET status_id = v_target_status_id
     WHERE id = p_lead_id;
  END IF;

  RETURN QUERY SELECT v_chat_id, v_target_status_id, v_target_status_id IS NOT NULL OR v_target_status_name IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_ai_autonomous_attendance_handoff(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_ai_autonomous_attendance_handoff(uuid, uuid, text) TO service_role;

NOTIFY pgrst, 'reload schema';
