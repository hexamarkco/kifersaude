import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'vitest';

const promptMigrationSource = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20261007004000_add_under_12_autonomous_attendance_rule.sql'),
  'utf8',
);
const handoffMigrationSource = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20261007005000_complete_autonomous_attendance_handoff.sql'),
  'utf8',
);
const handoffFixMigrationSource = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20261007012000_fix_autonomous_handoff_chat_id_ambiguity.sql'),
  'utf8',
);
const attendanceMigrationSource = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20261007006000_move_autonomous_reply_to_attendance.sql'),
  'utf8',
);
const workerSource = readFileSync(
  resolve(process.cwd(), 'supabase/functions/ai-autonomous-reply-worker/index.ts'),
  'utf8',
);

test('quotation completion requires a terminal QUALIFICACAO_COMPLETA handoff tag', () => {
  assert.match(promptMigrationSource, /ENCERRAMENTO PARA COTAÇÃO — HANDOFF OBRIGATÓRIO/);
  assert.match(promptMigrationSource, /\[\[HANDOFF: QUALIFICACAO_COMPLETA \| cotação encaminhada para atendimento manual\]\]/);
  assert.match(promptMigrationSource, /Não faça nova pergunta, não continue a conversa depois disso/);
});

test('qualification handoff atomically disables the attendant and moves the lead to Aguardando cotação', () => {
  assert.match(handoffMigrationSource, /complete_ai_autonomous_attendance_handoff/);
  assert.match(handoffMigrationSource, /WHEN 'QUALIFICACAO_COMPLETA' THEN 'Aguardando cotação'/);
  assert.match(handoffMigrationSource, /autonomous_attendance_status = 'handed_off'/);
  assert.match(handoffMigrationSource, /status = 'cancelled'/);
  assert.match(workerSource, /completeAutonomousAttendanceHandoff/);
  assert.doesNotMatch(workerSource, /\.update\(\{ autonomous_attendance_status: 'handed_off' \}\)/);
});

test('handoff reply-job predicates qualify chat_id to avoid PL/pgSQL output-column ambiguity', () => {
  assert.match(handoffFixMigrationSource, /UPDATE public\.ai_autonomous_reply_jobs AS jobs/);
  assert.match(handoffFixMigrationSource, /WHERE jobs\.chat_id = v_chat_id/);
  assert.doesNotMatch(handoffFixMigrationSource, /WHERE chat_id = v_chat_id/);
  assert.match(handoffFixMigrationSource, /autonomous_attendance_status = 'handed_off'/);
});

test('the first autonomous reply moves only Contato Inicial to Atendimento before sending', () => {
  assert.match(attendanceMigrationSource, /prepare_ai_autonomous_attendance_reply/);
  assert.match(attendanceMigrationSource, /lower\(trim\(nome\)\) = 'contato inicial'/);
  assert.match(attendanceMigrationSource, /lower\(trim\(nome\)\) = 'atendimento'/);
  assert.match(attendanceMigrationSource, /v_current_status_id IS DISTINCT FROM v_contact_initial_status_id THEN/);

  const sendStart = workerSource.indexOf('for (let i = 0; i < messages.length; i++)');
  const preSendSource = workerSource.slice(Math.max(0, sendStart - 1800), sendStart);
  assert.match(preSendSource, /const replyPreparation = await prepareAutonomousAttendanceReply/);
});

test('the worker discards an answer if the customer writes again while the model generates it', () => {
  const generatedResponseIndex = workerSource.indexOf("console.log('[ai-autonomous-reply-worker] resposta gerada'");
  const staleReplyCheckIndex = workerSource.indexOf('hasNewInboundMessageSincePrompt', generatedResponseIndex);
  const sendLoopIndex = workerSource.indexOf('for (let i = 0; i < messages.length; i++)');

  assert.ok(generatedResponseIndex >= 0);
  assert.ok(staleReplyCheckIndex > generatedResponseIndex);
  assert.ok(sendLoopIndex > staleReplyCheckIndex);
  assert.match(workerSource, /cancelStaleAutonomousReplyJob/);
  assert.match(workerSource, /order\('created_at', \{ ascending: false \}\)/);
});
