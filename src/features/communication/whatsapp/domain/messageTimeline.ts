import { getDateKey, SAO_PAULO_TIMEZONE } from '../../../../lib/dateUtils';
import { mergeCommWhatsAppMessages } from '../messageStatus';
import { getMessageClientOrderAt } from './messageMetadata';
import { getMessageSearchPreviewText, normalizeInboxSearch } from './messagePresentation';
import type { CommWhatsAppMessage } from './types';

export const parseCommMessageDate = (value?: string | null) => {
  if (!value) return new Date(Number.NaN);

  const direct = new Date(value);
  if (!Number.isNaN(direct.getTime())) return direct;

  const normalized = String(value).trim();
  const withoutTimezone = normalized.match(/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?$/);
  if (withoutTimezone) {
    const fallback = new Date(`${normalized.replace(' ', 'T')}Z`);
    if (!Number.isNaN(fallback.getTime())) return fallback;
  }

  return new Date(Number.NaN);
};

export const getMessageTimestampMs = (value?: string | null) => {
  if (!value) return null;
  const timestamp = parseCommMessageDate(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
};

export const getComparableMessageTimestampMs = (
  message: Pick<CommWhatsAppMessage, 'message_at' | 'created_at' | 'metadata'>,
) => {
  const clientOrderTimestamp = getMessageTimestampMs(getMessageClientOrderAt(message as CommWhatsAppMessage));
  if (clientOrderTimestamp !== null) return clientOrderTimestamp;

  const messageTimestamp = getMessageTimestampMs(message.message_at);
  return messageTimestamp ?? getMessageTimestampMs(message.created_at);
};

export const formatMessageTime = (value?: string | null) => {
  const date = parseCommMessageDate(value);
  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: SAO_PAULO_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
};

export const getMessageDayKey = (value?: string | null) => {
  if (!value) return '';
  const date = parseCommMessageDate(value);
  return Number.isNaN(date.getTime()) ? '' : getDateKey(date, SAO_PAULO_TIMEZONE);
};

export const formatMessageDaySeparatorLabel = (value?: string | null, now = new Date()) => {
  if (!value) return '';

  const date = parseCommMessageDate(value);
  if (Number.isNaN(date.getTime())) return '';

  const todayKey = getDateKey(now, SAO_PAULO_TIMEZONE);
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = getDateKey(yesterday, SAO_PAULO_TIMEZONE);
  const targetKey = getDateKey(date, SAO_PAULO_TIMEZONE);

  if (targetKey === todayKey) return 'Hoje';
  if (targetKey === yesterdayKey) return 'Ontem';

  const diffDays = Math.round((now.getTime() - date.getTime()) / (24 * 60 * 60 * 1000));
  if (diffDays > 1 && diffDays < 7) {
    return new Intl.DateTimeFormat('pt-BR', { weekday: 'long', timeZone: SAO_PAULO_TIMEZONE }).format(date);
  }

  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: SAO_PAULO_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
};

export const compareMessageChronology = (a: CommWhatsAppMessage, b: CommWhatsAppMessage) => {
  const timeDiff = (getComparableMessageTimestampMs(a) ?? 0) - (getComparableMessageTimestampMs(b) ?? 0);
  if (timeDiff !== 0) return timeDiff;

  const createdDiff = (getMessageTimestampMs(a.created_at) ?? 0) - (getMessageTimestampMs(b.created_at) ?? 0);
  return createdDiff !== 0 ? createdDiff : a.id.localeCompare(b.id);
};

export const mergeMessages = (existing: CommWhatsAppMessage[], incoming: CommWhatsAppMessage[]) => (
  mergeCommWhatsAppMessages(existing, incoming).sort(compareMessageChronology)
);

const getObviousDuplicateMessageKey = (message: CommWhatsAppMessage) => {
  if (message.direction === 'system') return '';

  const messageAtMs = getMessageTimestampMs(message.message_at);
  if (messageAtMs === null) return '';

  const text = normalizeInboxSearch(getMessageSearchPreviewText(message)).replace(/\s+/g, ' ').trim();
  if (text.length < 12) return '';

  const messageAtSecond = Math.floor(messageAtMs / 1000);
  const sender = normalizeInboxSearch(String(message.sender_phone ?? message.sender_name ?? ''));
  return [message.chat_id, message.direction, message.message_type.trim().toLowerCase(), messageAtSecond, sender, text].join(':');
};

const pickMoreCompleteDuplicateMessage = (current: CommWhatsAppMessage, candidate: CommWhatsAppMessage) => {
  const currentExternalId = String(current.external_message_id ?? '').trim();
  const candidateExternalId = String(candidate.external_message_id ?? '').trim();

  if (!currentExternalId && candidateExternalId) return candidate;
  if (!current.media_id && candidate.media_id) return candidate;
  if (!current.transcription_text && candidate.transcription_text) return candidate;
  return current;
};

export const dedupeObviousDuplicateMessages = (items: CommWhatsAppMessage[]) => {
  const bySemanticKey = new Map<string, CommWhatsAppMessage>();
  const passthrough: CommWhatsAppMessage[] = [];

  for (const message of items) {
    const key = getObviousDuplicateMessageKey(message);
    if (!key) {
      passthrough.push(message);
      continue;
    }

    const current = bySemanticKey.get(key);
    bySemanticKey.set(key, current ? pickMoreCompleteDuplicateMessage(current, message) : message);
  }

  return [...passthrough, ...bySemanticKey.values()].sort(compareMessageChronology);
};
