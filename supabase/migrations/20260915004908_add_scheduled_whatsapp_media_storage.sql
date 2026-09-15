BEGIN;

INSERT INTO storage.buckets (id, name, public)
VALUES ('comm-whatsapp-scheduled-media', 'comm-whatsapp-scheduled-media', false)
ON CONFLICT (id) DO UPDATE
SET public = false;

DROP POLICY IF EXISTS "Users can upload scheduled WhatsApp media" ON storage.objects;
CREATE POLICY "Users can upload scheduled WhatsApp media"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'comm-whatsapp-scheduled-media'
    AND public.current_user_can_edit_comm_whatsapp()
    AND (storage.foldername(name))[1] = 'ui'
    AND (storage.foldername(name))[2] = (select auth.uid()::text)
  );

DROP POLICY IF EXISTS "Users can view scheduled WhatsApp media" ON storage.objects;
CREATE POLICY "Users can view scheduled WhatsApp media"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'comm-whatsapp-scheduled-media'
    AND public.current_user_can_view_comm_whatsapp()
    AND (storage.foldername(name))[1] = 'ui'
    AND (storage.foldername(name))[2] = (select auth.uid()::text)
  );

DROP POLICY IF EXISTS "Users can delete scheduled WhatsApp media" ON storage.objects;
CREATE POLICY "Users can delete scheduled WhatsApp media"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'comm-whatsapp-scheduled-media'
    AND public.current_user_can_edit_comm_whatsapp()
    AND (storage.foldername(name))[1] = 'ui'
    AND (storage.foldername(name))[2] = (select auth.uid()::text)
  );

COMMIT;
