import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { test } from 'vitest';

const migrationSource = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260927195642_restrict_comm_whatsapp_anon_execute.sql'),
  'utf8',
);

test('remove a execução anônima dos RPCs SECURITY DEFINER do WhatsApp', () => {
  assert.match(migrationSource, /p\.proname LIKE 'comm_whatsapp%'/);
  assert.match(migrationSource, /REVOKE EXECUTE ON FUNCTION public\.%I\(%s\) FROM PUBLIC, anon/);
  assert.doesNotMatch(migrationSource, /GRANT EXECUTE[\s\S]*TO anon/);
});
