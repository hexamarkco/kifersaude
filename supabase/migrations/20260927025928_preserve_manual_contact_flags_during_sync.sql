BEGIN;

-- Contatos antigos podem ter sido salvos usando o contact_id original do
-- provedor. Nesses casos manual_override=true é a fonte de verdade, mesmo
-- que um upsert posterior do provedor envie manual_override=false (ou omita
-- as colunas novas). O nome escolhido pelo operador deve vencer esse upsert.
CREATE OR REPLACE FUNCTION public.comm_whatsapp_protect_manual_contact_cache()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF COALESCE(OLD.manual_override, false) THEN
      RETURN NULL;
    END IF;
    RETURN OLD;
  END IF;

  IF COALESCE(OLD.manual_override, false)
    AND NULLIF(btrim(OLD.manual_override_name), '') IS NOT NULL
    AND (
      NEW.manual_override IS NOT TRUE
      OR NULLIF(btrim(NEW.manual_override_name), '') IS NULL
      OR NEW.manual_override_name IS NOT DISTINCT FROM OLD.manual_override_name
    )
  THEN
    NEW.manual_override := true;
    NEW.manual_override_name := OLD.manual_override_name;
    NEW.display_name := OLD.manual_override_name;
    NEW.short_name := left(OLD.manual_override_name, 120);
  END IF;

  RETURN NEW;
END;
$function$;

NOTIFY pgrst, 'reload schema';

COMMIT;
