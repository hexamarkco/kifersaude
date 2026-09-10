import { describe, expect, it } from 'vitest';

import {
  buildFollowUpGenerateUserPrompt,
  FOLLOW_UP_RUNTIME_GUARDRAILS,
  FOLLOW_UP_GENERATE_SYSTEM_PROMPT,
} from '../comm-whatsapp-follow-up-generate-prompt.ts';
import {
  parseFollowUpOutput,
  validateFollowUpStructuralOutput,
  validateFollowUpTechnicalOutput,
} from '../comm-whatsapp-follow-up-output.ts';
import {
  buildFollowUpAiValidationUserPrompt,
  FOLLOW_UP_AI_VALIDATOR_SYSTEM_PROMPT,
  parseFollowUpAiValidationOutput,
  validateFollowUpAiValidationOutput,
} from '../comm-whatsapp-follow-up-ai-validator.ts';
import { collapseConsecutiveDuplicateTranscriptLines } from '../comm-whatsapp-transcript.ts';

describe('follow-up generation prompt', () => {
  it('passes the five direct context blocks without analysis or strategy JSON', () => {
    const prompt = buildFollowUpGenerateUserPrompt({
      transcript: 'Cliente: vou falar com meu marido.',
      leadContext: 'Nome: Ana',
      temporalFacts: 'Último contato há 2 dias.',
      recentAudits: 'Mensagem anterior sem resposta.',
      styleProfile: 'Curto e natural.',
    });

    expect(prompt).toContain('HISTÓRICO COMPLETO DA CONVERSA');
    expect(prompt).toContain('CONTEXTO DO LEAD');
    expect(prompt).toContain('FATOS TEMPORAIS');
    expect(prompt).toContain('AUDITORIAS RECENTES');
    expect(prompt).toContain('PERFIL DE ESTILO');
    expect(prompt.lastIndexOf('HISTÓRICO COMPLETO DA CONVERSA')).toBeGreaterThan(
      prompt.lastIndexOf('PERFIL DE ESTILO'),
    );
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
    expect(FOLLOW_UP_GENERATE_SYSTEM_PROMPT).toMatch(/ações pendentes de ações já concluídas/iu);
    expect(FOLLOW_UP_GENERATE_SYSTEM_PROMPT).toMatch(/não podem ser oferecidos como se ainda faltassem fazer/iu);
    expect(FOLLOW_UP_GENERATE_SYSTEM_PROMPT).toMatch(/situações que podem coexistir/iu);
    expect(FOLLOW_UP_GENERATE_SYSTEM_PROMPT).toMatch(/retomada de qualificação/iu);
    expect(FOLLOW_UP_GENERATE_SYSTEM_PROMPT).toMatch(/confirmar se agora pode retomar/iu);
    expect(FOLLOW_UP_GENERATE_SYSTEM_PROMPT).toMatch(/microdecisão é o destino comercial/iu);
    expect(FOLLOW_UP_GENERATE_SYSTEM_PROMPT).toMatch(/ponte humana/iu);
    expect(FOLLOW_UP_GENERATE_SYSTEM_PROMPT).toMatch(/preciso alinhar este ponto/iu);
    expect(FOLLOW_UP_GENERATE_SYSTEM_PROMPT).toMatch(/frase declarativa curta e completa/iu);
    expect(FOLLOW_UP_GENERATE_SYSTEM_PROMPT).toMatch(/Não confunda objetividade com frieza/iu);
    expect(FOLLOW_UP_GENERATE_SYSTEM_PROMPT).toMatch(/não soa como formulário/iu);
    expect(FOLLOW_UP_GENERATE_SYSTEM_PROMPT).toMatch(/frases intercambiáveis/iu);
    expect(FOLLOW_UP_GENERATE_SYSTEM_PROMPT).toMatch(/use por padrão uma saudação natural com “Tudo bem\?”/iu);
    expect(FOLLOW_UP_RUNTIME_GUARDRAILS).toMatch(/passagem do tempo, sozinha/iu);
    expect(FOLLOW_UP_RUNTIME_GUARDRAILS).toMatch(/sem reagendamento automático/iu);
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

describe('deterministic structural validation', () => {
  it.each([
    'Conseguiu analisar as opções?',
    'A condição especial acaba hoje. Entre Amil e Leve, qual você prefere?',
    'Você quer que eu descarte a opção atual e procure somente uma alternativa nova?',
  ])('does not hardcode commercial judgment: %s', (value) => {
    expect(validateFollowUpStructuralOutput(value)).toEqual({ valid: true });
  });

  it('allows a standalone Tudo bem? greeting before commercial content', () => {
    const value = 'Boa tarde, Brenda! Tudo bem?\n---\nPara você pesa mais a economia da Porto ou ter o Hospital Serrano na Amil?';
    expect(validateFollowUpStructuralOutput(value)).toEqual({ valid: true });
  });

  it.each([
    'Boa tarde, Brenda! Tudo bem? Para você pesa mais a economia da Porto ou ter o Hospital Serrano na Amil?',
    'Boa tarde, Brenda! Tudo bem?\n\nPara você pesa mais a economia da Porto ou ter o Hospital Serrano na Amil?',
  ])('rejects a greeting without the required separator: %s', (value) => {
    expect(validateFollowUpStructuralOutput(value)).toMatchObject({
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
    expect(validateFollowUpStructuralOutput('[[WAIT:recent_contact]]')).toEqual({ valid: true });
    expect(validateFollowUpStructuralOutput('[[WAIT:future_date]]')).toMatchObject({ valid: false });
    expect(validateFollowUpStructuralOutput('[[WAIT:future_date:2026-02-31]]')).toMatchObject({ valid: false });
    expect(validateFollowUpStructuralOutput('[[WAIT:unknown]]')).toMatchObject({ valid: false });
  });
});

describe('AI commercial validator contract', () => {
  const candidate = 'Boa tarde, Joana! Tudo bem?\n---\nQual limite mensal faz sentido para a opção individual em apartamento?';

  it('accepts approve, rewrite and wait decisions with valid contracts', () => {
    expect(parseFollowUpAiValidationOutput(JSON.stringify({
      decision: 'approve',
      reason: 'Uma única microdecisão contextual.',
      text: null,
      waitSignal: null,
    }))).toMatchObject({ decision: 'approve' });

    expect(parseFollowUpAiValidationOutput(JSON.stringify({
      decision: 'rewrite',
      reason: 'A candidata reunia duas decisões.',
      text: candidate,
      waitSignal: null,
    }))).toMatchObject({ decision: 'rewrite', text: candidate });

    expect(parseFollowUpAiValidationOutput(JSON.stringify({
      decision: 'wait',
      reason: 'Contato recente sem fato novo.',
      text: null,
      waitSignal: '[[WAIT:recent_contact]]',
    }))).toMatchObject({ decision: 'wait', waitSignal: '[[WAIT:recent_contact]]' });
  });

  it('rejects malformed decisions and structurally invalid rewrites', () => {
    expect(validateFollowUpAiValidationOutput('APROVADO')).toMatchObject({ valid: false });
    expect(validateFollowUpAiValidationOutput(JSON.stringify({
      decision: 'rewrite',
      reason: 'Saudação misturada ao conteúdo.',
      text: 'Boa tarde, Joana! Tudo bem? Qual opção você prefere?',
      waitSignal: null,
    }))).toMatchObject({ valid: false });
  });

  it('gives the AI the full policy, context and candidate for semantic judgment', () => {
    const prompt = buildFollowUpAiValidationUserPrompt({
      policy: 'Uma microdecisão por mensagem.',
      context: 'Joana prefere apartamento e ainda compara dois caminhos.',
      candidate,
    });

    expect(prompt).toContain('REGRAS DA FEATURE');
    expect(prompt).toContain('CONTEXTO DA NEGOCIAÇÃO');
    expect(prompt).toContain('MENSAGEM CANDIDATA');
    expect(FOLLOW_UP_AI_VALIDATOR_SYSTEM_PROMPT).toMatch(/avaliação semântica real/iu);
    expect(FOLLOW_UP_AI_VALIDATOR_SYSTEM_PROMPT).toMatch(/duas decisões independentes/iu);
    expect(FOLLOW_UP_AI_VALIDATOR_SYSTEM_PROMPT).toMatch(/familiares ou terceiros/iu);
    expect(FOLLOW_UP_AI_VALIDATOR_SYSTEM_PROMPT).toMatch(/ações já concluídas/iu);
    expect(FOLLOW_UP_AI_VALIDATOR_SYSTEM_PROMPT).toMatch(/não faça uma edição mínima/iu);
    expect(FOLLOW_UP_AI_VALIDATOR_SYSTEM_PROMPT).toMatch(/falsa escolha/iu);
    expect(FOLLOW_UP_AI_VALIDATOR_SYSTEM_PROMPT).toMatch(/retorno solicitado pelo lead/iu);
    expect(FOLLOW_UP_AI_VALIDATOR_SYSTEM_PROMPT).toMatch(/pergunta seca/iu);
    expect(FOLLOW_UP_AI_VALIDATOR_SYSTEM_PROMPT).toMatch(/CTA frio/iu);
    expect(FOLLOW_UP_AI_VALIDATOR_SYSTEM_PROMPT).toMatch(/linguagem burocrática/iu);
    expect(FOLLOW_UP_AI_VALIDATOR_SYSTEM_PROMPT).toMatch(/oração subordinada ao CTA/iu);
    expect(FOLLOW_UP_AI_VALIDATOR_SYSTEM_PROMPT).toMatch(/não haverá novo follow-up automático/iu);
    expect(FOLLOW_UP_AI_VALIDATOR_SYSTEM_PROMPT).toMatch(/equilibra avanço comercial e vínculo/iu);
    expect(FOLLOW_UP_AI_VALIDATOR_SYSTEM_PROMPT).toMatch(/comercialmente correta, porém gelada/iu);
    expect(FOLLOW_UP_AI_VALIDATOR_SYSTEM_PROMPT).toMatch(/intermediário a adivinhar/iu);
  });
});

describe('follow-up context hygiene', () => {
  it('collapses only consecutive duplicate transcript lines', () => {
    expect(collapseConsecutiveDuplicateTranscriptLines([
      '[10:00] Eu: Cotação enviada.',
      '[10:00] Eu: Cotação enviada.',
      '[10:01] Joana: Obrigada.',
      '[10:02] Eu: Cotação enviada.',
    ])).toEqual([
      '[10:00] Eu: Cotação enviada.',
      '[10:01] Joana: Obrigada.',
      '[10:02] Eu: Cotação enviada.',
    ]);
  });
});
