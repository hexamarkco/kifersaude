/*
  # Add WhatsApp message reads

  Tracks message read state per user (internal only).
*/

CREATE TABLE IF NOT EXISTS whatsapp_message_reads (
  message_id text NOT NULL REFERENCES whatsapp_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_message_reads_user_id
  ON whatsapp_message_reads(user_id);

ALTER TABLE whatsapp_message_reads ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'whatsapp_message_reads'
    AND policyname = 'Users can read own message reads'
  ) THEN
    CREATE POLICY "Users can read own message reads"
      ON whatsapp_message_reads
      FOR SELECT
      TO authenticated
      USING (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'whatsapp_message_reads'
    AND policyname = 'Users can insert own message reads'
  ) THEN
    CREATE POLICY "Users can insert own message reads"
      ON whatsapp_message_reads
      FOR INSERT
      TO authenticated
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

CREATE OR REPLACE FUNCTION get_whatsapp_unread_counts(current_user uuid)
RETURNS TABLE(chat_id text, unread_count bigint)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT m.chat_id, COUNT(*)
  FROM whatsapp_messages m
  WHERE m.direction = 'inbound'
    AND NOT EXISTS (
      SELECT 1
      FROM whatsapp_message_reads r
      WHERE r.message_id = m.id
        AND r.user_id = current_user
    )
  GROUP BY m.chat_id;
$$;
