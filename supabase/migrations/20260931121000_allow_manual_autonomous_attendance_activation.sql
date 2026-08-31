BEGIN;

-- Permite ativacao manual do atendimento autonomo para testes e excecoes
-- operacionais conscientes. A ativacao automatica pelo fluxo segue protegida
-- na Edge Function, restrita a chats sem historico visivel anterior ao lead.
CREATE OR REPLACE FUNCTION public.comm_whatsapp_set_autonomous_attendance_status(
  p_chat_id uuid,
  p_status text
)
RETURNS SETOF public.comm_whatsapp_chats
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_chat_id uuid;
  v_chat public.comm_whatsapp_chats%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.current_user_can_edit_comm_whatsapp() THEN
    RAISE EXCEPTION 'Permissao insuficiente para atualizar conversa.';
  END IF;

  IF p_status NOT IN ('inactive', 'active', 'handed_off') THEN
    RAISE EXCEPTION 'Status invalido para atualizacao manual do atendimento autonomo.';
  END IF;

  v_chat_id := public.comm_whatsapp_lock_canonical_chat_uuid(p_chat_id);
  IF v_chat_id IS NULL THEN
    RAISE EXCEPTION 'Conversa do WhatsApp nao encontrada.' USING ERRCODE = 'P0002';
  END IF;

  IF p_status = 'active' THEN
    UPDATE public.comm_whatsapp_chats
    SET autonomous_attendance_status = 'active',
        updated_at = now()
    WHERE public.comm_whatsapp_chats.id = v_chat_id
      AND public.comm_whatsapp_chats.deleted_at IS NULL
      AND public.comm_whatsapp_chats.merged_into_chat_id IS NULL
      AND public.comm_whatsapp_chats.lead_id IS NOT NULL
    RETURNING * INTO v_chat;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Conversa do WhatsApp nao encontrada ou sem lead vinculado.' USING ERRCODE = 'P0002';
    END IF;

    INSERT INTO public.ai_autonomous_reply_jobs (chat_id, lead_id, scheduled_at)
    VALUES (v_chat_id, v_chat.lead_id, now() + interval '30 seconds')
    ON CONFLICT (chat_id) WHERE status = 'pending'
    DO UPDATE SET
      lead_id = EXCLUDED.lead_id,
      scheduled_at = EXCLUDED.scheduled_at,
      last_error = NULL,
      updated_at = now();
  ELSE
    -- Cancela qualquer resposta da IA ja agendada pra esse chat: o humano
    -- assumiu ou encerrou a IA e ela nao deve responder jobs antigos.
    UPDATE public.ai_autonomous_reply_jobs
    SET status = 'cancelled', last_error = 'Atendimento assumido manualmente pelo humano'
    WHERE chat_id = v_chat_id AND status = 'pending';

    UPDATE public.comm_whatsapp_chats
    SET autonomous_attendance_status = p_status,
        updated_at = now()
    WHERE public.comm_whatsapp_chats.id = v_chat_id
      AND public.comm_whatsapp_chats.deleted_at IS NULL
      AND public.comm_whatsapp_chats.merged_into_chat_id IS NULL
    RETURNING * INTO v_chat;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Conversa do WhatsApp nao encontrada.' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  RETURN NEXT v_chat;
END;
$$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_set_autonomous_attendance_status(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_set_autonomous_attendance_status(uuid, text) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
