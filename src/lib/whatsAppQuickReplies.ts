export const WHATSAPP_QUICK_REPLIES_INTEGRATION_SLUG = 'whatsapp_quick_replies';
export const WHATSAPP_QUICK_REPLIES_INTEGRATION_NAME = 'Mensagens rapidas do WhatsApp';
export const WHATSAPP_QUICK_REPLIES_INTEGRATION_DESCRIPTION = 'Atalhos das mensagens rapidas usadas no inbox do WhatsApp.';

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

const toTrimmedString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const normalizeMultilineText = (value: unknown) =>
  typeof value === 'string' ? value.replace(/\r\n/g, '\n').trim() : '';

const normalizeLookup = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

export const sanitizeWhatsAppQuickReplyShortcut = (value: string) =>
  normalizeLookup(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const createQuickReplyId = (baseValue: string, index: number) => {
  const sanitizedBase = sanitizeWhatsAppQuickReplyShortcut(baseValue) || `msg-${index + 1}`;
  return `quick-reply-${sanitizedBase}-${index + 1}`;
};

const normalizeQuickReplyRecord = (value: unknown, index: number): WhatsAppQuickReply | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const name = toTrimmedString(record.name) || toTrimmedString(record.title) || `Mensagem rapida ${index + 1}`;
  const text = normalizeMultilineText(record.text);

  if (!text) {
    return null;
  }

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
      const baseShortcut = quickReply.shortcut || sanitizeWhatsAppQuickReplyShortcut(quickReply.name) || `msg-${index + 1}`;
      let shortcut = baseShortcut;
      let duplicateIndex = 2;

      while (usedShortcuts.has(shortcut)) {
        shortcut = `${baseShortcut}-${duplicateIndex}`;
        duplicateIndex += 1;
      }

      usedShortcuts.add(shortcut);

      return {
        ...quickReply,
        shortcut,
      };
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

  return {
    quickReplies: sanitizeWhatsAppQuickReplies(rawQuickReplies as WhatsAppQuickReply[]),
  };
};

export const buildWhatsAppQuickRepliesSettings = (quickReplies: WhatsAppQuickReply[]) => ({
  quickReplies: sanitizeWhatsAppQuickReplies(quickReplies),
});
