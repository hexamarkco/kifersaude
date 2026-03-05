/*
  # Protect WhatsApp group names from sender overwrites

  - Enforces `whatsapp_chats.name` for groups from canonical `whatsapp_groups.name`
  - Prevents accidental group name changes when canonical metadata is unavailable
  - Backfills current group chats using canonical group names
*/

CREATE OR REPLACE FUNCTION public.enforce_whatsapp_group_chat_name()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  canonical_name text;
BEGIN
  IF COALESCE(NEW.is_group, false) THEN
    SELECT g.name
      INTO canonical_name
      FROM public.whatsapp_groups g
     WHERE g.id = NEW.id
     LIMIT 1;

    canonical_name := nullif(btrim(canonical_name), '');

    IF canonical_name IS NOT NULL THEN
      NEW.name := canonical_name;
    ELSIF TG_OP = 'UPDATE'
      AND OLD.name IS NOT NULL
      AND btrim(OLD.name) <> ''
      AND NEW.name IS DISTINCT FROM OLD.name THEN
      NEW.name := OLD.name;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_whatsapp_group_chat_name ON public.whatsapp_chats;

CREATE TRIGGER trg_enforce_whatsapp_group_chat_name
BEFORE INSERT OR UPDATE OF name, is_group
ON public.whatsapp_chats
FOR EACH ROW
EXECUTE FUNCTION public.enforce_whatsapp_group_chat_name();

UPDATE public.whatsapp_chats c
SET name = g.name,
    updated_at = now()
FROM public.whatsapp_groups g
WHERE c.id = g.id
  AND COALESCE(c.is_group, false) = true
  AND g.name IS NOT NULL
  AND btrim(g.name) <> ''
  AND c.name IS DISTINCT FROM g.name;
