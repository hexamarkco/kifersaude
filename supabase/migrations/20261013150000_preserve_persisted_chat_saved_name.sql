BEGIN;

-- O nome salvo no proprio chat e a copia persistida da decisao do operador.
-- O cache de contatos pode receber, por alguns instantes, um nome antigo do
-- provedor durante a sincronizacao. Se ele vencer a coluna do chat, a lista
-- e a thread podem alternar entre as duas identidades.
--
-- Mantenha o cache como fallback para chats que ainda nao possuem a copia
-- persistida, mas nunca deixe uma leitura temporaria do provedor substituir
-- um nome que ja foi salvo no Inbox.
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
AS $function$
  WITH chat_identity AS MATERIALIZED (
    SELECT
      NULLIF(btrim(chat.saved_contact_name), '') AS saved_contact_name,
      COALESCE(
        NULLIF(btrim(p_phone_digits), ''),
        NULLIF(btrim(chat.phone_digits), ''),
        NULLIF(btrim(chat.phone_number), '')
      ) AS phone_digits
    FROM public.comm_whatsapp_chats AS chat
    WHERE chat.id = p_chat_id
      AND chat.channel_id = p_channel_id
      AND COALESCE(chat.is_group, false) = false
  ),
  lookup_keys AS MATERIALIZED (
    SELECT public.comm_whatsapp_phone_lookup_keys(
      (SELECT chat_identity.phone_digits FROM chat_identity)
    ) AS keys
  ),
  cache_rows AS MATERIALIZED (
    SELECT
      contact.id,
      contact.channel_id,
      contact.contact_id,
      contact.phone_digits,
      public.comm_whatsapp_is_manual_contact_cache_row(contact.manual_override, contact.contact_id) AS is_manual,
      CASE
        WHEN public.comm_whatsapp_is_manual_contact_cache_row(contact.manual_override, contact.contact_id)
          THEN COALESCE(NULLIF(btrim(contact.manual_override_name), ''), NULLIF(btrim(contact.display_name), ''))
        ELSE NULLIF(btrim(contact.display_name), '')
      END AS display_name,
      contact.updated_at,
      contact.last_synced_at
    FROM public.comm_whatsapp_phone_contacts_cache AS contact
    WHERE contact.channel_id = p_channel_id
      AND contact.saved = true
  ),
  phone_matches AS MATERIALIZED (
    SELECT cache.*
    FROM cache_rows AS cache
    CROSS JOIN lookup_keys
    WHERE public.comm_whatsapp_is_valid_display_name(cache.display_name)
      AND cache.phone_digits = ANY(lookup_keys.keys)
  ),
  direct_identifier_matches AS MATERIALIZED (
    SELECT cache.*
    FROM cache_rows AS cache
    JOIN public.comm_whatsapp_chat_identifiers AS identifier
      ON identifier.channel_id = p_channel_id
     AND identifier.chat_id = p_chat_id
     AND cache.contact_id = identifier.external_chat_id
    WHERE public.comm_whatsapp_is_valid_display_name(cache.display_name)
  ),
  normalized_identifier_matches AS MATERIALIZED (
    SELECT cache.*
    FROM cache_rows AS cache
    JOIN public.comm_whatsapp_chat_identifiers AS identifier
      ON identifier.channel_id = p_channel_id
     AND identifier.chat_id = p_chat_id
     AND public.normalize_comm_whatsapp_chat_id(cache.contact_id) = identifier.external_chat_id
    WHERE NOT EXISTS (SELECT 1 FROM phone_matches)
      AND NOT EXISTS (SELECT 1 FROM direct_identifier_matches)
      AND public.comm_whatsapp_is_valid_display_name(cache.display_name)
  ),
  indexed_matches AS MATERIALIZED (
    SELECT * FROM phone_matches
    UNION ALL
    SELECT * FROM direct_identifier_matches
    UNION ALL
    SELECT * FROM normalized_identifier_matches
  ),
  fallback_matches AS MATERIALIZED (
    SELECT cache.*
    FROM cache_rows AS cache
    CROSS JOIN lookup_keys
    WHERE NOT EXISTS (SELECT 1 FROM indexed_matches)
      AND NULLIF(btrim((SELECT phone_digits FROM chat_identity)), '') IS NOT NULL
      AND public.comm_whatsapp_is_valid_display_name(cache.display_name)
      AND public.comm_whatsapp_phone_lookup_keys(cache.phone_digits)
        && lookup_keys.keys
  ),
  candidates AS (
    SELECT DISTINCT ON (id)
      id, display_name, is_manual, updated_at, last_synced_at
    FROM (
      SELECT * FROM indexed_matches
      UNION ALL
      SELECT * FROM fallback_matches
    ) AS matches
    ORDER BY id
  ),
  resolved_names AS (
    SELECT
      0 AS source_priority,
      chat_identity.saved_contact_name AS display_name,
      true AS is_manual,
      NULL::timestamptz AS updated_at,
      NULL::timestamptz AS last_synced_at,
      NULL::uuid AS row_id
    FROM chat_identity
    WHERE public.comm_whatsapp_is_valid_display_name(chat_identity.saved_contact_name)

    UNION ALL

    SELECT
      1 AS source_priority,
      candidates.display_name,
      candidates.is_manual,
      candidates.updated_at,
      candidates.last_synced_at,
      candidates.id AS row_id
    FROM candidates
  )
  SELECT resolved_names.display_name
  FROM resolved_names
  WHERE public.comm_whatsapp_is_valid_display_name(resolved_names.display_name)
  ORDER BY
    resolved_names.source_priority,
    resolved_names.is_manual DESC,
    resolved_names.updated_at DESC NULLS LAST,
    resolved_names.last_synced_at DESC NULLS LAST,
    resolved_names.row_id DESC NULLS LAST
  LIMIT 1;
$function$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_preferred_saved_contact_name(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_preferred_saved_contact_name(uuid, uuid, text) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
