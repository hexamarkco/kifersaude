BEGIN;

-- O painel lista por canal e ordena pelo horário agendado. Os índices
-- existentes começam por status, mas a consulta geral do painel não filtra
-- status; sem este índice o Postgres precisa varrer e ordenar todo o histórico.
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_channel_scheduled_at_id
  ON public.comm_whatsapp_scheduled_messages (channel_id, scheduled_at DESC, id ASC);

CREATE INDEX IF NOT EXISTS idx_scheduled_sequences_channel_scheduled_at_id
  ON public.comm_whatsapp_scheduled_sequences (channel_id, scheduled_at DESC, id ASC);

COMMIT;
