import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { test } from 'vitest';

const migrationSource = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260927200836_restrict_internal_worker_execute.sql'),
  'utf8',
);

const internalFunctions = [
  'advance_step_dispatch',
  'claim_comm_whatsapp_campaign_targets',
  'claim_comm_whatsapp_enrichment_jobs',
  'complete_ai_autonomous_attendance_handoff',
  'reserve_comm_whatsapp_campaign_dispatch',
  'reserve_comm_whatsapp_campaign_stage_dispatch',
  'reserve_comm_whatsapp_campaign_stage_dispatch_retry',
  'try_acquire_ai_autonomous_reply_lock',
  'upsert_ai_autonomous_qualification_state',
];

test('restringe RPCs internos de workers ao service_role', () => {
  for (const functionName of internalFunctions) {
    assert.match(migrationSource, new RegExp(`REVOKE ALL ON FUNCTION public\\.${functionName}\\(`));
    assert.match(migrationSource, new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${functionName}\\([\\s\\S]*? TO service_role;`));
  }

  assert.doesNotMatch(migrationSource, /GRANT EXECUTE[\s\S]*TO (?:PUBLIC|anon|authenticated)/);
  assert.doesNotMatch(migrationSource, /create_scheduled_message\(/);
  assert.doesNotMatch(migrationSource, /cancel_scheduled_message\(/);
});
