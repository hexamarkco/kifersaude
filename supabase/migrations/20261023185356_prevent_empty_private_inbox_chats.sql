BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- Recovery previously created LID chats even when the provider returned no
-- history. Retire only untouched provider observations, preserving UUIDs and
-- identifiers. Real inbound messages can reopen them through existing rules.
-- Names are deliberately irrelevant: matching names cannot prove identity.
CREATE TEMP TABLE empty_observed_lid_chats (chat_id uuid PRIMARY KEY) ON COMMIT DROP;

INSERT INTO empty_observed_lid_chats (chat_id)
SELECT c.id
FROM public.comm_whatsapp_chats c
WHERE c.external_chat_id LIKE '%@lid'
  AND c.merged_into_chat_id IS NULL
  AND c.deleted_at IS NULL
  AND NULLIF(btrim(c.phone_digits), '') IS NULL
  AND NULLIF(btrim(c.phone_number), '') IS NULL
  AND NULLIF(btrim(c.saved_contact_name), '') IS NULL
  AND c.lead_id IS NULL
  AND c.last_message_at IS NULL
  AND NULLIF(btrim(c.last_message_text), '') IS NULL
  AND c.unread_count = 0
  AND NOT c.manual_unread
  AND NOT c.is_pinned
  AND NOT c.is_muted
  AND NOT c.identity_conflict
  AND NOT c.auto_link_blocked
  AND c.status = 'open'
  AND c.autonomous_attendance_status = 'inactive'
  AND EXISTS (
    SELECT 1 FROM public.comm_whatsapp_chat_identifiers i
    WHERE i.chat_id = c.id AND i.channel_id = c.channel_id
      AND i.external_chat_id = c.external_chat_id
      AND i.source = 'provider_observed' AND i.identifier_kind = 'lid'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.comm_whatsapp_chat_identifiers i
    WHERE i.chat_id = c.id AND i.identifier_kind = 'wa_id'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.comm_whatsapp_messages m WHERE m.chat_id = c.id
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.comm_whatsapp_messages_archive m WHERE m.chat_id = c.id
  )
  -- These audit references intentionally have no foreign key.
  AND NOT EXISTS (
    SELECT 1 FROM public.ai_call_logs audit WHERE audit.chat_id = c.id
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.comm_follow_up_audit_log audit
    WHERE audit.chat_id IN (c.id::text, c.external_chat_id)
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.mcp_comm_whatsapp_action_audit audit WHERE audit.chat_id = c.id
  )
FOR UPDATE OF c;

-- Preserve every business reference, including composite FKs and future
-- tables. Only provider identifiers/presence/identity enrichment are metadata.
-- Row locks also serialize concurrent message inserts against this cleanup.
DO $cleanup$
DECLARE
  reference record;
BEGIN
  FOR reference IN
    SELECT DISTINCT ns.nspname AS schema_name, rel.relname AS table_name,
      source_column.attname AS column_name
    FROM pg_constraint fk
    JOIN pg_class rel ON rel.oid = fk.conrelid
    JOIN pg_namespace ns ON ns.oid = rel.relnamespace
    CROSS JOIN LATERAL unnest(fk.conkey, fk.confkey) AS keys(source_key, target_key)
    JOIN pg_attribute source_column ON source_column.attrelid = fk.conrelid
      AND source_column.attnum = keys.source_key
    JOIN pg_attribute target_column ON target_column.attrelid = fk.confrelid
      AND target_column.attnum = keys.target_key
    WHERE fk.contype = 'f'
      AND fk.confrelid = 'public.comm_whatsapp_chats'::regclass
      AND target_column.attname = 'id'
      AND fk.conrelid NOT IN (
        'public.comm_whatsapp_chat_identifiers'::regclass,
        'public.comm_whatsapp_presences'::regclass,
        'public.comm_whatsapp_enrichment_jobs'::regclass
      )
  LOOP
    EXECUTE format(
      'DELETE FROM pg_temp.empty_observed_lid_chats candidate
       WHERE EXISTS (SELECT 1 FROM %I.%I related WHERE related.%I = candidate.chat_id)',
      reference.schema_name, reference.table_name, reference.column_name
    );
  END LOOP;
END;
$cleanup$;

UPDATE public.comm_whatsapp_chats c
SET deleted_at = now(), updated_at = now()
FROM empty_observed_lid_chats candidate
WHERE c.id = candidate.chat_id;

COMMIT;
