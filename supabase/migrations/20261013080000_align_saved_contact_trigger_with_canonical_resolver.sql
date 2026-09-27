BEGIN;

-- O resolvedor canônico também conhece identificadores LID e aliases do chat.
-- O gatilho anterior repetia somente a busca por telefone; quando o provedor
-- atualizava um chat LID, ele podia publicar o nome antigo antes da projeção
-- do Inbox corrigir a identidade.
CREATE OR REPLACE FUNCTION public.comm_whatsapp_preserve_saved_contact_display_name()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
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

  -- Use the same resolver consumed by the Inbox list and thread. This keeps
  -- manual cache rows authoritative for phone, direct identifier and
  -- normalized identifier matches alike.
  v_saved_contact_name := public.comm_whatsapp_preferred_saved_contact_name(
    NEW.channel_id,
    NEW.id,
    v_phone_lookup_value
  );

  -- If the cache is temporarily unavailable, retain the name already present
  -- on the chat instead of allowing an automatic provider refresh to erase it.
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

NOTIFY pgrst, 'reload schema';

COMMIT;
