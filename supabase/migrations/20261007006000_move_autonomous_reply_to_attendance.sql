/*
  # Move a lead to Atendimento before the first autonomous reply

  An inbound message eligible for Autonomous Attendance means the lead is no
  longer only awaiting initial contact. Before the worker sends a reply, move
  `Contato Inicial` to `Atendimento`. Other statuses are deliberately kept:
  automation must never regress a lead that is already farther in the funnel.
*/

CREATE OR REPLACE FUNCTION public.prepare_ai_autonomous_attendance_reply(
  p_chat_id uuid,
  p_lead_id uuid
)
RETURNS TABLE (
  can_reply boolean,
  moved_to_attendance boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_chat_id uuid;
  v_chat_lead_id uuid;
  v_attendance_status text;
  v_current_status_id uuid;
  v_contact_initial_status_id uuid;
  v_attendance_status_id uuid;
BEGIN
  v_chat_id := public.comm_whatsapp_lock_canonical_chat_uuid(p_chat_id);
  IF v_chat_id IS NULL THEN
    RAISE EXCEPTION 'Conversa do WhatsApp nao encontrada.' USING ERRCODE = 'P0002';
  END IF;

  SELECT lead_id, autonomous_attendance_status
    INTO v_chat_lead_id, v_attendance_status
    FROM public.comm_whatsapp_chats
   WHERE id = v_chat_id
   FOR UPDATE;

  IF v_chat_lead_id IS DISTINCT FROM p_lead_id THEN
    RAISE EXCEPTION 'Lead do chat nao corresponde ao atendimento autonomo.' USING ERRCODE = 'P0002';
  END IF;

  IF v_attendance_status IS DISTINCT FROM 'active' THEN
    RETURN QUERY SELECT false, false;
    RETURN;
  END IF;

  SELECT status_id
    INTO v_current_status_id
    FROM public.leads
   WHERE id = p_lead_id
   FOR UPDATE;

  SELECT id
    INTO v_contact_initial_status_id
    FROM public.lead_status_config
   WHERE lower(trim(nome)) = 'contato inicial'
   ORDER BY ordem ASC NULLS LAST, created_at ASC
   LIMIT 1;

  IF v_contact_initial_status_id IS NULL
     OR v_current_status_id IS DISTINCT FROM v_contact_initial_status_id THEN
    RETURN QUERY SELECT true, false;
    RETURN;
  END IF;

  SELECT id
    INTO v_attendance_status_id
    FROM public.lead_status_config
   WHERE lower(trim(nome)) = 'atendimento'
   ORDER BY ordem ASC NULLS LAST, created_at ASC
   LIMIT 1;

  IF v_attendance_status_id IS NULL THEN
    RAISE EXCEPTION 'Status Atendimento nao encontrado.' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.leads
     SET status_id = v_attendance_status_id
   WHERE id = p_lead_id;

  RETURN QUERY SELECT true, true;
END;
$$;

REVOKE ALL ON FUNCTION public.prepare_ai_autonomous_attendance_reply(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.prepare_ai_autonomous_attendance_reply(uuid, uuid) TO service_role;

NOTIFY pgrst, 'reload schema';
