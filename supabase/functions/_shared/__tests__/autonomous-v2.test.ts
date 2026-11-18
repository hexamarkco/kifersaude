import { afterAll, describe, expect, test, vi } from 'vitest';
import { writeFileSync } from 'node:fs';
import { assertDecision, decide, decisionTrace, internalBriefing, requirements } from '../autonomous-attendance-v2/domain/decision.ts';
import { confirmed, initialState, mergeInterpretation, parseInterpretation, readState, seedState, unseenMessages, type Interpretation, type V2State } from '../autonomous-attendance-v2/domain/state.ts';
import { formatReplyBlocks, legacyEvidenceMessageIds, restoreV2State, resumePreparedTurn, normalizeContextualAgeAnswer, runV2Turn, stateAfterSend, validateWrittenReply } from '../autonomous-attendance-v2/domain/turn.ts';
import { extractAutonomousQualificationState } from '../ai-autonomous-qualification.ts';
import { validateAutonomousReplyOutput } from '../ai-autonomous-helpers.ts';
import { date, interpretation, message, scenarios } from './fixtures/autonomous-v2-scenarios.ts';

const empty: Interpretation = { observations: [], humanRequested: false, quoteDeclined: false, irritated: false, question: null, suggestedField: null, signals: [] };
const full = () => mergeInterpretation(initialState(), interpretation(scenarios[1].values, scenarios[1].messages), scenarios[1].messages, date);

test('a split reply is one qualification turn and the single-question and commercial safeguards cover both parts', async () => {
  const messages = [message('Só para mim')];
  const generated = 'Entendi, será só para você.\n\nQual é a sua idade?';
  const turn = await runV2Turn({ messages, previous: initialState(), now: date, configVersion: 1, allowSplitReplies: true,
    generate: async request => request.stage === 'interpret' ? JSON.stringify(interpretation({ beneficiaryCount: 1 }, messages))
      : JSON.stringify({ text: generated, commercialClaims: [] }),
  });
  expect(turn.text).toBe(generated);
  expect(stateAfterSend(turn).asked.beneficiaries).toBe(1);
  for (const text of ['Qual é sua idade?\n\nEm que cidade mora?', 'O plano será aceito.\n\nQual é a sua idade?']) {
    expect(() => validateWrittenReply(JSON.stringify({ text, commercialClaims: [] }), turn.state, turn.decision)).toThrow();
  }
});

test.each(['5.3', '5,3', '3.4'])('interprets informal age %s in reply to an explicit personal age question', async (answer) => {
  const first = [message('Só para mim', 1)];
  const previous = mergeInterpretation(initialState(), interpretation({
    beneficiaryCount: 1, beneficiaries: [{ id: 'self', label: 'titular', age: null }],
  }, first), first, date);
  const prompt = { ...message('Entendi! Me fala, quantos anos você tem?', 2), role: 'ai' as const };
  const reply = message(answer, 3);
  const uncertain: Interpretation = { ...empty, observations: [
    { field: 'beneficiaries', value: null, status: 'uncertain', correction: false, messageId: reply.id, quote: answer },
  ] };
  const expectedAge = Number(answer.replace(/[.,]/, ''));
  const normalized = normalizeContextualAgeAnswer(uncertain, [reply], prompt, previous);
  expect(normalized.observations).toContainEqual({
    field: 'beneficiaries', value: [{ id: 'self', label: 'titular', age: expectedAge }],
    status: 'confirmed', correction: false, messageId: reply.id, quote: answer,
  });
  const next = mergeInterpretation(previous, normalized, [reply], date);
  expect(confirmed(next, 'beneficiaries')).toEqual([{ id: 'self', label: 'titular', age: expectedAge }]);
  expect(next.facts.beneficiaries?.evidence.at(-1)).toMatchObject({ messageId: reply.id, quote: answer });

  const turn = await runV2Turn({ messages: [prompt, reply], previous, now: date, configVersion: 1,
    generate: async request => request.stage === 'interpret' ? JSON.stringify(uncertain)
      : JSON.stringify({ text: 'Em que cidade e bairro você mora?', commercialClaims: [] }),
  });
  expect(confirmed(turn.state, 'beneficiaries')).toEqual([{ id: 'self', label: 'titular', age: expectedAge }]);
  expect(turn.decision.field).not.toBe('beneficiaries');
});

test('does not treat an arbitrary decimal or different context as a confirmed age', () => {
  const previous = mergeInterpretation(initialState(), interpretation({ beneficiaryCount: 1 }, [message('Só eu', 1)]),
    [message('Só eu', 1)], date);
  const ageQuestion = { ...message('Quantos anos você tem?', 2), role: 'ai' as const };
  const priceQuestion = { ...message('Quanto você paga no plano?', 2), role: 'ai' as const };
  for (const [text, question] of [
    ['5.3', priceQuestion], ['5.3 mil', ageQuestion], ['5.30', ageQuestion], ['1.5', ageQuestion],
  ] as const) {
    const reply = message(text, 3);
    expect(normalizeContextualAgeAnswer(empty, [reply], question, previous)).toBe(empty);
  }
  const multiple = mergeInterpretation(initialState(), interpretation({ beneficiaryCount: 2 }, [message('Duas vidas', 1)]),
    [message('Duas vidas', 1)], date);
  expect(normalizeContextualAgeAnswer(empty, [message('5.3', 3)], ageQuestion, multiple)).toBe(empty);
});

test('the next two reply opportunities stay in a single bubble after a split; extra parts collapse without losing text', async () => {
  for (const intervening of [false, true]) {
    const messages = [
      { ...message('Entendi, será só para você.\n\nQual é a sua idade?', 1), role: 'ai' as const },
      ...(intervening ? [{ ...message('Pode me dizer a cidade e o bairro?', 2), role: 'ai' as const }] : []),
      message('Tenho 35 anos', 3),
    ];
    const turn = await runV2Turn({ messages, previous: initialState(), now: date, configVersion: 1, allowSplitReplies: true,
      generate: async request => request.stage === 'interpret' ? JSON.stringify(interpretation({ beneficiaryCount: 1 }, [messages.at(-1)!]))
        : JSON.stringify({ text: 'Entendi, será só para você.\n\nQual é a sua idade?', commercialClaims: [] }),
    });
    expect(turn.text).not.toContain('\n\n');
  }
  expect(formatReplyBlocks('Primeira frase.\n\nSegunda frase.\n\nUma pergunta?', true))
    .toBe('Primeira frase. Segunda frase. Uma pergunta?');
  expect(formatReplyBlocks('Perfeito! Qual é a sua idade?', true)).toBe('Perfeito! Qual é a sua idade?');
  expect(formatReplyBlocks('Você tem CNPJ ou MEI? Isso me ajuda a ver outras opções.', true))
    .toBe('Você tem CNPJ ou MEI? Isso me ajuda a ver outras opções.');
});

test('a cancelled plan offers previous operator and cancellation reason without adding essential requirements', () => {
  const messages = [message('Cancelei meu plano há pouco', 2)];
  const state = mergeInterpretation(full(), interpretation({ cancelledPreviousPlan: 'yes', hasCurrentPlan: 'no' }, messages), messages, date);
  const first = decide(state, { ...empty, suggestedField: 'goal' });
  expect(first).toMatchObject({ action: 'ask', field: 'previousOperator', reason: 'optional_information', missing: [] });
  const sent = stateAfterSend({ state, decision: first, text: 'Qual era a operadora?', briefing: internalBriefing(state, first) });
  expect(decide(sent, empty)).toMatchObject({ action: 'ask', field: 'cancellationReason', missing: [] });
  expect(requirements(sent)).toEqual([]);
});

test('the operator of a cancelled plan does not imply a current plan or overwrite a current operator', () => {
  const messages = [message('O plano que cancelei era da Operadora Antiga', 2)];
  const state = mergeInterpretation(initialState(), interpretation({ cancelledPreviousPlan: 'yes', previousOperator: 'Operadora Antiga' }, messages), messages, date);
  expect(confirmed(readState(state)!, 'hasCurrentPlan')).toBeNull();
  expect(confirmed(state, 'currentOperator')).toBeNull();
  const current = [message('Hoje tenho a Operadora Atual', 3)];
  const next = mergeInterpretation(state, interpretation({ currentOperator: 'Operadora Atual', hasCurrentPlan: 'yes' }, current), current, date);
  expect(confirmed(next, 'previousOperator')).toBe('Operadora Antiga');
  expect(confirmed(next, 'currentOperator')).toBe('Operadora Atual');
  expect(confirmed(next, 'hasCurrentPlan')).toBe('yes');
});

test('spontaneous cancellation details are preserved and never asked again', () => {
  const messages = [message('Cancelei a Operadora Antiga porque ficou caro', 2)];
  const state = mergeInterpretation(full(), interpretation({ cancelledPreviousPlan: 'yes', previousOperator: 'Operadora Antiga',
    cancellationReason: 'Ficou caro' }, messages), messages, date);
  expect(decide(readState(state)!, empty).action).toBe('complete');
  expect(confirmed(readState(state)!, 'cancellationReason')).toBe('Ficou caro');
});

test.each(['unknown', 'declined'] as const)('optional cancellation answers %s never block qualification or imply quotation refusal', (status) => {
  const messages = [message('Não consigo informar esses dados do plano antigo', 2)];
  const extracted = interpretation({ cancelledPreviousPlan: 'yes' }, messages);
  for (const field of ['previousOperator', 'cancellationReason'] as const) extracted.observations.push({
    field, value: null, status, correction: false, messageId: messages[0].id, quote: messages[0].content });
  const state = mergeInterpretation(full(), extracted, messages, date);
  expect(decide(state, empty)).toMatchObject({ action: 'complete', missing: [] });
  expect(decide(state, { ...extracted, quoteDeclined: true })).toMatchObject({ action: 'complete', handoffCode: 'QUALIFICACAO_COMPLETA' });
});

test('ignored cancellation questions are offered only once and never block completion', () => {
  const messages = [message('Cancelei meu plano', 2)];
  const state = mergeInterpretation(full(), interpretation({ cancelledPreviousPlan: 'yes' }, messages), messages, date);
  state.asked.previousOperator = 1; state.asked.cancellationReason = 1;
  expect(decide(state, empty)).toMatchObject({ action: 'complete', missing: [] });
  expect(() => assertDecision(state, decide(state, empty))).not.toThrow();
});

test.each(['unknown', 'uncertain', 'declined'] as const)('a clear answer fills an earlier %s field instead of creating a conflict', (status) => {
  const first = [message('sim')];
  const ambiguous: Interpretation = { ...empty, observations: [{ field: 'beneficiaryCount', value: null, status,
    messageId: first[0].id, quote: 'sim', correction: false }] };
  const prior = mergeInterpretation(initialState(), ambiguous, first, date);
  const reply = [message('eu', 2)];
  const next = mergeInterpretation(prior, interpretation({ beneficiaryCount: 1, beneficiaries: [{ id: 'self', label: 'titular', age: null }] }, reply), reply, date);
  expect(confirmed(next, 'beneficiaryCount')).toBe(1);
  expect(next.facts.beneficiaryCount?.status).toBe('confirmed');
  expect(next.facts.beneficiaryCount?.evidence).toHaveLength(2);
  expect(decide(next, empty)).toMatchObject({ action: 'ask', field: 'beneficiaries' });
});

test('only two different confirmed values create a real conflict; a direct clarification resolves it without a correction keyword', () => {
  const messages = [message('São duas pessoas')];
  const prior = mergeInterpretation(initialState(), interpretation({ beneficiaryCount: 2 }, messages), messages, date);
  const other = [message('Só eu', 2)];
  const conflict = mergeInterpretation(prior, interpretation({ beneficiaryCount: 1 }, other), other, date);
  expect(conflict.facts.beneficiaryCount).toMatchObject({ value: 2, conflictingValue: 1, status: 'conflict' });
  const asked = stateAfterSend({ state: conflict, decision: decide(conflict, empty), text: 'É só você no plano?', briefing: internalBriefing(conflict, decide(conflict, empty)) });
  const confirmation = [message('sim', 3)];
  const next = mergeInterpretation(asked, interpretation({ beneficiaryCount: 1 }, confirmation), confirmation, date);
  expect(confirmed(next, 'beneficiaryCount')).toBe(1);
  expect(next.facts.beneficiaryCount).not.toHaveProperty('conflictingValue');
});

test('saved false null-vs-value conflicts are repaired without discarding evidence or weakening real conflicts', () => {
  const state = initialState();
  state.facts.beneficiaryCount = { value: null, conflictingValue: 1, status: 'conflict', updatedAt: date,
    evidence: [{ messageId: 'first', quote: 'sim', at: date, source: 'conversation' }, { messageId: 'second', quote: 'eu', at: date, source: 'conversation' }] };
  const repaired = readState(state)!;
  expect(confirmed(repaired, 'beneficiaryCount')).toBe(1);
  expect(repaired.facts.beneficiaryCount?.evidence).toEqual(state.facts.beneficiaryCount.evidence);
  state.facts.beneficiaryCount.value = 2;
  expect(readState(state)?.facts.beneficiaryCount?.status).toBe('conflict');
});

test.each(['Rio', 'Rio de Janeiro', 'rio de janeiro'])('capital %s supplies UF and prioritizes neighborhood over another suggested field', (city) => {
  const messages = [message(city)];
  const state = mergeInterpretation(initialState(), interpretation({ city }, messages), messages, date);
  expect(confirmed(state, 'city')).toBe(city === 'Rio' ? 'Rio de Janeiro' : city);
  expect(confirmed(state, 'state')).toBe('RJ');
  expect(state.facts.state).toMatchObject({ derivedFrom: 'city', evidence: state.facts.city?.evidence });
  expect(requirements(state)).toContain('neighborhood');
  expect(requirements(state)).not.toContain('state');
  expect(decide(state, { ...empty, suggestedField: 'companyPresence' })).toMatchObject({ action: 'ask', field: 'neighborhood' });
});

test('noncapital city needs no neighborhood or separate UF answer; unknown geography is never guessed from DDD', () => {
  const messages = [message('Moro em Niterói RJ')];
  const values = { ...scenarios[1].values, city: 'Niterói' }; delete values.neighborhood;
  const state = mergeInterpretation(initialState(), interpretation(values, messages), messages, date);
  expect(requirements(state)).not.toContain('neighborhood');
  delete state.facts.neighborhood;
  expect(decide(state, empty).action).toBe('complete');
  const unknown = seedState({ city: 'Cidade Exemplo' }, date);
  expect(confirmed(unknown, 'state')).toBeNull();
  expect(requirements(unknown)).not.toContain('state');
  expect(confirmed(seedState({ city: 'constructor' }, date), 'state')).toBeNull();
});

test('location question asks city and neighborhood, never a separate state question', () => {
  const state = full(); delete state.facts.city; delete state.facts.state; delete state.facts.neighborhood;
  const decision = decide(state, empty);
  expect(decision).toMatchObject({ action: 'ask', field: 'city' });
  const text = 'Em que cidade e bairro seu filho mora?';
  expect(validateWrittenReply(JSON.stringify({ text, commercialClaims: [] }), state, decision)).toBe(text);
  for (const rejected of ['Em qual cidade e estado ele mora?', 'Em qual estado ele mora?', 'Em qual cidade ele mora?']) {
    expect(() => validateWrittenReply(JSON.stringify({ text: rejected, commercialClaims: [] }), state, decision)).toThrow();
  }
  state.facts.city = { ...full().facts.city!, value: 'Duque de Caxias' };
  expect(requirements(state)).toEqual([]);
  expect(decide(state, empty).action).toBe('complete');
});

test('contradictory geography is clarified through city/bairro and corrected without asking state', () => {
  const messages = [message('Rio de Janeiro, SP')];
  const state = mergeInterpretation(initialState(), interpretation({ city: 'Rio de Janeiro', state: 'SP' }, messages), messages, date);
  expect(requirements(state)).toContain('city');
  expect(decide(state, empty)).toMatchObject({ action: 'clarify', field: 'city' });
  const correction = [message('É a cidade do Rio de Janeiro, moro em Campo Grande.', 20)];
  const clarified = interpretation({ city: 'Rio de Janeiro', neighborhood: 'Campo Grande' }, correction);
  clarified.observations.forEach((item) => { item.correction = true; });
  const next = mergeInterpretation(state, clarified, correction, date);
  expect(confirmed(next, 'state')).toBe('RJ');
  expect(requirements(next)).not.toContain('city');
});

test('confirmed neighborhood survives context eviction and does not become another city', () => {
  const prior = full();
  const messages = [message('Tenho CNPJ', 20)];
  const state = mergeInterpretation(prior, interpretation({ companyPresence: 'yes' }, messages, { suggestedField: 'state' }), messages, date);
  expect(confirmed(state, 'city')).toBe('Rio de Janeiro');
  expect(confirmed(state, 'neighborhood')).toBe('Campo Grande');
  expect(confirmed(state, 'state')).toBe('RJ');
  expect(requirements(state)).not.toContain('neighborhood');
  expect(requirements(state)).not.toContain('state');
});

test('city corrections retain former evidence but require a new neighborhood for the new capital', () => {
  const messages = [message('Corrigindo, agora moro em São Paulo', 20)];
  const update = interpretation({ city: 'São Paulo' }, messages);
  update.observations[0].correction = true;
  const state = mergeInterpretation(full(), update, messages, date);
  expect(confirmed(state, 'city')).toBe('São Paulo');
  expect(confirmed(state, 'state')).toBe('SP');
  expect(confirmed(state, 'neighborhood')).toBeNull();
  expect(state.facts.neighborhood?.value).toBe('Campo Grande');
  expect(state.facts.neighborhood?.evidence).toEqual(full().facts.neighborhood?.evidence);
  expect(decide(state, empty)).toMatchObject({ action: 'ask', field: 'neighborhood' });
});

test('an explicit conflicting UF is clarified instead of silently overwritten by geography', () => {
  const messages = [message('Rio de Janeiro, SP')];
  const state = mergeInterpretation(initialState(), interpretation({ city: 'Rio de Janeiro', state: 'SP' }, messages), messages, date);
  expect(state.facts.state).toMatchObject({ status: 'conflict', value: 'SP', conflictingValue: 'RJ' });
  expect(decide(state, empty)).toMatchObject({ action: 'clarify', field: 'city' });
});

test('resolving a city conflict invalidates the former neighborhood and a new address can replace it in one message', () => {
  const messages = [message('Agora moro em São Paulo', 20)];
  const ambiguous = interpretation({ city: 'São Paulo' }, messages);
  const conflicted = mergeInterpretation(full(), ambiguous, messages, date);
  const correction = interpretation({ city: 'São Paulo' }, messages); correction.observations[0].correction = true;
  expect(confirmed(mergeInterpretation(conflicted, correction, messages, date), 'neighborhood')).toBeNull();
  const address = interpretation({ city: 'São Paulo', neighborhood: 'Moema' }, messages);
  address.observations[0].correction = true;
  const updated = mergeInterpretation(full(), address, messages, date);
  expect(confirmed(updated, 'neighborhood')).toBe('Moema');
  expect(confirmed(updated, 'state')).toBe('SP');
});

test('prepared snapshots upgrade without losing facts; completing a capital without neighborhood is blocked', () => {
  const state = full(); delete state.facts.neighborhood;
  const old = { ...state, policyVersion: '2026-11-14' }; delete old.facts.state;
  const restored = readState(old)!;
  expect(restored.policyVersion).toBe('2026-11-15.2');
  expect(confirmed(restored, 'state')).toBe('RJ');
  expect(confirmed(restored, 'beneficiaries')).toEqual(confirmed(state, 'beneficiaries'));
  expect(() => assertDecision(restored, { action: 'complete', field: null, missing: [], reason: 'model_tag', handoffCode: 'QUALIFICACAO_COMPLETA' })).toThrow();
  const decision = decide(restored, empty);
  expect(validateWrittenReply(JSON.stringify({ text: 'Em qual bairro você mora?', commercialClaims: [] }), restored, decision)).toBe('Em qual bairro você mora?');
  expect(() => validateWrittenReply(JSON.stringify({ text: 'Em qual estado você mora?', commercialClaims: [] }), restored, decision)).toThrow();
});

test('only essential information blocks completion and unanswered optional questions are not repeated', () => {
  const state = full();
  delete state.facts.intent; delete state.facts.goal; delete state.facts.hasCurrentPlan;
  expect(requirements(state)).toEqual([]);
  let decision = decide(state, empty);
  expect(decision).toMatchObject({ action: 'ask', field: 'hasCurrentPlan', reason: 'optional_information' });
  assertDecision(state, decision);
  state.asked.hasCurrentPlan = 1;
  decision = decide(state, empty);
  expect(decision).toMatchObject({ action: 'ask', field: 'goal', reason: 'optional_information' });
  state.asked.goal = 1;
  expect(decide(state, empty)).toMatchObject({ action: 'complete' });
  const missingCompany = structuredClone(state); delete missingCompany.facts.companyPresence;
  expect(decide(missingCompany, { ...empty, suggestedField: 'hasCurrentPlan' })).toMatchObject({ action: 'ask', field: 'companyPresence' });
});

test.each(['hasCurrentPlan', 'goal'] as const)('optional %s can be ignored or declined without repetition, commercial loss or incomplete qualification', (field) => {
  const state = full(); delete state.facts[field];
  const question = decide(state, empty);
  expect(question).toMatchObject({ action: 'ask', field, reason: 'optional_information' });
  state.asked[field] = 1;
  expect(decide(state, empty).action).toBe('complete');
  const messages = [message('Prefiro não informar isso', 20)];
  const refusal: Interpretation = { ...empty, quoteDeclined: true,
    signals: [{ messageId: messages[0].id, quote: messages[0].content }],
    observations: [{ field, status: 'declined', value: null, messageId: messages[0].id, quote: messages[0].content, correction: false }] };
  const next = mergeInterpretation(state, refusal, messages, date);
  expect(decide(next, refusal)).toMatchObject({ action: 'complete', handoffCode: 'QUALIFICACAO_COMPLETA' });
});

test('CNPJ number is optional, offered once only to company owners and preserved when volunteered', () => {
  const state = full();
  expect(decide(state, empty).field).not.toBe('companyNumber');
  state.facts.companyPresence!.value = 'yes';
  state.facts.companyType = { ...state.facts.companyPresence!, value: 'mei' };
  const question = decide(state, empty);
  expect(question).toMatchObject({ action: 'ask', field: 'companyNumber', reason: 'optional_information', missing: [] });
  assertDecision(state, question);
  expect(validateWrittenReply(JSON.stringify({ text: 'Você tem o número do CNPJ do seu MEI? Ele ajuda a refinar a cotação.', commercialClaims: [] }), state, question))
    .toBe('Você tem o número do CNPJ do seu MEI? Ele ajuda a refinar a cotação.');
  expect(() => validateWrittenReply(JSON.stringify({ text: 'Você tem CNPJ ou MEI?', commercialClaims: [] }), state, question)).toThrow();
  state.asked.companyNumber = 1;
  expect(decide(state, empty)).toMatchObject({ action: 'complete', handoffCode: 'QUALIFICACAO_COMPLETA', missing: [] });
  const messages = [message('Prefiro não passar o número do MEI', 20)];
  const refusal: Interpretation = { ...empty, quoteDeclined: true,
    signals: [{ messageId: messages[0].id, quote: messages[0].content }],
    observations: [{ field: 'companyNumber', value: null, status: 'declined', correction: false, messageId: messages[0].id, quote: messages[0].content }] };
  const next = mergeInterpretation(state, refusal, messages, date);
  expect(confirmed(next, 'companyPresence')).toBe('yes');
  expect(decide(next, refusal)).toMatchObject({ action: 'complete', handoffCode: 'QUALIFICACAO_COMPLETA', missing: [] });
  const volunteered = [message('O número é 00.000.000/0000-00', 21)];
  const withNumber = mergeInterpretation(state, interpretation({ companyNumber: '00.000.000/0000-00' }, volunteered), volunteered, date);
  expect(confirmed(withNumber, 'companyNumber')).toBe('00.000.000/0000-00');
  expect(decisionTrace(withNumber, decide(withNumber, empty), 25)).not.toHaveProperty('companyNumber');
  expect(JSON.stringify(decisionTrace(withNumber, decide(withNumber, empty), 25))).not.toContain('00.000.000');
});

test.each([
  { intent: 'add_dependents', preferences: ['Plano para a família'] },
  { intent: 'expand_network', preferences: ['Melhorar a rede', 'Hospital Exemplo'] },
  { intent: 'pf_to_mei', preferences: ['Manter a operadora'] },
  { intent: 'portability', preferences: ['Aproveitar carências'] },
] as const)('initial qualification collects context without evaluating product eligibility: $intent', ({ intent, preferences }) => {
  const messages = [message('Minha família tem 0, 1, 2, 7, 24 e 27 anos. Somos de Belford Roxo. Tenho MEI e quero incluir meus filhos e melhorar a rede.')];
  const state = mergeInterpretation(initialState(), interpretation({ beneficiaryCount: 6,
    beneficiaries: [0, 1, 2, 7, 24, 27].map((age, index) => ({ id: `b${index+1}`, label: `Pessoa ${index+1}`, age })),
    city: 'Belford Roxo', companyPresence: 'yes', companyType: 'mei', hasCurrentPlan: 'yes', currentOperator: 'Klini',
    goal: 'Incluir os filhos e melhorar a rede', intent, preferences: [...preferences] }, messages), messages, date);
  state.facts.companyNumber = { value: null, status: 'unknown', updatedAt: date, evidence: [] };
  state.asked.companyNumber = 1;
  const decision = decide(state, empty);
  expect(requirements(state)).toEqual([]);
  expect(decision).toMatchObject({ action: 'complete', handoffCode: 'QUALIFICACAO_COMPLETA', missing: [] });
  assertDecision(state, decision);
  expect(internalBriefing(state, decision).review).toEqual([]);
  const incomplete = structuredClone(state); delete incomplete.facts.beneficiaries;
  expect(decide(incomplete, empty).action).not.toBe('complete');
  expect(() => assertDecision(incomplete, decision)).toThrow();
});

test('a product question is left to the broker while collecting missing essentials, without requiring optional answers first', () => {
  const question: Interpretation = { ...empty, question: { text: 'Tem carência?', topic: 'waiting_period' },
    signals: [{ messageId: 'synthetic-1', quote: 'Tem carência?' }] };
  const complete = full(); delete complete.facts.hasCurrentPlan; delete complete.facts.goal;
  expect(decide(complete, question)).toMatchObject({ action: 'complete', handoffCode: 'QUALIFICACAO_COMPLETA' });
  delete complete.facts.beneficiaries;
  expect(decide(complete, question)).toMatchObject({ action: 'ask', field: 'beneficiaries', handoffCode: null });
  expect(decide(full(), { ...empty, humanRequested: true, signals: [{ messageId: 'synthetic-1', quote: 'Quero falar com uma pessoa.' }] }))
    .toMatchObject({ action: 'handoff', reason: 'customer_requested_human', handoffCode: 'PRECISA_HUMANO' });
});

test.each(['beneficiaries', 'city', 'neighborhood'] as const)('essential %s gets a polite retry and cannot complete if still missing', (field) => {
  const state = full();
  state.facts[field] = { ...state.facts[field]!, status: 'unknown', value: null };
  state.asked[field] = 1;
  const decision = decide(state, empty);
  expect(decision).toMatchObject({ action: 'clarify', field, reason: 'essential_information_needed' });
  const sent = stateAfterSend({ state, decision, text: 'Você consegue conferir essa informação?', briefing: internalBriefing(state, decision) });
  expect(sent.asked[field]).toBe(2);
  expect(decide(sent, empty)).toMatchObject({ action: 'handoff', reason: 'essential_information_unavailable', handoffCode: 'PRECISA_HUMANO' });
  expect(() => assertDecision(sent, { action: 'complete', field: null, reason: 'forced', missing: [], handoffCode: 'QUALIFICACAO_COMPLETA' })).toThrow();
});

test('optional conflicts stay in internal memory without forcing a clarification or blocking essential qualification', () => {
  const state = full();
  state.facts.goal!.status = 'conflict'; state.facts.goal!.conflictingValue = 'Outro objetivo';
  state.asked.goal = 1;
  const decision = decide(state, empty);
  expect(decision.action).toBe('complete');
  expect(internalBriefing(state, decision)).toMatchObject({ pending: [], conflicts: [], optionalConflicts: ['goal'] });
});

test('spontaneous MEI ownership answers company presence even when only the company type was extracted', () => {
  const messages = [message('Tenho MEI e quero fazer uma cotação para nós.')];
  const state = mergeInterpretation(initialState(), interpretation({ companyType: 'mei' }, messages), messages, date);
  expect(confirmed(state, 'companyPresence')).toBe('yes');
  expect(state.facts.companyPresence?.evidence).toEqual(state.facts.companyType?.evidence);
  expect(requirements(state)).not.toContain('companyPresence');
  expect(decide(state, { ...empty, suggestedField: 'companyPresence' }).field).not.toBe('companyPresence');
  delete state.facts.companyPresence;
  expect(confirmed(readState(state)!, 'companyPresence')).toBe('yes');
  const later = [message('Agora podemos continuar', 20)];
  expect(confirmed(mergeInterpretation(state, empty, later, date), 'companyPresence')).toBe('yes');
});

test('a wish to use MEI never confirms ownership and a named current operator answers current-plan presence', () => {
  const messages = [message('Quero usar MEI, meu plano atual é a Operadora Exemplo.')];
  const state = mergeInterpretation(initialState(), interpretation({ targetModality: 'mei', currentOperator: 'Operadora Exemplo' }, messages), messages, date);
  expect(confirmed(state, 'companyPresence')).toBeNull();
  expect(confirmed(state, 'hasCurrentPlan')).toBe('yes');
  expect(state.facts.hasCurrentPlan?.evidence).toEqual(state.facts.currentOperator?.evidence);
});

test('out-of-order information survives later messages without reasking known ages, location or company ownership', () => {
  const original = [message('Tenho MEI, é para mim e minha esposa de 35 e 32 anos. Moramos no Rio, em Campo Grande.')];
  const state = mergeInterpretation(initialState(), interpretation({ companyType: 'mei', beneficiaryCount: 2,
    beneficiaries: [{ id: 'self', label: 'cliente', age: 35 }, { id: 'spouse', label: 'esposa', age: 32 }], city: 'Rio', neighborhood: 'Campo Grande' }, original), original, date);
  state.lastQuestion = 'hasCurrentPlan'; state.asked.hasCurrentPlan = 1;
  const nextMessages = [message('O reajuste pesou muito, quero diminuir o custo.', 20)];
  const next = mergeInterpretation(state, interpretation({ goal: 'Diminuir o custo' }, nextMessages), nextMessages, date);
  expect(requirements(next)).toEqual([]);
  expect(confirmed(next, 'companyPresence')).toBe('yes');
  expect(confirmed(next, 'beneficiaries')?.map((person) => person.age)).toEqual([35, 32]);
  expect(confirmed(next, 'neighborhood')).toBe('Campo Grande');
  expect(confirmed(next, 'city')).toBe('Rio de Janeiro');
  expect(decide(next, { ...empty, suggestedField: 'companyPresence' })).toMatchObject({ field: 'companyNumber', reason: 'optional_information' });
});

test('warm contextual questions and useful justifications pass validation without requiring canned acknowledgments', () => {
  const state = full(); delete state.facts.neighborhood;
  const decision = decide(state, empty);
  for (const text of ['Entendi, esse reajuste pesou para vocês. Em qual bairro vocês moram? Isso ajuda a orientar a pesquisa da rede na região.',
    'Em qual bairro vocês moram? Assim consigo orientar a pesquisa da rede perto de vocês.', 'Em qual bairro você mora?']) {
    expect(validateWrittenReply(JSON.stringify({ text, commercialClaims: [] }), state, decision)).toBe(text);
  }
});

test('company question may explain comparison of modalities without promising a universally lower price', () => {
  const state = full(); delete state.facts.companyPresence;
  const decision = decide(state, empty);
  expect(decision.field).toBe('companyPresence');
  const text = 'Para comparar as modalidades de contratação, você tem CNPJ ou MEI?';
  expect(validateWrittenReply(JSON.stringify({ text, commercialClaims: [] }), state, decision)).toBe(text);
  for (const promise of ['Com CNPJ sempre fica mais em conta.', 'Com CNPJ fica mais barato.', 'MEI garante economia.']) {
    expect(() => validateWrittenReply(JSON.stringify({ text: `${promise} Você tem CNPJ ou MEI?`, commercialClaims: [] }), state, decision)).toThrow();
  }
});

test('the question uses the brokers own voice rather than describing an assistant helping another broker', () => {
  const state = full(); delete state.facts.companyPresence;
  const decision = decide(state, empty);
  const direct = 'Você tem CNPJ ou MEI? Isso me ajuda a ver as opções para vocês.';
  expect(validateWrittenReply(JSON.stringify({ text: direct, commercialClaims: [] }), state, decision)).toBe(direct);
  const intermediary = 'Você tem CNPJ ou MEI? Essa informação ajuda a corretora a avaliar as modalidades para a cotação.';
  expect(() => validateWrittenReply(JSON.stringify({ text: intermediary, commercialClaims: [] }), state, decision)).toThrow();
});
const simulationRows: Record<string, unknown>[] = [];
afterAll(() => {
  if (process.env.AUTONOMOUS_V2_REPORT_PATH) writeFileSync(process.env.AUTONOMOUS_V2_REPORT_PATH, JSON.stringify({
    mode: 'offline_mocked_interpretation_and_writing', policyVersion: '2026-11-15.2', scenarios: simulationRows,
    limitations: ['Intent values are annotated fixture inputs, not measured LLM predictions.',
      'Legacy extraction is executed on the same synthetic transcript; historical model responses are unavailable.',
      'No real model, WhatsApp, remote database, deployment or business result is measured.'],
  }, null, 2));
});

describe('V2 — regressão comercial com intérprete e redator simulados', () => {
  test.each(scenarios)('$id — $name', async (scenario) => {
    const observations = interpretation(scenario.values, scenario.messages, scenario.extras);
    if (scenario.unknown) observations.observations.push({ field: scenario.unknown, value: null, status: 'unknown', correction: false,
      messageId: scenario.messages[0].id, quote: scenario.messages[0].content });
    const generate = vi.fn(async (request) => {
      if (request.stage === 'interpret') return JSON.stringify(observations);
      const { action: decision } = JSON.parse(request.userPrompt);
      return JSON.stringify({ text: scenario.reply, action: decision.action, questionField: decision.field, commercialClaims: [] });
    });
    const turn = await runV2Turn({ messages: scenario.messages, previous: initialState(), now: date, configVersion: 25, generate });
    const legacy = extractAutonomousQualificationState(scenario.messages, date);
    simulationRows.push({ id: scenario.id, name: scenario.name,
      baseline: { ages: legacy.lives.items.map((life) => life.age), pending: legacy.missingRequiredFields, projectionStatus: legacy.status,
        incompleteTagAcceptedByOldValidator: validateAutonomousReplyOutput('Vou preparar a cotação. [[HANDOFF: QUALIFICACAO_COMPLETA]]', scenario.messages).valid },
      v2: { ...decisionTrace(turn.state, turn.decision, 25), ages: confirmed(turn.state, 'beneficiaries')?.map((life) => life.age), text: turn.text,
        invalidCompleteHandoff: turn.decision.handoffCode === 'QUALIFICACAO_COMPLETA' && requirements(turn.state).length > 0 } });
    expect(turn.decision.action).toBe(scenario.action);
    expect(generate.mock.calls.map(([request]) => request.stage)).toEqual(['interpret', 'write']);
    expect(turn.text).not.toMatch(/[：:—–]|\[\[HANDOFF/);
    expect((turn.text.match(/\?/g) ?? []).length).toBeLessThanOrEqual(1);
    if (turn.decision.handoffCode === 'QUALIFICACAO_COMPLETA') {
      expect(requirements(turn.state)).toEqual([]);
      expect(turn.briefing.review).toEqual([]);
    }
    if (scenario.id === 1) {
      expect(confirmed(turn.state, 'intent')).toBe('pf_to_mei');
      expect(confirmed(turn.state, 'beneficiaries')?.map((life) => life.age)).toEqual([80, 80]);
      expect(turn.briefing.confirmed.companyType).toBe('mei');
      expect(turn.decision).toMatchObject({ action: 'ask', field: 'companyNumber', reason: 'optional_information', handoffCode: null });
    }
  });
});

test('characterizes the original extractor losing an equal age and the original validator accepting an incomplete tag', () => {
  const history = [{ role: 'lead' as const, content: 'É para mim e minha esposa, duas vidas de 80 anos. Rio de Janeiro. Tenho Leve Saúde e quero mudar de pessoa física para MEI.' }];
  const baseline = extractAutonomousQualificationState(history, date);
  expect(baseline.lives.items.map((life) => life.age)).toEqual([80, null]);
  expect(baseline.company.hasCnpjOrMei).toBe('no');
  expect(baseline.missingRequiredFields).toContain('ages');
  expect(validateAutonomousReplyOutput('Vou preparar a cotação. [[HANDOFF: QUALIFICACAO_COMPLETA]]', history).valid).toBe(true);
});

test('model suggestions cannot complete, reopen known fields or ask optional generic questions', () => {
  const state = full();
  expect(decide(state, { ...empty, suggestedField: 'currentOperator' }).action).toBe('complete');
  delete state.facts.city;
  expect(decide(state, { ...empty, suggestedField: 'companyPresence' })).toMatchObject({ action: 'ask', field: 'city' });
  expect(() => assertDecision(state, { action: 'complete', field: null, missing: [], reason: 'model_tag', handoffCode: 'QUALIFICACAO_COMPLETA' })).toThrow();
  expect(() => assertDecision(state, { action: 'ask', field: 'companyPresence', missing: [], reason: 'model_question', handoffCode: null })).toThrow();
});

test('confirmed facts survive history eviction, uncertain inference and an unknown answer', () => {
  const old = full();
  const msgs = [message('Não sei, acho que mudou', 10)];
  const uncertain = interpretation({}, msgs);
  uncertain.observations = [{ field: 'city', value: null, status: 'unknown', correction: false, messageId: msgs[0].id, quote: msgs[0].content }];
  const next = mergeInterpretation(old, uncertain, msgs, date);
  expect(confirmed(next, 'city')).toBe('Rio de Janeiro');
  expect(requirements(next)).toEqual([]);
  expect(readState(next)).toEqual(next);
  expect(unseenMessages(msgs, next)).toEqual([]);
});

test('conflicts require clarification; explicit correction updates only the requested fact with evidence', () => {
  const prior = full();
  const msgs = [message('Moro em Niterói', 10)];
  const update = interpretation({ city: 'Niterói' }, msgs);
  const conflict = mergeInterpretation(prior, update, msgs, date);
  expect(conflict.facts.city).toMatchObject({ value: 'Rio de Janeiro', status: 'conflict', conflictingValue: 'Niterói' });
  expect(decide(conflict, empty)).toMatchObject({ action: 'clarify', field: 'city' });
  update.observations[0].correction = true;
  const corrected = mergeInterpretation(conflict, update, msgs, date);
  expect(confirmed(corrected, 'city')).toBe('Niterói');
  expect(confirmed(corrected, 'beneficiaries')).toEqual(confirmed(prior, 'beneficiaries'));
  expect(corrected.facts.city?.evidence).toHaveLength(2);
});

test('partial beneficiary updates preserve confirmed ages and explicit corrections preserve the other person', () => {
  const data = scenarios[13];
  let prior = mergeInterpretation(initialState(), interpretation(data.values, data.messages), data.messages, date);
  const msgs = [message('Minha esposa tem 81 anos', 10)];
  const update = interpretation({ beneficiaries: [{ id: 'spouse', label: 'esposa', age: null }] }, msgs);
  prior = mergeInterpretation(prior, update, msgs, date);
  expect(confirmed(prior, 'beneficiaries')?.map((life) => life.age)).toEqual([80, 80]);
  const corrected = interpretation({ beneficiaries: [{ id: 'self', label: 'cliente', age: 80 }, { id: 'spouse', label: 'esposa', age: 81 }] }, msgs);
  corrected.observations[0].correction = true;
  expect(confirmed(mergeInterpretation(prior, corrected, msgs, date), 'beneficiaries')?.map((life) => life.age)).toEqual([80, 81]);
  corrected.observations[0].value = [{ id: 'spouse', label: 'esposa', age: 81 }];
  expect(confirmed(mergeInterpretation(prior, corrected, msgs, date), 'beneficiaries')?.map((life) => life.age)).toEqual([80, 81]);
  corrected.observations[0].removedBeneficiaryIds = ['self'];
  expect(confirmed(mergeInterpretation(prior, corrected, msgs, date), 'beneficiaries')).toEqual([{ id: 'spouse', label: 'esposa', age: 81 }]);
});

test('goal changes preserve unrelated facts without applying product eligibility rules', () => {
  const msgs = [message('Agora quero mudar para MEI mantendo a operadora', 10)];
  const update = interpretation({ intent: 'pf_to_mei', goal: 'Mudar PF para MEI' }, msgs);
  update.observations.forEach((item) => { item.correction = true; });
  const state = mergeInterpretation(full(), update, msgs, date);
  expect(confirmed(state, 'intent')).toBe('pf_to_mei');
  expect(confirmed(state, 'beneficiaryCount')).toBe(1);
  expect(decide(state, empty).handoffCode).toBe('QUALIFICACAO_COMPLETA');
});

test('bare number is interpreted using the actual last question without restarting', async () => {
  const previous = full();
  delete previous.facts.beneficiaries;
  previous.lastQuestion = 'beneficiaries';
  const msgs = [message('35', 10)];
  const turn = await runV2Turn({ previous, messages: msgs, now: date, configVersion: 25, generate: async (request) => {
    if (request.stage === 'interpret') {
      expect(JSON.parse(request.userPrompt).lastSentQuestion).toBe('beneficiaries');
      return JSON.stringify(interpretation({ beneficiaries: [{ id: 'self', label: 'cliente', age: 35 }] }, msgs));
    }
    return JSON.stringify({ text: 'A equipe vai dar continuidade à sua cotação.', action: 'complete', questionField: null, commercialClaims: [] });
  } });
  expect(turn.decision.action).toBe('complete');
});

test('unanswered questions get a bounded retry, only sent questions increment the counter', async () => {
  const previous = full(); delete previous.facts.neighborhood;
  const msgs = [message('Pode continuar', 10)];
  const run = async (state: V2State) => runV2Turn({ previous: state, messages: msgs, now: date, configVersion: 25, generate: async (request) =>
    request.stage === 'interpret' ? JSON.stringify(empty) : JSON.stringify({ text: 'Em qual bairro você mora?', commercialClaims: [] }) });
  const turn = await run(previous);
  expect(turn.state.asked.neighborhood).toBeUndefined();
  expect(stateAfterSend(turn).asked.neighborhood).toBe(1);
  previous.asked.neighborhood = 2;
  expect(decide(previous, empty)).toMatchObject({ action: 'handoff', reason: 'question_attempts_exhausted' });
});

test('evidence must be literal and come from a new customer message; malformed JSON never reaches the writer', async () => {
  const msgs = [message('Olá')];
  const fake = interpretation({ companyPresence: 'yes' }, msgs);
  fake.observations[0].quote = 'Tenho MEI';
  expect(() => parseInterpretation(JSON.stringify(fake), msgs)).toThrow();
  fake.observations[0].quote = 'Olá'; fake.observations[0].messageId = 'nonexistent';
  expect(() => parseInterpretation(JSON.stringify(fake), msgs)).toThrow();
  const generator = vi.fn(async () => '[[HANDOFF: QUALIFICACAO_COMPLETA]]');
  await expect(runV2Turn({ messages: msgs, previous: initialState(), now: date, configVersion: 25, generate: generator })).rejects.toThrow();
  expect(generator).toHaveBeenCalledTimes(1);
});

test.each(['Garantimos aceitação.', 'Pode migrar sem carência.', 'Vai pagar menos.', 'O valor é R$ 300,00.', 'Seu MEI está elegível.', 'A carência será aproveitada.', 'Resposta — interna', 'Sou a Maria.'])('rejects unsafe/unauthorized copy %s', (text) => {
  const state = full(); const decision = decide(state, empty);
  expect(() => validateWrittenReply(JSON.stringify({ text, action: decision.action, questionField: null, commercialClaims: [] }), state, decision)).toThrow();
});

test('customer cannot change the authorized action or expose internal summary through a tag', () => {
  const state = full(); delete state.facts.city;
  const decision = decide(state, empty);
  expect(() => validateWrittenReply(JSON.stringify({ text: 'Pronto', action: 'complete', questionField: null, commercialClaims: [] }), state, decision)).toThrow();
  expect(() => validateWrittenReply(JSON.stringify({ text: '[[HANDOFF: QUALIFICACAO_COMPLETA]]', action: decision.action, questionField: decision.field, commercialClaims: [] }), state, decision)).toThrow();
});

test('CRM data is reusable and lower authority than a customer correction; modality is not company ownership', () => {
  const state = seedState({ city: 'Campinas', state: 'SP', currentOperator: 'Amil' }, date);
  const msgs = [message('Vou usar em Niterói RJ', 10)];
  const next = mergeInterpretation(state, interpretation({ city: 'Niterói', state: 'RJ' }, msgs), msgs, date);
  expect(confirmed(next, 'city')).toBe('Niterói');
  expect(confirmed(next, 'companyPresence')).toBeNull();
  expect(confirmed(next, 'currentOperator')).toBe('Amil');
  const restored = restoreV2State({ schemaVersion: 2, facts: { location: { value: { cityStatus: 'known', city: 'Campinas', state: 'SP' } } } }, {}, date);
  expect(restored.facts.city).toMatchObject({ value: 'Campinas', status: 'uncertain' });
  expect(confirmed(restored, 'city')).toBeNull();
  expect(() => restoreV2State({ attendanceV2: { version: 7 } }, {}, date)).toThrow();
});

test('legacy migration rebuilds earlier answers from their messages instead of repeating questions or trusting erroneous ages', async () => {
  const previous = restoreV2State({ qualification: { lives: { countStatus: 'known', count: 2, items: [
    { id: 'self', label: 'cliente', ageStatus: 'known', age: 81 }, { id: 'spouse', label: 'esposa', ageStatus: 'known', age: 79 },
  ] }, location: { cityStatus: 'known', city: 'Rio de Janeiro', state: 'RJ' } } }, {}, date);
  const first = message('Eu e minha esposa, 80 anos cada, Niterói', 1);
  const middle = Array.from({ length: 18 }, (_, index) => ({ ...message('Vou continuar o atendimento.', index + 2), role: 'ai' as const }));
  const latest = message('Tenho MEI', 21);
  const history = [first, ...middle, latest];
  const generated = interpretation({ beneficiaryCount: 2, beneficiaries: [{ id: 'self', label: 'cliente', age: 80 },
    { id: 'spouse', label: 'esposa', age: 80 }], city: 'Niterói' }, [first]);
  generated.observations.push(...interpretation({ companyPresence: 'yes', companyType: 'mei' }, [latest]).observations);
  const turn = await runV2Turn({ messages: history, previous, now: date, configVersion: 1, generate: async request => {
    if (request.stage === 'interpret') {
      const payload = JSON.parse(request.userPrompt);
      expect(payload.recentMessages).toHaveLength(history.length);
      expect(payload.newMessages.map((row: { id: string }) => row.id)).toEqual([first.id, latest.id]);
      return JSON.stringify(generated);
    }
    return JSON.stringify({ text: 'Vocês têm plano atualmente?', commercialClaims: [] });
  } });
  expect(turn.decision).toMatchObject({ action: 'ask', field: 'hasCurrentPlan', missing: [] });
  expect(confirmed(turn.state, 'beneficiaries')?.map(life => life.age)).toEqual([80, 80]);
  expect(confirmed(turn.state, 'city')).toBe('Niterói');
  expect(turn.state.facts.beneficiaries?.evidence.some(evidence => evidence.source === 'conversation')).toBe(true);
});

test('unverifiable legacy projections alone cannot authorize complete qualification', () => {
  const legacy = { qualification: { lives: { countStatus: 'known', count: 1, items: [{ id: 'self', label: 'cliente', ageStatus: 'known', age: 35 }] },
    location: { cityStatus: 'known', city: 'Niterói', state: 'RJ' }, company: { answerStatus: 'known', hasCnpjOrMei: 'no' } } };
  const imported = restoreV2State(legacy, {}, date);
  expect(requirements(imported)).toContain('beneficiaries');
  expect(decide(imported, empty).action).not.toBe('complete');
});

test('legacy evidence lookup ignores malformed identifiers, deduplicates and does not reload V2 history', () => {
  const id = '00000000-0000-0000-0000-000000000001';
  const memory = { facts: { lives: { evidence: [{ source_message_id: id }, { source_message_id: 'not-a-uuid' }] } },
    commercial: { goal: { evidence: [{ source_message_id: id }] } } };
  expect(legacyEvidenceMessageIds(memory)).toEqual([id]);
  expect(legacyEvidenceMessageIds({ ...memory, attendanceV2: initialState() })).toEqual([]);
});

test('arrival cursor supports late historical timestamps and ignores already incorporated fragments', () => {
  const state = full();
  state.cursor = { id: 'a', receivedAt: '2026-11-14T13:00:00.000Z' };
  const late = { ...message('Correção', 10), receivedAt: '2026-11-14T13:01:00.000Z' };
  expect(unseenMessages([late], state)).toEqual([late]);
  expect(unseenMessages([{ ...late, receivedAt: '2026-11-14T12:59:00.000Z' }], state)).toEqual([]);
  state.cursor = { id: late.id, receivedAt: '2026-11-14T13:01:00+00:00' };
  expect(unseenMessages([late], state)).toEqual([]);
});

test('prepared retries reuse the approved turn; telemetry has no PII or quote', () => {
  const state = full(); const decision = decide(state, empty);
  const memory = { source_message_id: 'source', attendanceV2: state, v2Decision: decision, v2Reply: 'A equipe vai dar continuidade à sua cotação.' };
  expect(resumePreparedTurn(memory, 'source')?.decision).toEqual(decision);
  expect(resumePreparedTurn(memory, 'other')).toBeNull();
  expect(JSON.stringify(decisionTrace(state, decision, 25))).not.toMatch(/Rio de Janeiro|35|synthetic|quote/);
});
test('only an explicit quotation refusal can mark a loss; ambiguous refusal preserves the commercial status', () => {
  expect(decide(full(), { ...empty, quoteDeclined: true, signals: [{ messageId: 'x', quote: 'Não quero cotação' }] }))
    .toMatchObject({ action: 'handoff', handoffCode: 'RECUSOU_COTACAO' });
  expect(decide(full(), { ...empty, quoteDeclined: true, signals: [{ messageId: 'x', quote: 'Não quero trocar de operadora' }] }))
    .toMatchObject({ action: 'handoff', handoffCode: 'PRECISA_HUMANO' });
});
