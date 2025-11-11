ALTER TABLE whatsapp_conversations
  ADD COLUMN IF NOT EXISTS target_phone text;

CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_target_phone
  ON whatsapp_conversations(target_phone);

UPDATE whatsapp_conversations
SET target_phone = phone_number
WHERE message_type = 'received'
  AND target_phone IS NULL;
