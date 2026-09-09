import { describe, expect, it } from 'vitest';

import {
  buildFollowUpGenerateUserPrompt,
  FOLLOW_UP_RUNTIME_GUARDRAILS,
  FOLLOW_UP_GENERATE_SYSTEM_PROMPT,
} from '../comm-whatsapp-follow-up-generate-prompt.ts';
import {
  parseFollowUpOutput,
  validateFollowUpBusinessOutput,
  validateFollowUpTechnicalOutput,
} from '../comm-whatsapp-follow-up-output.ts';

describe('single-call follow-up prompt', () => {
  it('passes the five direct context blocks without analysis or strategy JSON', () => {
    const prompt = buildFollowUpGenerateUserPrompt({
      transcript: 'Cliente: vou falar com meu marido.',
      leadContext: 'Nome: Ana',
      temporalFacts: 'Último contato há 2 dias.',
      recentAudits: 'Mensagem anterior sem resposta.',
      styleProfile: 'Curto e natural.',
    });

    expect(prompt).toContain('HISTÓRICO DA CONVERSA');
    expect(prompt).toContain('CONTEXTO DO LEAD');
    expect(prompt).toContain('FATOS TEMPORAIS');
    expect(prompt).toContain('AUDITORIAS RECENTES');
    expect(prompt).toContain('PERFIL DE ESTILO');
    expect(prompt).not.toContain('COMMERCIAL ANALYSIS');
    expect(prompt).not.toContain('VALIDATION FEEDBACK');
  });

  it('preserves the commercial cases required by the consolidated prompt', () => {
    expect(FOLLOW_UP_GENERATE_SYSTEM_PROMPT).toMatch(/enviar cotação/iu);
    expect(FOLLOW_UP_GENERATE_SYSTEM_PROMPT).toMatch(/obrigação da própria Luiza/iu);
    expect(FOLLOW_UP_GENERATE_SYSTEM_PROMPT).toMatch(/marido/iu);
    expect(FOLLOW_UP_GENERATE_SYSTEM_PROMPT).toMatch(/tentativas sem progresso/iu);
    expect(FOLLOW_UP_GENERATE_SYSTEM_PROMPT).toMatch(/sinais concretos de compra/iu);
    expect(FOLLOW_UP_GENERATE_SYSTEM_PROMPT).toMatch(/não volte ao discurso de convencimento/iu);
    expect(FOLLOW_UP_GENERATE_SYSTEM_PROMPT).toMatch(/Silêncio isolado não é objeção/iu);
  });

  it('allows the same call to recommend waiting instead of inventing a social touch', () => {
    expect(FOLLOW_UP_RUNTIME_GUARDRAILS).toContain('[[WAIT:recent_contact]]');
    expect(FOLLOW_UP_RUNTIME_GUARDRAILS).toContain('[[WAIT:future_date:AAAA-MM-DD]]');
    expect(FOLLOW_UP_RUNTIME_GUARDRAILS).toMatch(/não gere uma mensagem puramente social/iu);
  });
});

describe('deterministic technical validation', () => {
  it('accepts usable text without asking another AI to judge quality', () => {
    expect(validateFollowUpTechnicalOutput('Ana, posso confirmar qual opção você prefere?')).toEqual({ valid: true });
    expect(validateFollowUpTechnicalOutput('Oi, Ana!\n---\nPosso confirmar a opção que você escolheu?')).toEqual({ valid: true });
  });

  it.each([
    ['', 'empty_response'],
    ['```texto```', 'invalid_output'],
    ['{"analysis":{"stage":"quoting"}}', 'invalid_output'],
    ['Primeiro---Segundo', 'invalid_output'],
    ['---\nMensagem', 'invalid_output'],
    ['Mensagem\n---\n---\nOutra', 'invalid_output'],
    ['Como modelo de linguagem, eu sugiro esta mensagem.', 'invalid_output'],
  ])('rejects corrupted output %#', (value, stopReason) => {
    expect(validateFollowUpTechnicalOutput(value)).toMatchObject({ valid: false, stopReason });
  });
});

describe('deterministic commercial guardrail', () => {
  const evidence = 'Foram apresentadas Amil e Leve. O cliente prioriza o Hospital X e falou com a esposa.';

  it.each([
    'Entre a Amil e a Leve, qual ficou mais próxima do que você procura?',
    'Para você pesa mais manter o Hospital X ou reduzir o valor mensal?',
    'Se eu conseguir manter esse hospital perto do seu orçamento, faz sentido iniciar a proposta?',
    'Conseguiu falar com sua esposa sobre manter a Unimed?',
    'Vou confirmar a rede desse hospital e volto com a opção correta.',
    'Quer que eu ajuste a cotação para uma faixa mais enxuta?',
    'Posso deixar essa análise pausada por enquanto?',
    'O que falta para decidirmos entre a Amil e a Leve?',
  ])('accepts a contextual choice or concrete commercial action: %s', (value) => {
    expect(validateFollowUpBusinessOutput(value, evidence)).toEqual({ valid: true });
  });

  it.each([
    'Oi, tudo bem?',
    'Passei para saber como você e sua família estão.',
    'Conseguiu analisar as opções?',
    'Ficou com alguma dúvida?',
    'O que falta para decidirmos?',
    'Só passando para saber se você viu minha mensagem.',
    'Quando fizer sentido, pode me chamar. Estou por aqui.',
    'Você prefere mensagem ou ligação?',
  ])('rejects generic or socially empty messages: %s', (value) => {
    expect(validateFollowUpBusinessOutput(value, evidence)).toMatchObject({
      valid: false,
      stopReason: 'invalid_output',
    });
  });

  it('accepts valid wait signals and rejects malformed ones', () => {
    expect(parseFollowUpOutput('[[WAIT:personal_context]]')).toEqual({
      kind: 'wait',
      reasonCode: 'personal_context',
      suggestedDate: null,
    });
    expect(parseFollowUpOutput('[[WAIT:future_date:2026-10-15]]')).toEqual({
      kind: 'wait',
      reasonCode: 'future_date',
      suggestedDate: '2026-10-15',
    });
    expect(validateFollowUpBusinessOutput('[[WAIT:recent_contact]]')).toEqual({ valid: true });
    expect(validateFollowUpBusinessOutput('[[WAIT:future_date]]')).toMatchObject({ valid: false });
    expect(validateFollowUpBusinessOutput('[[WAIT:future_date:2026-02-31]]')).toMatchObject({ valid: false });
    expect(validateFollowUpBusinessOutput('[[WAIT:unknown]]')).toMatchObject({ valid: false });
  });

  it('blocks artificial urgency unless the same fact exists in the evidence', () => {
    const message = 'A condição especial acaba hoje. Entre Amil e Leve, qual você prefere?';
    expect(validateFollowUpBusinessOutput(message, evidence)).toMatchObject({ valid: false });
    expect(validateFollowUpBusinessOutput(message, `${evidence} A condição especial acaba hoje.`)).toEqual({ valid: true });
  });
});
