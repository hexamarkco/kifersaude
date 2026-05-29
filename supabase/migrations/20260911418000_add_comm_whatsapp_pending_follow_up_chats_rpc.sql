BEGIN;

CREATE OR REPLACE FUNCTION public.comm_whatsapp_pending_follow_up_chats()
RETURNS TABLE(
  chat_id uuid,
  external_chat_id text,
  lead_id uuid,
  lead_name text,
  lead_phone text,
  reminder_id uuid,
  reminder_title text,
  reminder_due_at timestamptz,
  reminder_priority text,
  last_message_at timestamptz,
  last_message_text text
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    cwc.id,
    cwc.external_chat_id,
    l.id,
    l.nome_completo,
    l.telefone,
    r.id,
    r.titulo,
    r.data_lembrete,
    r.prioridade,
    cwc.last_message_at,
    cwc.last_message_text
  FROM reminders r
  JOIN leads l ON l.id = r.lead_id AND l.deleted_at IS NULL
  JOIN comm_whatsapp_chats cwc ON cwc.lead_id = l.id AND cwc.deleted_at IS NULL
  WHERE r.lido = false
    AND r.tipo = 'Follow-up'
    AND r.data_lembrete <= CURRENT_DATE
    AND r.deleted_at IS NULL
  ORDER BY r.prioridade DESC, r.data_lembrete ASC, l.nome_completo ASC;
$$;

GRANT EXECUTE ON FUNCTION public.comm_whatsapp_pending_follow_up_chats() TO authenticated;

COMMIT;
