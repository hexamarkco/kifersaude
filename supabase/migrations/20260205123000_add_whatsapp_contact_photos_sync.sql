/*
  # WhatsApp contact photos sync

  - Store contact profile photos in storage
  - Track source URLs and public URLs
  - Schedule daily sync via pg_cron
*/

CREATE TABLE IF NOT EXISTS public.whatsapp_contact_photos (
  contact_id text PRIMARY KEY,
  source_url text,
  storage_path text,
  public_url text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_contact_photos_updated_at
  ON public.whatsapp_contact_photos(updated_at DESC);

ALTER TABLE public.whatsapp_contact_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view whatsapp contact photos" ON public.whatsapp_contact_photos;
CREATE POLICY "Authenticated users can view whatsapp contact photos"
  ON public.whatsapp_contact_photos FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Service role can manage whatsapp contact photos" ON public.whatsapp_contact_photos;
CREATE POLICY "Service role can manage whatsapp contact photos"
  ON public.whatsapp_contact_photos FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'whatsapp-contact-photos') THEN
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('whatsapp-contact-photos', 'whatsapp-contact-photos', true);
  END IF;
END $$;

DO $$
DECLARE
  function_url text;
  service_role_key text;
BEGIN
  SELECT
    (config_value->>'supabase_url')::text,
    (config_value->>'supabase_service_role_key')::text
  INTO function_url, service_role_key
  FROM (
    SELECT jsonb_object_agg(config_key, config_value) as config_value
    FROM system_configurations
    WHERE config_key IN ('supabase_url', 'supabase_service_role_key')
  ) configs;

  IF function_url IS NOT NULL THEN
    function_url := function_url || '/functions/v1/whatsapp-sync-contact-photos';
  END IF;

  IF function_url IS NULL OR service_role_key IS NULL THEN
    RAISE NOTICE 'WhatsApp contact photos cron not configured (missing system_configurations).';
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-whatsapp-contact-photos-daily') THEN
    PERFORM cron.unschedule('sync-whatsapp-contact-photos-daily');
  END IF;

  PERFORM cron.schedule(
    'sync-whatsapp-contact-photos-daily',
    '0 0 * * *',
    format(
      'SELECT net.http_post(url := %L, headers := jsonb_build_object(''Content-Type'', ''application/json'', ''Authorization'', ''Bearer %s''), body := jsonb_build_object(''source'', ''cron''));',
      function_url,
      service_role_key
    )
  );
END $$;
