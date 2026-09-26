BEGIN;

-- Os identificadores da conversa são normalizados, mas o cache antigo pode
-- conter contact_id no formato recebido do WhatsApp (por exemplo, com
-- sufixo). Tente a chave direta primeiro e só normalize como fallback raro.
CREATE OR REPLACE FUNCTION public.comm_whatsapp_preferred_saved_contact_name(
  p_channel_id uuid,
  p_chat_id uuid,
  p_phone_digits text
)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  WITH lookup_keys AS MATERIALIZED (
    SELECT public.comm_whatsapp_phone_lookup_keys(p_phone_digits) AS keys
  ),
  phone_matches AS MATERIALIZED (
    SELECT
      contact.id,
      NULLIF(btrim(contact.display_name), '') AS display_name,
      contact.contact_id LIKE 'manual:%' AS is_manual,
      contact.updated_at,
      contact.last_synced_at
    FROM public.comm_whatsapp_phone_contacts_cache contact
    CROSS JOIN lookup_keys
    WHERE contact.channel_id = p_channel_id
      AND contact.saved = true
      AND public.comm_whatsapp_is_valid_display_name(contact.display_name)
      AND contact.phone_digits = ANY(lookup_keys.keys)
  ),
  direct_identifier_matches AS MATERIALIZED (
    SELECT
      contact.id,
      NULLIF(btrim(contact.display_name), '') AS display_name,
      contact.contact_id LIKE 'manual:%' AS is_manual,
      contact.updated_at,
      contact.last_synced_at
    FROM public.comm_whatsapp_phone_contacts_cache contact
    JOIN public.comm_whatsapp_chat_identifiers identifier
      ON identifier.channel_id = p_channel_id
     AND identifier.chat_id = p_chat_id
     AND contact.contact_id = identifier.external_chat_id
    WHERE contact.channel_id = p_channel_id
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
    FROM public.comm_whatsapp_phone_contacts_cache contact
    JOIN public.comm_whatsapp_chat_identifiers identifier
      ON identifier.channel_id = p_channel_id
     AND identifier.chat_id = p_chat_id
     AND public.normalize_comm_whatsapp_chat_id(contact.contact_id) = identifier.external_chat_id
    WHERE NOT EXISTS (SELECT 1 FROM phone_matches)
      AND NOT EXISTS (SELECT 1 FROM direct_identifier_matches)
      AND contact.channel_id = p_channel_id
      AND contact.saved = true
      AND public.comm_whatsapp_is_valid_display_name(contact.display_name)
  ),
  indexed_matches AS MATERIALIZED (
    SELECT * FROM phone_matches
    UNION ALL
    SELECT * FROM direct_identifier_matches
    UNION ALL
    SELECT * FROM normalized_identifier_matches
  ),
  fallback_matches AS MATERIALIZED (
    SELECT
      contact.id,
      NULLIF(btrim(contact.display_name), '') AS display_name,
      contact.contact_id LIKE 'manual:%' AS is_manual,
      contact.updated_at,
      contact.last_synced_at
    FROM public.comm_whatsapp_phone_contacts_cache contact
    CROSS JOIN lookup_keys
    WHERE NOT EXISTS (SELECT 1 FROM indexed_matches)
      AND NULLIF(btrim(p_phone_digits), '') IS NOT NULL
      AND contact.channel_id = p_channel_id
      AND contact.saved = true
      AND public.comm_whatsapp_is_valid_display_name(contact.display_name)
      AND public.comm_whatsapp_phone_lookup_keys(contact.phone_digits)
        && lookup_keys.keys
  ),
  candidates AS (
    SELECT DISTINCT ON (id)
      id, display_name, is_manual, updated_at, last_synced_at
    FROM (
      SELECT * FROM indexed_matches
      UNION ALL
      SELECT * FROM fallback_matches
    ) matches
    ORDER BY id
  )
  SELECT candidates.display_name
  FROM candidates
  ORDER BY
    candidates.is_manual DESC,
    candidates.updated_at DESC,
    candidates.last_synced_at DESC,
    candidates.id DESC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_preferred_saved_contact_name(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_preferred_saved_contact_name(uuid, uuid, text) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
