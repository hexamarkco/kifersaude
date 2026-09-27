BEGIN;

-- A full contact synchronization used to refresh every chat in the channel.
-- That made the canonical name resolver run once per historical chat and the
-- 15-second PostgREST timeout could abort the whole synchronization (and make
-- the Inbox list fail at the same time). The contact cache and the denormalized
-- chat name only need a refresh for chats that can actually be affected:
-- chats with a saved name, a matching saved cache row, or a saved identifier.
-- The Inbox projections still resolve the canonical name on read, so chats
-- outside this candidate set keep their existing behavior without paying the
-- cost of a full-channel refresh.
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
