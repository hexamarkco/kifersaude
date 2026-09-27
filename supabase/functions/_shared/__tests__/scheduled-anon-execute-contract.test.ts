import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { test } from 'vitest';

const migrationSource = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260927201041_restrict_scheduled_anon_execute.sql'),
  'utf8',
);

const scheduledFunctions = [
  'cancel_scheduled_message',
  'schedule_follow_up_reminder',
  'schedule_follow_up_reminder_v2',
];

test('mantém ações de agenda autenticadas e bloqueia chamadas anônimas', () => {
  for (const functionName of scheduledFunctions) {
    assert.match(migrationSource, new RegExp(`REVOKE EXECUTE ON FUNCTION public\\.${functionName}\\(`));
    assert.match(migrationSource, new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${functionName}\\([\\s\\S]*? TO authenticated, service_role;`));
  }

  assert.doesNotMatch(migrationSource, /GRANT EXECUTE[\s\S]*TO (?:PUBLIC|anon)/);
});
