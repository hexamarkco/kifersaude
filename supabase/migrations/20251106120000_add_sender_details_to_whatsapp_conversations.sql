-- Add metadata columns for WhatsApp conversations contact details
ALTER TABLE whatsapp_conversations
  ADD COLUMN IF NOT EXISTS sender_name text,
  ADD COLUMN IF NOT EXISTS sender_photo text,
  ADD COLUMN IF NOT EXISTS chat_name text;

CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_sender_name
  ON whatsapp_conversations((lower(sender_name)));
