import { describe, expect, it } from 'vitest';
import {
  validateCommercialMessage,
  formatValidationFeedback,
} from '../comm-whatsapp-follow-up-v3-validator.ts';
import type { CommercialAnalysis, FollowUpStrategy } from '../comm-whatsapp-follow-up-v3-types.ts';

const makeAnalysis = (overrides: Partial<CommercialAnalysis> = {}): CommercialAnalysis => ({
  stage: 'cotacao_apresentada',
  leadTemperature: 'morno',
  contactRole: 'decisor_e_beneficiario',
  stakeholders: [],
  blocker: 'nao_identificado',
  buyingSignals: [],
  objections: [],
  knownFacts: [],
  lastCommercialEvent: 'cotacao enviada',
  lastCustomerPosition: 'aguardando analise',
  lastCommercialCommitment: { exists: false, actor: null, action: null, thirdParty: null, expectedResult: null, rawEvidence: null },
  previousMicrodecision: null,
  pendingMicrodecision: null,
  decisionMaker: null,
  nextActionOwner: 'lead',
  mainCommercialQuestion: 'Qual plano escolher?',
  confidence: 0.7,
  ...overrides,
});

const makeStrategy = (overrides: Partial<FollowUpStrategy> = {}): FollowUpStrategy => ({
  shouldSend: true,
  reasonToWait: null,
  commercialFunction: 'retomar_contexto',
  goal: 'retomar conversa sobre proposta',
  targetMicrodecision: 'qual plano prefere',
  targetPerson: null,
  strategySummary: 'Retomar conversa sobre a proposta enviada',
  mustUseContext: ['proposta enviada'],
  mustAvoid: ['urgencia falsa'],
  idealQuestionType: 'aberta',
  expectedUsefulReplies: ['prefiro o plano X'],
  ...overrides,
});

describe('V3 Validator — validateCommercialMessage', () => {
  it('passes for a valid contextual message', () => {
    const result = validateCommercialMessage({
      text: 'Oi Maria, vi que voce pediu a proposta do plano ouro. Conseguimos incluir a cobertura dental tambem. O que acha?',
      analysis: makeAnalysis(),
      strategy: makeStrategy(),
    });
    expect(result.passed).toBe(true);
    expect(result.score).toBeGreaterThan(0.7);
  });

  it('rejects pure collection messages', () => {
    const result = validateCommercialMessage({
      text: 'Conseguiu analisar? Estou a disposicao.',
      analysis: makeAnalysis(),
      strategy: makeStrategy(),
    });
    expect(result.passed).toBe(false);
    expect(result.failedCriteria.some((f) => f.criterion === 'cobranca_pura')).toBe(true);
  });

  it('warns about generic messages without specific context', () => {
    const result = validateCommercialMessage({
      text: 'Ola, tudo bem? Gostaria de saber se voce tem alguma duvida sobre o plano.',
      analysis: makeAnalysis({ knownFacts: [], stakeholders: [] }),
      strategy: makeStrategy(),
    });
    expect(result.warnings.some((w) => w.criterion === 'genericidade')).toBe(true);
  });

  it('rejects messages with false urgency', () => {
    const result = validateCommercialMessage({
      text: 'Oi, o reajuste vai entrar em vigor dia 15. Precisa fechar ate la para garantir o preco atual.',
      analysis: makeAnalysis(),
      strategy: makeStrategy(),
    });
    expect(result.passed).toBe(false);
    expect(result.failedCriteria.some((f) => f.criterion === 'falsa_urgencia')).toBe(true);
  });

  it('warns about AI/corporate language', () => {
    const result = validateCommercialMessage({
      text: 'Gostaríamos de informar que a proposta está pronta. É importante ressaltar que o prazo é limitado.',
      analysis: makeAnalysis(),
      strategy: makeStrategy(),
    });
    expect(result.warnings.some((w) => w.criterion === 'naturalidade')).toBe(true);
  });

  it('warns when too many questions', () => {
    const result = validateCommercialMessage({
      text: 'Voce viu a proposta? Qual plano prefere? Precisa de mais informacoes? Posso te ligar?',
      analysis: makeAnalysis(),
      strategy: makeStrategy(),
    });
    expect(result.warnings.some((w) => w.criterion === 'facilidade_resposta')).toBe(true);
  });

  it('rejects when shouldSend=false but message was generated', () => {
    const result = validateCommercialMessage({
      text: 'Oi, tudo bem?',
      analysis: makeAnalysis({ pendingMicrodecision: 'aguardar resposta do decisor' }),
      strategy: makeStrategy({ shouldSend: false }),
    });
    expect(result.passed).toBe(false);
    expect(result.failedCriteria.some((f) => f.criterion === 'continuidade')).toBe(true);
  });

  it('rejects when strategy is nenhuma but shouldSend=true', () => {
    const result = validateCommercialMessage({
      text: 'Oi, tudo bem?',
      analysis: makeAnalysis(),
      strategy: makeStrategy({ commercialFunction: 'nenhuma', shouldSend: true }),
    });
    expect(result.passed).toBe(false);
    expect(result.failedCriteria.some((f) => f.criterion === 'coerencia_estrategia')).toBe(true);
  });

  it('rejects repetitive messages', () => {
    const result = validateCommercialMessage({
      text: 'Voce conseguiu analisar a proposta que enviei? Qual plano prefere?',
      analysis: makeAnalysis(),
      strategy: makeStrategy(),
      previousTexts: ['Voce conseguiu ver a proposta? Qual plano voce prefere?'],
    });
    expect(result.passed).toBe(false);
    expect(result.failedCriteria.some((f) => f.criterion === 'repeticao')).toBe(true);
  });

  it('rejects asking known information', () => {
    const result = validateCommercialMessage({
      text: 'Qual cidade voce mora?',
      analysis: makeAnalysis({
        knownFacts: ['Cliente mora em Cabo Frio'],
      }),
      strategy: makeStrategy(),
    });
    expect(result.passed).toBe(false);
    expect(result.failedCriteria.some((f) => f.criterion === 'informacao_conhecida')).toBe(true);
  });

  it('warns about stage mismatch (selling already decided)', () => {
    const result = validateCommercialMessage({
      text: 'Temos varias opcoes de planos para voce comparar. Qual prefere?',
      analysis: makeAnalysis({ stage: 'sinal_de_compra' }),
      strategy: makeStrategy(),
    });
    expect(result.warnings.some((w) => w.criterion === 'estagio')).toBe(true);
  });

  it('allows commitment context for collection phrases', () => {
    const result = validateCommercialMessage({
      text: 'Voce conseguiu falar com seu marido sobre a proposta?',
      analysis: makeAnalysis({
        lastCommercialCommitment: {
          exists: true,
          actor: 'Maria',
          action: 'falar com marido',
          thirdParty: 'marido',
          expectedResult: 'retorno sobre plano',
          rawEvidence: 'Vou falar com meu marido',
        },
      }),
      strategy: makeStrategy(),
    });
    expect(result.passed).toBe(true);
  });

  it('score decreases with more errors', () => {
    const resultNoErrors = validateCommercialMessage({
      text: 'Oi Maria, a proposta do plano ouro ficou pronta. Quer que eu te envie?',
      analysis: makeAnalysis(),
      strategy: makeStrategy(),
    });

    const resultWithUrgency = validateCommercialMessage({
      text: 'Oi Maria, ultimo dia de promocao! O preco vai aumentar amanha. Fechamos?',
      analysis: makeAnalysis(),
      strategy: makeStrategy(),
    });

    expect(resultWithUrgency.score).toBeLessThan(resultNoErrors.score);
  });
});

describe('V3 Validator — formatValidationFeedback', () => {
  it('returns null for clean result', () => {
    const result = validateCommercialMessage({
      text: 'Oi Maria, vi que voce pediu a proposta do plano ouro.',
      analysis: makeAnalysis(),
      strategy: makeStrategy(),
    });
    expect(formatValidationFeedback(result)).toBeNull();
  });

  it('formats errors and warnings', () => {
    const result = validateCommercialMessage({
      text: 'Conseguiu analisar?',
      analysis: makeAnalysis(),
      strategy: makeStrategy(),
    });
    const feedback = formatValidationFeedback(result);
    expect(feedback).toContain('REJEITADA');
    expect(feedback).toContain('cobranca_pura');
  });

  it('formats warnings only', () => {
    const result = validateCommercialMessage({
      text: 'Ola, tudo bem? Gostaria de saber se voce tem alguma duvida sobre o plano de saude que enviei anteriormente. Posso te ajudar com alguma informacao adicional?',
      analysis: makeAnalysis({ knownFacts: [], stakeholders: [] }),
      strategy: makeStrategy({ targetMicrodecision: 'qual plano prefere' }),
    });
    const feedback = formatValidationFeedback(result);
    expect(feedback).toBeTruthy();
    expect(feedback).toContain('Avisos');
  });
});
