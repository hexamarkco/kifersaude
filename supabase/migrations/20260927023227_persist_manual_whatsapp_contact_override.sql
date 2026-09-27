BEGIN;

ALTER TABLE public.comm_whatsapp_phone_contacts_cache
  ADD COLUMN IF NOT EXISTS manual_override boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS manual_override_name text;

CREATE INDEX IF NOT EXISTS idx_comm_whatsapp_phone_contacts_manual_override
  ON public.comm_whatsapp_phone_contacts_cache (channel_id, phone_digits)
  WHERE manual_override = true;

CREATE OR REPLACE FUNCTION public.comm_whatsapp_protect_manual_contact_cache()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    -- Uma decisão explícita do operador não pode ser removida pelo cleanup
    -- automático da sincronização do provedor.
    IF COALESCE(OLD.manual_override, false) THEN
      RETURN NULL;
    END IF;
    RETURN OLD;
  END IF;

  -- O provedor pode reenviar o nome antigo no mesmo upsert. Quando a linha
  -- está marcada como manual, preserve o texto escolhido no CRM. Uma mudança
  -- deliberada em manual_override_name continua sendo permitida.
  IF COALESCE(OLD.manual_override, false)
    AND COALESCE(NEW.manual_override, false)
    AND NULLIF(btrim(OLD.manual_override_name), '') IS NOT NULL
    AND NEW.manual_override_name IS NOT DISTINCT FROM OLD.manual_override_name
    AND NEW.display_name IS DISTINCT FROM OLD.manual_override_name
  THEN
    NEW.display_name := OLD.manual_override_name;
    NEW.short_name := left(OLD.manual_override_name, 120);
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_comm_whatsapp_protect_manual_contact_cache
  ON public.comm_whatsapp_phone_contacts_cache;

CREATE TRIGGER trg_comm_whatsapp_protect_manual_contact_cache
BEFORE UPDATE OR DELETE ON public.comm_whatsapp_phone_contacts_cache
FOR EACH ROW
EXECUTE FUNCTION public.comm_whatsapp_protect_manual_contact_cache();

CREATE OR REPLACE FUNCTION public.comm_whatsapp_save_manual_contact_override(
  p_channel_id uuid,
  p_phone_number text,
  p_display_name text
)
RETURNS SETOF public.comm_whatsapp_phone_contacts_cache
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_phone text := NULLIF(public.normalize_comm_whatsapp_phone(COALESCE(p_phone_number, '')), '');
  v_name text := NULLIF(btrim(COALESCE(p_display_name, '')), '');
  v_phone_keys text[];
  v_row public.comm_whatsapp_phone_contacts_cache%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.current_user_can_edit_comm_whatsapp() THEN
    RAISE EXCEPTION 'Permissao insuficiente para salvar o nome do contato.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.comm_whatsapp_channels AS channel
    WHERE channel.id = p_channel_id
  ) THEN
    RAISE EXCEPTION 'Canal WhatsApp nao encontrado.';
  END IF;

  IF v_phone IS NULL THEN
    RAISE EXCEPTION 'Numero invalido para salvar o nome do contato.';
  END IF;

  IF v_name IS NULL THEN
    RAISE EXCEPTION 'Nome invalido para salvar o contato.';
  END IF;

  v_phone_keys := public.comm_whatsapp_phone_lookup_keys(v_phone);

  -- Atualize a linha sincronizada existente quando possível. Isso mantém a
  -- compatibilidade com versões antigas da Edge Function que ainda usam o
  -- contact_id recebido do provedor.
  UPDATE public.comm_whatsapp_phone_contacts_cache AS contact
  SET display_name = v_name,
      short_name = left(v_name, 120),
      manual_override = true,
      manual_override_name = v_name,
      saved = true,
      updated_at = now()
  WHERE contact.channel_id = p_channel_id
    AND contact.saved = true
    AND contact.phone_digits = ANY(v_phone_keys);

  IF NOT FOUND THEN
    INSERT INTO public.comm_whatsapp_phone_contacts_cache (
      channel_id,
      contact_id,
      phone_number,
      phone_digits,
      display_name,
      short_name,
      saved,
      manual_override,
      manual_override_name,
      last_synced_at,
      updated_at
    )
    VALUES (
      p_channel_id,
      'manual:' || v_phone,
      v_phone,
      v_phone,
      v_name,
      left(v_name, 120),
      true,
      true,
      v_name,
      now(),
      now()
    )
    ON CONFLICT (channel_id, contact_id) DO UPDATE
    SET display_name = EXCLUDED.display_name,
        short_name = EXCLUDED.short_name,
        saved = true,
        manual_override = true,
        manual_override_name = EXCLUDED.manual_override_name,
        updated_at = now();
  END IF;

  -- Reforce a identidade imediatamente, sem depender de um novo webhook ou
  -- da publicação da versão nova da Edge Function.
  UPDATE public.comm_whatsapp_chats AS chat
  SET saved_contact_name = v_name,
      display_name = v_name,
      updated_at = now()
  WHERE chat.channel_id = p_channel_id
    AND COALESCE(chat.is_group, false) = false
    AND chat.phone_digits = ANY(v_phone_keys);

  SELECT contact.*
  INTO v_row
  FROM public.comm_whatsapp_phone_contacts_cache AS contact
  WHERE contact.channel_id = p_channel_id
    AND contact.saved = true
    AND contact.phone_digits = ANY(v_phone_keys)
  ORDER BY contact.manual_override DESC,
           (contact.contact_id LIKE 'manual:%') DESC,
           contact.updated_at DESC,
           contact.id DESC
  LIMIT 1;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Nao foi possivel persistir o nome manual do contato.';
  END IF;

  RETURN NEXT v_row;
END;
$function$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_protect_manual_contact_cache() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_protect_manual_contact_cache() TO service_role;

REVOKE ALL ON FUNCTION public.comm_whatsapp_save_manual_contact_override(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_save_manual_contact_override(uuid, text, text) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
