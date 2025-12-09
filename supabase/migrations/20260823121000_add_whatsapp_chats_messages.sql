/*
  # WhatsApp chats e mensagens

  ## Description
  Estrutura para armazenar chats e mensagens recebidas do webhook do WhatsApp,
  mantendo histórico, metadados e payload bruto para debug e futuras features de inbox.
*/

CREATE TABLE IF NOT EXISTS whatsapp_chats (
  id text PRIMARY KEY,
  name text,
  is_group boolean DEFAULT false,
  last_message_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id text PRIMARY KEY,
  chat_id text NOT NULL REFERENCES whatsapp_chats(id) ON DELETE CASCADE,
  from_number text,
  to_number text,
  type text,
  body text,
  has_media boolean DEFAULT false,
  timestamp timestamptz,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_chat_id ON whatsapp_messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_timestamp ON whatsapp_messages(timestamp DESC);

ALTER TABLE whatsapp_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Admins can read WhatsApp chats" ON whatsapp_chats
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY IF NOT EXISTS "Admins can read WhatsApp messages" ON whatsapp_messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );
