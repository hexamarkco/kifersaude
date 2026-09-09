export const WHATSAPP_QUICK_REPLIES_INTEGRATION_SLUG = 'whatsapp_quick_replies';
export const WHATSAPP_QUICK_REPLIES_INTEGRATION_NAME = 'Mensagens rápidas do WhatsApp';
export const WHATSAPP_QUICK_REPLIES_INTEGRATION_DESCRIPTION = 'Atalhos das mensagens rápidas usadas no inbox do WhatsApp.';

export type WhatsAppQuickReply = {
  id: string;
  name: string;
  shortcut: string;
  text: string;
  created_at: string | null;
  updated_at: string | null;
};

export type WhatsAppQuickRepliesSettings = {
  quickReplies: WhatsAppQuickReply[];
};

export type QuickReplyCommandMatch = {
  query: string;
  start: number;
  end: number;
};

type TextSelection = {
  start: number;
  end: number;
};

const toTrimmedString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
const normalizeMultilineText = (value: unknown) => (
  typeof value === 'string' ? value.replace(/\r\n/g, '\n').trim() : ''
);

export const normalizeQuickReplyLookup = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim();

export const sanitizeWhatsAppQuickReplyShortcut = (value: string) => normalizeQuickReplyLookup(value)
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

export const buildQuickReplyShortcut = (value: string, index: number) => (
  sanitizeWhatsAppQuickReplyShortcut(value) || `msg-${index + 1}`
);

export const summarizeQuickReplyPreview = (value: string) => {
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length <= 120
    ? normalized
    : `${normalized.slice(0, 117).trimEnd()}...`;
};

export const getActiveQuickReplyMatch = (
  value: string,
  selection: TextSelection,
): QuickReplyCommandMatch | null => {
  if (selection.start !== selection.end) return null;

  const cursor = Math.max(0, Math.min(selection.start, value.length));
  const textBeforeCursor = value.slice(0, cursor);
  const slashIndex = textBeforeCursor.lastIndexOf('/');
  if (slashIndex < 0) return null;

  const query = textBeforeCursor.slice(slashIndex + 1);
  if (/\s|\n/.test(query)) return null;

  if (slashIndex > 0) {
    const previousCharacter = value[slashIndex - 1];
    if (!/\s/.test(previousCharacter)) return null;
  }

  return { query, start: slashIndex, end: cursor };
};

const createQuickReplyId = (baseValue: string, index: number) => (
  `quick-reply-${buildQuickReplyShortcut(baseValue, index)}-${index + 1}`
);

const normalizeQuickReplyRecord = (value: unknown, index: number): WhatsAppQuickReply | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  const record = value as Record<string, unknown>;
  const name = toTrimmedString(record.name) || toTrimmedString(record.title) || `Mensagem rápida ${index + 1}`;
  const text = normalizeMultilineText(record.text);
  if (!text) return null;

  return {
    id: toTrimmedString(record.id) || createQuickReplyId(name, index),
    name,
    shortcut: sanitizeWhatsAppQuickReplyShortcut(toTrimmedString(record.shortcut) || name),
    text,
    created_at: toTrimmedString(record.created_at) || null,
    updated_at: toTrimmedString(record.updated_at) || null,
  };
};

export const sanitizeWhatsAppQuickReplies = (quickReplies: WhatsAppQuickReply[]): WhatsAppQuickReply[] => {
  const usedShortcuts = new Set<string>();

  return quickReplies
    .map((quickReply, index) => normalizeQuickReplyRecord(quickReply, index))
    .filter((quickReply): quickReply is WhatsAppQuickReply => quickReply !== null)
    .map((quickReply, index) => {
      const baseShortcut = quickReply.shortcut
        || sanitizeWhatsAppQuickReplyShortcut(quickReply.name)
        || `msg-${index + 1}`;
      let shortcut = baseShortcut;
      let duplicateIndex = 2;

      while (usedShortcuts.has(shortcut)) {
        shortcut = `${baseShortcut}-${duplicateIndex}`;
        duplicateIndex += 1;
      }

      usedShortcuts.add(shortcut);
      return { ...quickReply, shortcut };
    });
};

export const normalizeWhatsAppQuickRepliesSettings = (settings: unknown): WhatsAppQuickRepliesSettings => {
  const source = settings && typeof settings === 'object' && !Array.isArray(settings)
    ? settings as Record<string, unknown>
    : {};
  const rawQuickReplies = Array.isArray(source.quickReplies)
    ? source.quickReplies
    : Array.isArray(source.quick_replies)
      ? source.quick_replies
      : [];

  return { quickReplies: sanitizeWhatsAppQuickReplies(rawQuickReplies as WhatsAppQuickReply[]) };
};

export const buildWhatsAppQuickRepliesSettings = (quickReplies: WhatsAppQuickReply[]) => ({
  quickReplies: sanitizeWhatsAppQuickReplies(quickReplies),
});
