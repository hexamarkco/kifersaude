BEGIN;

-- A persistencia de cada mensagem atualiza a identidade do chat. O lookup
-- antigo aplicava phone_lookup_keys() em toda a tabela de contatos para cada
-- mensagem, mesmo quando phone_digits ja estava normalizado e indexado.
-- Primeiro use a mesma precedencia indexada do resolvedor do Inbox; mantenha
-- os identificadores alternativos como fallback para chats antigos/LID.
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
  v_display_name text;
BEGIN
  SELECT * INTO v_chat
  FROM public.comm_whatsapp_chats
  WHERE id = public.comm_whatsapp_resolve_chat_uuid(p_chat_id)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  WITH lookup_keys AS MATERIALIZED (
    SELECT public.comm_whatsapp_phone_lookup_keys(v_chat.phone_digits) AS keys
  ),
  phone_matches AS MATERIALIZED (
    SELECT
      contact.id,
      NULLIF(btrim(contact.display_name), '') AS display_name,
      contact.contact_id LIKE 'manual:%' AS is_manual,
      contact.updated_at,
      contact.last_synced_at
    FROM public.comm_whatsapp_phone_contacts_cache AS contact
    CROSS JOIN lookup_keys
    WHERE contact.channel_id = v_chat.channel_id
      AND contact.saved = true
      AND public.comm_whatsapp_is_valid_display_name(contact.display_name)
      AND NULLIF(btrim(COALESCE(contact.phone_digits, '')), '') IS NOT NULL
      AND NULLIF(btrim(COALESCE(v_chat.phone_digits, '')), '') IS NOT NULL
      AND contact.phone_digits = ANY(lookup_keys.keys)
  ),
  direct_identifier_matches AS MATERIALIZED (
    SELECT
      contact.id,
      NULLIF(btrim(contact.display_name), '') AS display_name,
      contact.contact_id LIKE 'manual:%' AS is_manual,
      contact.updated_at,
      contact.last_synced_at
    FROM public.comm_whatsapp_phone_contacts_cache AS contact
    JOIN public.comm_whatsapp_chat_identifiers AS identifier
      ON identifier.channel_id = v_chat.channel_id
     AND identifier.chat_id = v_chat.id
     AND contact.contact_id = identifier.external_chat_id
    WHERE contact.channel_id = v_chat.channel_id
      AND contact.saved = true
      AND public.comm_whatsapp_is_valid_display_name(contact.display_name)
  ),
  normalized_identifier_matches AS MATERIALIZED (
    SELECT
      contact.id,
      NULLIF(btrim(contact.display_name), '') AS display_name,
      contact.contact_id LIKE 'manual:%' AS is_manual,
      contact.updated_at,
      contact.last_synced_at
    FROM public.comm_whatsapp_phone_contacts_cache AS contact
    JOIN public.comm_whatsapp_chat_identifiers AS identifier
      ON identifier.channel_id = v_chat.channel_id
     AND identifier.chat_id = v_chat.id
     AND public.normalize_comm_whatsapp_chat_id(contact.contact_id) = identifier.external_chat_id
    WHERE contact.channel_id = v_chat.channel_id
      AND contact.saved = true
      AND public.comm_whatsapp_is_valid_display_name(contact.display_name)
  ),
  candidates AS (
    SELECT DISTINCT ON (id)
      id, display_name, is_manual, updated_at, last_synced_at
    FROM (
      SELECT * FROM phone_matches
      UNION ALL
      SELECT * FROM direct_identifier_matches
      UNION ALL
      SELECT * FROM normalized_identifier_matches
    ) AS matches
    ORDER BY id
  )
  SELECT candidates.display_name
  INTO v_saved_contact_name
  FROM candidates
  ORDER BY
    candidates.is_manual DESC,
    candidates.updated_at DESC,
    candidates.last_synced_at DESC,
    candidates.id DESC
  LIMIT 1;

  -- O cache pode ficar momentaneamente vazio durante uma sincronização. O
  -- nome persistido representa uma decisão explícita do usuário e deve ser
  -- mantido até que um novo contato salvo forneça outro nome.
  IF v_saved_contact_name IS NULL
    AND public.comm_whatsapp_is_valid_display_name(v_chat.saved_contact_name)
  THEN
    v_saved_contact_name := NULLIF(btrim(v_chat.saved_contact_name), '');
  END IF;

  SELECT NULLIF(btrim(lead.nome_completo), '')
  INTO v_lead_name
  FROM public.leads AS lead
  WHERE lead.id = v_chat.lead_id
    AND public.comm_whatsapp_is_valid_display_name(lead.nome_completo);

  SELECT NULLIF(btrim(channel.connected_user_name), '')
  INTO v_connected_user_name
  FROM public.comm_whatsapp_channels AS channel
  WHERE channel.id = v_chat.channel_id;

  v_safe_push_name := NULLIF(btrim(v_chat.push_name), '');
  IF v_safe_push_name IS NOT NULL AND (
    NOT public.comm_whatsapp_is_valid_display_name(v_safe_push_name)
    OR (v_connected_user_name IS NOT NULL AND lower(v_safe_push_name) = lower(v_connected_user_name))
  ) THEN
    v_safe_push_name := NULL;
  END IF;

  v_display_name := COALESCE(
    v_saved_contact_name,
    v_lead_name,
    v_safe_push_name,
    CASE
      WHEN NULLIF(btrim(COALESCE(v_chat.phone_number, '')), '') IS NOT NULL
        THEN public.comm_whatsapp_format_phone_label(v_chat.phone_number)
      ELSE 'Contato privado'
    END
  );

  IF v_chat.saved_contact_name IS DISTINCT FROM v_saved_contact_name
    OR v_chat.push_name IS DISTINCT FROM v_safe_push_name
    OR v_chat.display_name IS DISTINCT FROM v_display_name
  THEN
    UPDATE public.comm_whatsapp_chats
    SET saved_contact_name = v_saved_contact_name,
        push_name = v_safe_push_name,
        display_name = v_display_name,
        updated_at = now()
    WHERE id = v_chat.id
    RETURNING * INTO v_chat;
  END IF;

  RETURN NEXT v_chat;
END;
$$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_refresh_chat_identity(uuid) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_refresh_chat_identity(uuid) TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
