import { expect, test } from 'vitest';
import { readStyleLibrary, selectStyleExamples } from '../autonomous-attendance-v2/domain/style.ts';
import { decide } from '../autonomous-attendance-v2/domain/decision.ts';
import { initialState, mergeInterpretation, type Interpretation } from '../autonomous-attendance-v2/domain/state.ts';
import { runV2Turn } from '../autonomous-attendance-v2/domain/turn.ts';
import { date, interpretation, message } from './fixtures/autonomous-v2-scenarios.ts';

const empty: Interpretation = { observations: [], humanRequested: false, quoteDeclined: false, irritated: false, question: null, suggestedField: null, signals: [] };
const library = readStyleLibrary({ version: 'test-1', examples: [
  { id: 'style-000000000001', field: 'beneficiaries', text: 'Perfeito! E qual é a sua idade?', audience: 'individual' },
  { id: 'style-000000000002', field: 'beneficiaries', text: 'Me fala, quantos anos você tem?', audience: 'individual' },
  { id: 'style-000000000003', field: 'beneficiaries', text: 'E quais são as idades de vocês?', audience: 'family' },
  { id: 'style-000000000004', field: 'city', text: 'Em que cidade e bairro você mora?', audience: 'any' },
] });

test('retrieves matching subjects and audience, avoids recent repeated openings and caps the examples', () => {
  const messages = [message('Só eu')];
  const state = mergeInterpretation(initialState(), interpretation({ beneficiaryCount: 1 }, messages), messages, date);
  const decision = decide(state, empty);
  const selected = selectStyleExamples(library, decision, 1, ['Perfeito! Vou conferir.']);
  expect(selected.map(row => row.id)).toEqual(['style-000000000002', 'style-000000000001']);
  expect(selectStyleExamples(library, decision, 2, []).map(row => row.id)).toEqual(['style-000000000003']);
  expect(selectStyleExamples(undefined, decision, 1, [])).toEqual([]);
  expect(selectStyleExamples(library, { ...decision, action: 'handoff', field: null }, 1, [])).toEqual([]);
});
test('invalid and duplicated references fail explicitly', () => {
  expect(() => readStyleLibrary({ version: 'x', examples: [{ ...library.examples[0], field: 'unsupported' }] })).toThrow();
  expect(() => readStyleLibrary({ version: 'x', examples: [library.examples[0], library.examples[0]] })).toThrow();
});
test('history references go only to writing; they do not enter interpretation, qualification memory or the chosen action', async () => {
  const messages = [message('Só para mim')];
  const extracted = interpretation({ beneficiaryCount: 1 }, messages);
  const prompts: { stage: string; payload: Record<string, unknown> }[] = [];
  const invoke = (withStyle: boolean) => runV2Turn({ messages, previous: initialState(), now: date, configVersion: 1,
    styleLibrary: withStyle ? library : undefined,
    generate: async request => {
      prompts.push({ stage: request.stage, payload: JSON.parse(request.userPrompt) });
      return request.stage === 'interpret' ? JSON.stringify(extracted) : JSON.stringify({ text: 'Perfeito! Qual é a sua idade?', commercialClaims: [] });
    },
  });
  const withStyle = await invoke(true); const withoutStyle = await invoke(false);
  expect(withStyle.state).toEqual(withoutStyle.state);
  expect(withStyle.decision).toEqual(withoutStyle.decision);
  expect(prompts[0].payload).not.toHaveProperty('styleReferences');
  expect(prompts[1].payload.styleReferences).toHaveLength(2);
  expect(prompts[3].payload).not.toHaveProperty('styleReferences');
  expect(withStyle.styleTrace).toEqual({ libraryVersion: 'test-1', referenceIds: ['style-000000000001', 'style-000000000002'] });
  expect(withStyle.state.facts).not.toHaveProperty('city');
});
