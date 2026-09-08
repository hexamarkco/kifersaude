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

test('pipeline normal usa uma única Feature e não chama analysis', () => {
  const normalPipeline = edgeSource.slice(edgeSource.indexOf('// SINGLE-CALL FOLLOW-UP'));
  assert.equal((normalPipeline.match(/generateTextForFeature\(\{/g) ?? []).length, 1);
  assert.match(normalPipeline, /featureKey: AI_FEATURES\.FOLLOWUP_GENERATE/);
  assert.doesNotMatch(normalPipeline, /FOLLOWUP_ANALYSIS|followup\.analysis|buildAnalysisUserPrompt/);
});

test('pipeline limita o provider a uma chamada normal e um retry técnico', () => {
  assert.match(edgeSource, /maxAttempts: 2/);
  assert.match(edgeSource, /maxProviderRequestsPerAttempt: 1/);
  assert.match(edgeSource, /retrySameResolvedModel: true/);
  assert.match(edgeSource, /validateOutput: validateFollowUpTechnicalOutput/);
});

test('não há validator por IA, regeneration por qualidade ou JSON comercial no caminho normal', () => {
  const normalPipeline = edgeSource.slice(edgeSource.indexOf('// SINGLE-CALL FOLLOW-UP'));
  assert.doesNotMatch(normalPipeline, /validateCommercialMessage|formatValidationFeedback/);
  assert.doesNotMatch(normalPipeline, /parseFollowUpGenerationResult|validationFeedback/);
  assert.doesNotMatch(normalPipeline, /upsert_commercial_state/);
  assert.match(normalPipeline, /v3_analysis: null/);
  assert.match(normalPipeline, /v3_strategy: null/);
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

test('UI não oferece geração automática de múltiplas versões', () => {
  assert.doesNotMatch(batchModalSource, /variantCount|3 opções/);
});

test('followup.refine continua manual e em uma única chamada própria', () => {
  const refinementStart = edgeSource.indexOf('// REFINEMENT MODE');
  const normalStart = edgeSource.indexOf('// SINGLE-CALL FOLLOW-UP');
  const refinementPipeline = edgeSource.slice(refinementStart, normalStart);

  assert.equal((refinementPipeline.match(/generateTextForFeature\(\{/g) ?? []).length, 1);
  assert.match(refinementPipeline, /featureKey: 'followup\.refine'/);
  assert.match(refinementPipeline, /Mensagem atual a refinar/);
  assert.match(refinementPipeline, /Ajuste solicitado/);
});
