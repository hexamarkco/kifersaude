import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'vitest';
import assert from 'node:assert/strict';

const migrationSource = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20261013160000_optimize_inbox_identity_resolution.sql'),
  'utf8',
);

describe('Inbox identity resolution performance contract', () => {
  it('returns persisted names before scanning the contact cache', () => {
    assert.match(migrationSource, /LANGUAGE plpgsql/);
    assert.match(migrationSource, /IF public\.comm_whatsapp_is_valid_display_name\(v_saved_contact_name\)/);
    assert.match(migrationSource, /RETURN v_saved_contact_name;/);
  });

  it('reuses the canonical projection in presence and groups wrappers', () => {
    assert.match(migrationSource, /c\.display_name,/);
    assert.match(migrationSource, /COALESCE\(c\.saved_contact_name, NULLIF\(btrim\(chat\.saved_contact_name\), ''\)\)/);
    assert.doesNotMatch(migrationSource, /SELECT public\.comm_whatsapp_preferred_saved_contact_name\(/);
  });
});
