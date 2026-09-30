BEGIN;

DROP INDEX IF EXISTS public.idx_comm_whatsapp_messages_delivery_status_recheck;

CREATE INDEX idx_comm_whatsapp_messages_delivery_status_recheck
  ON public.comm_whatsapp_messages (channel_id, delivery_status_checked_at ASC NULLS FIRST, message_at ASC)
  WHERE direction = 'outbound'
    AND external_message_id IS NOT NULL
    AND delivery_status IN ('pending', 'queued', 'sending', 'sent', 'delivered');

CREATE OR REPLACE FUNCTION public.comm_whatsapp_mark_delivery_status_observed()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.direction = 'outbound' THEN
    NEW.delivery_status_checked_at := now();
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_mark_delivery_status_observed() FROM PUBLIC;

COMMIT;
