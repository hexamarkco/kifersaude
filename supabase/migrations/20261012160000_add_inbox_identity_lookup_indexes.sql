-- Support the Inbox identity lookups and the composite chat merge foreign key.
-- These indexes match the columns used by the repository/RPC queries and by
-- PostgreSQL when checking updates/deletes against the related chat rows.

BEGIN;

CREATE INDEX IF NOT EXISTS idx_comm_whatsapp_chat_identifiers_chat_channel
  ON public.comm_whatsapp_chat_identifiers (chat_id, channel_id);

CREATE INDEX IF NOT EXISTS idx_comm_whatsapp_chats_merged_into_channel
  ON public.comm_whatsapp_chats (merged_into_chat_id, channel_id);

COMMIT;
