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

test('historico completo orienta a qualificacao e o parser nao decide o proximo turno', () => {
  assert.match(migrationSource, /ai_autonomous_qualification_states/);
  assert.match(migrationSource, /upsert_ai_autonomous_qualification_state/);
  assert.match(workerSource, /buildAutonomousAttendanceUserPrompt/);
  assert.match(workerSource, /buildAutonomousAttendanceUserPrompt\(history/);
  assert.doesNotMatch(workerSource, /extractAutonomousQualificationState/);
  assert.doesNotMatch(workerSource, /persistQualificationState/);
  assert.doesNotMatch(workerSource, /qualification_decision/);
});

test('commercial status blocks autonomous reactivation and scheduling', () => {
  assert.match(migrationSource, /ai_lead_is_waiting_for_quote/);
  assert.match(migrationSource, /O atendimento autonomo nao pode ser reativado/);
  assert.match(migrationSource, /autonomous_attendance_status = 'handed_off'/);
  assert.match(webhookSource, /schedule_ai_autonomous_reply_job/);
});

test('webhook waits sixteen seconds to group inbound messages before replying', () => {
  assert.match(webhookSource, /const AI_AUTONOMOUS_REPLY_DEBOUNCE_SECONDS = 16;/);
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
