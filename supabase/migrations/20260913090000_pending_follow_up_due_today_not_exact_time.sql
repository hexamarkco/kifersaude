/*
  # Follow-ups em lote: considerar devido o dia inteiro, nao so o horario exato

  comm_whatsapp_pending_follow_up_chats exigia reminder.data_lembrete <= now(),
  entao um follow-up agendado pra mais tarde no mesmo dia (ex.: 18h, com o
  usuario abrindo o lote as 15h) ficava de fora do lote mesmo aparecendo como
  pendencia do dia na Agenda do WhatsApp — que agrupa por data, ignorando o
  horario. Alinha os dois: um follow-up conta como devido a partir do inicio
  do dia atual (fuso America/Sao_Paulo, mesmo fuso usado no agrupamento por
  dia no cliente), nao so apos o minuto exato do lembrete.
*/

BEGIN;

DROP FUNCTION IF EXISTS public.comm_whatsapp_pending_follow_up_chats();

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
  last_message_text text,
  lead_favorito boolean
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    chat.id,
    chat.external_chat_id,
    lead.id,
    lead.nome_completo,
    lead.telefone,
    reminder.id,
    reminder.titulo,
    reminder.data_lembrete,
    reminder.prioridade,
    chat.last_message_at,
    chat.last_message_text,
    lead.favorito
  FROM public.reminders AS reminder
  JOIN public.leads AS lead
    ON lead.id = reminder.lead_id
   AND COALESCE(lead.arquivado, false) = false
  JOIN LATERAL (
    SELECT candidate.*
    FROM public.comm_whatsapp_chats AS candidate
    WHERE candidate.lead_id = lead.id
      AND candidate.deleted_at IS NULL
      AND candidate.merged_into_chat_id IS NULL
    ORDER BY
      CASE
        WHEN candidate.external_chat_id = public.normalize_comm_whatsapp_chat_id(
          COALESCE(lead.telefone, candidate.external_chat_id)
        ) THEN 0
        ELSE 1
      END,
      CASE
        WHEN candidate.external_chat_id = public.normalize_comm_whatsapp_chat_id(candidate.external_chat_id) THEN 0
        ELSE 1
      END,
      CASE WHEN NULLIF(btrim(COALESCE(candidate.external_chat_id, '')), '') IS NULL THEN 1 ELSE 0 END,
      candidate.last_message_at DESC NULLS LAST,
      candidate.updated_at DESC NULLS LAST,
      candidate.id ASC
    LIMIT 1
  ) AS chat ON true
  WHERE COALESCE(reminder.lido, false) = false
    AND reminder.tipo = 'Follow-up'
    AND (reminder.data_lembrete AT TIME ZONE 'America/Sao_Paulo')::date
        <= (now() AT TIME ZONE 'America/Sao_Paulo')::date
  ORDER BY reminder.prioridade DESC, reminder.data_lembrete ASC, lead.nome_completo ASC;
$$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_pending_follow_up_chats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_pending_follow_up_chats() TO authenticated;

COMMIT;
