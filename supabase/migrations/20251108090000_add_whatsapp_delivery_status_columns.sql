ALTER TABLE whatsapp_conversations
  ADD COLUMN IF NOT EXISTS delivery_status text CHECK (
    delivery_status IN (
      'pending',
      'sent',
      'received',
      'read',
      'read_by_me',
      'played',
      'failed'
    )
  ),
  ADD COLUMN IF NOT EXISTS delivery_status_updated_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_delivery_status
  ON whatsapp_conversations(delivery_status);

CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_status_updated_at
  ON whatsapp_conversations(delivery_status_updated_at DESC);
