import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'vitest';

const migrationSource = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20261009010000_rebuild_autonomous_qualification_state.sql'),
  'utf8',
);
const workerSource = readFileSync(
  resolve(process.cwd(), 'supabase/functions/ai-autonomous-reply-worker/index.ts'),
  'utf8',
);
const webhookSource = readFileSync(
  resolve(process.cwd(), 'supabase/functions/comm-whatsapp-webhook/index.ts'),
  'utf8',
);
const qualificationSource = readFileSync(
  resolve(process.cwd(), 'supabase/functions/_shared/ai-autonomous-qualification.ts'),
  'utf8',
);

test('qualification state is persisted and exposes deterministic decision data', () => {
  assert.match(migrationSource, /ai_autonomous_qualification_states/);
  assert.match(migrationSource, /upsert_ai_autonomous_qualification_state/);
  assert.match(qualificationSource, /missingRequiredFields/);
  assert.match(workerSource, /extractAutonomousQualificationState/);
  assert.match(workerSource, /persistQualificationState/);
  assert.match(workerSource, /buildQualificationDecisionPrompt/);
});

test('commercial status blocks autonomous reactivation and scheduling', () => {
  assert.match(migrationSource, /ai_lead_is_waiting_for_quote/);
  assert.match(migrationSource, /O atendimento autonomo nao pode ser reativado/);
  assert.match(migrationSource, /autonomous_attendance_status = 'handed_off'/);
  assert.match(webhookSource, /schedule_ai_autonomous_reply_job/);
});

test('same conversation has a lease and outbound delivery key before sending', () => {
  assert.match(migrationSource, /ai_autonomous_reply_locks/);
  assert.match(migrationSource, /try_acquire_ai_autonomous_reply_lock/);
  assert.match(migrationSource, /ai_autonomous_reply_delivery_keys/);
  assert.match(migrationSource, /claim_ai_autonomous_reply_delivery_key/);
  assert.match(workerSource, /try_acquire_ai_autonomous_reply_lock/);
  assert.match(workerSource, /claim_ai_autonomous_reply_delivery_key/);
  assert.match(workerSource, /release_ai_autonomous_reply_lock/);
  assert.match(workerSource, /finally/);
});
