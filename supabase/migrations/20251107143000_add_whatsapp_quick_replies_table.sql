/*
  # Add WhatsApp Quick Replies Table

  ## Summary
  Creates the `whatsapp_quick_replies` table to store reusable predefined
  responses that can be managed from the application UI.
*/

CREATE TABLE IF NOT EXISTS whatsapp_quick_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  category text,
  is_favorite boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_quick_replies_title
  ON whatsapp_quick_replies (title);

ALTER TABLE whatsapp_quick_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view whatsapp quick replies"
  ON whatsapp_quick_replies FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert whatsapp quick replies"
  ON whatsapp_quick_replies FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update whatsapp quick replies"
  ON whatsapp_quick_replies FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete whatsapp quick replies"
  ON whatsapp_quick_replies FOR DELETE
  TO authenticated
  USING (true);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'update_updated_at_column'
      AND pg_function_is_visible(oid)
  ) THEN
    CREATE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'update_whatsapp_quick_replies_updated_at'
  ) THEN
    CREATE TRIGGER update_whatsapp_quick_replies_updated_at
      BEFORE UPDATE ON whatsapp_quick_replies
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;
