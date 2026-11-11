import assert from 'node:assert/strict';
import { test, vi } from 'vitest';

type TestMock<Args extends unknown[], Result> = {
  (...args: Args): Result;
  mock: { calls: Args[] };
  mockReturnValue(value: Result): TestMock<Args, Result>;
  mockResolvedValue(value: Awaited<Result>): TestMock<Args, Result>;
};

type Query = {
  select: TestMock<[string, ...unknown[]], Query>;
  eq: TestMock<[string, unknown], Query>;
  in: TestMock<[string, unknown[]], Query>;
  is: TestMock<[string, unknown], Query>;
  or: TestMock<[string], Query>;
  order: TestMock<[string, { ascending: boolean }], Query>;
  limit: TestMock<[number], Promise<{ data: unknown[]; error: unknown | null }>>;
  range: TestMock<[number, number], Promise<{ data: unknown[]; error: unknown | null; count: number }>>;
};

const mocks = vi.hoisted(() => {
  const createMock = <Args extends unknown[], Result>() => (
    vi.fn() as unknown as TestMock<Args, Result>
  );
  const query = {} as Query;
  query.select = createMock<[string, ...unknown[]], Query>();
  query.eq = createMock<[string, unknown], Query>();
  query.in = createMock<[string, unknown[]], Query>();
  query.is = createMock<[string, unknown], Query>();
  query.or = createMock<[string], Query>();
  query.order = createMock<[string, { ascending: boolean }], Query>();
  query.limit = createMock<[number], Promise<{ data: unknown[]; error: unknown | null }>>();
  query.range = createMock<[number, number], Promise<{ data: unknown[]; error: unknown | null; count: number }>>();

  const from = createMock<[string], Query>();
  from.mockReturnValue(query);
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.in.mockReturnValue(query);
  query.is.mockReturnValue(query);
  query.or.mockReturnValue(query);
  query.order.mockReturnValue(query);
  query.limit.mockResolvedValue({ data: [], error: null });
  query.range.mockResolvedValue({ data: [], error: null, count: 0 });

  return { from, query };
});

vi.mock('../../../infrastructure/supabase', () => ({
  supabase: {
    from: mocks.from,
  },
  getSupabaseErrorMessage: vi.fn(async (_error: unknown, fallback: unknown) => String(fallback)),
}));

import {
  commWhatsAppCampaignService,
  buildStepRows,
  computeAdmissionIntervalMinutes,
  computeContactIntervalMinutes,
  formatContactInterval,
  formatAdmissionInterval,
} from './commWhatsAppCampaignService';

test('ritmo da campanha deriva do limite e da janela, sem acelerar quando a divisão não é inteira', () => {
  assert.equal(computeAdmissionIntervalMinutes(30, '09:00', '18:30', 12), 19);
  assert.equal(computeAdmissionIntervalMinutes(29, '09:00', '18:30'), 20);
  assert.equal(formatAdmissionInterval(19), 'Aprox. 1 novo contato a cada 19 min');
  assert.equal(computeAdmissionIntervalMinutes(null, '09:00', '18:30', 6), 1 / 6);
  assert.equal(formatAdmissionInterval(computeAdmissionIntervalMinutes(null, '09:00', '18:30', 6)), 'Aprox. 1 novo contato a cada 10 s');
});

test('ritmo entre contatos pode ser fixado ou distribuído pela janela conforme a audiência', () => {
  assert.equal(computeContactIntervalMinutes(7, 30, '09:00', '18:30', 500), 7);
  assert.equal(computeContactIntervalMinutes(null, 30, '09:00', '18:30', 578), 19);
  assert.equal(computeContactIntervalMinutes(null, null, '09:00', '18:30', 2), 285);
  assert.equal(computeContactIntervalMinutes(null, null, '09:00', '18:30', 578), 1);
  assert.equal(formatContactInterval(null), 'Distribuído automaticamente pela janela');
});

test('consultas de campanhas nao pedem lead_name removido dos chats remotos', async () => {
  const selectCallsBefore = mocks.query.select.mock.calls.length;

  await commWhatsAppCampaignService.listCampaignTargets('campaign-1');
  await commWhatsAppCampaignService.listPendingAiSuggestions();

  const campaignSelects = mocks.query.select.mock.calls
    .slice(selectCallsBefore)
    .map(([fields]) => fields);

  assert.equal(campaignSelects.length, 2);
  assert.equal(campaignSelects.every((fields) => !fields.includes('lead_name')), true);
  assert.equal(campaignSelects.every((fields) => fields.includes('lead_id')), true);
});

test('copies A, B, C e D compartilham o mesmo indice de mensagem e preservam os demais baloes', () => {
  const rows = buildStepRows('campaign-copies', [{
    kind: 'message', delayAmount: 0, delayUnit: 'minutes',
    messages: [{
      messageText: 'Mensagem A: {{nome}}',
      variantBMessageText: 'Mensagem B: {{nome}}',
      variantCopies: { D: 'Mensagem D: {{nome}}', C: 'Mensagem C: {{nome}}' },
    }, { messageText: 'Segundo balao para todos' }],
  }, { kind: 'message', delayAmount: 1, delayUnit: 'days', messages: [{ messageText: 'Follow-up' }] }], true);

  assert.deepEqual(rows.filter((row) => row.step_index === 0).map((row) => row.variant_label), ['A', 'B', 'C', 'D']);
  assert.deepEqual(rows.filter((row) => row.step_index === 0).map((row) => row.message_text), [
    'Mensagem A: {{nome}}', 'Mensagem B: {{nome}}', 'Mensagem C: {{nome}}', 'Mensagem D: {{nome}}',
  ]);
  assert.deepEqual(rows.filter((row) => row.step_index > 0).map((row) => [row.step_index, row.variant_label]), [
    [1, 'ANY'], [2, 'ANY'],
  ]);
  assert.equal(rows.find((row) => row.step_index === 2)?.delay_amount, 1);
});

test('campanha sem alternancia mantém somente a copy principal; modelos A/B antigos continuam válidos', () => {
  const stages = [{
    kind: 'message' as const, delayAmount: 0, delayUnit: 'minutes' as const,
    messages: [{ messageText: 'A', variantBMessageText: 'B' }],
  }];
  assert.deepEqual(buildStepRows('legacy', stages, false).map((row) => row.variant_label), ['ANY']);
  assert.deepEqual(buildStepRows('legacy', stages, true).map((row) => row.variant_label), ['A', 'B']);
});

test('copies A, B e C podem variar todos os baloes da mesma sequencia', () => {
  const rows = buildStepRows('campaign-full-copies', [{
    kind: 'message', delayAmount: 0, delayUnit: 'minutes',
    messages: [
      { messageText: 'A1', variantBMessageText: 'B1', variantCopies: { C: 'C1' } },
      { messageText: 'A2', variantBMessageText: 'B2', variantCopies: { C: 'C2' } },
      { messageText: 'A3', variantBMessageText: 'B3', variantCopies: { C: 'C3' } },
      { messageText: 'A4', variantBMessageText: 'B4', variantCopies: { C: 'C4' } },
    ],
  }], true);
  assert.equal(rows.length, 12);
  for (let step = 0; step < 4; step += 1) {
    assert.deepEqual(rows.filter((row) => row.step_index === step)
      .map((row) => [row.variant_label, row.message_text]),
      [['A', `A${step + 1}`], ['B', `B${step + 1}`], ['C', `C${step + 1}`]]);
  }
});

test('baloes sem override continuam compartilhados entre as copies', () => {
  const rows = buildStepRows('campaign-mixed-copies', [{
    kind: 'message', delayAmount: 0, delayUnit: 'minutes',
    messages: [
      { messageText: 'A1', variantBMessageText: 'B1', variantCopies: { C: 'C1' } },
      { messageText: 'Compartilhado' },
    ],
  }], true);
  assert.deepEqual(rows.filter((row) => row.step_index === 1).map((row) => row.variant_label), ['ANY']);
});
