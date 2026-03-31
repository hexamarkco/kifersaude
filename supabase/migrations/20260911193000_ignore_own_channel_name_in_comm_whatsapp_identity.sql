BEGIN;

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
  v_connected_user_name text;
  v_safe_push_name text;
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
    AND c.saved = true
    AND public.comm_whatsapp_phone_lookup_keys(c.phone_digits) && public.comm_whatsapp_phone_lookup_keys(v_chat.phone_digits)
  ORDER BY c.updated_at DESC, c.last_synced_at DESC, c.id DESC
  LIMIT 1;

  SELECT NULLIF(btrim(l.nome_completo), '')
  INTO v_lead_name
  FROM public.leads l
  WHERE l.id = v_chat.lead_id;

  SELECT NULLIF(btrim(ch.connected_user_name), '')
  INTO v_connected_user_name
  FROM public.comm_whatsapp_channels ch
  WHERE ch.id = v_chat.channel_id;

  v_safe_push_name := NULLIF(btrim(v_chat.push_name), '');
  IF v_safe_push_name IS NOT NULL
    AND v_connected_user_name IS NOT NULL
    AND lower(v_safe_push_name) = lower(v_connected_user_name) THEN
    v_safe_push_name := NULL;
  END IF;

  UPDATE public.comm_whatsapp_chats
  SET
    saved_contact_name = v_saved_contact_name,
    push_name = v_safe_push_name,
    display_name = COALESCE(
      v_saved_contact_name,
      v_lead_name,
      v_safe_push_name,
      public.comm_whatsapp_format_phone_label(v_chat.phone_number)
    ),
    updated_at = now()
  WHERE id = v_chat.id
  RETURNING * INTO v_chat;

  RETURN NEXT v_chat;
END;
$$;

WITH polluted_chats AS (
  SELECT c.id
  FROM public.comm_whatsapp_chats c
  JOIN public.comm_whatsapp_channels ch ON ch.id = c.channel_id
  WHERE c.saved_contact_name IS NULL
    AND c.lead_id IS NULL
    AND NULLIF(btrim(c.push_name), '') IS NOT NULL
    AND NULLIF(btrim(ch.connected_user_name), '') IS NOT NULL
    AND lower(btrim(c.push_name)) = lower(btrim(ch.connected_user_name))
)
SELECT public.comm_whatsapp_refresh_chat_identity(id)
FROM polluted_chats;

COMMIT;
