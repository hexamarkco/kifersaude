import { describe, expect, it } from 'vitest';

import {
  buildFollowUpGenerateUserPrompt,
  FOLLOW_UP_GENERATE_SYSTEM_PROMPT,
} from '../comm-whatsapp-follow-up-generate-prompt.ts';
import { validateFollowUpTechnicalOutput } from '../comm-whatsapp-follow-up-output.ts';

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
