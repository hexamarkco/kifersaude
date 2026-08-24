/*
  # Create link page images storage bucket

  1. New Storage Bucket
    - `link-page-images` - Public bucket for the /links page avatar photo

  2. Storage Policies
    - Public read access for all images
    - Admins can upload/update/delete images

  Mirrors the existing `blog-images` bucket setup.
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('link-page-images', 'link-page-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public can view link page images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'link-page-images');

CREATE POLICY "Admins can upload link page images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'link-page-images' AND
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update link page images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'link-page-images' AND
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete link page images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'link-page-images' AND
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );
