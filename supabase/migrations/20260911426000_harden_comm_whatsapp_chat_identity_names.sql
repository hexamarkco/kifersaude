BEGIN;

CREATE OR REPLACE FUNCTION public.comm_whatsapp_is_valid_display_name(p_value text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  WITH normalized AS (
    SELECT btrim(COALESCE(p_value, '')) AS value
  )
  SELECT value <> ''
    AND regexp_replace(value, '[\s()+-]', '', 'g') !~ '^\+?[0-9]+$'
    AND value !~ '^[[:space:][:punct:]]+$'
  FROM normalized;
$$;

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
  v_business_name text;
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
    AND public.comm_whatsapp_is_valid_display_name(c.display_name)
    AND public.comm_whatsapp_phone_lookup_keys(c.phone_digits) && public.comm_whatsapp_phone_lookup_keys(v_chat.phone_digits)
  ORDER BY
    CASE
      WHEN c.contact_id LIKE 'manual:%' THEN 0
      WHEN c.contact_id LIKE 'chat:%' THEN 2
      ELSE 1
    END,
    c.updated_at DESC,
    c.last_synced_at DESC,
    c.id DESC
  LIMIT 1;

  SELECT NULLIF(btrim(l.nome_completo), '')
  INTO v_lead_name
  FROM public.leads l
  WHERE l.id = v_chat.lead_id
    AND public.comm_whatsapp_is_valid_display_name(l.nome_completo);

  SELECT NULLIF(btrim(ch.connected_user_name), '')
  INTO v_connected_user_name
  FROM public.comm_whatsapp_channels ch
  WHERE ch.id = v_chat.channel_id;

  v_safe_push_name := NULLIF(btrim(v_chat.push_name), '');
  IF v_safe_push_name IS NOT NULL
    AND (
      NOT public.comm_whatsapp_is_valid_display_name(v_safe_push_name)
      OR (
        v_connected_user_name IS NOT NULL
        AND lower(v_safe_push_name) = lower(v_connected_user_name)
      )
    ) THEN
    v_safe_push_name := NULL;
  END IF;

  IF v_saved_contact_name IS NULL AND v_lead_name IS NULL AND v_safe_push_name IS NULL THEN
    v_business_name := public.comm_whatsapp_guess_business_display_name(v_chat.id);
    IF NOT public.comm_whatsapp_is_valid_display_name(v_business_name) THEN
      v_business_name := NULL;
    END IF;
  ELSE
    v_business_name := NULL;
  END IF;

  UPDATE public.comm_whatsapp_chats
  SET
    saved_contact_name = v_saved_contact_name,
    push_name = COALESCE(v_safe_push_name, v_business_name),
    display_name = COALESCE(
      v_saved_contact_name,
      v_lead_name,
      v_safe_push_name,
      v_business_name,
      public.comm_whatsapp_format_phone_label(v_chat.phone_number)
    ),
    updated_at = now()
  WHERE id = v_chat.id
  RETURNING * INTO v_chat;

  RETURN NEXT v_chat;
END;
$$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_is_valid_display_name(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_is_valid_display_name(text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.comm_whatsapp_refresh_chat_identity(uuid) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_refresh_chat_identity(uuid) TO service_role;

COMMIT;
