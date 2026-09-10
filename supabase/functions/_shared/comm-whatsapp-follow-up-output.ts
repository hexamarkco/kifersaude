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

const COURTESY_GREETING_PATTERN = /\btudo bem\s*\?/;
const OPENING_GREETING_PATTERN = /^(?:oi|ola|bom dia|boa tarde|boa noite)\b/;

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

/**
 * Validates only objective transport and formatting contracts. Commercial
 * quality is intentionally evaluated by the AI review stage, where the full
 * conversation can be interpreted semantically.
 */
export const validateFollowUpStructuralOutput = (
  rawValue: string,
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
  const hasGreeting = COURTESY_GREETING_PATTERN.test(normalized) || OPENING_GREETING_PATTERN.test(normalized);

  if (hasGreeting) {
    const blocks = parsed.text.split(/\r?\n---\r?\n/);
    const greetingBlock = normalizeForMatching(blocks[0] ?? '');
    const remainingBlocks = normalizeForMatching(blocks.slice(1).join('\n'));
    const greetingIsInFirstBlock = COURTESY_GREETING_PATTERN.test(greetingBlock)
      || OPENING_GREETING_PATTERN.test(greetingBlock);
    const greetingLeaksIntoLaterBlock = COURTESY_GREETING_PATTERN.test(remainingBlocks)
      || OPENING_GREETING_PATTERN.test(remainingBlocks);

    if (blocks.length < 2 || !greetingIsInFirstBlock || greetingLeaksIntoLaterBlock) {
      return {
        valid: false,
        stopReason: 'invalid_output',
        message: 'A saudação deve ocupar o primeiro bloco e ser seguida por uma linha contendo exatamente --- antes da mensagem comercial.',
      };
    }
  }

  return { valid: true };
};

export const buildFollowUpStructuralRetryInstruction = (
  validation: FollowUpTechnicalValidation,
): string => [
  'CORREÇÃO TÉCNICA OBRIGATÓRIA PARA ESTA NOVA TENTATIVA:',
  validation.message || 'A tentativa anterior não respeitou o contrato de saída.',
  'Preserve a estratégia, mas corrija somente o formato objetivo solicitado.',
].join('\n');
