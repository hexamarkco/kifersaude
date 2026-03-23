/*
  # Archive noisy WhatsApp webhook payloads

  Keeps the hot `whatsapp_webhook_events` table lean by allowing raw payloads
  to live in Storage while Postgres keeps a compact summary plus archive metadata.
*/

ALTER TABLE public.whatsapp_webhook_events
  ADD COLUMN IF NOT EXISTS payload_archive_path text,
  ADD COLUMN IF NOT EXISTS payload_archived boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS payload_size_bytes integer;

CREATE INDEX IF NOT EXISTS idx_whatsapp_webhook_events_event_created_at
  ON public.whatsapp_webhook_events (event, created_at DESC);

INSERT INTO storage.buckets (id, name, public)
VALUES ('whatsapp-webhook-archive', 'whatsapp-webhook-archive', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Admins can view WhatsApp webhook archive" ON storage.objects;

CREATE POLICY "Admins can view WhatsApp webhook archive"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'whatsapp-webhook-archive'
    AND EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role = 'admin'
    )
  );
