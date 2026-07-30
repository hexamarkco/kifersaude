BEGIN;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('whapi-webhook-archive', 'whapi-webhook-archive', false, 52428800, NULL)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.comm_whatsapp_event_receipts
  ADD COLUMN IF NOT EXISTS payload_archive_path text;

CREATE OR REPLACE FUNCTION public.cleanup_comm_whatsapp_webhook_archive(
  p_retention interval DEFAULT interval '30 days'
)
RETURNS TABLE(archive_path text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.comm_whatsapp_event_receipts
  SET payload_archive_path = NULL
  WHERE payload_archive_path IS NOT NULL
    AND received_at < now() - p_retention
  RETURNING payload_archive_path;
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_comm_whatsapp_webhook_archive(interval) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_comm_whatsapp_webhook_archive(interval) TO service_role;

COMMIT;
