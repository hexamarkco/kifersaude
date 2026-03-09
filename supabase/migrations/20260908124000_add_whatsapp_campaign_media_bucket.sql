/*
  # Add WhatsApp campaign media bucket

  Enables admin upload of media files used in campaign flow steps.
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('whatsapp-campaign-media', 'whatsapp-campaign-media', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public can view WhatsApp campaign media" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload WhatsApp campaign media" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update WhatsApp campaign media" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete WhatsApp campaign media" ON storage.objects;

CREATE POLICY "Public can view WhatsApp campaign media"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'whatsapp-campaign-media');

CREATE POLICY "Admins can upload WhatsApp campaign media"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'whatsapp-campaign-media'
    AND EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update WhatsApp campaign media"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'whatsapp-campaign-media'
    AND EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete WhatsApp campaign media"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'whatsapp-campaign-media'
    AND EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role = 'admin'
    )
  );
