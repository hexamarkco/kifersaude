CREATE TABLE IF NOT EXISTS whatsapp_chat_preferences (
  phone_number text PRIMARY KEY,
  archived boolean NOT NULL DEFAULT false,
  pinned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE whatsapp_chat_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Users can view whatsapp chat preferences"
  ON whatsapp_chat_preferences FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY IF NOT EXISTS "Users can insert whatsapp chat preferences"
  ON whatsapp_chat_preferences FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "Users can update whatsapp chat preferences"
  ON whatsapp_chat_preferences FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'update_whatsapp_chat_preferences_updated_at'
  ) THEN
    CREATE TRIGGER update_whatsapp_chat_preferences_updated_at
      BEFORE UPDATE ON whatsapp_chat_preferences
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;
