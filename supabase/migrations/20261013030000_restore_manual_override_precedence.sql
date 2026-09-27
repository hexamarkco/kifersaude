BEGIN;

-- The manual override flag is the source of truth for contacts saved before
-- the manual: identifier was introduced. Later Inbox migrations kept the
-- older contact_id prefix check in a few final function definitions, so a
-- provider cache row could win again during a message refresh.
DO $migration$
DECLARE
  v_signature text;
  v_definition text;
  v_updated_definition text;
  v_changed boolean := false;
BEGIN
  FOREACH v_signature IN ARRAY ARRAY[
    'public.comm_whatsapp_preferred_saved_contact_name(uuid,uuid,text)',
    'public.comm_whatsapp_list_chats(text,text,text,text,text,text[],text[],integer,integer)',
    'public.comm_whatsapp_refresh_chat_identity(uuid)',
    'public.comm_whatsapp_preserve_saved_contact_display_name()'
  ] LOOP
    SELECT pg_get_functiondef(p.oid)
    INTO v_definition
    FROM pg_proc AS p
    WHERE p.oid = v_signature::regprocedure;

    IF v_definition IS NULL THEN
      RAISE EXCEPTION 'Function % was not found.', v_signature;
    END IF;

    v_updated_definition := replace(
      v_definition,
      'contact.contact_id LIKE ''manual:%'' AS is_manual',
      'public.comm_whatsapp_is_manual_contact_cache_row(contact.manual_override, contact.contact_id) AS is_manual'
    );
    v_updated_definition := replace(
      v_updated_definition,
      'CASE WHEN contact.contact_id LIKE ''manual:%'' THEN 0 ELSE 1 END',
      'CASE WHEN public.comm_whatsapp_is_manual_contact_cache_row(contact.manual_override, contact.contact_id) THEN 0 ELSE 1 END'
    );

    IF v_updated_definition <> v_definition THEN
      EXECUTE v_updated_definition;
      v_changed := true;
    END IF;
  END LOOP;

  IF NOT v_changed THEN
    -- It is valid for a project that already received the corrected function
    -- definitions to need no replacement. The assertion below still makes
    -- this migration fail if the canonical helper disappeared entirely.
    IF NOT EXISTS (
      SELECT 1
      FROM pg_proc AS p
      WHERE p.oid = 'public.comm_whatsapp_preferred_saved_contact_name(uuid,uuid,text)'::regprocedure
        AND pg_get_functiondef(p.oid) ILIKE '%comm_whatsapp_is_manual_contact_cache_row%'
    ) THEN
      RAISE EXCEPTION 'The canonical saved-contact resolver does not use the manual override helper.';
    END IF;
  END IF;
END;
$migration$;

-- Correct already persisted chat identities so the first refresh after this
-- migration cannot emit the old provider name through Realtime.
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
          AND public.comm_whatsapp_is_valid_display_name(contact.display_name)
          AND (
            public.comm_whatsapp_phone_lookup_keys(contact.phone_digits)
              && public.comm_whatsapp_phone_lookup_keys(chat.phone_digits)
            OR EXISTS (
              SELECT 1
              FROM public.comm_whatsapp_chat_identifiers AS identifier
              WHERE identifier.chat_id = chat.id
                AND identifier.channel_id = chat.channel_id
                AND identifier.external_chat_id = public.normalize_comm_whatsapp_chat_id(contact.contact_id)
            )
          )
      )
  LOOP
    PERFORM public.comm_whatsapp_refresh_chat_identity(v_chat_id);
  END LOOP;
END;
$repair$;

NOTIFY pgrst, 'reload schema';

COMMIT;
