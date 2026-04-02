BEGIN;

CREATE OR REPLACE FUNCTION public.comm_whatsapp_preserve_archived_when_muted()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.is_archived
     AND OLD.is_muted
     AND COALESCE(NEW.unread_count, 0) > COALESCE(OLD.unread_count, 0) THEN
    NEW.is_archived := true;
    NEW.archived_at := COALESCE(OLD.archived_at, NEW.archived_at, now());
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_comm_whatsapp_preserve_archived_when_muted ON public.comm_whatsapp_chats;
CREATE TRIGGER trg_comm_whatsapp_preserve_archived_when_muted
  BEFORE UPDATE ON public.comm_whatsapp_chats
  FOR EACH ROW
  EXECUTE FUNCTION public.comm_whatsapp_preserve_archived_when_muted();

COMMIT;
