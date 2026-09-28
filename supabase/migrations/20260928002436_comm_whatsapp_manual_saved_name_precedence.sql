BEGIN;

-- A chat row can retain a name that was written by the provider before the
-- operator saved the contact. The manual cache is the durable operator
-- decision and must win over that historical copy. The persisted chat value
-- remains the fast fallback for the common saved-contact path.
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

  -- Manual rows are checked before the persisted chat copy. This is the
  -- important distinction when an old provider name was stored in the chat
  -- before the operator saved or renamed the contact.
  SELECT manual_match.display_name
  INTO v_saved_contact_name
  FROM (
    WITH lookup_keys AS MATERIALIZED (
      SELECT public.comm_whatsapp_phone_lookup_keys(v_phone_digits) AS keys
    ),
    phone_matches AS MATERIALIZED (
      SELECT
        contact.id,
        COALESCE(NULLIF(btrim(contact.manual_override_name), ''), NULLIF(btrim(contact.display_name), '')) AS display_name,
        contact.updated_at,
        contact.last_synced_at
      FROM public.comm_whatsapp_phone_contacts_cache AS contact
      CROSS JOIN lookup_keys
      WHERE contact.channel_id = p_channel_id
        AND contact.saved = true
        AND public.comm_whatsapp_is_manual_contact_cache_row(contact.manual_override, contact.contact_id)
        AND contact.phone_digits = ANY(lookup_keys.keys)
    ),
    direct_identifier_matches AS MATERIALIZED (
      SELECT
        contact.id,
        COALESCE(NULLIF(btrim(contact.manual_override_name), ''), NULLIF(btrim(contact.display_name), '')) AS display_name,
        contact.updated_at,
        contact.last_synced_at
      FROM public.comm_whatsapp_chat_identifiers AS identifier
      JOIN public.comm_whatsapp_phone_contacts_cache AS contact
        ON contact.channel_id = p_channel_id
       AND contact.contact_id = identifier.external_chat_id
       AND contact.saved = true
       AND public.comm_whatsapp_is_manual_contact_cache_row(contact.manual_override, contact.contact_id)
      WHERE identifier.channel_id = p_channel_id
        AND identifier.chat_id = p_chat_id
    ),
    normalized_identifier_matches AS MATERIALIZED (
      SELECT
        contact.id,
        COALESCE(NULLIF(btrim(contact.manual_override_name), ''), NULLIF(btrim(contact.display_name), '')) AS display_name,
        contact.updated_at,
        contact.last_synced_at
      FROM public.comm_whatsapp_chat_identifiers AS identifier
      JOIN public.comm_whatsapp_phone_contacts_cache AS contact
        ON contact.channel_id = p_channel_id
       AND public.normalize_comm_whatsapp_chat_id(contact.contact_id) = identifier.external_chat_id
       AND contact.saved = true
       AND public.comm_whatsapp_is_manual_contact_cache_row(contact.manual_override, contact.contact_id)
      WHERE identifier.channel_id = p_channel_id
        AND identifier.chat_id = p_chat_id
        AND NOT EXISTS (SELECT 1 FROM phone_matches)
        AND NOT EXISTS (SELECT 1 FROM direct_identifier_matches)
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
        COALESCE(NULLIF(btrim(contact.manual_override_name), ''), NULLIF(btrim(contact.display_name), '')) AS display_name,
        contact.updated_at,
        contact.last_synced_at
      FROM public.comm_whatsapp_phone_contacts_cache AS contact
      CROSS JOIN lookup_keys
      WHERE NOT EXISTS (SELECT 1 FROM indexed_matches)
        AND NULLIF(btrim(v_phone_digits), '') IS NOT NULL
        AND contact.channel_id = p_channel_id
        AND contact.saved = true
        AND public.comm_whatsapp_is_manual_contact_cache_row(contact.manual_override, contact.contact_id)
        AND public.comm_whatsapp_phone_lookup_keys(contact.phone_digits) && lookup_keys.keys
    )
    SELECT
      matches.display_name,
      matches.updated_at,
      matches.last_synced_at,
      matches.id
    FROM (
      SELECT * FROM indexed_matches
      UNION ALL
      SELECT * FROM fallback_matches
    ) AS matches
    WHERE public.comm_whatsapp_is_valid_display_name(matches.display_name)
    ORDER BY matches.updated_at DESC NULLS LAST, matches.last_synced_at DESC NULLS LAST, matches.id DESC
    LIMIT 1
  ) AS manual_match;

  IF public.comm_whatsapp_is_valid_display_name(v_saved_contact_name) THEN
    RETURN v_saved_contact_name;
  END IF;

  -- No manual cache row exists. Keep the persisted chat decision ahead of
  -- synchronized provider data, preserving stable names without a cache scan.
  SELECT NULLIF(btrim(chat.saved_contact_name), '')
  INTO v_saved_contact_name
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
    cache_rows AS MATERIALIZED (
      SELECT
        contact.id,
        contact.contact_id,
        contact.phone_digits,
        NULLIF(btrim(contact.display_name), '') AS display_name,
        contact.updated_at,
        contact.last_synced_at
      FROM public.comm_whatsapp_phone_contacts_cache AS contact
      WHERE contact.channel_id = p_channel_id
        AND contact.saved = true
        AND NOT public.comm_whatsapp_is_manual_contact_cache_row(contact.manual_override, contact.contact_id)
    ),
    phone_matches AS MATERIALIZED (
      SELECT cache.*
      FROM cache_rows AS cache
      CROSS JOIN lookup_keys
      WHERE cache.phone_digits = ANY(lookup_keys.keys)
    ),
    direct_identifier_matches AS MATERIALIZED (
      SELECT cache.*
      FROM public.comm_whatsapp_chat_identifiers AS identifier
      JOIN cache_rows AS cache ON cache.contact_id = identifier.external_chat_id
      WHERE identifier.channel_id = p_channel_id
        AND identifier.chat_id = p_chat_id
    ),
    normalized_identifier_matches AS MATERIALIZED (
      SELECT cache.*
      FROM public.comm_whatsapp_chat_identifiers AS identifier
      JOIN cache_rows AS cache
        ON public.normalize_comm_whatsapp_chat_id(cache.contact_id) = identifier.external_chat_id
      WHERE identifier.channel_id = p_channel_id
        AND identifier.chat_id = p_chat_id
        AND NOT EXISTS (SELECT 1 FROM phone_matches)
        AND NOT EXISTS (SELECT 1 FROM direct_identifier_matches)
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
        AND NULLIF(btrim(v_phone_digits), '') IS NOT NULL
        AND public.comm_whatsapp_phone_lookup_keys(cache.phone_digits) && lookup_keys.keys
    ),
    candidates AS (
      SELECT DISTINCT ON (id)
        id,
        display_name,
        updated_at,
        last_synced_at
      FROM (
        SELECT * FROM indexed_matches
        UNION ALL
        SELECT * FROM fallback_matches
      ) AS matches
      WHERE public.comm_whatsapp_is_valid_display_name(matches.display_name)
      ORDER BY id
    )
    SELECT candidates.display_name
    FROM candidates
    ORDER BY candidates.updated_at DESC NULLS LAST, candidates.last_synced_at DESC NULLS LAST, candidates.id DESC
    LIMIT 1
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_preferred_saved_contact_name(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_preferred_saved_contact_name(uuid, uuid, text) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
