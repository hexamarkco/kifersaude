// ---- Validador Comercial V3 ----
// Determinístico + LLM opcional. Verifica se a mensagem gerada
// atende aos critérios comerciais antes de ser apresentada ao operador.

import type { CommercialAnalysis, FollowUpStrategy } from './comm-whatsapp-follow-up-v3-types.ts';

export type ValidationCriterion =
  | 'continuidade'
  | 'microdecisao'
  | 'genericidade'
  | 'cobranca_pura'
  | 'repeticao'
  | 'informacao_conhecida'
  | 'stakeholder'
  | 'estagio'
  | 'falsa_urgencia'
  | 'naturalidade'
  | 'facilidade_resposta'
  | 'coerencia_estrategia';

export type ValidationSeverity = 'error' | 'warning';

export type ValidationResult = {
  passed: boolean;
  score: number;
  failedCriteria: Array<{
    criterion: ValidationCriterion;
    severity: ValidationSeverity;
    reason: string;
  }>;
  warnings: Array<{
    criterion: ValidationCriterion;
    reason: string;
  }>;
};

// ---- Padrões de frases genéricas / cobrança pura ----
// Presença sozinha não é reprovação — o contexto importa.

const GENERIC_PHRASES = [
  'conseguiu analisar',
  'conseguiu olhar',
  'deu uma olhada',
  'viu minha mensagem',
  'ficou alguma dúvida',
  'alguma dúvida',
  'alguma novidade',
  'gostaria de prosseguir',
  'podemos prosseguir',
  'podemos dar continuidade',
  'seu filho conseguiu ver',
  'já conversou com seu marido',
  'conseguiu falar com',
  'o que achou',
  'viu as opções',
  'conseguiu ver',
  'tem alguma dúvida',
  'precisa de algo',
  'estou à disposição',
  'qualquer dúvida',
  'se precisar de algo',
  'pode me chamar',
];

// ---- Frases que são aceitáveis em contexto de compromisso ----

const COMMITMENT_CONTEXT_PHRASES = [
  'você conseguiu falar com', // pode ser válido se houver compromisso explícito
  'conseguiu falar com',
];

export const validateCommercialMessage = (params: {
  text: string;
  analysis: CommercialAnalysis;
  strategy: FollowUpStrategy;
  previousTexts?: string[];
}): ValidationResult => {
  const text = params.text.toLowerCase().trim();
  const failedCriteria: ValidationResult['failedCriteria'] = [];
  const warnings: ValidationResult['warnings'] = [];

  // A. CONTINUIDADE — a mensagem continua o último fio comercial?
  if (params.analysis.pendingMicrodecision && !params.strategy.shouldSend) {
    failedCriteria.push({
      criterion: 'continuidade',
      severity: 'error',
      reason: 'A estratégia definida não deveria enviar mensagem agora, mas uma mensagem foi gerada.',
    });
  }

  // B. MICRODECISÃO — a mensagem busca a microdecisão definida?
  if (params.strategy.targetMicrodecision && params.strategy.targetMicrodecision !== 'nenhuma') {
    const microdecisionKeywords = extractKeywords(params.strategy.targetMicrodecision);
    const textHasMicrodecisionRef = microdecisionKeywords.some((kw) => text.includes(kw));
    // Não bloquear se a mensagem é very short e precisa de contexto adicional
    if (!textHasMicrodecisionRef && text.length > 80) {
      warnings.push({
        criterion: 'microdecisao',
        reason: `A microdecisão-alvo "${params.strategy.targetMicrodecision}" não parece estar sendo buscada na mensagem.`,
      });
    }
  }

  // C. GENERICIDADE — a mensagem serviria para qualquer lead?
  const hasLeadSpecificContext = hasSpecificContext(params.text, params.analysis);
  if (!hasLeadSpecificContext && text.length > 60) {
    warnings.push({
      criterion: 'genericidade',
      reason: 'A mensagem não parece conter detalhes específicos desta conversa.',
    });
  }

  // D. COBRANÇA PURA — apenas pergunta se o cliente viu/analisou?
  const isPureCollection = detectPureCollection(text, params.analysis);
  if (isPureCollection) {
    failedCriteria.push({
      criterion: 'cobranca_pura',
      severity: 'error',
      reason: 'A mensagem é essencialmente uma cobrança de resposta sem avançar microdecisão.',
    });
  }

  // E. REPETIÇÃO — repete algo que já foi ignorado?
  if (params.previousTexts && params.previousTexts.length > 0) {
    const isRepetitive = detectRepetition(text, params.previousTexts);
    if (isRepetitive) {
      failedCriteria.push({
        criterion: 'repeticao',
        severity: 'error',
        reason: 'A mensagem repete uma pergunta ou estratégia que já foi ignorada.',
      });
    }
  }

  // F. INFORMAÇÃO CONHECIDA — pergunta algo que o cliente já informou?
  const asksKnownInfo = detectKnownInfoRepetition(text, params.analysis);
  if (asksKnownInfo) {
    failedCriteria.push({
      criterion: 'informacao_conhecida',
      severity: 'error',
      reason: 'A mensagem pergunta uma informação que o cliente já forneceu.',
    });
  }

  // G. STAKEHOLDER — quando existe terceiro, respeita?
  if (params.analysis.decisionMaker && params.analysis.decisionMaker !== 'não identificado') {
    const mentionsThirdParty = text.includes(params.analysis.decisionMaker.toLowerCase())
      || (params.analysis.stakeholders.some((s) => text.includes(s.description.toLowerCase())));
    if (!mentionsThirdParty && params.strategy.targetMicrodecision.includes('terceiro')) {
      warnings.push({
        criterion: 'stakeholder',
        reason: 'Existe terceiro/decisor identificado, mas a mensagem não o menciona.',
      });
    }
  }

  // H. ESTÁGIO — está vendendo algo já decidido ou fechando sem informação?
  if (params.analysis.stage === 'sinal_de_compra' || params.analysis.stage === 'aguardando_acao') {
    if (text.includes('compar') || text.includes('opções') || text.includes('planos')) {
      warnings.push({
        criterion: 'estagio',
        reason: 'O lead já demonstrou interesse/sinal de compra, mas a mensagem volta a comparar opções.',
      });
    }
  }

  // I. FALSA URGÊNCIA — inventou prazo/promoção?
  const urgencyPatterns = [
    /\b(prazo|reajuste|promoção|desconto|escassez|última chance|vagas limitadas|só até|validade|expira)\b/i,
    /\b(preço vai aumentar|valor vai mudar|não vai ter mais|vai acabar)\b/i,
  ];
  for (const pattern of urgencyPatterns) {
    if (pattern.test(text)) {
      failedCriteria.push({
        criterion: 'falsa_urgencia',
        severity: 'error',
        reason: 'A mensagem contém linguagem de urgência/escassez que pode não ser verdadeira.',
      });
      break;
    }
  }

  // J. NATURALIDADE — parece IA ou corporativo?
  const aiPatterns = [
    /\b(gostaríamos de|gostaria de informar|venho por meio|ento|é importante ressaltar|desejamos)\b/i,
    /\b(saudações|atenciosamente|cordiais)\b/i,
  ];
  for (const pattern of aiPatterns) {
    if (pattern.test(text)) {
      warnings.push({
        criterion: 'naturalidade',
        reason: 'A mensagem contém linguagem formal/corporativa que soa não natural para WhatsApp.',
      });
      break;
    }
  }

  // K. FACILIDADE DE RESPOSTA — a pergunta é razoavelmente simples?
  const questionMarks = (text.match(/\?/g) || []).length;
  if (questionMarks > 2) {
    warnings.push({
      criterion: 'facilidade_resposta',
      reason: `A mensagem contém ${questionMarks} perguntas — pode ser difícil para o cliente responder todas.`,
    });
  }

  // L. COERÊNCIA COM ESTRATÉGFIA
  if (params.strategy.commercialFunction === 'nenhuma' && params.strategy.shouldSend) {
    failedCriteria.push({
      criterion: 'coerencia_estrategia',
      severity: 'error',
      reason: 'A estratégia define "nenhuma" função comercial, mas shouldSend=true.',
    });
  }

  // Calcular score (0-1, onde 1 = perfeito)
  const errors = failedCriteria.filter((f) => f.severity === 'error');
  const score = Math.max(0, 1 - (errors.length * 0.25) - (warnings.length * 0.1));

  return {
    passed: errors.length === 0,
    score: Math.round(score * 100) / 100,
    failedCriteria,
    warnings,
  };
};

// ---- Helpers ----

function extractKeywords(phrase: string): string[] {
  return phrase
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .slice(0, 5);
}

function hasSpecificContext(text: string, analysis: CommercialAnalysis): boolean {
  const lower = text.toLowerCase();
  // Verifica se menciona algo específico: nomes, valores, planos, cidades
  const specificPatterns = [
    /\b(r\$|reais|valor|preço|mensalidade)\b/i,
    /\b(amil|assim|klini|sulamerica|bradesco|unimed|pottencial|notre|intermed)\b/i,
    /\b(cabo frio|rio de janeiro|são paulo|belo horizonte|curitiba)\b/i,
    /\b(bronze|prata|ouro|enfermaria|apartamento|individual|familiar)\b/i,
  ];
  if (specificPatterns.some((p) => p.test(text))) return true;

  // Verifica se menciona stakeholders conhecidos
  if (analysis.stakeholders.length > 0) {
    return analysis.stakeholders.some((s) => lower.includes(s.description.toLowerCase().split(' ')[0]));
  }

  return false;
}

function detectPureCollection(text: string, analysis: CommercialAnalysis): boolean {
  const lower = text.toLowerCase();
  const isGenericPhrase = GENERIC_PHRASES.some((phrase) => lower.includes(phrase));
  if (!isGenericPhrase) return false;

  // Se há compromisso explícito, pode ser aceitável cobrar
  if (analysis.lastCommercialCommitment.exists) {
    const hasCommitmentContext = COMMITMENT_CONTEXT_PHRASES.some((p) => lower.includes(p));
    if (hasCommitmentContext) return false;
  }

  // Se a mensagem tem conteúdo além da cobrança, não é pura
  const lines = text.split('\n').filter((l) => l.trim());
  if (lines.length > 2) return false;

  // Se a mensagem é apenas a frase genérica ou muito similar
  const words = lower.split(/\s+/).length;
  if (words <= 20) return true;

  return false;
}

function detectRepetition(text: string, previousTexts: string[]): boolean {
  const lower = text.toLowerCase();
  for (const prev of previousTexts) {
    const prevLower = prev.toLowerCase();
    // Verifica similaridade por sobreposição de palavras significativas
    const textWords = new Set(lower.split(/\s+/).filter((w) => w.length > 3));
    const prevWords = new Set(prevLower.split(/\s+/).filter((w) => w.length > 3));
    let overlap = 0;
    for (const w of textWords) {
      if (prevWords.has(w)) overlap++;
    }
    const smaller = Math.min(textWords.size, prevWords.size);
    if (smaller > 0 && overlap / smaller > 0.6) return true;
  }
  return false;
}

function detectKnownInfoRepetition(text: string, analysis: CommercialAnalysis): boolean {
  const lower = text.toLowerCase();

  // Se o cliente já disse a cidade e a mensagem pergunta a cidade
  const cityMentioned = analysis.knownFacts.some((f) => /mora em|cidade de/i.test(f));
  if (cityMentioned && /\b(qual.*cidade|mora em qual|que cidade)\b/i.test(text)) return true;

  // Se o cliente já disse a idade e a mensagem pergunta a idade
  const ageMentioned = analysis.knownFacts.some((f) => /\b\d+\s*anos?\b/i.test(f));
  if (ageMentioned && /\b(quantos anos|qual.*idade|idade de)\b/i.test(text)) return true;

  // Se o cliente já disse que não tem plano
  const noPlanMentioned = analysis.knownFacts.some((f) => /não tem|sem plano/i.test(f));
  if (noPlanMentioned && /\b(já tem plano|possui plano|cobertura atual)\b/i.test(text)) return true;

  return false;
}

export const formatValidationFeedback = (result: ValidationResult): string | null => {
  if (result.passed && result.warnings.length === 0) return null;

  const parts: string[] = [];

  if (!result.passed) {
    parts.push('A mensagem anterior foi REJEITADA pelo validador:');
    for (const fail of result.failedCriteria) {
      parts.push(`- [${fail.criterion}] ${fail.reason}`);
    }
  }

  if (result.warnings.length > 0) {
    parts.push('Avisos:');
    for (const warn of result.warnings) {
      parts.push(`- [${warn.criterion}] ${warn.reason}`);
    }
  }

  return parts.join('\n');
};
