BEGIN;

-- Keep the persisted chat name as the first and cheapest identity source.
-- For chats without that value, avoid materializing the entire channel cache
-- for every row in the Inbox page: the common phone and identifier paths can
-- use their existing indexes directly.
CREATE OR REPLACE FUNCTION public.comm_whatsapp_preferred_saved_contact_name(
  p_channel_id uuid,
  p_chat_id uuid,
  p_phone_digits text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $function$
DECLARE
  v_saved_contact_name text;
  v_phone_digits text;
BEGIN
  SELECT
    NULLIF(btrim(chat.saved_contact_name), ''),
    COALESCE(
      NULLIF(btrim(p_phone_digits), ''),
      NULLIF(btrim(chat.phone_digits), ''),
      NULLIF(btrim(chat.phone_number), '')
    )
  INTO v_saved_contact_name, v_phone_digits
  FROM public.comm_whatsapp_chats AS chat
  WHERE chat.id = p_chat_id
    AND chat.channel_id = p_channel_id
    AND COALESCE(chat.is_group, false) = false;

  IF public.comm_whatsapp_is_valid_display_name(v_saved_contact_name) THEN
    RETURN v_saved_contact_name;
  END IF;

  RETURN (
    WITH lookup_keys AS MATERIALIZED (
      SELECT public.comm_whatsapp_phone_lookup_keys(v_phone_digits) AS keys
    ),
    phone_matches AS MATERIALIZED (
      SELECT
        contact.id,
        public.comm_whatsapp_is_manual_contact_cache_row(contact.manual_override, contact.contact_id) AS is_manual,
        CASE
          WHEN public.comm_whatsapp_is_manual_contact_cache_row(contact.manual_override, contact.contact_id)
            THEN COALESCE(NULLIF(btrim(contact.manual_override_name), ''), NULLIF(btrim(contact.display_name), ''))
          ELSE NULLIF(btrim(contact.display_name), '')
        END AS display_name,
        contact.updated_at,
        contact.last_synced_at
      FROM public.comm_whatsapp_phone_contacts_cache AS contact
      CROSS JOIN lookup_keys
      WHERE contact.channel_id = p_channel_id
        AND contact.saved = true
        AND contact.phone_digits = ANY(lookup_keys.keys)
    ),
    direct_identifier_matches AS MATERIALIZED (
      SELECT
        contact.id,
        public.comm_whatsapp_is_manual_contact_cache_row(contact.manual_override, contact.contact_id) AS is_manual,
        CASE
          WHEN public.comm_whatsapp_is_manual_contact_cache_row(contact.manual_override, contact.contact_id)
            THEN COALESCE(NULLIF(btrim(contact.manual_override_name), ''), NULLIF(btrim(contact.display_name), ''))
          ELSE NULLIF(btrim(contact.display_name), '')
        END AS display_name,
        contact.updated_at,
        contact.last_synced_at
      FROM public.comm_whatsapp_chat_identifiers AS identifier
      JOIN public.comm_whatsapp_phone_contacts_cache AS contact
        ON contact.channel_id = p_channel_id
       AND contact.contact_id = identifier.external_chat_id
      WHERE identifier.channel_id = p_channel_id
        AND identifier.chat_id = p_chat_id
        AND contact.saved = true
    ),
    normalized_identifier_matches AS MATERIALIZED (
      SELECT
        contact.id,
        public.comm_whatsapp_is_manual_contact_cache_row(contact.manual_override, contact.contact_id) AS is_manual,
        CASE
          WHEN public.comm_whatsapp_is_manual_contact_cache_row(contact.manual_override, contact.contact_id)
            THEN COALESCE(NULLIF(btrim(contact.manual_override_name), ''), NULLIF(btrim(contact.display_name), ''))
          ELSE NULLIF(btrim(contact.display_name), '')
        END AS display_name,
        contact.updated_at,
        contact.last_synced_at
      FROM public.comm_whatsapp_chat_identifiers AS identifier
      JOIN public.comm_whatsapp_phone_contacts_cache AS contact
        ON contact.channel_id = p_channel_id
       AND public.normalize_comm_whatsapp_chat_id(contact.contact_id) = identifier.external_chat_id
      WHERE identifier.channel_id = p_channel_id
        AND identifier.chat_id = p_chat_id
        AND NOT EXISTS (SELECT 1 FROM phone_matches)
        AND NOT EXISTS (SELECT 1 FROM direct_identifier_matches)
        AND contact.saved = true
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
        public.comm_whatsapp_is_manual_contact_cache_row(contact.manual_override, contact.contact_id) AS is_manual,
        CASE
          WHEN public.comm_whatsapp_is_manual_contact_cache_row(contact.manual_override, contact.contact_id)
            THEN COALESCE(NULLIF(btrim(contact.manual_override_name), ''), NULLIF(btrim(contact.display_name), ''))
          ELSE NULLIF(btrim(contact.display_name), '')
        END AS display_name,
        contact.updated_at,
        contact.last_synced_at
      FROM public.comm_whatsapp_phone_contacts_cache AS contact
      CROSS JOIN lookup_keys
      WHERE NOT EXISTS (SELECT 1 FROM indexed_matches)
        AND NULLIF(btrim(v_phone_digits), '') IS NOT NULL
        AND contact.channel_id = p_channel_id
        AND contact.saved = true
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
      ) AS matches
      ORDER BY id
    )
    SELECT candidates.display_name
    FROM candidates
    WHERE public.comm_whatsapp_is_valid_display_name(candidates.display_name)
    ORDER BY
      candidates.is_manual DESC,
      candidates.updated_at DESC NULLS LAST,
      candidates.last_synced_at DESC NULLS LAST,
      candidates.id DESC
    LIMIT 1
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_preferred_saved_contact_name(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_preferred_saved_contact_name(uuid, uuid, text) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
