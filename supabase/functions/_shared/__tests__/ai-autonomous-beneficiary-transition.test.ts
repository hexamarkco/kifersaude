import { describe, expect, test } from 'vitest';
import { extractAutonomousQualificationState } from '../ai-autonomous-qualification.ts';
import { validateAutonomousReplyOutput } from '../ai-autonomous-helpers.ts';
import { adultAddedToChildQuote } from './fixtures/adult-added-to-child-quote.ts';

const stateFrom = (history = adultAddedToChildQuote) => extractAutonomousQualificationState(history, '2026-10-09T12:00:00.000Z');

describe('adding an adult to a child quote', () => {
  test('an existing family plan does not confirm adults in the child quote', () => {
    const history = adultAddedToChildQuote.slice(0, 3);
    expect(stateFrom(history).lives.items.map((life) => [life.role, life.age])).toEqual([['child', 4]]);
    expect(validateAutonomousReplyOutput('Você quer avaliar uma cotação incluindo um adulto junto com seu filho?', history).valid).toBe(true);
  });
  test('keeps both ages after the wife joins, without adding the person typing', () => {
    const state = stateFrom();
    expect(state.lives.count).toBe(2);
    expect(state.lives.items.map((life) => [life.role, life.age])).toEqual([['adult', 39], ['child', 4]]);
    expect(state.missingRequiredFields).not.toContain('ages');
  });

  test('addresses the only adult beneficiary rather than historical family mentions', () => {
    expect(validateAutonomousReplyOutput('Sua esposa tem CNPJ ou MEI? Dependendo do caso, pode ficar mais em conta.', adultAddedToChildQuote).valid).toBe(true);
    for (const reply of ['Você tem CNPJ ou MEI?', 'Você ou sua esposa tem CNPJ ou MEI?', 'Sua esposa ou você tem CNPJ ou MEI?', 'Alguém que vai entrar no plano tem CNPJ ou MEI?', 'Seu filho tem CNPJ ou MEI?']) {
      expect(validateAutonomousReplyOutput(reply, adultAddedToChildQuote).valid, reply).toBe(false);
    }
  });

  test('a correction to the child age preserves the adult age', () => {
    const state = stateFrom([...adultAddedToChildQuote, { role: 'lead', content: 'Corrigindo, meu filho fez 5 anos.' }]);
    expect(state.lives.items.map((life) => life.age)).toEqual([39, 5]);
  });

  test('does not mistake a CNPJ acknowledgement followed by a plan question for another CNPJ question', () => {
    const history = [...adultAddedToChildQuote, { role: 'ai' as const, content: 'Sua esposa tem CNPJ ou MEI?' }, { role: 'lead' as const, content: 'Ela não tem CNPJ nem MEI.' }];
    expect(validateAutonomousReplyOutput('Tudo bem, podemos cotar sem CNPJ. Qual é a operadora do plano atual?', history).valid).toBe(true);
    expect(validateAutonomousReplyOutput('Sem CNPJ, qual é a operadora do plano atual?', history).valid).toBe(true);
    expect(validateAutonomousReplyOutput('Sua esposa pode cotar sem CNPJ. Você tem CNPJ ou MEI?', adultAddedToChildQuote).valid).toBe(false);
  });

  test('a correction to the adult age preserves the child age', () => {
    const state = stateFrom([...adultAddedToChildQuote, { role: 'lead', content: 'Corrigindo, minha esposa tem 40 anos.' }]);
    expect(state.lives.items.map((life) => life.age)).toEqual([40, 4]);
  });

  test('also preserves the child when the person typing joins', () => {
    const history = [...adultAddedToChildQuote.slice(0, -1), { role: 'lead' as const, content: 'Eu entro, tenho 38 anos.' }];
    expect(stateFrom(history).lives.items.map((life) => life.age)).toEqual([38, 4]);
    expect(validateAutonomousReplyOutput('Você tem CNPJ ou MEI?', history).valid).toBe(true);
    expect(validateAutonomousReplyOutput('Sua esposa tem CNPJ ou MEI?', history).valid).toBe(false);
  });

  test('still requires a question covering both adults for a couple with a child', () => {
    const history = [{ role: 'lead' as const, content: 'Para mim e minha esposa e nosso filho. Eu tenho 40 anos, ela tem 39 anos e meu filho tem 4 anos.' }];
    expect(stateFrom(history).lives.items.map((life) => [life.role, life.age])).toEqual([['adult', 40], ['adult', 39], ['child', 4]]);
    expect(validateAutonomousReplyOutput('Sua esposa tem CNPJ ou MEI?', history).valid).toBe(false);
    expect(validateAutonomousReplyOutput('Você ou sua esposa tem CNPJ ou MEI?', history).valid).toBe(true);
  });
});
