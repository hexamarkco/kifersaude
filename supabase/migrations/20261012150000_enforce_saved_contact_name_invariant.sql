BEGIN;

-- O nome salvo pelo operador precisa continuar sendo a fonte de verdade mesmo
-- quando uma atualização automática do provedor tenta limpar ou substituir a
-- identidade do chat.
CREATE OR REPLACE FUNCTION public.comm_whatsapp_preserve_saved_contact_display_name()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
DECLARE
  v_saved_contact_name text;
  v_phone_lookup_value text;
BEGIN
  IF COALESCE(NEW.is_group, false) THEN
    RETURN NEW;
  END IF;

  v_phone_lookup_value := COALESCE(
    NULLIF(btrim(NEW.phone_digits), ''),
    NULLIF(btrim(NEW.phone_number), ''),
    NULLIF(btrim(OLD.phone_digits), ''),
    NULLIF(btrim(OLD.phone_number), '')
  );

  SELECT NULLIF(btrim(contact.display_name), '')
  INTO v_saved_contact_name
  FROM public.comm_whatsapp_phone_contacts_cache AS contact
  WHERE contact.channel_id = NEW.channel_id
    AND contact.saved = true
    AND NULLIF(btrim(contact.display_name), '') IS NOT NULL
    AND public.comm_whatsapp_phone_lookup_keys(COALESCE(contact.phone_digits, contact.phone_number))
      && public.comm_whatsapp_phone_lookup_keys(v_phone_lookup_value)
  ORDER BY
    CASE WHEN contact.contact_id LIKE 'manual:%' THEN 0 ELSE 1 END,
    contact.updated_at DESC,
    contact.last_synced_at DESC,
    contact.id DESC
  LIMIT 1;

  -- Se o cache estiver temporariamente indisponível, não deixe uma atualização
  -- automática apagar um nome que já estava salvo no próprio chat.
  v_saved_contact_name := COALESCE(
    v_saved_contact_name,
    NULLIF(btrim(OLD.saved_contact_name), ''),
    NULLIF(btrim(NEW.saved_contact_name), '')
  );

  IF v_saved_contact_name IS NOT NULL THEN
    NEW.saved_contact_name := v_saved_contact_name;
    NEW.display_name := v_saved_contact_name;
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
