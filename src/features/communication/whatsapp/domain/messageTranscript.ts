import { getDeletedMessageMarker } from './messageMetadata';
import {
  getUnknownMessageMarker,
  isHiddenTechnicalMessageMarker,
} from './messagePresentation';
import type { CommWhatsAppMessage } from './types';
import { shouldHideTechnicalMessage } from './messageVisibility';

export const DEFAULT_TRANSCRIPT_TIME_ZONE = 'America/Sao_Paulo';
const AUDIO_WITHOUT_TRANSCRIPTION_MARKER = '[Áudio sem transcrição]';

export const normalizeSystemTimeZone = (value: unknown) => {
  const candidate = String(value ?? '').trim();
  if (!candidate) return DEFAULT_TRANSCRIPT_TIME_ZONE;

  try {
    new Intl.DateTimeFormat('pt-BR', { timeZone: candidate }).format(new Date());
    return candidate;
  } catch {
    return DEFAULT_TRANSCRIPT_TIME_ZONE;
  }
};

const getTranscriptDateTimeParts = (date: Date, timeZone: string) => {
  const formatter = new Intl.DateTimeFormat('pt-BR', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';

  return {
    day: read('day'),
    month: read('month'),
    year: read('year'),
    hour: read('hour'),
    minute: read('minute'),
  };
};

export const formatTranscriptTimestamp = (value: string, timeZone: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '[--:--, --/--/----]';

  const parts = getTranscriptDateTimeParts(date, timeZone);
  return `[${parts.hour}:${parts.minute}, ${parts.day}/${parts.month}/${parts.year}]`;
};

const normalizeTranscriptText = (value?: string | null) => String(value ?? '').replace(/\s+/g, ' ').trim();

export const buildTranscriptContent = (message: CommWhatsAppMessage) => {
  if (shouldHideTechnicalMessage(message) || message.direction === 'system') return '';
  if (message.direction === 'outbound' && message.delivery_status.trim().toLowerCase() === 'failed') return '';

  const text = normalizeTranscriptText(message.text_content);
  const caption = normalizeTranscriptText(message.media_caption);
  const transcription = normalizeTranscriptText(message.transcription_text);
  const kind = message.message_type.trim().toLowerCase();
  const isDeleted = message.delivery_status.trim().toLowerCase() === 'deleted';
  const visibleText = isHiddenTechnicalMessageMarker(text, message.message_type) ? '' : text;
  const visibleCaption = isHiddenTechnicalMessageMarker(caption, message.message_type) ? '' : caption;
  const withDeletedFlag = (content: string) => {
    if (!isDeleted) return content;
    return content ? `[Mensagem apagada] ${content}` : getDeletedMessageMarker(kind);
  };

  if (kind === 'text') return withDeletedFlag(visibleText);
  if (kind === 'image') return withDeletedFlag(visibleCaption ? `[Imagem] ${visibleCaption}` : '[Imagem]');
  if (kind === 'video' || kind === 'gif' || kind === 'short') {
    return withDeletedFlag(visibleCaption ? `[Video] ${visibleCaption}` : '[Video]');
  }
  if (kind === 'document') {
    return withDeletedFlag(visibleCaption ? `[Documento] ${visibleCaption}` : '[Documento]');
  }
  if (kind === 'audio' || kind === 'voice') {
    return withDeletedFlag(transcription || AUDIO_WITHOUT_TRANSCRIPTION_MARKER);
  }
  if (visibleCaption) return withDeletedFlag(visibleCaption);
  if (visibleText) return withDeletedFlag(visibleText);
  if (transcription) return withDeletedFlag(transcription);
  return withDeletedFlag(getUnknownMessageMarker(kind));
};

export const buildTranscriptLine = (
  message: CommWhatsAppMessage,
  leadLabel: string,
  timeZone: string,
) => {
  const content = buildTranscriptContent(message);
  if (!content) return null;

  const author = message.direction === 'outbound' ? 'Eu' : leadLabel;
  return `${formatTranscriptTimestamp(message.message_at, timeZone)} ${author}: ${content}`;
};
