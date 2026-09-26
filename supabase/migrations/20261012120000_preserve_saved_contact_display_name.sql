BEGIN;

CREATE OR REPLACE FUNCTION public.comm_whatsapp_preserve_saved_contact_display_name()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  -- Eventos do provedor podem trazer um nome diferente do nome salvo pelo
  -- operador. Enquanto o contato continuar salvo, o nome escolhido no CRM
  -- deve vencer qualquer atualização automática de identidade.
  IF NOT COALESCE(NEW.is_group, false)
    AND NULLIF(btrim(OLD.saved_contact_name), '') IS NOT NULL
    AND NEW.saved_contact_name IS NOT DISTINCT FROM OLD.saved_contact_name
    AND NEW.display_name IS DISTINCT FROM OLD.saved_contact_name
  THEN
    NEW.display_name := OLD.saved_contact_name;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_comm_whatsapp_preserve_saved_contact_display_name
  ON public.comm_whatsapp_chats;

CREATE TRIGGER trg_comm_whatsapp_preserve_saved_contact_display_name
  BEFORE UPDATE OF display_name, saved_contact_name, push_name
  ON public.comm_whatsapp_chats
  FOR EACH ROW
  EXECUTE FUNCTION public.comm_whatsapp_preserve_saved_contact_display_name();

COMMIT;
