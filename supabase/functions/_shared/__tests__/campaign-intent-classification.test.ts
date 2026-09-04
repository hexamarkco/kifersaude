import assert from 'node:assert/strict';
import { test } from 'vitest';

// ============================================================
// Contract: normalizeClassification + deriveRecommendedAction
// These functions are tested in isolation (no DB, no AI).
// They mirror the logic in comm-whatsapp-campaign-worker/index.ts.
// ============================================================

const CONTACT_PERMISSIONS = new Set([
  'OPT_OUT_EXPLICITO', 'NUMERO_ERRADO', 'DESTINATARIO_INCORRETO',
  'RECLAMACAO_CONTATO', 'AMBIGUO', 'NENHUM_SINAL',
]);
const COMMERCIAL_INTENTS = new Set([
  'JA_POSSUI_PLANO', 'INTERESSADO', 'SEM_INTERESSE',
  'QUER_SABER_MAIS', 'ADIAR_CONTATO', 'OUTRO',
]);

function deriveRecommendedAction(cp: string): string {
  switch (cp) {
    case 'OPT_OUT_EXPLICITO':
    case 'NUMERO_ERRADO':
    case 'DESTINATARIO_INCORRETO':
    case 'RECLAMACAO_CONTATO':
      return 'suggest_block_whatsapp_campaigns';
    case 'AMBIGUO':
      return 'review';
    case 'NENHUM_SINAL':
    default:
      return 'keep_active';
  }
}

function mapContactPermissionToLegacyIntent(cp: string, ci: string): string {
  if (cp === 'OPT_OUT_EXPLICITO') return 'opt_out';
  if (cp === 'NUMERO_ERRADO' || cp === 'DESTINATARIO_INCORRETO') return 'wrong_number';
  if (cp === 'RECLAMACAO_CONTATO') return 'angry_or_complaint';
  if (cp === 'AMBIGUO') return 'unclear';
  if (ci === 'SEM_INTERESSE') return 'negative_interest';
  return 'continue_conversation';
}

function normalizeClassification(value: Record<string, unknown>) {
  const rawContactPermission = typeof value.contact_permission === 'string' ? value.contact_permission.trim() : '';
  const rawCommercialIntent = typeof value.commercial_intent === 'string' ? value.commercial_intent.trim() : '';

  const contact_permission = CONTACT_PERMISSIONS.has(rawContactPermission) ? rawContactPermission : 'NENHUM_SINAL';
  const commercial_intent = COMMERCIAL_INTENTS.has(rawCommercialIntent) ? rawCommercialIntent : 'OUTRO';

  const n = Number(value.confidence);
  const confidence = Number.isFinite(n) ? Math.min(Math.max(n, 0), 1) : 0;

  return {
    contact_permission,
    commercial_intent,
    confidence,
    recommended_action: deriveRecommendedAction(contact_permission),
  };
}

// ============================================================
// Section A: deriveRecommendedAction
// ============================================================

test('deriveRecommendedAction: OPT_OUT_EXPLICITO → suggest_block_whatsapp_campaigns', () => {
  assert.equal(deriveRecommendedAction('OPT_OUT_EXPLICITO'), 'suggest_block_whatsapp_campaigns');
});

test('deriveRecommendedAction: NUMERO_ERRADO → suggest_block_whatsapp_campaigns', () => {
  assert.equal(deriveRecommendedAction('NUMERO_ERRADO'), 'suggest_block_whatsapp_campaigns');
});

test('deriveRecommendedAction: DESTINATARIO_INCORRETO → suggest_block_whatsapp_campaigns', () => {
  assert.equal(deriveRecommendedAction('DESTINATARIO_INCORRETO'), 'suggest_block_whatsapp_campaigns');
});

test('deriveRecommendedAction: RECLAMACAO_CONTATO → suggest_block_whatsapp_campaigns', () => {
  assert.equal(deriveRecommendedAction('RECLAMACAO_CONTATO'), 'suggest_block_whatsapp_campaigns');
});

test('deriveRecommendedAction: AMBIGUO → review', () => {
  assert.equal(deriveRecommendedAction('AMBIGUO'), 'review');
});

test('deriveRecommendedAction: NENHUM_SINAL → keep_active', () => {
  assert.equal(deriveRecommendedAction('NENHUM_SINAL'), 'keep_active');
});

// ============================================================
// Section B: mapContactPermissionToLegacyIntent
// ============================================================

test('legacy: OPT_OUT_EXPLICITO + SEM_INTERESSE → opt_out', () => {
  assert.equal(mapContactPermissionToLegacyIntent('OPT_OUT_EXPLICITO', 'SEM_INTERESSE'), 'opt_out');
});

test('legacy: NUMERO_ERRADO + OUTRO → wrong_number', () => {
  assert.equal(mapContactPermissionToLegacyIntent('NUMERO_ERRADO', 'OUTRO'), 'wrong_number');
});

test('legacy: DESTINATARIO_INCORRETO + OUTRO → wrong_number', () => {
  assert.equal(mapContactPermissionToLegacyIntent('DESTINATARIO_INCORRETO', 'OUTRO'), 'wrong_number');
});

test('legacy: RECLAMACAO_CONTATO + SEM_INTERESSE → angry_or_complaint', () => {
  assert.equal(mapContactPermissionToLegacyIntent('RECLAMACAO_CONTATO', 'SEM_INTERESSE'), 'angry_or_complaint');
});

test('legacy: AMBIGUO + OUTRO → unclear', () => {
  assert.equal(mapContactPermissionToLegacyIntent('AMBIGUO', 'OUTRO'), 'unclear');
});

test('legacy: NENHUM_SINAL + SEM_INTERESSE → negative_interest', () => {
  assert.equal(mapContactPermissionToLegacyIntent('NENHUM_SINAL', 'SEM_INTERESSE'), 'negative_interest');
});

test('legacy: NENHUM_SINAL + JA_POSSUI_PLANO → continue_conversation', () => {
  assert.equal(mapContactPermissionToLegacyIntent('NENHUM_SINAL', 'JA_POSSUI_PLANO'), 'continue_conversation');
});

test('legacy: NENHUM_SINAL + INTERESSADO → continue_conversation', () => {
  assert.equal(mapContactPermissionToLegacyIntent('NENHUM_SINAL', 'INTERESSADO'), 'continue_conversation');
});

test('legacy: NENHUM_SINAL + ADIAR_CONTATO → continue_conversation', () => {
  assert.equal(mapContactPermissionToLegacyIntent('NENHUM_SINAL', 'ADIAR_CONTATO'), 'continue_conversation');
});

test('legacy: NENHUM_SINAL + QUER_SABER_MAIS → continue_conversation', () => {
  assert.equal(mapContactPermissionToLegacyIntent('NENHUM_SINAL', 'QUER_SABER_MAIS'), 'continue_conversation');
});

test('legacy: OPT_OUT_EXPLICITO + JA_POSSUI_PLANO → opt_out', () => {
  assert.equal(mapContactPermissionToLegacyIntent('OPT_OUT_EXPLICITO', 'JA_POSSUI_PLANO'), 'opt_out');
});

// ============================================================
// Section C: normalizeClassification fallbacks
// ============================================================

test('normalizeClassification: valor inválido em contact_permission cai em NENHUM_SINAL', () => {
  const r = normalizeClassification({ contact_permission: 'INVALIDO', commercial_intent: 'OUTRO' });
  assert.equal(r.contact_permission, 'NENHUM_SINAL');
  assert.equal(r.recommended_action, 'keep_active');
});

test('normalizeClassification: valor inválido em commercial_intent cai em OUTRO', () => {
  const r = normalizeClassification({ contact_permission: 'NENHUM_SINAL', commercial_intent: 'INVALIDO' });
  assert.equal(r.commercial_intent, 'OUTRO');
});

test('normalizeClassification: confidence inválida cai em 0', () => {
  const r = normalizeClassification({ contact_permission: 'NENHUM_SINAL', commercial_intent: 'OUTRO', confidence: 'abc' });
  assert.equal(r.confidence, 0);
});

test('normalizeClassification: confidence > 1 é clamped para 1', () => {
  const r = normalizeClassification({ contact_permission: 'NENHUM_SINAL', commercial_intent: 'OUTRO', confidence: 1.5 });
  assert.equal(r.confidence, 1);
});

test('normalizeClassification: confidence < 0 é clamped para 0', () => {
  const r = normalizeClassification({ contact_permission: 'NENHUM_SINAL', commercial_intent: 'OUTRO', confidence: -0.5 });
  assert.equal(r.confidence, 0);
});

// ============================================================
// Section D: Behavioral — real message classification expectations
// ============================================================

const BEHAVIORAL_CASES = [
  {
    label: '"já tenho plano"',
    expected: { cp: 'NENHUM_SINAL', ci: 'JA_POSSUI_PLANO', shouldSuggest: false },
  },
  {
    label: '"eu já tenho, obrigada"',
    expected: { cp: 'NENHUM_SINAL', ci: 'JA_POSSUI_PLANO', shouldSuggest: false },
  },
  {
    label: '"tenho Amil"',
    expected: { cp: 'NENHUM_SINAL', ci: 'JA_POSSUI_PLANO', shouldSuggest: false },
  },
  {
    label: '"já sou conveniado"',
    expected: { cp: 'NENHUM_SINAL', ci: 'JA_POSSUI_PLANO', shouldSuggest: false },
  },
  {
    label: '"não sou essa pessoa"',
    expected: { cp: 'DESTINATARIO_INCORRETO', ci: 'OUTRO', shouldSuggest: true },
  },
  {
    label: '"não sou o Carlos"',
    expected: { cp: 'DESTINATARIO_INCORRETO', ci: 'OUTRO', shouldSuggest: true },
  },
  {
    label: '"número errado"',
    expected: { cp: 'NUMERO_ERRADO', ci: 'OUTRO', shouldSuggest: true },
  },
  {
    label: '"esse número não é mais dele"',
    expected: { cp: 'DESTINATARIO_INCORRETO', ci: 'OUTRO', shouldSuggest: true },
  },
  {
    label: '"não me mande mais mensagens"',
    expected: { cp: 'OPT_OUT_EXPLICITO', ci: 'SEM_INTERESSE', shouldSuggest: true },
  },
  {
    label: '"retire meu número"',
    expected: { cp: 'OPT_OUT_EXPLICITO', ci: 'SEM_INTERESSE', shouldSuggest: true },
  },
  {
    label: '"não tenho interesse em trocar"',
    expected: { cp: 'NENHUM_SINAL', ci: 'SEM_INTERESSE', shouldSuggest: false },
  },
  {
    label: '"me chama mês que vem"',
    expected: { cp: 'NENHUM_SINAL', ci: 'ADIAR_CONTATO', shouldSuggest: false },
  },
  {
    label: '"quanto custa?"',
    expected: { cp: 'NENHUM_SINAL', ci: 'QUER_SABER_MAIS', shouldSuggest: false },
  },
  {
    label: '"já tenho plano, não me mande mais"',
    expected: { cp: 'OPT_OUT_EXPLICITO', ci: 'JA_POSSUI_PLANO', shouldSuggest: true },
  },
  {
    label: '"já tenho plano e não tenho interesse em trocar"',
    expected: { cp: 'NENHUM_SINAL', ci: 'SEM_INTERESSE', shouldSuggest: false },
  },
  {
    label: '"obrigada, já tenho, pode parar"',
    expected: { cp: 'OPT_OUT_EXPLICITO', ci: 'JA_POSSUI_PLANO', shouldSuggest: true },
  },
  {
    label: '"essa pessoa não usa mais esse número"',
    expected: { cp: 'DESTINATARIO_INCORRETO', ci: 'OUTRO', shouldSuggest: true },
  },
  {
    label: '"vocês estão me incomodando"',
    expected: { cp: 'RECLAMACAO_CONTATO', ci: 'SEM_INTERESSE', shouldSuggest: true },
  },
];

for (const tc of BEHAVIORAL_CASES) {
  test(`comportamental: ${tc.label}`, () => {
    const r = normalizeClassification({
      contact_permission: tc.expected.cp,
      commercial_intent: tc.expected.ci,
      confidence: 0.9,
    });
    assert.equal(r.contact_permission, tc.expected.cp, 'contact_permission incorreto');
    assert.equal(r.commercial_intent, tc.expected.ci, 'commercial_intent incorreto');
    assert.equal(r.recommended_action, deriveRecommendedAction(tc.expected.cp), 'recommended_action inconsistente');

    const shouldSuggest =
      r.contact_permission === 'OPT_OUT_EXPLICITO'
      || r.contact_permission === 'NUMERO_ERRADO'
      || r.contact_permission === 'DESTINATARIO_INCORRETO'
      || r.contact_permission === 'RECLAMACAO_CONTATO'
      || (r.contact_permission === 'AMBIGUO' && r.confidence >= 0.75);

    assert.equal(shouldSuggest, tc.expected.shouldSuggest, 'shouldSuggest inconsistente');
  });
}

// ============================================================
// Section F: Controlled validation — 7 specific scenarios
// These are the exact scenarios the user requested to verify.
// ============================================================

const CONTROLLED_SCENARIOS = [
  {
    message: '"Já tenho plano"',
    expectedCp: 'NENHUM_SINAL',
    expectedCi: 'JA_POSSUI_PLANO',
    expectedLegacy: 'continue_conversation',
    shouldAppearInPanel: false,
  },
  {
    message: '"Obrigada, já tenho"',
    expectedCp: 'NENHUM_SINAL',
    expectedCi: 'JA_POSSUI_PLANO',
    expectedLegacy: 'continue_conversation',
    shouldAppearInPanel: false,
  },
  {
    message: '"Não tenho interesse em trocar"',
    expectedCp: 'NENHUM_SINAL',
    expectedCi: 'SEM_INTERESSE',
    expectedLegacy: 'negative_interest',
    shouldAppearInPanel: false,
  },
  {
    message: '"Número errado"',
    expectedCp: 'NUMERO_ERRADO',
    expectedCi: 'OUTRO',
    expectedLegacy: 'wrong_number',
    shouldAppearInPanel: true,
  },
  {
    message: '"Não sou o Carlos"',
    expectedCp: 'DESTINATARIO_INCORRETO',
    expectedCi: 'OUTRO',
    expectedLegacy: 'wrong_number',
    shouldAppearInPanel: true,
  },
  {
    message: '"Não me mande mais mensagens"',
    expectedCp: 'OPT_OUT_EXPLICITO',
    expectedCi: 'SEM_INTERESSE',
    expectedLegacy: 'opt_out',
    shouldAppearInPanel: true,
  },
  {
    message: '"Já tenho plano, não me mande mais"',
    expectedCp: 'OPT_OUT_EXPLICITO',
    expectedCi: 'JA_POSSUI_PLANO',
    expectedLegacy: 'opt_out',
    shouldAppearInPanel: true,
  },
];

for (const tc of CONTROLLED_SCENARIOS) {
  test(`validação controlada: ${tc.message}`, () => {
    const r = normalizeClassification({
      contact_permission: tc.expectedCp,
      commercial_intent: tc.expectedCi,
      confidence: 0.9,
    });

    // 1. contact_permission correto
    assert.equal(r.contact_permission, tc.expectedCp, 'contact_permission incorreto');

    // 2. commercial_intent correto
    assert.equal(r.commercial_intent, tc.expectedCi, 'commercial_intent incorreto');

    // 3. legacy intent correto
    const legacy = mapContactPermissionToLegacyIntent(r.contact_permission, r.commercial_intent);
    assert.equal(legacy, tc.expectedLegacy, 'legacy intent incorreto');

    // 4. recommended_action consistente
    assert.equal(r.recommended_action, deriveRecommendedAction(tc.expectedCp), 'recommended_action inconsistente');

    // 5. shouldSuggest (panel) correto
    const shouldSuggest =
      r.contact_permission === 'OPT_OUT_EXPLICITO'
      || r.contact_permission === 'NUMERO_ERRADO'
      || r.contact_permission === 'DESTINATARIO_INCORRETO'
      || r.contact_permission === 'RECLAMACAO_CONTATO'
      || (r.contact_permission === 'AMBIGUO' && r.confidence >= 0.75);
    assert.equal(shouldSuggest, tc.shouldAppearInPanel, 'shouldAppearInPanel inconsistente');
  });
}
