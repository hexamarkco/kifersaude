import { messagesReferToSameDelivery } from '../messageStatus';
import {
  getMessageEditableText,
  getMessageSummaryMarker,
  isMessageSummaryMarker,
  normalizeComparableMessageText,
} from './messagePresentation';
import type { CommWhatsAppMessage } from './types';

export type MessageQuoteInfo = {
  externalMessageId: string | null;
  authorPhone: string | null;
  quotedType: string | null;
  previewText: string;
};

export type MessageContactCardInfo = {
  kind: 'contact' | 'contact_list';
  count: number;
  items: Array<{
    name: string | null;
    phoneNumber: string | null;
  }>;
};

export type MessageInteractiveInfo = {
  kind: 'buttons' | 'list' | 'reply' | 'template' | 'unknown';
  header: string | null;
  body: string | null;
  footer: string | null;
  buttons: Array<{ id: string | null; title: string | null }>;
  sections: Array<{
    title: string | null;
    rows: Array<{ id: string | null; title: string | null; description: string | null }>;
  }>;
  selectedReply: { id: string | null; title: string | null } | null;
};

const readRecord = (value: unknown): Record<string, unknown> | null => (
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
);

export const getMessageMetadataRecord = (message?: CommWhatsAppMessage | null) => readRecord(message?.metadata) ?? {};

export const getMessageClientRequestId = (message?: CommWhatsAppMessage | null) => {
  const metadata = getMessageMetadataRecord(message);
  return String(metadata.client_request_id ?? metadata.clientRequestId ?? '').trim();
};

export const getMessageClientOrderAt = (message?: CommWhatsAppMessage | null) => {
  const metadata = getMessageMetadataRecord(message);
  return String(metadata.client_order_at ?? metadata.clientOrderAt ?? '').trim();
};

export const messagesReferToSameOutgoing = (left: CommWhatsAppMessage, right: CommWhatsAppMessage) => (
  messagesReferToSameDelivery(left, right) || left.id === right.id
);

export const getMessageQuoteInfo = (message?: CommWhatsAppMessage | null): MessageQuoteInfo | null => {
  if (!message) return null;

  const quote = readRecord(getMessageMetadataRecord(message).quote);
  if (!quote) return null;

  const quotedType = String(quote.quoted_type ?? '').trim().toLowerCase() || null;
  const previewText = String(quote.preview_text ?? '').trim() || getMessageSummaryMarker(quotedType || 'text');
  const externalMessageId = String(quote.external_message_id ?? '').trim() || null;
  const authorPhone = String(quote.author_phone ?? '').trim() || null;

  if (!externalMessageId && !previewText && !authorPhone && !quotedType) return null;

  return { externalMessageId, authorPhone, quotedType, previewText };
};

export const hasMessageQuote = (message?: CommWhatsAppMessage | null) => Boolean(getMessageQuoteInfo(message));

export const getMessageContactCardInfo = (message?: CommWhatsAppMessage | null): MessageContactCardInfo | null => {
  if (!message) return null;

  const messageType = message.message_type.trim().toLowerCase();
  const contactCard = readRecord(getMessageMetadataRecord(message).contact_card);
  const kind = String(contactCard?.kind ?? '').trim().toLowerCase();

  if (kind !== 'contact' && kind !== 'contact_list') {
    if (messageType !== 'contact' && messageType !== 'contact_list') return null;

    const fallbackText = String(message.text_content ?? '').trim();
    return {
      kind: messageType as 'contact' | 'contact_list',
      count: messageType === 'contact' ? 1 : 0,
      items: fallbackText && !isMessageSummaryMarker(fallbackText, message.message_type)
        ? [{ name: fallbackText, phoneNumber: null }]
        : [],
    };
  }

  const items = Array.isArray(contactCard?.items)
    ? contactCard.items
        .map((item) => {
          const record = readRecord(item);
          if (!record) return null;
          const name = String(record.name ?? '').trim() || null;
          const phoneNumber = String(record.phone_number ?? '').trim() || null;
          return name || phoneNumber ? { name, phoneNumber } : null;
        })
        .filter((item): item is { name: string | null; phoneNumber: string | null } => Boolean(item))
    : [];

  const rawCount = Number(contactCard?.count ?? items.length);
  const count = Number.isFinite(rawCount)
    ? Math.max(items.length, Math.max(0, Math.round(rawCount)))
    : items.length;

  return {
    kind: kind as 'contact' | 'contact_list',
    count: count || (kind === 'contact' ? 1 : 0),
    items,
  };
};

export const getMessageInteractiveInfo = (message?: CommWhatsAppMessage | null): MessageInteractiveInfo | null => {
  if (!message) return null;

  const interactive = readRecord(getMessageMetadataRecord(message).interactive);
  if (!interactive) return null;

  const kind = String(interactive.kind ?? '').trim().toLowerCase();
  const validKinds = ['buttons', 'list', 'reply', 'template', 'unknown'];
  if (!validKinds.includes(kind)) return null;

  const readButton = (value: unknown) => {
    const record = readRecord(value);
    if (!record) return null;
    const id = String(record.id ?? '').trim() || null;
    const title = String(record.title ?? '').trim() || null;
    return id || title ? { id, title } : null;
  };

  const buttons = Array.isArray(interactive.buttons)
    ? interactive.buttons.map(readButton).filter((button): button is { id: string | null; title: string | null } => Boolean(button))
    : [];

  const sections = Array.isArray(interactive.sections)
    ? interactive.sections
        .map((entry) => {
          const record = readRecord(entry);
          if (!record) return null;
          const title = String(record.title ?? '').trim() || null;
          const rows = Array.isArray(record.rows)
            ? record.rows
                .map((row) => {
                  const rowRecord = readRecord(row);
                  if (!rowRecord) return null;
                  const id = String(rowRecord.id ?? '').trim() || null;
                  const rowTitle = String(rowRecord.title ?? '').trim() || null;
                  const description = String(rowRecord.description ?? '').trim() || null;
                  return id || rowTitle || description ? { id, title: rowTitle, description } : null;
                })
                .filter((row): row is { id: string | null; title: string | null; description: string | null } => Boolean(row))
            : [];
          return title || rows.length > 0 ? { title, rows } : null;
        })
        .filter((section): section is MessageInteractiveInfo['sections'][number] => Boolean(section))
    : [];

  const selectedReply = readButton(interactive.selectedReply);
  const header = String(interactive.header ?? '').trim() || null;
  const body = String(interactive.body ?? '').trim() || null;
  const footer = String(interactive.footer ?? '').trim() || null;

  if (!header && !body && !footer && buttons.length === 0 && sections.length === 0 && !selectedReply) return null;

  return {
    kind: kind as MessageInteractiveInfo['kind'],
    header,
    body,
    footer,
    buttons,
    sections,
    selectedReply,
  };
};

export const getMessageLinkPreview = (message: CommWhatsAppMessage) => {
  const preview = getMessageMetadataRecord(message).link_preview;
  if (!preview || typeof preview !== 'object' || Array.isArray(preview)) return null;

  const record = preview as Record<string, unknown>;
  const url = String(record.url ?? record.link ?? record.canonical ?? '').trim();
  const title = String(record.title ?? '').trim();
  const description = String(record.description ?? '').trim();
  const canonical = String(record.canonical ?? '').trim();
  const body = String(record.body ?? '').trim();
  const previewImage = String(record.preview ?? '').trim();

  if (!url && !title && !description && !previewImage && !body) return null;

  let domain = '';
  try {
    domain = new URL(canonical || url).hostname.replace(/^www\./i, '');
  } catch {
    domain = '';
  }

  return {
    url: url || canonical || null,
    title: title || null,
    description: description || null,
    body: body || null,
    previewImage: previewImage || null,
    domain: domain || null,
  };
};

export const getDeletedMessageMarker = (messageType: string) => {
  switch (messageType.trim().toLowerCase()) {
    case 'image': return '[Imagem apagada]';
    case 'video':
    case 'gif':
    case 'short': return '[Video apagado]';
    case 'audio':
    case 'voice': return '[Audio apagado]';
    case 'document': return '[Documento apagado]';
    case 'sticker': return '[Sticker apagado]';
    case 'contact':
    case 'contact_list': return '[Contato apagado]';
    case 'poll': return '[Enquete apagada]';
    default: return '[Mensagem apagada]';
  }
};

export const buildDeletedMessageSummary = (messageType: string, preservedText?: string | null) => {
  const normalizedText = String(preservedText ?? '').trim();
  return normalizedText ? `[Apagada] ${normalizedText}` : getDeletedMessageMarker(messageType);
};

export const getEditedMessageInfo = (message?: CommWhatsAppMessage | null) => {
  if (!message) {
    return { edited: false, originalText: null, previousText: null, currentText: null, editedAt: null };
  }

  const metadata = getMessageMetadataRecord(message);
  const messageType = message.message_type.trim().toLowerCase();
  const currentText = getMessageEditableText(message) || normalizeComparableMessageText(message.message_type, message.text_content);
  const originalText = normalizeComparableMessageText(message.message_type, metadata.original_text_content);
  const editHistory = Array.isArray(metadata.edit_history)
    ? metadata.edit_history.filter((item): item is Record<string, unknown> => Boolean(readRecord(item)))
    : [];
  const lastEdit = editHistory.length > 0 ? editHistory[editHistory.length - 1] : null;
  const previousText = normalizeComparableMessageText(message.message_type, lastEdit?.previous_text) || originalText || null;
  const visibleCurrentText = getMessageEditableText(message) || currentText || null;
  const editedAt = String(metadata.edited_at ?? '').trim() || null;
  const inferredTextEdit = messageType === 'text' && Boolean(originalText && originalText !== visibleCurrentText);

  return {
    edited: metadata.edited === true || Boolean(editedAt) || editHistory.length > 0 || inferredTextEdit,
    originalText: originalText && originalText !== currentText ? originalText : null,
    previousText: previousText && previousText !== visibleCurrentText ? previousText : null,
    currentText: visibleCurrentText,
    editedAt,
  };
};

export const getDeletedMessageInfo = (message?: CommWhatsAppMessage | null) => {
  if (!message) {
    return { deleted: false, deletedAt: null, deletedBy: null, preservedText: '[Mensagem apagada]' };
  }

  const metadata = getMessageMetadataRecord(message);
  const currentText = String(message.text_content ?? message.media_caption ?? '').trim();
  const originalText = String(metadata.deleted_original_text_content ?? '').trim();
  const deletedAt = String(metadata.deleted_at ?? '').trim() || null;
  const deletedBy = String(metadata.deleted_by ?? '').trim() || null;

  return {
    deleted: message.delivery_status.trim().toLowerCase() === 'deleted' || metadata.deleted === true,
    deletedAt,
    deletedBy,
    preservedText: originalText || currentText || getDeletedMessageMarker(message.message_type),
  };
};

export const getMessageReactions = (message?: CommWhatsAppMessage | null) => {
  if (!message) return [];

  const rawReactions = Array.isArray(getMessageMetadataRecord(message).reactions)
    ? getMessageMetadataRecord(message).reactions as unknown[]
    : [];
  const normalized = rawReactions
    .map(readRecord)
    .filter((item): item is Record<string, unknown> => Boolean(item))
    .map((item) => ({
      emoji: String(item.emoji ?? '').trim(),
      fromMe: item.from_me === true,
      actorLabel: item.from_me === true ? 'Você' : String(item.from_name ?? item.from ?? '').trim() || 'Contato',
    }))
    .filter((item) => Boolean(item.emoji));

  const grouped = new Map<string, { emoji: string; count: number; fromMe: boolean; actors: string[] }>();
  for (const reaction of normalized) {
    const current = grouped.get(reaction.emoji);
    if (current) {
      current.count += 1;
      current.fromMe = current.fromMe || reaction.fromMe;
      if (!current.actors.includes(reaction.actorLabel)) current.actors.push(reaction.actorLabel);
    } else {
      grouped.set(reaction.emoji, { emoji: reaction.emoji, count: 1, fromMe: reaction.fromMe, actors: [reaction.actorLabel] });
    }
  }

  return Array.from(grouped.values()).sort((left, right) => right.count - left.count || left.emoji.localeCompare(right.emoji, 'pt-BR'));
};

export const getReactionTooltipText = (message?: CommWhatsAppMessage | null) => {
  if (!message || !String(message.metadata?.chat_id ?? '').trim().toLowerCase().endsWith('@g.us')) return '';
  return getMessageReactions(message)
    .map((reaction) => `${reaction.emoji} ${reaction.actors.join(', ')}`)
    .join('\n');
};

export const getOwnReactionEmoji = (message?: CommWhatsAppMessage | null) => {
  if (!message) return null;
  const rawReactions = Array.isArray(getMessageMetadataRecord(message).reactions)
    ? getMessageMetadataRecord(message).reactions as unknown[]
    : [];
  const ownReaction = rawReactions
    .map(readRecord)
    .find((item) => item && String(item.actor_key ?? '').trim() === 'self');
  return ownReaction ? String(ownReaction.emoji ?? '').trim() || null : null;
};
