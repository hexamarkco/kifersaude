import { expect, test } from 'vitest';
import { decide, requirements } from '../autonomous-attendance-v2/domain/decision.ts';
import { confirmed, initialState, mergeInterpretation, readState, type Interpretation } from '../autonomous-attendance-v2/domain/state.ts';
import { isAlreadyAssistedResponse, preserveExplicitAgeList, preserveSoloBeneficiary, prioritizeProductQuestion, runV2Turn } from '../autonomous-attendance-v2/domain/turn.ts';
import { date, interpretation, message } from './fixtures/autonomous-v2-scenarios.ts';

const noInterpretation: Interpretation = {
  observations: [], humanRequested: false, quoteDeclined: false, irritated: false,
  question: null, suggestedField: null, signals: [],
};
const ages = (state: ReturnType<typeof initialState>) => confirmed(state, 'beneficiaries')?.map((item) => item.age);

test.each([
  { label: 'two children', count: 2, id: 'filhos', placeholder: 'filhos', known: [6, 11] },
  { label: 'five relatives', count: 5, id: 'family_unspecified', placeholder: 'Família (composição não especificada)', known: [12, 19, 20, 45, 56] },
])('removes only aggregate placeholders from a complete age list ($label)', ({ count, id, placeholder, known }) => {
  const msgs = [message('Família', 1)];
  const initial = mergeInterpretation(initialState(), interpretation({
    beneficiaryCount: count,
    beneficiaries: [{ id, label: placeholder, age: null }, ...known.map((age, index) =>
      ({ id: 'person' + index, label: 'Pessoa ' + index, age }))],
  }, msgs), msgs, date);
  const restored = readState(initial)!;
  expect(ages(restored)).toEqual(known);
  expect(requirements(restored)).not.toContain('beneficiaries');
  expect(restored.facts.beneficiaries?.evidence).toEqual(initial.facts.beneficiaries?.evidence);
});

test('new individually aged children replace the old collective placeholder without a third child', () => {
  const first = [message('São meus dois filhos', 1)];
  const previous = mergeInterpretation(initialState(), interpretation({
    beneficiaryCount: 2, beneficiaries: [{ id: 'filhos', label: 'filhos', age: null }],
  }, first), first, date);
  const nextMessage = [message('6 e 11 anos', 2)];
  const next = mergeInterpretation(previous, interpretation({
    beneficiaries: [{ id: 'filhos-1', label: 'filho', age: 6 }, { id: 'filhos-2', label: 'filho', age: 11 }],
  }, nextMessage), nextMessage, date);
  expect(ages(next)).toEqual([6, 11]);
  expect(requirements(next)).not.toContain('beneficiaries');
});

test('a clear request for an individual plan is not reinterpreted as unknown family size', () => {
  const fresh = [message('Boa tarde gostaria de saber como funciona, só pra mim', 1)];
  const extracted = preserveSoloBeneficiary(noInterpretation, fresh, initialState());
  const state = mergeInterpretation(initialState(), extracted, fresh, date);
  expect(confirmed(state, 'beneficiaryCount')).toBe(1);
  expect(ages(state)).toEqual([null]);
  expect(decide(state, extracted)).toMatchObject({ action: 'ask', field: 'beneficiaries' });
});

test('protects explicit age lists when the interpreter silently drops a number or miscounts', () => {
  for (const text of ['32/54/59', '44 59 70 idades', '54,52,29,27', '80/80']) {
    const fresh = [message(text, 2)];
    const expected = text.replace(/ idades$/, '').split(/[\/, ]+/).map(Number);
    const extraction = interpretation({
      beneficiaryCount: expected.length - 1,
      beneficiaries: expected.slice(0, -1).map((age, i) =>
        ({ id: 'extracted-' + i, label: 'Pessoa ' + i, age })),
    }, fresh);
    const fixed = preserveExplicitAgeList(extraction, fresh, initialState());
    const state = mergeInterpretation(initialState(), fixed, fresh, date);
    expect(confirmed(state, 'beneficiaryCount')).toBe(expected.length);
    expect(ages(state)).toEqual(expected);
    expect(requirements(state)).not.toContain('beneficiaries');
  }
});

test('a later personal age identifies the unique unnamed life instead of creating a new one', () => {
  const first = [message('32/54/59', 1)];
  const previous = mergeInterpretation(initialState(), interpretation({
    beneficiaryCount: 3,
    beneficiaries: [32, 54, 59].map((age, i) =>
      ({ id: 'family-' + i, label: 'Pessoa ' + (i + 1), age })),
  }, first), first, date);
  const update = [message('Eu tenho 54', 2)];
  const next = mergeInterpretation(previous, interpretation({
    beneficiaries: [{ id: 'titular', label: 'titular', age: 54 }],
  }, update), update, date);
  expect(confirmed(next, 'beneficiaryCount')).toBe(3);
  expect(ages(next)).toEqual([32, 54, 59]);
  expect(confirmed(next, 'beneficiaries')?.[1].label).toBe('titular');
});

test('does not merge twins just because both people share the same age', () => {
  const msgs = [message('Duas pessoas de 54', 1)];
  const prior = mergeInterpretation(initialState(), interpretation({
    beneficiaryCount: 2, beneficiaries: [{ id: 'a', label: 'Pessoa 1', age: 54 },
      { id: 'b', label: 'Pessoa 2', age: 54 }],
  }, msgs), msgs, date);
  const update = [message('Tenho 54 também', 2)];
  const next = mergeInterpretation(prior, interpretation({
    beneficiaries: [{ id: 'third', label: 'titular', age: 54 }],
  }, update), update, date);
  expect(confirmed(next, 'beneficiaries')).toHaveLength(3);
  expect(requirements(next)).toContain('beneficiaries');
});

test('courteous already-assisted reply stops bot questions without marking the quote as lost', async () => {
  const fresh = [message('Já estou em contato com uma pessoa. Obrigada.', 1)];
  expect(isAlreadyAssistedResponse(fresh)).toBe(true);
  expect(isAlreadyAssistedResponse([message('Estou em contato com a operadora, mas quero a cotação.', 2)])).toBe(false);
  const turn = await runV2Turn({
    messages: fresh, previous: initialState(), now: date, configVersion: 24,
    generate: async (request) => request.stage === 'interpret' ? JSON.stringify(noInterpretation)
      : JSON.stringify({ text: 'Obrigada por avisar. Fico à disposição.', commercialClaims: [] }),
  });
  expect(turn.decision).toMatchObject({
    action: 'handoff', reason: 'customer_already_assisted', handoffCode: 'PRECISA_HUMANO',
  });
  expect(turn.text).not.toContain('?');
});

test('a quotation containing only children goes to a broker for eligibility review', () => {
  const msgs = [message('Só meus dois filhos, 6 e 11 anos', 1)];
  const state = mergeInterpretation(initialState(), interpretation({
    beneficiaryCount: 2, beneficiaries: [{ id: 'a', label: 'filho', age: 6 },
      { id: 'b', label: 'filho', age: 11 }], city: 'Bocaiúva do Sul', companyPresence: 'no',
  }, msgs), msgs, date);
  expect(decide(state, noInterpretation)).toMatchObject({
    action: 'handoff', reason: 'only_minor_beneficiaries', handoffCode: 'PRECISA_HUMANO',
  });
});

test('a concrete price or coverage request bypasses optional questionnaire fields when essentials are known', () => {
  const msgs = [message('Somos dois, 60 e 67, em Porto Alegre, Sarandi, temos CNPJ', 1)];
  const state = mergeInterpretation(initialState(), interpretation({
    beneficiaryCount: 2, beneficiaries: [{ id: 'one', label: 'titular', age: 60 },
      { id: 'two', label: 'cônjuge', age: 67 }],
    city: 'Porto Alegre', neighborhood: 'Sarandi', companyPresence: 'yes',
  }, msgs), msgs, date);
  expect(requirements(state)).toEqual([]);
  for (const question of ['Gostaria de saber qual seria o valir para nos dois', 'O que esse plano cobre?']) {
    const parsed = prioritizeProductQuestion(noInterpretation, [message(question, 2)]);
    expect(parsed.question?.topic).toMatch(/price|network/);
    expect(decide(state, parsed)).toMatchObject({ action: 'complete', handoffCode: 'QUALIFICACAO_COMPLETA' });
  }
  const missing = structuredClone(state);
  delete missing.facts.city;
  const parsed = prioritizeProductQuestion(noInterpretation, [message('O que esse plano cobre?', 3)]);
  expect(decide(missing, parsed).action).toBe('ask');
});

test('a general question about operators can be answered without a product promise', async () => {
  const msgs = [message('Quais planos você trabalha?', 1)];
  const general: Interpretation = { ...noInterpretation, question: { text: msgs[0].content, topic: 'general' },
    signals: [{ messageId: msgs[0].id, quote: msgs[0].content }] };
  const turn = await runV2Turn({
    messages: msgs, previous: initialState(), now: date, configVersion: 24,
    generate: async (request) => {
      if (request.stage === 'interpret') return JSON.stringify(general);
      expect(request.systemPrompt).toContain('trabalhamos com diferentes operadoras');
      return JSON.stringify({ text: 'Trabalho com diferentes operadoras. As opções variam conforme a região e modalidade.',
        commercialClaims: [] });
    },
  });
  expect(turn.decision.action).toBe('answer');
});
