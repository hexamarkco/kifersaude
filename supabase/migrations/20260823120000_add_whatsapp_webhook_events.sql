/*
  # WhatsApp webhook events

  ## Description
  Stores raw payloads received from the WhatsApp bridge webhook so we can
  debug and power future inbox features from real data.
*/

CREATE TABLE IF NOT EXISTS whatsapp_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event text DEFAULT 'unknown',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  headers jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_webhook_events_created_at
  ON whatsapp_webhook_events(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_whatsapp_webhook_events_event
  ON whatsapp_webhook_events(event);

ALTER TABLE whatsapp_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Admins can read WhatsApp webhook events"
  ON whatsapp_webhook_events
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );
