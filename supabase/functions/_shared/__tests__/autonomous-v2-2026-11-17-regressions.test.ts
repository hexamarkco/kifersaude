import { expect, test } from 'vitest';
import { decide, requirements } from '../autonomous-attendance-v2/domain/decision.ts';
import { confirmed, initialState, mergeInterpretation, readState, type Interpretation } from '../autonomous-attendance-v2/domain/state.ts';
import { isAlreadyAssistedResponse, isResolvedNeedResponse, preserveExplicitAgeList, preserveSoloBeneficiary, prioritizeProductQuestion, runV2Turn, validateWrittenReply } from '../autonomous-attendance-v2/domain/turn.ts';
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
    const expected = text.replace(/ idades$/, '').split(/[\x2f, ]+/).map(Number);
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

test.each([
  'Bom dia. Ja resolvi',
  'Já resolvi, obrigada!',
  'Já resolvi tudo',
  'Já consegui, valeu',
  'Já consegui um plano',
  'Já consegui o que precisava',
  'Não preciso mais',
  'Não preciso mais de cotação',
  'Já está tudo resolvido',
  'Resolvi com outra corretora',
])('resolved need stops qualification: %s', (text) => {
  expect(isResolvedNeedResponse([message(text, 1)])).toBe(true);
  expect(decide(initialState(), noInterpretation, { customerNeedResolved: true })).toMatchObject({
    action: 'handoff', reason: 'customer_need_resolved', handoffCode: 'PRECISA_HUMANO',
  });
});

test.each([
  'Já resolvi o boleto, mas quero cotar.',
  'Já consegui meu CNPJ e quero contratar.',
  'Não preciso mais do boleto, quero uma cotação.',
  'Já resolvi, mas preciso de uma cotação para minha mãe.',
  'Já consegui o que precisava, agora quero um plano para minha filha.',
  'Não preciso mais de cotação, mas tenho uma dúvida sobre a rede.',
  'Ainda não consegui resolver.',
  'Já resolvi. Pode me passar o valor de outro plano?',
])('a partial resolution or new question does not end the bot: %s', (text) => {
  expect(isResolvedNeedResponse([message(text, 1)])).toBe(false);
});

test('multiple inbound bubbles are read together before deciding whether the need ended', () => {
  expect(isResolvedNeedResponse([message('Bom dia. Ja resolvi', 1), message('Obrigada!', 2)])).toBe(true);
  expect(isResolvedNeedResponse([message('Já resolvi', 1), message('Mas quero cotar pra minha mãe', 2)])).toBe(false);
  expect(isResolvedNeedResponse([message('Já resolvi', 1), message('Me passa o valor de outro plano?', 2)])).toBe(false);
});

test('Rose Mary: V2 acknowledges that the need was resolved without questions or changing the sales status', async () => {
  const fresh = [message('Bom dia. Ja resolvi', 1)];
  const extracted = interpretation({ goal: 'A busca por plano já foi resolvida.' }, fresh);
  const turn = await runV2Turn({
    messages: fresh, previous: initialState(), now: date, configVersion: 24,
    generate: async (request) => request.stage === 'interpret' ? JSON.stringify(extracted)
      : JSON.stringify({ text: 'Que bom que você conseguiu resolver! Obrigada por avisar. Fico à disposição.', commercialClaims: [] }),
  });
  expect(turn.decision).toMatchObject({
    action: 'handoff', field: null, reason: 'customer_need_resolved', handoffCode: 'PRECISA_HUMANO',
  });
  expect(turn.text).not.toContain('?');
  expect(turn.briefing.handoffCode).toBe('PRECISA_HUMANO');
  expect(() => validateWrittenReply(JSON.stringify({
    text: 'O plano seria só pra você ou para alguém da família?', commercialClaims: [],
  }), turn.state, turn.decision)).toThrow('Pergunta incompatível');
  expect(decide(turn.state, { ...noInterpretation, quoteDeclined: true,
    signals: [{ messageId: fresh[0].id, quote: fresh[0].content }] },
  { customerNeedResolved: true }).handoffCode).toBe('PRECISA_HUMANO');
});

test('a quotation containing only children goes to a broker for eligibility review', () => {
  const msgs = [message('Só meus dois filhos, 6 e 11 anos', 1)];
  const state = mergeInterpretation(initialState(), interpretation({
    beneficiaryCount: 2, beneficiaries: [{ id: 'a', label: 'filho', age: 6 },
      { id: 'b', label: 'filho', age: 11 }], city: 'Bocaiúva do Sul', companyPresence: 'no',
  }, msgs), msgs, date);
  expect(decide(state, noInterpretation)).toMatchObject({
    action: 'handoff', reason: 'child_requires_adult_holder', handoffCode: 'PRECISA_HUMANO',
  });
});

test.each([
  { age: 11, city: 'Rio de Janeiro', state: 'RJ', reason: 'child_requires_adult_holder' },
  { age: 12, city: 'Rio de Janeiro', state: 'RJ', reason: 'age_twelve_needs_review' },
  { age: 16, city: 'São Paulo', state: 'SP', reason: 'minor_individual_region_not_verified' },
  { age: 16, city: 'Niterói', state: null, reason: 'minor_individual_region_not_verified' },
])('does not invent individual minor eligibility at age $age in $city ($state)', ({ age, city, state, reason }) => {
  const msgs = [message('Tenho ' + age + ' anos em ' + city, 1)];
  const data = {
    beneficiaryCount: 1, beneficiaries: [{ id: 'minor', label: 'beneficiário', age }],
    city, companyPresence: 'no', ...(state ? { state } : {}),
  };
  const stateV2 = mergeInterpretation(initialState(), interpretation(data, msgs), msgs, date);
  expect(decide(stateV2, noInterpretation)).toMatchObject({
    action: 'handoff', reason, handoffCode: 'PRECISA_HUMANO',
  });
});

test.each([13, 15, 17])('a single %i-year-old in confirmed RJ continues ordinary qualification', (age) => {
  const msgs = [message('Tenho ' + age + ' anos em Niterói RJ', 1)];
  const state = mergeInterpretation(initialState(), interpretation({
    beneficiaryCount: 1, beneficiaries: [{ id: 'teen', label: 'titular', age }],
    city: 'Niterói', state: 'RJ', companyPresence: 'no',
  }, msgs), msgs, date);
  expect(requirements(state)).toEqual([]);
  expect(decide(state, noInterpretation)).toMatchObject({ action: 'ask', reason: 'optional_information' });
});

test('single 13-17-year-old with unknown residence is asked for city before geographic review', () => {
  const msgs = [message('Só eu com 15 anos', 1)];
  const state = mergeInterpretation(initialState(), interpretation({
    beneficiaryCount: 1, beneficiaries: [{ id: 'teen', label: 'titular', age: 15 }], companyPresence: 'no',
  }, msgs), msgs, date);
  expect(decide(state, noInterpretation)).toMatchObject({ action: 'ask', field: 'city' });
});

test('multiple minor lives in RJ go to a broker rather than assuming an individual contract', () => {
  const msgs = [message('Só meus dois filhos de 15 e 17 em Niterói RJ', 1)];
  const state = mergeInterpretation(initialState(), interpretation({
    beneficiaryCount: 2, beneficiaries: [{ id: 'a', label: 'filho', age: 15 },
      { id: 'b', label: 'filho', age: 17 }], city: 'Niterói', state: 'RJ', companyPresence: 'no',
  }, msgs), msgs, date);
  expect(decide(state, noInterpretation)).toMatchObject({
    action: 'handoff', reason: 'multiple_minor_contract_needs_review',
  });
});

test('a child under 12 accompanied by an adult is not blocked by the minor-only rule', () => {
  const msgs = [message('Eu e meu filho, 35 e 10 anos, em Niterói RJ', 1)];
  const state = mergeInterpretation(initialState(), interpretation({
    beneficiaryCount: 2, beneficiaries: [{ id: 'adult', label: 'titular', age: 35 },
      { id: 'child', label: 'filho', age: 10 }], city: 'Niterói', state: 'RJ', companyPresence: 'no',
  }, msgs), msgs, date);
  expect(decide(state, noInterpretation)).toMatchObject({ action: 'ask', reason: 'optional_information' });
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
