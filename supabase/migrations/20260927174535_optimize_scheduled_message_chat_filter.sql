BEGIN;

-- O painel do Inbox filtra agendamentos por canal e contato. Os índices
-- existentes cobrem o worker e a listagem por canal, mas não esta consulta
-- específica; sem estes índices o Postgres pode varrer o histórico do canal.
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_channel_chat_scheduled_at_id
  ON public.comm_whatsapp_scheduled_messages (channel_id, chat_id, scheduled_at DESC, id ASC);

CREATE INDEX IF NOT EXISTS idx_scheduled_sequences_channel_chat_scheduled_at_id
  ON public.comm_whatsapp_scheduled_sequences (channel_id, chat_id, scheduled_at DESC, id ASC);

COMMIT;
