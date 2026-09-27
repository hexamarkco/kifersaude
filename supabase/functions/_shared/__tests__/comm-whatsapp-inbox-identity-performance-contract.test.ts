import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'vitest';
import assert from 'node:assert/strict';

const migrationSource = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20261013160000_optimize_inbox_identity_resolution.sql'),
  'utf8',
);
const lookupMigrationSource = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20261013180000_optimize_saved_contact_lookup_paths.sql'),
  'utf8',
);
const markReadMigrationSource = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20261014020000_optimize_comm_whatsapp_readable_message_counts.sql'),
  'utf8',
);

describe('Inbox identity resolution performance contract', () => {
  it('returns persisted names before scanning the contact cache', () => {
    assert.match(migrationSource, /LANGUAGE plpgsql/);
    assert.match(migrationSource, /IF public\.comm_whatsapp_is_valid_display_name\(v_saved_contact_name\)/);
    assert.match(migrationSource, /RETURN v_saved_contact_name;/);
  });

  it('keeps the common phone lookup on the indexed cache column', () => {
    assert.match(lookupMigrationSource, /contact\.phone_digits = ANY\(lookup_keys\.keys\)/);
    assert.doesNotMatch(lookupMigrationSource, /cache_rows AS MATERIALIZED/);
  });

  it('reuses the canonical projection in presence and groups wrappers', () => {
    assert.match(migrationSource, /c\.display_name,/);
    assert.match(migrationSource, /COALESCE\(c\.saved_contact_name, NULLIF\(btrim\(chat\.saved_contact_name\), ''\)\)/);
    assert.doesNotMatch(migrationSource, /SELECT public\.comm_whatsapp_preferred_saved_contact_name\(/);
  });

  it('indexes only visible inbound messages used by the unread counter', () => {
    assert.match(markReadMigrationSource, /CREATE INDEX IF NOT EXISTS idx_comm_whatsapp_messages_readable_inbound_chat_at/);
    assert.match(markReadMigrationSource, /direction = 'inbound'/);
    assert.match(markReadMigrationSource, /comm_whatsapp_message_preview_text\(media_caption, text_content, message_type\) IS NOT NULL/);
  });
});
