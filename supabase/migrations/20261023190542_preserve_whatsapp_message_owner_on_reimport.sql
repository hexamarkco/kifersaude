BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- A history replay can expose an existing message under an unverified LID.
-- Preserve the canonical owner of that exact provider message, instead of
-- moving it to a newly observed chat and stranding the previous chat preview.
-- This routes one message; it does not verify or merge contact identifiers.
DO $migration$
DECLARE
  definition text;
  old_lock text := $old$  PERFORM pg_advisory_xact_lock(
    hashtextextended('comm-whatsapp-identity:' || p_channel_id::text || ':' || v_input_external_chat_id, 0)
  );$old$;
  owner_routing text := $new$  IF NULLIF(btrim(COALESCE(p_external_message_id, '')), '') IS NOT NULL THEN
    -- Serialize concurrent replays even when their external chat ids differ.
    -- The internal INSERT ... ON CONFLICT DO NOTHING remains authoritative.
    PERFORM pg_advisory_xact_lock(hashtextextended(
      'comm-whatsapp-message:' || p_channel_id::text || ':' || btrim(p_external_message_id), 0
    ));

    SELECT chat.external_chat_id, NULLIF(btrim(chat.phone_digits), '')
    INTO v_existing_message_external_chat_id, v_existing_message_phone
    FROM public.comm_whatsapp_messages message
    JOIN public.comm_whatsapp_chats chat
      ON chat.id = public.comm_whatsapp_resolve_chat_uuid(message.chat_id)
      AND chat.channel_id = message.channel_id
    WHERE message.channel_id = p_channel_id
      AND message.external_message_id = btrim(p_external_message_id);

    IF FOUND THEN
      IF v_input_external_chat_id IS DISTINCT FROM v_existing_message_external_chat_id THEN
        p_metadata := COALESCE(p_metadata, '{}'::jsonb) || jsonb_build_object(
          'reimport_observed_chat_id', v_input_external_chat_id
        );
      END IF;
      v_input_external_chat_id := v_existing_message_external_chat_id;
      v_phone_number := v_existing_message_phone;
    END IF;
  END IF;

$new$;
BEGIN
  SELECT replace(pg_get_functiondef(p.oid), chr(13), '') INTO definition
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'comm_whatsapp_persist_message'
    AND p.pronargs = 28;

  IF definition IS NULL
    OR position('  v_result record;' IN definition) = 0
    OR (length(definition) - length(replace(definition, old_lock, ''))) / length(old_lock) <> 1
  THEN
    RAISE EXCEPTION 'Persistencia canonica esperada nao encontrada; nenhuma alteracao aplicada.';
  END IF;

  definition := replace(definition, '  v_result record;', $declarations$  v_result record;
  v_existing_message_external_chat_id text;
  v_existing_message_phone text;$declarations$);
  definition := replace(definition, old_lock, owner_routing || old_lock);
  EXECUTE definition;
END;
$migration$;

NOTIFY pgrst, 'reload schema';
COMMIT;
