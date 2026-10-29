import { describe, expect, test } from 'vitest';
import { deriveAutonomousConversationMemory, buildAutonomousMemoryPrompt, type MemoryMessage } from '../ai-autonomous-memory.ts';
import { buildAutonomousAttendanceUserPrompt, validateAutonomousReplyOutput } from '../ai-autonomous-helpers.ts';
const date = '2026-10-29T12:00:00Z';
const history = (...texts: string[]): MemoryMessage[] => texts.map((content, index) => ({
  id: `synthetic-${index}`, messageAt: date, role: content.startsWith('AI ') ? 'ai' : 'lead', content: content.replace(/^AI /, ''),
}));

describe('evidence based autonomous memory', () => {
  test('T01 origin corporate plan never confirms eligible destination CNPJ', () => {
    const messages = history('Tenho SulAmérica empresarial para 3 pessoas. Está caro, quero portabilidade.',
      'AI Quais são as idades?', '46, 51 e 24', 'AI Em qual cidade e estado?', 'Macapá/AP. Preciso de abrangência nacional.',
      'AI Alguém tem CNPJ?', 'Meu plano atual é empresarial por CNPJ');
    const state = deriveAutonomousConversationMemory(messages, date);
    expect(state.qualification.company.hasCnpjOrMei).toBe('unknown');
    expect(state.qualification.currentHealthPlan.operator).toBe('Sul América');
    expect(state.commercial).toMatchObject({ reduceCost: { status: 'confirmed' }, portability: { status: 'confirmed' },
      nationalCoverage: { status: 'confirmed' }, originContract: { status: 'confirmed' } });
    expect(state.commercial.nationalCoverage.evidence[0].source_message_id).toBe('synthetic-4');
    expect(buildAutonomousMemoryPrompt(state)).not.toContain('evidence');
  });

  test('T02 consecutive operator answer is incorporated and the repeated question is rejected', () => {
    const messages = history('AI Você tem plano?', 'Tenho mas vou cancelar', 'Tenho Med Sênior');
    const state = deriveAutonomousConversationMemory(messages, date);
    expect(state.qualification.currentHealthPlan.operator).toBe('MedSênior');
    expect(state.commercial.cancellation.status).toBe('confirmed');
    expect(validateAutonomousReplyOutput('Qual é a sua operadora atual?', messages).valid).toBe(false);
    expect(validateAutonomousReplyOutput('O que está fazendo você querer cancelar?', messages).valid).toBe(true);
  });

  test('T04 each short negation belongs only to its pending question', () => {
    const messages = history('Só para mim, tenho 63 anos', 'AI Em qual cidade e estado?', 'Paraná', 'Curitiba',
      'AI Você tem CNPJ ou MEI?', 'Não tenho');
    const first = deriveAutonomousConversationMemory(messages, date);
    expect(first.qualification.company.hasCnpjOrMei).toBe('no');
    expect(first.qualification.currentHealthPlan.hasPlan).toBe('unknown');
    const final = deriveAutonomousConversationMemory([...messages, ...history('AI Você já tem plano de saúde?', 'Não tenho')], date);
    expect(final.qualification.currentHealthPlan.hasPlan).toBe('no');
    expect(final.qualification.location).toMatchObject({ city: 'Curitiba', state: 'PR', neighborhoodRequired: false });
    expect(final.qualification.status).toBe('complete');
  });

  test('T05 keeps both compositions and both supplied ages in the evidence and shared prompt', () => {
    const messages = history('Quero comparar só para mim, tenho 59 anos, ou incluir meu filho de 31 anos');
    const state = deriveAutonomousConversationMemory(messages, date);
    expect(state.commercial.alternatives.value).toBe(messages[0].content);
    expect(state.commercial.alternatives.evidence).toEqual([{ source_message_id: messages[0].id, message_at: date, evidence: messages[0].content }]);
    expect(buildAutonomousAttendanceUserPrompt(messages)).toContain(messages[0].content);
  });

  test.each([8, 12, 15])('T06 under twelve operational restriction is scoped correctly at age %s', (age) => {
    const state = deriveAutonomousConversationMemory(history(`Somente para minha filha de ${age} anos`), date);
    expect(state.qualification.singleUnderTwelveWithoutAdult).toBe(age < 12);
    expect(state.qualification.company.hasCnpjOrMei).toBe('unknown');
    expect(state.qualification.missingRequiredFields).not.toContain('has_cnpj_or_mei');
  });

  test('preserves corrections with source evidence and clears the old operator after a later denial', () => {
    const messages = history('Tenho Unimed', 'AI Em qual cidade?', 'Curitiba', 'AI Em qual cidade vai usar?', 'Na verdade, vou usar em Macapá/AP', 'Não tenho plano');
    const state = deriveAutonomousConversationMemory(messages, date);
    expect(state.qualification.currentHealthPlan).toMatchObject({ hasPlan: 'no', operator: null });
    expect(state.facts.currentHealthPlan.evidence.map((item) => item.source_message_id)).toContain('synthetic-0');
    expect(state.facts.currentHealthPlan.status).toBe('negated');
    expect(state.qualification.location.city).toBe('Macapá');
  });

  test('bounded windows preserve v2 commercial evidence and accept legacy v1 state safely', () => {
    const previous = deriveAutonomousConversationMemory(history('Quero portabilidade'), date);
    const next = deriveAutonomousConversationMemory(history('Bom dia'), date, undefined, previous);
    expect(next.commercial.portability).toEqual(previous.commercial.portability);
    expect(deriveAutonomousConversationMemory([], date, undefined, { schemaVersion: 1 }).schemaVersion).toBe(2);
    expect(next.control.historyWindowComplete).toBe(false);
  });

  test('distinguishes uncertainty and explicit withdrawal of a priority', () => {
    expect(deriveAutonomousConversationMemory(history('Talvez queira portabilidade'), date).commercial.portability.status).toBe('uncertain');
    expect(deriveAutonomousConversationMemory(history('Não quero portabilidade'), date).commercial.portability.status).toBe('negated');
  });
});
