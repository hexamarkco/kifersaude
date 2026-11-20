BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

-- Do not infer that an unverified LID belongs to a phone contact.
-- Some Whapi outbound echoes contain a different external message ID while
-- retaining a stable provider message prefix. Route only the exact mirrored
-- message, never the LID identity, to the phone chat.
DO $migration$
DECLARE
  definition text;
  lock_anchor text := $anchor$  PERFORM pg_advisory_xact_lock(
    hashtextextended('comm-whatsapp-identity:' || p_channel_id::text || ':' || v_input_external_chat_id, 0)
  );$anchor$;
  echo_block text := $echo$  -- Match a provider echo by its message prefix, content, second-level
  -- timestamp, channel and direction. No names or telephone guesses.
  IF v_input_external_chat_id ~* '@lid$'
     AND v_direction = 'outbound'
     AND COALESCE(p_message_type, '') = 'text'
     AND length(COALESCE(p_text_content, '')) >= 12
     AND p_last_message_at IS NOT NULL
     AND position('-' IN COALESCE(p_external_message_id, '')) > 12
  THEN
    v_echo_prefix := split_part(btrim(p_external_message_id), '-', 1);
    SELECT count(*), min(m.id::text)::uuid, min(m.chat_id::text)::uuid,
           min(m.external_message_id)
    INTO v_echo_count, v_echo_message_id, v_echo_chat_id,
         v_echo_external_message_id
    FROM public.comm_whatsapp_messages m
    JOIN public.comm_whatsapp_chats c ON c.id = m.chat_id
    WHERE m.channel_id = p_channel_id
      AND c.channel_id = p_channel_id
      AND c.external_chat_id LIKE '%@s.whatsapp.net'
      AND c.deleted_at IS NULL
      AND c.merged_into_chat_id IS NULL
      AND m.direction = 'outbound'
      AND m.message_type = 'text'
      AND m.text_content = p_text_content
      AND m.message_at BETWEEN p_last_message_at - interval '2 seconds'
                           AND p_last_message_at + interval '2 seconds'
      AND split_part(m.external_message_id, '-', 1) = v_echo_prefix;

    IF v_echo_count = 1 THEN
      -- Existing canonical phone message remains the owner. Whapi's raw
      -- webhook event and receipt retain the observed LID ID for audit.
      PERFORM public.comm_whatsapp_update_message_status(
        p_channel_id, v_echo_external_message_id, p_delivery_status,
        COALESCE(p_status_updated_at, p_last_message_at), p_error_message
      );
      SELECT c.unread_count INTO v_echo_unread_count
      FROM public.comm_whatsapp_chats c WHERE c.id = v_echo_chat_id;
      RETURN QUERY SELECT v_echo_chat_id, v_echo_message_id, false,
                          COALESCE(v_echo_unread_count, 0), true;
      RETURN;
    END IF;
  END IF;

$echo$;
BEGIN
  SELECT replace(pg_get_functiondef(p.oid), chr(13), '') INTO definition
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'comm_whatsapp_persist_message'
    AND p.pronargs = 28;

  IF definition IS NULL OR position('v_echo_count bigint;' IN definition) > 0
    OR position('  v_existing_message_phone text;' IN definition) = 0
    OR (length(definition) - length(replace(definition, lock_anchor, ''))) / length(lock_anchor) <> 1
  THEN
    RAISE EXCEPTION 'Canonical WhatsApp persistence signature changed; aborting safely.';
  END IF;

  definition := replace(definition,
    '  v_existing_message_phone text;',
    '  v_existing_message_phone text;' || E'\n' ||
    '  v_echo_count bigint;' || E'\n' ||
    '  v_echo_message_id uuid;' || E'\n' ||
    '  v_echo_chat_id uuid;' || E'\n' ||
    '  v_echo_external_message_id text;' || E'\n' ||
    '  v_echo_prefix text;' || E'\n' ||
    '  v_echo_unread_count integer;'
  );
  definition := replace(definition, lock_anchor, echo_block || lock_anchor);
  EXECUTE definition;
END;
$migration$;

-- One-time reconciliation: only exact, unique outbound message mirrors.
-- Source rows are preserved, and no WhatsApp contact identity is merged.
CREATE TEMP TABLE kifer_whapi_lid_echo_pairs ON COMMIT DROP AS
SELECT
  lid.id AS lid_chat_id,
  lm.id AS lid_message_id,
  lm.channel_id,
  matches.phone_message_id,
  matches.phone_chat_id,
  matches.phone_external_message_id,
  lm.delivery_status AS echo_delivery_status,
  lm.status_updated_at AS echo_status_at
FROM public.comm_whatsapp_chats lid
JOIN public.comm_whatsapp_messages lm ON lm.chat_id = lid.id
JOIN LATERAL (
  SELECT count(*) AS candidate_count,
         min(pm.id::text)::uuid AS phone_message_id,
         min(pm.chat_id::text)::uuid AS phone_chat_id,
         min(pm.external_message_id) AS phone_external_message_id
  FROM public.comm_whatsapp_messages pm
  JOIN public.comm_whatsapp_chats pc ON pc.id = pm.chat_id
  WHERE pm.channel_id = lm.channel_id
    AND pc.channel_id = lid.channel_id
    AND pc.id <> lid.id
    AND pc.external_chat_id LIKE '%@s.whatsapp.net'
    AND pc.deleted_at IS NULL
    AND pc.merged_into_chat_id IS NULL
    AND pm.direction = 'outbound'
    AND pm.message_type = 'text'
    AND pm.text_content = lm.text_content
    AND pm.message_at BETWEEN lm.message_at - interval '2 seconds'
                          AND lm.message_at + interval '2 seconds'
    AND split_part(pm.external_message_id, '-', 1) = split_part(lm.external_message_id, '-', 1)
) matches ON matches.candidate_count = 1
WHERE lid.external_chat_id LIKE '%@lid'
  AND lid.display_name = 'Contato privado'
  AND lid.deleted_at IS NULL
  AND lid.merged_into_chat_id IS NULL
  AND lm.direction = 'outbound'
  AND lm.message_type = 'text'
  AND length(COALESCE(lm.text_content, '')) >= 12
  AND position('-' IN COALESCE(lm.external_message_id, '')) > 12;

-- Status updates respect the existing monotonic status transition RPC.
DO $statuses$
DECLARE
  matched record;
BEGIN
  FOR matched IN
    SELECT DISTINCT channel_id, phone_external_message_id,
           echo_delivery_status, echo_status_at
    FROM pg_temp.kifer_whapi_lid_echo_pairs
    WHERE echo_delivery_status IS NOT NULL
  LOOP
    PERFORM public.comm_whatsapp_update_message_status(
      matched.channel_id, matched.phone_external_message_id,
      matched.echo_delivery_status, matched.echo_status_at, NULL
    );
  END LOOP;
END;
$statuses$;

-- A LID chat consisting entirely of copies from one phone chat, without
-- unread/pinned/commercial/conflict state, is archived rather than deleted.
-- Genuine unresolved or mixed conversations stay accessible as before.
UPDATE public.comm_whatsapp_chats lid
SET is_archived = true,
    archived_at = COALESCE(lid.archived_at, now()),
    updated_at = now()
WHERE lid.external_chat_id LIKE '%@lid'
  AND lid.display_name = 'Contato privado'
  AND lid.deleted_at IS NULL
  AND lid.merged_into_chat_id IS NULL
  AND lid.is_archived IS NOT TRUE
  AND lid.lead_id IS NULL
  AND lid.identity_conflict IS NOT TRUE
  AND COALESCE(lid.unread_count, 0) = 0
  AND lid.manual_unread IS NOT TRUE
  AND lid.is_pinned IS NOT TRUE
  AND EXISTS (
    SELECT 1 FROM pg_temp.kifer_whapi_lid_echo_pairs p
    WHERE p.lid_chat_id = lid.id
    GROUP BY p.lid_chat_id HAVING count(DISTINCT p.phone_chat_id) = 1
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.comm_whatsapp_messages lm
    WHERE lm.chat_id = lid.id
      AND NOT EXISTS (
        SELECT 1 FROM pg_temp.kifer_whapi_lid_echo_pairs p
        WHERE p.lid_message_id = lm.id
      )
  );

NOTIFY pgrst, 'reload schema';
COMMIT;