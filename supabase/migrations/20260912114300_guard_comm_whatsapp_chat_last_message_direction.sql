CREATE OR REPLACE FUNCTION public.comm_whatsapp_default_last_message_direction()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NULLIF(btrim(COALESCE(NEW.last_message_direction, '')), '') IS NULL THEN
    NEW.last_message_direction := 'system';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_comm_whatsapp_default_last_message_direction ON public.comm_whatsapp_chats;
CREATE TRIGGER trg_comm_whatsapp_default_last_message_direction
BEFORE INSERT OR UPDATE OF last_message_direction ON public.comm_whatsapp_chats
FOR EACH ROW
EXECUTE FUNCTION public.comm_whatsapp_default_last_message_direction();
