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
const reasoningBudgetMigrationSource = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20261007011000_raise_follow_up_reasoning_budget.sql'),
  'utf8',
);

test('pipeline normal usa geração e validação por IA na mesma Feature', () => {
  const normalPipeline = edgeSource.slice(edgeSource.indexOf('// TWO-STAGE FOLLOW-UP'));
  assert.equal((normalPipeline.match(/generateTextForFeature\(\{/g) ?? []).length, 2);
  assert.match(normalPipeline, /featureKey: AI_FEATURES\.FOLLOWUP_GENERATE/);
  assert.match(normalPipeline, /FOLLOW_UP_AI_VALIDATOR_SYSTEM_PROMPT/);
  assert.doesNotMatch(normalPipeline, /FOLLOWUP_ANALYSIS|followup\.analysis|buildAnalysisUserPrompt/);
});

test('cada etapa limita provider e mantém retry apenas para contrato técnico', () => {
  assert.match(edgeSource, /maxAttempts: 2/);
  assert.match(edgeSource, /maxProviderRequestsPerAttempt: 1/);
  assert.match(edgeSource, /retrySameResolvedModel: true/);
  assert.match(edgeSource, /validateOutput: validateFollowUpStructuralOutput/);
  assert.match(edgeSource, /validateOutput: validateFollowUpAiValidationOutput/);
  assert.match(edgeSource, /buildValidationRetryInstruction: buildFollowUpStructuralRetryInstruction/);
  assert.match(edgeSource, /buildValidationRetryInstruction: buildFollowUpAiValidationRetryInstruction/);
});

test('julgamento comercial é feito pela IA e não por padrões semânticos locais', () => {
  const normalPipeline = edgeSource.slice(edgeSource.indexOf('// TWO-STAGE FOLLOW-UP'));
  assert.match(normalPipeline, /parseFollowUpAiValidationOutput/);
  assert.match(normalPipeline, /aiValidation\.decision === 'rewrite'/);
  assert.match(normalPipeline, /aiValidation\.decision === 'approve'/);
  assert.doesNotMatch(normalPipeline, /validateCommercialMessage|validateFollowUpBusinessOutput/);
  assert.doesNotMatch(normalPipeline, /upsert_commercial_state/);
  assert.match(normalPipeline, /v3_analysis: null/);
  assert.match(normalPipeline, /v3_strategy: null/);
  assert.match(normalPipeline, /validator: 'ai'/);
});

test('pipeline pode aguardar sem gerar contato social e reserva orçamento para raciocínio', () => {
  const normalPipeline = edgeSource.slice(edgeSource.indexOf('// TWO-STAGE FOLLOW-UP'));
  assert.match(normalPipeline, /FOLLOW_UP_RUNTIME_GUARDRAILS/);
  assert.match(normalPipeline, /parseFollowUpOutput/);
  assert.match(normalPipeline, /currentAction: waitAiContext \? 'wait' : 'send'/);
  assert.match(normalPipeline, /FOLLOW_UP_GENERATE_MIN_OUTPUT_TOKENS/);
  assert.match(normalPipeline, /FINAL_LEAD_STATUSES\.has\(normalizedLeadStatus\)/);
  assert.doesNotMatch(normalPipeline, /EMOTIONAL_CONTEXT_INSTRUCTION/);
  assert.match(reasoningBudgetMigrationSource, /max_output_tokens, 0\), 1600/);
  assert.match(reasoningBudgetMigrationSource, /v_current\.max_output_tokens, 0\) >= 1600/);
});

test('esperas dependentes de fato novo não criam reagendamento automático por passagem do tempo', () => {
  assert.match(edgeSource, /EVENT_DRIVEN_WAIT_REASONS/);
  assert.match(edgeSource, /'personal_context'/);
  assert.match(edgeSource, /'seller_action_pending'/);
  assert.match(edgeSource, /'no_useful_move'/);
  assert.match(edgeSource, /suggestedDateTime: null/);
  assert.match(edgeSource, /Não criar uma nova cobrança apenas pela passagem do tempo/);
  assert.doesNotMatch(edgeSource, /WAIT_COOLDOWN_BUSINESS_DAYS/);
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
  const normalStart = edgeSource.indexOf('// TWO-STAGE FOLLOW-UP');
  const refinementPipeline = edgeSource.slice(refinementStart, normalStart);

  assert.equal((refinementPipeline.match(/generateTextForFeature\(\{/g) ?? []).length, 1);
  assert.match(refinementPipeline, /featureKey: 'followup\.refine'/);
  assert.match(refinementPipeline, /Mensagem atual a refinar/);
  assert.match(refinementPipeline, /Ajuste solicitado/);
});

test('modo interno de simulação exige service role e não grava auditoria comercial', () => {
  assert.match(edgeSource, /body\.simulationMode === true/);
  assert.match(edgeSource, /isServiceRoleRequest\(req, serviceRoleKey\)/);
  assert.match(edgeSource, /if \(chat\.lead_id && !isInternalSimulation\)/);
  assert.match(edgeSource, /simulationValidation: isInternalSimulation/);
});
