BEGIN;

-- A sincronizacao antiga da Edge Function pode atualizar uma linha manual sem
-- enviar as colunas manual_override e manual_override_name. A protecao
-- anterior preservava o nome apenas quando a nova linha ainda chegava marcada
-- como manual, permitindo que o nome do provedor reaparecesse.
--
-- Este trigger mantem a decisao do operador como fonte de verdade em tres
-- situacoes:
--   1. um upsert automatico tenta atualizar a mesma linha manual;
--   2. a sincronizacao tenta inserir outra linha para o mesmo telefone;
--   3. o cleanup automatico tenta apagar a linha manual.
-- Uma alteracao manual explicita continua permitida quando o novo
-- manual_override_name realmente muda.
CREATE OR REPLACE FUNCTION public.comm_whatsapp_protect_manual_contact_cache()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_manual_name text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF public.comm_whatsapp_is_manual_contact_cache_row(OLD.manual_override, OLD.contact_id) THEN
      RETURN NULL;
    END IF;

    RETURN OLD;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- Uma linha manual nova tem prioridade e deve ser inserida normalmente.
    IF public.comm_whatsapp_is_manual_contact_cache_row(NEW.manual_override, NEW.contact_id) THEN
      RETURN NEW;
    END IF;

    -- Nao deixe a sincronizacao recriar a copia do provedor ao lado de uma
    -- decisao manual existente para o mesmo telefone.
    IF EXISTS (
      SELECT 1
      FROM public.comm_whatsapp_phone_contacts_cache AS manual
      WHERE manual.channel_id = NEW.channel_id
        AND manual.saved = true
        AND public.comm_whatsapp_is_manual_contact_cache_row(manual.manual_override, manual.contact_id)
        AND public.comm_whatsapp_phone_lookup_keys(COALESCE(manual.phone_digits, manual.phone_number))
          && public.comm_whatsapp_phone_lookup_keys(COALESCE(NEW.phone_digits, NEW.phone_number))
    ) THEN
      RETURN NULL;
    END IF;

    RETURN NEW;
  END IF;

  IF public.comm_whatsapp_is_manual_contact_cache_row(OLD.manual_override, OLD.contact_id) THEN
    v_manual_name := COALESCE(
      NULLIF(btrim(OLD.manual_override_name), ''),
      NULLIF(btrim(OLD.display_name), '')
    );

    -- Renomeacao manual explicita: deixa passar o novo nome escolhido.
    IF public.comm_whatsapp_is_manual_contact_cache_row(NEW.manual_override, NEW.contact_id)
      AND NULLIF(btrim(NEW.manual_override_name), '') IS DISTINCT FROM v_manual_name
    THEN
      RETURN NEW;
    END IF;

    IF v_manual_name IS NOT NULL THEN
      NEW.contact_id := OLD.contact_id;
      NEW.display_name := v_manual_name;
      NEW.short_name := left(v_manual_name, 120);
      NEW.saved := true;
      NEW.manual_override := true;
      NEW.manual_override_name := v_manual_name;
    END IF;

    RETURN NEW;
  END IF;

  -- Se ja existe uma linha manual equivalente, uma atualizacao automatica da
  -- linha do provedor nao traz informacao nova para o Inbox. Ignora-a para
  -- evitar que duas fontes concorrentes alternem o nome exibido.
  IF NOT public.comm_whatsapp_is_manual_contact_cache_row(NEW.manual_override, NEW.contact_id)
    AND EXISTS (
      SELECT 1
      FROM public.comm_whatsapp_phone_contacts_cache AS manual
      WHERE manual.channel_id = NEW.channel_id
        AND manual.id <> OLD.id
        AND manual.saved = true
        AND public.comm_whatsapp_is_manual_contact_cache_row(manual.manual_override, manual.contact_id)
        AND public.comm_whatsapp_phone_lookup_keys(COALESCE(manual.phone_digits, manual.phone_number))
          && public.comm_whatsapp_phone_lookup_keys(COALESCE(NEW.phone_digits, NEW.phone_number))
    )
  THEN
    RETURN NULL;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_comm_whatsapp_protect_manual_contact_cache
  ON public.comm_whatsapp_phone_contacts_cache;

CREATE TRIGGER trg_comm_whatsapp_protect_manual_contact_cache
BEFORE INSERT OR UPDATE OR DELETE ON public.comm_whatsapp_phone_contacts_cache
FOR EACH ROW
EXECUTE FUNCTION public.comm_whatsapp_protect_manual_contact_cache();

REVOKE ALL ON FUNCTION public.comm_whatsapp_protect_manual_contact_cache() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_protect_manual_contact_cache() TO service_role;

-- Remove any provider copy that may have been recreated before this guard was
-- installed. The operation is idempotent and only affects rows without the
-- manual marker.
DELETE FROM public.comm_whatsapp_phone_contacts_cache AS stale
USING public.comm_whatsapp_phone_contacts_cache AS manual
WHERE manual.channel_id = stale.channel_id
  AND manual.id <> stale.id
  AND manual.saved = true
  AND public.comm_whatsapp_is_manual_contact_cache_row(manual.manual_override, manual.contact_id)
  AND public.comm_whatsapp_is_manual_contact_cache_row(stale.manual_override, stale.contact_id) = false
  AND public.comm_whatsapp_phone_lookup_keys(COALESCE(manual.phone_digits, manual.phone_number))
    && public.comm_whatsapp_phone_lookup_keys(COALESCE(stale.phone_digits, stale.phone_number));

NOTIFY pgrst, 'reload schema';

COMMIT;
