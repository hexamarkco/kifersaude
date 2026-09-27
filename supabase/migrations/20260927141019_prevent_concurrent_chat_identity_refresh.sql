BEGIN;

-- Contact synchronization requests can arrive concurrently while the browser
-- refreshes stale contact data. Only one refresh per channel should walk the
-- affected chats; a duplicate request can return immediately because the
-- caller will observe the same canonical data after the first request ends.
-- A transaction-scoped advisory lock keeps the HTTP contract unchanged and
-- releases automatically on commit or rollback.
CREATE OR REPLACE FUNCTION public.comm_whatsapp_refresh_channel_chat_identities(p_channel_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_chat record;
  v_count integer := 0;
BEGIN
  IF NOT pg_try_advisory_xact_lock(
    hashtextextended(
      'comm_whatsapp_refresh_channel_chat_identities:' || p_channel_id::text,
      0
    )
  ) THEN
    RETURN 0;
  END IF;

  FOR v_chat IN
    SELECT chat.id
    FROM public.comm_whatsapp_chats AS chat
    WHERE chat.channel_id = p_channel_id
      AND chat.merged_into_chat_id IS NULL
      AND (
        NULLIF(btrim(chat.saved_contact_name), '') IS NOT NULL
        OR EXISTS (
          SELECT 1
          FROM public.comm_whatsapp_phone_contacts_cache AS contact
          WHERE contact.channel_id = chat.channel_id
            AND contact.saved = true
            AND contact.phone_digits = ANY(
              public.comm_whatsapp_phone_lookup_keys(
                COALESCE(NULLIF(btrim(chat.phone_digits), ''), NULLIF(btrim(chat.phone_number), ''))
              )
            )
        )
        OR EXISTS (
          SELECT 1
          FROM public.comm_whatsapp_chat_identifiers AS identifier
          JOIN public.comm_whatsapp_phone_contacts_cache AS contact
            ON contact.channel_id = identifier.channel_id
           AND contact.contact_id = identifier.external_chat_id
           AND contact.saved = true
          WHERE identifier.channel_id = chat.channel_id
            AND identifier.chat_id = chat.id
        )
      )
  LOOP
    PERFORM public.comm_whatsapp_refresh_chat_identity(v_chat.id);
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
