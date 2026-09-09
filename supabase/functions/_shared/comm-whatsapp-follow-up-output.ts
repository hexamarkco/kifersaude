export type FollowUpTechnicalStopReason =
  | 'empty_response'
  | 'invalid_output';

export type FollowUpTechnicalValidation = {
  valid: boolean;
  stopReason?: FollowUpTechnicalStopReason;
  message?: string;
};

export type FollowUpWaitReasonCode =
  | 'recent_contact'
  | 'future_date'
  | 'personal_context'
  | 'seller_action_pending'
  | 'no_useful_move';

export type ParsedFollowUpOutput =
  | { kind: 'send'; text: string }
  | { kind: 'wait'; reasonCode: FollowUpWaitReasonCode; suggestedDate: string | null };

const MAX_FOLLOW_UP_LENGTH = 1_500;
const INTERNAL_LEAK_PATTERNS = [
  /\bcommercial_analysis\b/i,
  /\bvalidation_feedback\b/i,
  /\bsystem prompt\b/i,
  /\binstru(?:ç|c)(?:ão|oes|ões) interna/i,
  /\bcomo (?:uma? )?(?:ia|inteligência artificial|modelo de linguagem)\b/i,
  /\bmeu racioc[ií]nio\b/i,
];

const WAIT_SIGNAL_PATTERN = /^\[\[WAIT:(recent_contact|future_date|personal_context|seller_action_pending|no_useful_move)(?::(\d{4}-\d{2}-\d{2}))?\]\]$/;

const normalizeForMatching = (value: string): string => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase();

const isValidIsoDate = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

export const parseFollowUpOutput = (rawValue: string): ParsedFollowUpOutput | null => {
  const value = rawValue.trim();
  const waitMatch = value.match(WAIT_SIGNAL_PATTERN);

  if (waitMatch) {
    const reasonCode = waitMatch[1] as FollowUpWaitReasonCode;
    const suggestedDate = waitMatch[2] ?? null;
    if (reasonCode === 'future_date') {
      return suggestedDate && isValidIsoDate(suggestedDate)
        ? { kind: 'wait', reasonCode, suggestedDate }
        : null;
    }
    if (suggestedDate) return null;
    return { kind: 'wait', reasonCode, suggestedDate: null };
  }

  if (/^\[\[WAIT:/i.test(value)) return null;
  return { kind: 'send', text: value };
};

const looksLikeJson = (value: string): boolean => {
  const trimmed = value.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return false;

  try {
    JSON.parse(trimmed);
    return true;
  } catch {
    return /^\s*[[{]/.test(trimmed) && /[}\]]\s*$/.test(trimmed);
  }
};

export const validateFollowUpTechnicalOutput = (rawValue: string): FollowUpTechnicalValidation => {
  const value = rawValue.trim();

  if (!value) {
    return { valid: false, stopReason: 'empty_response', message: 'Resposta vazia do provider.' };
  }

  if (value.length > MAX_FOLLOW_UP_LENGTH) {
    return { valid: false, stopReason: 'invalid_output', message: 'Resposta excede o limite técnico de 1500 caracteres.' };
  }

  if (value.includes('\0') || value.includes('\uFFFD')) {
    return { valid: false, stopReason: 'invalid_output', message: 'Resposta contém caracteres corrompidos.' };
  }

  if (looksLikeJson(value)) {
    return { valid: false, stopReason: 'invalid_output', message: 'Resposta JSON inesperada para uma Feature de texto.' };
  }

  if (
    (value.startsWith('"') && value.endsWith('"'))
    || (value.startsWith("'") && value.endsWith("'"))
    || (value.startsWith('“') && value.endsWith('”'))
  ) {
    return { valid: false, stopReason: 'invalid_output', message: 'Resposta veio envolvida em aspas.' };
  }

  if (
    /```|^\s{0,3}#{1,6}\s/m.test(value)
    || /^\s*(?:[-+*]|\d+\.)\s+/m.test(value)
    || /^\s*>\s+/m.test(value)
    || /\[[^\]]+\]\([^)]+\)/.test(value)
    || /\*\*[^*]+\*\*/.test(value)
  ) {
    return { valid: false, stopReason: 'invalid_output', message: 'Resposta contém markdown indevido.' };
  }

  if (INTERNAL_LEAK_PATTERNS.some((pattern) => pattern.test(value))) {
    return { valid: false, stopReason: 'invalid_output', message: 'Resposta expõe instrução ou raciocínio interno.' };
  }

  const lines = value.split(/\r?\n/);
  const separatorIndexes = lines
    .map((line, index) => line.trim() === '---' ? index : -1)
    .filter((index) => index >= 0);

  if (lines.some((line) => line.trim() === '---' && line !== '---')) {
    return { valid: false, stopReason: 'invalid_output', message: 'Separador deve ocupar sozinho a linha, sem espaços.' };
  }

  if (lines.some((line) => line.includes('---') && line.trim() !== '---')) {
    return { valid: false, stopReason: 'invalid_output', message: 'Separador de blocos malformado.' };
  }

  if (separatorIndexes.some((index) => index === 0 || index === lines.length - 1)) {
    return { valid: false, stopReason: 'invalid_output', message: 'Separador não pode ficar no início ou no final.' };
  }

  if (separatorIndexes.some((index) => lines[index - 1]?.trim() === '---' || lines[index + 1]?.trim() === '---')) {
    return { valid: false, stopReason: 'invalid_output', message: 'Separadores consecutivos não são permitidos.' };
  }

  return { valid: true };
};

const GENERIC_CHECK_IN_PATTERNS = [
  /conseguiu (?:ver|olhar|analisar|avaliar)/,
  /teve tempo de (?:ver|olhar|analisar|avaliar)/,
  /(?:ficou|esta|está) com alguma duvida/,
  /alguma novidade/,
  /o que (?:voce )?achou/,
  /ainda (?:tem|teria) interesse/,
  /gostaria de prosseguir/,
];

const PASSIVE_HANDOFF_PATTERNS = [
  /(?:estou|fico|seguimos) (?:aqui |por aqui )?(?:a disposicao|disponivel)/,
  /\bestou por aqui\b/,
  /quando (?:fizer sentido|quiser|puder).*(?:me chama|pode me chamar|falamos|retomamos)/,
  /qualquer (?:coisa|duvida).*(?:me chama|estou por aqui)/,
  /passando (?:so |apenas )?para (?:saber|lembrar|ver)/,
  /pode me chamar quando/,
];

const COMMERCIAL_ANCHOR_PATTERNS = [
  /\b(?:plano|opcao|alternativa|cotacao|simulacao|operadora|amil|unimed|leve|bradesco|sulamerica|medsenior|hapvida|notredame|rede|cobertura|hospital|acomodacao|enfermaria|apartamento|coparticipacao|carencia|mensalidade|valor|preco|custo|orcamento|limite|teto|proposta|contratacao|contrato|documentacao|documentos|boleto|vigencia|beneficiari[oa]s?|titular|dependente|elegibilidade|entrevista|pagamento|inicio|necessidade)\b/,
  /\b(?:falar|conversar|decidir|confirmar|alinhar|definir|falou|conversou|decidiu|confirmou|alinhou|definiu)\b.*\b(?:marido|esposa|familia|soci[oa]|rh)\b/,
  /\b(?:marido|esposa|familia|soci[oa]|rh)\b.*\b(?:falar|conversar|decidir|confirmar|alinhar|definir|falou|conversou|decidiu|confirmou|alinhou|definiu)\b/,
  /r\$\s*\d/i,
];

const SPECIFIC_ADVANCE_PATTERNS = [
  /\b(?:prefere|escolhe|escolheria|ficou mais proxima|ficou mais perto)\b.*\b(?:ou|entre)\b/,
  /\bentre\b.+\b(?:qual|que|voce prefere|ficou)\b/,
  /\bpesa mais\b/,
  /\bprincipal (?:criterio|prioridade|preocupacao|bloqueio)\b/,
  /\b(?:limite|teto) (?:de )?(?:valor|orcamento|mensalidade)\b/,
  /\bse eu conseguir\b.+\b(?:faria sentido|podemos|seguimos|resolve)\b/,
  /\b(?:posso|podemos|vamos) (?:dar entrada|iniciar|montar|emitir|gerar|seguir com|verificar)\b/,
  /\b(?:posso|podemos) (?:deixar|pausar|encerrar)\b/,
  /\b(?:incluir|retirar|manter)\b.+\b(?:titular|dependente|beneficiari[oa]|marido|esposa|filh[oa]|mae|pai)\b/,
  /\b(?:me envie|preciso de|pode enviar|consegue enviar)\b.+\b(?:documento|documentacao|dados)\b/,
  /\bqual (?:plano|opcao|operadora|hospital|rede|acomodacao|data)\b/,
  /\bqual (?:das|dentre as) (?:duas|opcoes)\b/,
  /\b(?:preco|valor|rede|hospital|carencia|acomodacao)\b.+\b(?:ou|versus|x)\b/,
];

const SELLER_ACTION_PATTERNS = [
  /\b(?:vou|posso) (?:confirmar|verificar|consultar|atualizar|ajustar|recalcular|enviar|montar)\b/,
  /\b(?:quer que eu|devo) (?:confirmar|verificar|consultar|atualizar|ajustar|recalcular|enviar|montar)\b/,
  /\bdeixa eu (?:confirmar|verificar|consultar|atualizar)\b/,
];

const UNSUPPORTED_URGENCY_PATTERNS = [
  /\bultima chance\b/,
  /\bso hoje\b/,
  /\bapenas hoje\b/,
  /\bantes que (?:acabe|expire|aumente)\b/,
  /\bcondicao especial\b/,
  /\bpreco vai (?:subir|aumentar)\b/,
];

/**
 * Conservative business guardrail. The model still performs the semantic
 * analysis; this validator only blocks well-known failure modes that should
 * never be sent as the final result.
 */
export const validateFollowUpBusinessOutput = (
  rawValue: string,
  evidenceText = '',
): FollowUpTechnicalValidation => {
  const parsed = parseFollowUpOutput(rawValue);
  if (!parsed) {
    return {
      valid: false,
      stopReason: 'invalid_output',
      message: 'Sinal de espera malformado.',
    };
  }

  if (parsed.kind === 'wait') return { valid: true };

  const technicalValidation = validateFollowUpTechnicalOutput(parsed.text);
  if (!technicalValidation.valid) return technicalValidation;

  const normalized = normalizeForMatching(parsed.text);
  const normalizedEvidence = normalizeForMatching(evidenceText);
  const hasCommercialAnchor = COMMERCIAL_ANCHOR_PATTERNS.some((pattern) => pattern.test(normalized));
  const hasSpecificAdvance = SPECIFIC_ADVANCE_PATTERNS.some((pattern) => pattern.test(normalized));
  const hasSellerAction = SELLER_ACTION_PATTERNS.some((pattern) => pattern.test(normalized));

  if (/\bprefere (?:receber )?(?:mensagem|ligacao|telefone|whatsapp) ou (?:mensagem|ligacao|telefone|whatsapp)\b/.test(normalized)) {
    return {
      valid: false,
      stopReason: 'invalid_output',
      message: 'A mensagem escolhe apenas o canal de contato e não trabalha a decisão comercial pendente.',
    };
  }

  if ((parsed.text.match(/\?/g) ?? []).length > 1) {
    return {
      valid: false,
      stopReason: 'invalid_output',
      message: 'O follow-up empilha mais de uma pergunta; persiga uma única microdecisão.',
    };
  }

  if (GENERIC_CHECK_IN_PATTERNS.some((pattern) => pattern.test(normalized)) && !hasSpecificAdvance) {
    return {
      valid: false,
      stopReason: 'invalid_output',
      message: 'A mensagem é uma checagem genérica e não define uma microdecisão comercial específica.',
    };
  }

  if (PASSIVE_HANDOFF_PATTERNS.some((pattern) => pattern.test(normalized)) && !hasSpecificAdvance && !hasSellerAction) {
    return {
      valid: false,
      stopReason: 'invalid_output',
      message: 'A mensagem apenas mantém contato ou devolve a iniciativa ao lead, sem produzir avanço comercial.',
    };
  }

  if (!hasCommercialAnchor && !hasSpecificAdvance && !hasSellerAction) {
    return {
      valid: false,
      stopReason: 'invalid_output',
      message: 'A mensagem não contém contexto, decisão ou ação comercial identificável.',
    };
  }

  const unsupportedUrgency = UNSUPPORTED_URGENCY_PATTERNS.find((pattern) => (
    pattern.test(normalized) && !pattern.test(normalizedEvidence)
  ));
  if (unsupportedUrgency) {
    return {
      valid: false,
      stopReason: 'invalid_output',
      message: 'A mensagem cria urgência ou condição comercial sem sustentação no contexto fornecido.',
    };
  }

  return { valid: true };
};

export const buildFollowUpValidationRetryInstruction = (
  validation: FollowUpTechnicalValidation,
): string => [
  'CORREÇÃO OBRIGATÓRIA PARA ESTA NOVA TENTATIVA:',
  validation.message || 'A tentativa anterior não passou pela validação comercial determinística.',
  'Gere uma mensagem diferente que trabalhe uma única microdecisão comercial sustentada pelo histórico.',
  'Se não houver um contato comercialmente útil e apropriado agora, retorne um dos sinais [[WAIT:...]] permitidos, em vez de uma mensagem social ou genérica.',
].join('\n');
