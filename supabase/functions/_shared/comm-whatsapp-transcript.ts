/* eslint-disable @typescript-eslint/no-explicit-any */
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
