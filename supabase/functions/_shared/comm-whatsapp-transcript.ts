import { toTrimmedString } from './comm-whatsapp.ts';

export type ChatRow = {
  id: string;
  phone_number: string | null;
  display_name: string | null;
  saved_contact_name: string | null;
  push_name: string | null;
  lead_id: string | null;
};

export type MessageRow = {
  id: string;
  direction: 'inbound' | 'outbound' | 'system';
  message_type: string;
  delivery_status: string;
  text_content: string | null;
  message_at: string;
  media_caption: string | null;
  transcription_text: string | null;
};

export type LeadRow = {
  id: string;
  nome_completo: string | null;
  status: string | null;
  origem: string | null;
  responsavel: string | null;
  cidade: string | null;
  email: string | null;
};

export const DEFAULT_SYSTEM_TIMEZONE = 'America/Sao_Paulo';
export const AUDIO_WITHOUT_TRANSCRIPTION_MARKER = '[Audio sem transcricao]';

export const normalizeSystemTimeZone = (value: unknown) => {
  const candidate = toTrimmedString(value);
  if (!candidate) return DEFAULT_SYSTEM_TIMEZONE;
  try {
    new Intl.DateTimeFormat('pt-BR', { timeZone: candidate }).format(new Date());
    return candidate;
  } catch {
    return DEFAULT_SYSTEM_TIMEZONE;
  }
};

export const formatTimestamp = (value: string, timeZone: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '[--:--, --/--/----]';
  const parts = new Intl.DateTimeFormat('pt-BR', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
  return `[${read('hour')}:${read('minute')}, ${read('day')}/${read('month')}/${read('year')}]`;
};

export const normalizeTranscriptText = (value: string) => value.replace(/\s+/g, ' ').trim();

export const getMessageContent = (message: MessageRow) => {
  if (message.direction === 'system') return '';
  if (message.direction === 'outbound' && message.delivery_status.trim().toLowerCase() === 'failed') return '';
  const text = normalizeTranscriptText(toTrimmedString(message.text_content));
  const caption = normalizeTranscriptText(toTrimmedString(message.media_caption));
  const transcription = normalizeTranscriptText(toTrimmedString(message.transcription_text));
  const kind = message.message_type.trim().toLowerCase();
  if (kind === 'text') return text;
  if (kind === 'image') return caption ? `[Imagem] ${caption}` : '[Imagem]';
  if (kind === 'video' || kind === 'gif' || kind === 'short') return caption ? `[Video] ${caption}` : '[Video]';
  if (kind === 'document') return caption ? `[Documento] ${caption}` : '[Documento]';
  if (kind === 'audio' || kind === 'voice') return transcription || AUDIO_WITHOUT_TRANSCRIPTION_MARKER;
  if (caption) return caption;
  if (text) return text;
  if (transcription) return transcription;
  return `[${kind || 'mensagem sem texto'}]`;
};

export const buildTranscriptLine = (message: MessageRow, contactLabel: string, timeZone: string) => {
  const content = getMessageContent(message);
  if (!content) return null;
  const author = message.direction === 'outbound' ? 'VOCE' : contactLabel;
  return `${formatTimestamp(message.message_at, timeZone)} ${author}: ${content}`;
};

export const getChatLabel = (chat: ChatRow, lead: LeadRow | null) => (
  toTrimmedString(chat.saved_contact_name)
  || toTrimmedString(lead?.nome_completo)
  || toTrimmedString(chat.push_name)
  || toTrimmedString(chat.display_name)
  || toTrimmedString(chat.phone_number)
  || 'Cliente'
);

// ---- Style profile (aprende o estilo de escrita real da operacao a partir
// de mensagens outbound recentes, para gerar texto que soa humano em vez de
// generico/robotico) ----

export type StyleProfile = {
  avgLengthLabel: string;
  greetingPatterns: string[];
  closingPatterns: string[];
  questionRate: number;
  usesEmoji: boolean;
  formality: string;
  commonOpenings: string[];
  messageStructure: string;
  avgMessagesPerSession: number;
};

export const buildStyleProfile = (outboundMessages: MessageRow[]): StyleProfile => {
  const texts = outboundMessages
    .map((m) => normalizeTranscriptText(toTrimmedString(m.text_content)))
    .filter((t) => t.length >= 12 && t.length <= 1200);

  if (texts.length === 0) {
    return {
      avgLengthLabel: 'nao identificado',
      greetingPatterns: [],
      closingPatterns: [],
      questionRate: 0,
      usesEmoji: false,
      formality: 'neutro',
      commonOpenings: [],
      messageStructure: 'nao identificada',
      avgMessagesPerSession: 1,
    };
  }

  const lengths = texts.map((t) => t.length);
  const avgLength = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  const avgLengthLabel = avgLength < 40 ? 'muito curta' : avgLength < 100 ? 'curta' : avgLength < 200 ? 'media' : avgLength < 400 ? 'longa' : 'muito longa';

  const questionCount = texts.filter((t) => t.includes('?')).length;
  const questionRate = Math.round((questionCount / texts.length) * 100);

  const openings = texts.map((t) => {
    const cleaned = t.replace(/^["'“”\s]+/, '');
    return cleaned.slice(0, 60).trim();
  }).filter((o) => o.length >= 4);
  const openingFreq = new Map<string, number>();
  for (const o of openings) {
    const key = o.slice(0, 30);
    openingFreq.set(key, (openingFreq.get(key) || 0) + 1);
  }
  const commonOpenings = [...openingFreq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([text]) => text);

  const greetings = ['ola', 'olá', 'oi', 'bom dia', 'boa tarde', 'boa noite', 'hey', 'fala'];
  const greetingMatch = texts.filter((t) => {
    const lower = t.toLowerCase().trim();
    return greetings.some((g) => lower.startsWith(g) || lower.startsWith(`${g},`));
  });
  const greetingPatterns = greetingMatch.length > 0
    ? (greetingMatch.length / texts.length > 0.15 ? ['saudacao frequente'] : ['saudacao ocasional'])
    : ['sem saudacao'];

  const closings = ['obrigado', 'obrigada', 'abraco', 'abraços', 'atenciosamente', 'grato', 'grata', 'aguardo', 'fico no aguardo'];
  const closingMatch = texts.filter((t) => {
    const lower = t.toLowerCase().trim();
    return closings.some((c) => lower.includes(c));
  });
  const closingPatterns = closingMatch.length > 0
    ? (closingMatch.length / texts.length > 0.1 ? ['fechamento frequente'] : ['fechamento ocasional'])
    : ['sem fechamento'];

  const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F600}-\u{1F64F}]/u;
  const emojiCount = texts.filter((t) => emojiRegex.test(t)).length;
  const usesEmoji = emojiCount / texts.length > 0.05;

  const formalMarkers = texts.filter((t) => /(sr\.?|sra\.?|senhor|senhora|por gentileza|gostaria de|encaminhar)/i.test(t)).length;
  const informalMarkers = texts.filter((t) => /(vc|voce|ta|tá|ok|beleza|blz|foi|show|curtir|tranquilo|tranquila)/i.test(t)).length;
  const formality = formalMarkers > informalMarkers ? 'formal' : informalMarkers > formalMarkers ? 'informal' : 'neutro';

  const hasLineBreaks = texts.filter((t) => t.includes('\n')).length / texts.length > 0.2;
  const structureDesc = hasLineBreaks
    ? 'frequentemente usa paragrafos/multiplas linhas'
    : avgLength < 100
      ? 'mensagens curtas em linha unica'
      : 'bloco unico de texto';

  return {
    avgLengthLabel,
    greetingPatterns,
    closingPatterns,
    questionRate,
    usesEmoji,
    formality,
    commonOpenings,
    messageStructure: structureDesc,
    avgMessagesPerSession: Math.max(1, Math.round(texts.length / Math.max(1, outboundMessages.length / 3))),
  };
};

export const buildStyleProfileText = (profile: StyleProfile): string => {
  const parts: string[] = ['Perfil de estilo da operacao (analisado de mensagens reais enviadas):'];
  parts.push(`- Comprimento tipico: ${profile.avgLengthLabel}`);
  parts.push(`- Estrutura: ${profile.messageStructure}`);
  parts.push(`- Tom predominante: ${profile.formality}`);
  parts.push(`- Uso de perguntas: ${profile.questionRate}% das mensagens`);
  if (profile.usesEmoji) parts.push('- Usa emojis ocasionalmente');
  else parts.push('- Raramente usa emojis');
  if (profile.greetingPatterns.length > 0) parts.push(`- Saudacao: ${profile.greetingPatterns.join(', ')}`);
  if (profile.closingPatterns.length > 0) parts.push(`- Fechamento: ${profile.closingPatterns.join(', ')}`);
  if (profile.commonOpenings.length > 0) {
    parts.push('- Aberturas comuns:');
    profile.commonOpenings.slice(0, 3).forEach((o) => parts.push(`  * "${o}${o.length >= 30 ? '...' : ''}"`));
  }
  return parts.join('\n');
};

export const MAX_STYLE_EXAMPLES = 12;
export const STYLE_SAMPLE_LIMIT = 120;

export const buildStyleExamples = (styleMessages: MessageRow[]): string[] => (
  styleMessages
    .map((m) => normalizeTranscriptText(toTrimmedString(m.text_content)))
    .filter(Boolean)
    .filter((text) => text.length >= 12 && text.length <= 900)
    .filter((text) => /[a-zA-ZÀ-ÿ]{3,}/.test(text))
    .slice(0, MAX_STYLE_EXAMPLES)
);
