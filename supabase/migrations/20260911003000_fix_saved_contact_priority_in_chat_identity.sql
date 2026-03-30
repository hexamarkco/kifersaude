BEGIN;

DELETE FROM public.comm_whatsapp_phone_contacts_cache
WHERE saved = false;

CREATE OR REPLACE FUNCTION public.comm_whatsapp_refresh_chat_identity(p_chat_id uuid)
RETURNS SETOF public.comm_whatsapp_chats
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_chat public.comm_whatsapp_chats%ROWTYPE;
  v_saved_contact_name text;
  v_lead_name text;
BEGIN
  SELECT *
  INTO v_chat
  FROM public.comm_whatsapp_chats
  WHERE id = p_chat_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT NULLIF(btrim(c.display_name), '')
  INTO v_saved_contact_name
  FROM public.comm_whatsapp_phone_contacts_cache c
  WHERE c.channel_id = v_chat.channel_id
    AND c.phone_digits = v_chat.phone_digits
    AND c.saved = true
  ORDER BY c.updated_at DESC, c.last_synced_at DESC, c.id DESC
  LIMIT 1;

  SELECT NULLIF(btrim(l.nome_completo), '')
  INTO v_lead_name
  FROM public.leads l
  WHERE l.id = v_chat.lead_id;

  UPDATE public.comm_whatsapp_chats
  SET
    saved_contact_name = v_saved_contact_name,
    display_name = COALESCE(
      v_saved_contact_name,
      v_lead_name,
      NULLIF(btrim(v_chat.push_name), ''),
      public.comm_whatsapp_format_phone_label(v_chat.phone_number)
    ),
    updated_at = now()
  WHERE id = v_chat.id
  RETURNING * INTO v_chat;

  RETURN NEXT v_chat;
END;
$$;

SELECT public.comm_whatsapp_refresh_channel_chat_identities(id)
FROM public.comm_whatsapp_channels;

COMMIT;
