BEGIN;

-- Older saved contacts can carry the provider contact_id while the explicit
-- manual_override flag and manual_override_name already identify the operator
-- decision. Every Inbox projection must use that decision before provider
-- metadata, including rows created before the manual: identifier existed.
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
  WITH lookup_keys AS MATERIALIZED (
    SELECT public.comm_whatsapp_phone_lookup_keys(p_phone_digits) AS keys
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
      AND NULLIF(btrim(p_phone_digits), '') IS NOT NULL
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
  )
  SELECT candidates.display_name
  FROM candidates
  ORDER BY
    candidates.is_manual DESC,
    candidates.updated_at DESC,
    candidates.last_synced_at DESC,
    candidates.id DESC
  LIMIT 1;
$function$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_preferred_saved_contact_name(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_preferred_saved_contact_name(uuid, uuid, text) TO authenticated, service_role;

-- Realtime updates can arrive from the provider with a newer display_name.
-- Resolve the effective name from manual_override_name before publishing the
-- chat identity, so a provider refresh cannot make the old name reappear.
CREATE OR REPLACE FUNCTION public.comm_whatsapp_preserve_saved_contact_display_name()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_saved_contact_name text;
  v_phone_lookup_value text;
BEGIN
  IF COALESCE(NEW.is_group, false) THEN
    RETURN NEW;
  END IF;

  v_phone_lookup_value := COALESCE(
    NULLIF(btrim(NEW.phone_digits), ''),
    NULLIF(btrim(NEW.phone_number), ''),
    NULLIF(btrim(OLD.phone_digits), ''),
    NULLIF(btrim(OLD.phone_number), '')
  );

  SELECT CASE
    WHEN public.comm_whatsapp_is_manual_contact_cache_row(contact.manual_override, contact.contact_id)
      THEN COALESCE(NULLIF(btrim(contact.manual_override_name), ''), NULLIF(btrim(contact.display_name), ''))
    ELSE NULLIF(btrim(contact.display_name), '')
  END
  INTO v_saved_contact_name
  FROM public.comm_whatsapp_phone_contacts_cache AS contact
  WHERE contact.channel_id = NEW.channel_id
    AND contact.saved = true
    AND public.comm_whatsapp_is_valid_display_name(
      CASE
        WHEN public.comm_whatsapp_is_manual_contact_cache_row(contact.manual_override, contact.contact_id)
          THEN COALESCE(NULLIF(btrim(contact.manual_override_name), ''), NULLIF(btrim(contact.display_name), ''))
        ELSE NULLIF(btrim(contact.display_name), '')
      END
    )
    AND public.comm_whatsapp_phone_lookup_keys(COALESCE(contact.phone_digits, contact.phone_number))
      && public.comm_whatsapp_phone_lookup_keys(v_phone_lookup_value)
  ORDER BY
    public.comm_whatsapp_is_manual_contact_cache_row(contact.manual_override, contact.contact_id) DESC,
    contact.updated_at DESC,
    contact.last_synced_at DESC,
    contact.id DESC
  LIMIT 1;

  v_saved_contact_name := COALESCE(
    v_saved_contact_name,
    NULLIF(btrim(OLD.saved_contact_name), ''),
    NULLIF(btrim(NEW.saved_contact_name), '')
  );

  IF v_saved_contact_name IS NOT NULL THEN
    NEW.saved_contact_name := v_saved_contact_name;
    NEW.display_name := v_saved_contact_name;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_comm_whatsapp_preserve_saved_contact_display_name
  ON public.comm_whatsapp_chats;

CREATE TRIGGER trg_comm_whatsapp_preserve_saved_contact_display_name
  BEFORE UPDATE OF display_name, saved_contact_name, push_name
  ON public.comm_whatsapp_chats
  FOR EACH ROW
  EXECUTE FUNCTION public.comm_whatsapp_preserve_saved_contact_display_name();

-- Keep the compatibility list path aligned with the canonical resolver. The
-- presence-aware path already calls the resolver directly; this patch covers
-- deployments that temporarily use the groups compatibility function.
DO $migration$
DECLARE
  v_definition text;
  v_updated_definition text;
BEGIN
  SELECT pg_get_functiondef(p.oid)
  INTO v_definition
  FROM pg_proc AS p
  WHERE p.oid = 'public.comm_whatsapp_list_chats(text,text,text,text,text,text[],text[],integer,integer)'::regprocedure;

  IF v_definition IS NULL THEN
    RAISE EXCEPTION 'Funcao comm_whatsapp_list_chats/9 nao encontrada.';
  END IF;

  v_updated_definition := replace(
    v_definition,
    $old$NULLIF(btrim(contact.display_name), '') AS display_name$old$,
    $new$CASE
      WHEN public.comm_whatsapp_is_manual_contact_cache_row(contact.manual_override, contact.contact_id)
        THEN COALESCE(NULLIF(btrim(contact.manual_override_name), ''), NULLIF(btrim(contact.display_name), ''))
      ELSE NULLIF(btrim(contact.display_name), '')
    END AS display_name$new$
  );

  IF v_updated_definition = v_definition THEN
    RAISE EXCEPTION 'Nao foi possivel alinhar a identidade manual em comm_whatsapp_list_chats.';
  END IF;

  EXECUTE v_updated_definition;
END;
$migration$;

-- Recalculate existing chat rows once so the corrected resolver is reflected
-- immediately in the table and in the next Realtime event.
DO $repair$
DECLARE
  v_chat_id uuid;
BEGIN
  FOR v_chat_id IN
    SELECT chat.id
    FROM public.comm_whatsapp_chats AS chat
    WHERE COALESCE(chat.is_group, false) = false
      AND chat.deleted_at IS NULL
      AND chat.merged_into_chat_id IS NULL
      AND EXISTS (
        SELECT 1
        FROM public.comm_whatsapp_phone_contacts_cache AS contact
        WHERE contact.channel_id = chat.channel_id
          AND contact.saved = true
          AND public.comm_whatsapp_phone_lookup_keys(COALESCE(contact.phone_digits, contact.phone_number))
            && public.comm_whatsapp_phone_lookup_keys(COALESCE(chat.phone_digits, chat.phone_number))
      )
  LOOP
    PERFORM public.comm_whatsapp_refresh_chat_identity(v_chat_id);
  END LOOP;
END;
$repair$;

NOTIFY pgrst, 'reload schema';

COMMIT;
