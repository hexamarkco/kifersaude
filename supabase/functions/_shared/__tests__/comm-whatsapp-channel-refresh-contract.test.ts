import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'vitest';
import assert from 'node:assert/strict';

const migrationSource = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20261013170000_skip_redundant_channel_identity_refresh.sql'),
  'utf8',
);

describe('channel identity refresh contract', () => {
  it('does not refresh chats that already have a valid persisted name', () => {
    assert.match(
      migrationSource,
      /AND NOT public\.comm_whatsapp_is_valid_display_name\(chat\.saved_contact_name\)/,
    );
    assert.match(migrationSource, /public\.comm_whatsapp_refresh_chat_identity\(v_chat\.id\)/);
  });

  it('keeps refresh serialization and service-role-only access', () => {
    assert.match(migrationSource, /pg_try_advisory_xact_lock/);
    assert.match(
      migrationSource,
      /GRANT EXECUTE ON FUNCTION public\.comm_whatsapp_refresh_channel_chat_identities\(uuid\) TO service_role/,
    );
    assert.doesNotMatch(
      migrationSource,
      /GRANT EXECUTE ON FUNCTION public\.comm_whatsapp_refresh_channel_chat_identities\(uuid\).*authenticated/,
    );
  });
});
