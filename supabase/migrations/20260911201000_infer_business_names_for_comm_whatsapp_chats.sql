BEGIN;

CREATE OR REPLACE FUNCTION public.comm_whatsapp_extract_business_display_name(p_text text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_text text := regexp_replace(COALESCE(p_text, ''), '\s+', ' ', 'g');
  v_match text[];
  v_area text;
  v_brand text;
BEGIN
  IF btrim(v_text) = '' OR v_text ~ '^\[[^\]]+\]$' THEN
    RETURN NULL;
  END IF;

  v_match := regexp_match(
    v_text,
    '(?i)(?:setor|time|equipe|área|area)\s+(jur[ií]dico|cobran[cç]as?|comercial|financeiro|atendimento|suporte|assinaturas?)\s+(?:da|do|de)\s+([[:alnum:]À-ÿ&._ -]+?)(?=[!,.:\n]|$)'
  );

  IF v_match IS NULL THEN
    v_match := regexp_match(
      v_text,
      '(?i)(?:setor|time|equipe|área|area)\s+(jur[ií]dico|cobran[cç]as?|comercial|financeiro|atendimento|suporte|assinaturas?)\s+([[:alnum:]À-ÿ&._ -]+?)(?=[!,.:\n]|$)'
    );
  END IF;

  IF v_match IS NULL THEN
    v_match := regexp_match(
      v_text,
      '(?i)(jur[ií]dico|cobran[cç]as?|comercial|financeiro|atendimento|suporte)\s+(?:da|do|de)\s+([[:alnum:]À-ÿ&._ -]+?)(?=[!,.:\n]|$)'
    );
  END IF;

  IF v_match IS NOT NULL THEN
    v_area := initcap(lower(btrim(v_match[1])));
    v_brand := regexp_replace(btrim(v_match[2]), '\s+', ' ', 'g');
    IF v_area <> '' AND v_brand <> '' THEN
      RETURN v_area || ' ' || v_brand;
    END IF;
  END IF;

  v_match := regexp_match(
    v_text,
    '(?i)(?:bem-vindo|bem vindo)\s+a\s+[_*~]*([[:alnum:]À-ÿ&._ -]+?)[_*~]*(?=[!,.:\n]|$)'
  );

  IF v_match IS NOT NULL THEN
    v_brand := regexp_replace(btrim(v_match[1]), '\s+', ' ', 'g');
    IF v_brand <> '' THEN
      RETURN v_brand;
    END IF;
  END IF;

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_extract_business_display_name(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_extract_business_display_name(text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.comm_whatsapp_guess_business_display_name(p_chat_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_guess text;
BEGIN
  SELECT public.comm_whatsapp_extract_business_display_name(m.text_content)
  INTO v_guess
  FROM public.comm_whatsapp_messages m
  WHERE m.chat_id = p_chat_id
    AND m.direction = 'inbound'
    AND COALESCE(m.source, '') = 'business_api'
    AND COALESCE(NULLIF(btrim(m.text_content), ''), NULLIF(btrim(m.media_caption), '')) IS NOT NULL
  ORDER BY m.message_at DESC, m.id DESC
  LIMIT 1;

  RETURN NULLIF(btrim(COALESCE(v_guess, '')), '');
END;
$$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_guess_business_display_name(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_guess_business_display_name(uuid) TO authenticated, service_role;

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

  IF v_saved_contact_name IS NULL AND v_lead_name IS NULL AND v_safe_push_name IS NULL THEN
    v_business_name := public.comm_whatsapp_guess_business_display_name(v_chat.id);
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

WITH candidate_chats AS (
  SELECT c.id
  FROM public.comm_whatsapp_chats c
  LEFT JOIN public.comm_whatsapp_channels ch ON ch.id = c.channel_id
  WHERE c.saved_contact_name IS NULL
    AND c.lead_id IS NULL
    AND (
      NULLIF(btrim(c.push_name), '') IS NULL
      OR (
        NULLIF(btrim(ch.connected_user_name), '') IS NOT NULL
        AND lower(btrim(c.push_name)) = lower(btrim(ch.connected_user_name))
      )
      OR lower(btrim(c.display_name)) = lower(public.comm_whatsapp_format_phone_label(c.phone_number))
    )
)
SELECT public.comm_whatsapp_refresh_chat_identity(id)
FROM candidate_chats;

COMMIT;
