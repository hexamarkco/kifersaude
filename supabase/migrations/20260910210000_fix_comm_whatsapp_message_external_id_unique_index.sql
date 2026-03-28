BEGIN;

DROP INDEX IF EXISTS public.idx_comm_whatsapp_messages_external_message_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_comm_whatsapp_messages_external_message_id
  ON public.comm_whatsapp_messages (channel_id, external_message_id);

COMMIT;
