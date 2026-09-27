BEGIN;

-- Um contato salvo manualmente e uma linha antiga do provedor podem
-- representar o mesmo telefone. A cópia do provedor não deve continuar
-- disponível para consultas legadas, pois ela pode reintroduzir o nome antigo
-- durante uma atualização do Inbox.
DELETE FROM public.comm_whatsapp_phone_contacts_cache AS stale
USING public.comm_whatsapp_phone_contacts_cache AS manual
WHERE manual.channel_id = stale.channel_id
  AND manual.id <> stale.id
  AND public.comm_whatsapp_is_manual_contact_cache_row(manual.manual_override, manual.contact_id)
  AND public.comm_whatsapp_is_manual_contact_cache_row(stale.manual_override, stale.contact_id) = false
  AND public.comm_whatsapp_phone_lookup_keys(COALESCE(manual.phone_digits, manual.phone_number))
    && public.comm_whatsapp_phone_lookup_keys(COALESCE(stale.phone_digits, stale.phone_number));

-- Salvar ou renomear novamente o contato também corrige cópias antigas que
-- tenham sido criadas antes da proteção de nomes manuais.
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

  DELETE FROM public.comm_whatsapp_phone_contacts_cache AS stale
  WHERE stale.channel_id = p_channel_id
    AND public.comm_whatsapp_is_manual_contact_cache_row(stale.manual_override, stale.contact_id) = false
    AND public.comm_whatsapp_phone_lookup_keys(COALESCE(stale.phone_digits, stale.phone_number))
      && v_phone_keys;

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
  ORDER BY public.comm_whatsapp_is_manual_contact_cache_row(contact.manual_override, contact.contact_id) DESC,
           contact.updated_at DESC,
           contact.id DESC
  LIMIT 1;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Nao foi possivel persistir o nome manual do contato.';
  END IF;

  RETURN NEXT v_row;
END;
$function$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_save_manual_contact_override(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_save_manual_contact_override(uuid, text, text) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
