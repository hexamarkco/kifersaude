-- A provider can send a stale push name with every new message. The message
-- persistence path updates display_name before refreshing the saved-contact
-- identity, which allowed realtime to briefly expose that stale value.
-- Keep the user-selected contact name authoritative at the database boundary
-- so every reader (Inbox, search and realtime) sees the same identity.

CREATE OR REPLACE FUNCTION public.comm_whatsapp_preserve_saved_contact_name()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_saved_name text := NULLIF(btrim(COALESCE(NEW.saved_contact_name, '')), '');
BEGIN
  IF COALESCE(NEW.is_group, false) OR v_saved_name IS NULL THEN
    RETURN NEW;
  END IF;

  IF public.comm_whatsapp_is_valid_display_name(v_saved_name) THEN
    NEW.saved_contact_name := v_saved_name;
    NEW.display_name := v_saved_name;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_preserve_saved_contact_name() FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_preserve_saved_contact_name() TO service_role;

DROP TRIGGER IF EXISTS comm_whatsapp_preserve_saved_contact_name_trigger
  ON public.comm_whatsapp_chats;

CREATE TRIGGER comm_whatsapp_preserve_saved_contact_name_trigger
BEFORE INSERT OR UPDATE OF display_name, saved_contact_name
ON public.comm_whatsapp_chats
FOR EACH ROW
EXECUTE FUNCTION public.comm_whatsapp_preserve_saved_contact_name();
