import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'vitest';

const edgeSource = readFileSync(
  resolve(process.cwd(), 'supabase/functions/comm-whatsapp-generate-follow-up/index.ts'),
  'utf8',
);
const batchModalSource = readFileSync(
  resolve(process.cwd(), 'src/features/communication/whatsapp/components/WhatsAppBatchFollowUpModal.tsx'),
  'utf8',
);
const migrationSource = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20261001002000_add_follow_up_v2_audit_and_reminder_provenance.sql'),
  'utf8',
);

test('V2 aceita wait sem texto e não cria variações', () => {
  assert.match(edgeSource, /currentAction === 'wait' \|\| Boolean\(result\.text\)/);
  assert.match(edgeSource, /if \(aiContext\?\.currentAction === 'wait'\) \{\s+variations = \[\];\s+responseText = '';/s);
  assert.match(batchModalSource, /it\.currentAction === 'send'/);
});

test('V2 protege outbound recente e não reintroduz exemplos literais de estilo', () => {
  assert.match(edgeSource, /RECENT_OUTBOUND_WAIT_MS = 12 \* 60 \* 60 \* 1000/);
  assert.match(edgeSource, /hasRecentOutboundWithoutInbound\(messages, now\) && !customInstructions/);
  assert.doesNotMatch(edgeSource, /buildStyleExamples/);
  assert.doesNotMatch(edgeSource, /EXEMPLOS REAIS DO SEU ESTILO/);
});

test('V2 faz retry único quando repete função comercial sem inbound', () => {
  assert.match(edgeSource, /getLastUnansweredCommercialFunction/);
  assert.match(edgeSource, /funcao comercial repetida sem resposta/);
  assert.match(edgeSource, /FollowUpValidationError/);
});

test('V2 persiste proveniência, textos e aprovação de reminder', () => {
  for (const column of [
    'source_reminder_id',
    'commercial_function',
    'generated_text',
    'sent_text',
    'sent_at_actual',
    'created_reminder_id',
    'follow_up_generation_id',
  ]) {
    assert.match(migrationSource, new RegExp(column));
  }
  assert.match(migrationSource, /schedule_follow_up_reminder_v2/);
  assert.match(batchModalSource, /approvedScheduleAction/);
});
