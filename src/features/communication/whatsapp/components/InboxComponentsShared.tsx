import { type ReactNode } from 'react';
import { AlertCircle, AlertTriangle, Check, CheckCheck, Clock3, FileAudio, FileImage, FileText, Images, Link2, MapPin, MessageCircle, Sticker, UserRound, Volume2, Vote } from 'lucide-react';
import { getPanelButtonClass } from '../../../../components/ui/standards';
import { SAO_PAULO_TIMEZONE } from '../../../../lib/dateUtils';
import type { CommWhatsAppChat, CommWhatsAppMessage } from '../../../../lib/supabase';
import { formatCommWhatsAppPhoneLabel } from '../../../../lib/commWhatsAppService';
import { cx } from '../../../../lib/cx';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type ChatPreviewIconType = 'image' | 'video' | 'audio' | 'document' | 'link' | 'location' | 'sticker' | 'contact' | 'poll' | 'interactive';
export type PointerAnchor = { x: number; y: number };
export type WhatsAppFormatMatch = { start: number; end: number; marker: string; format: WhatsAppTextFormat };
export type WhatsAppTextFormat = 'bold' | 'italic' | 'strike';

export type MessageQuoteInfo = {
  externalMessageId: string | null;
  authorPhone: string | null;
  quotedType: string | null;
  previewText: string;
};

export type MessageContactCardInfo = {
  kind: 'contact' | 'contact_list';
  count: number;
  items: Array<{ name: string | null; phoneNumber: string | null }>;
};

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

export const VIDEO_LIKE_MESSAGE_TYPES = new Set(['video', 'gif', 'short']);

export const VISIBLE_SUMMARY_MARKERS = new Set([
  '[imagem]', '[video]', '[documento]', '[audio]', '[link]',
  '[localizacao]', '[sticker]', '[contato]', '[enquete]', '[resposta]', '[mensagem interativa]',
]);

export const HIDDEN_TECHNICAL_MESSAGE_MARKERS = new Set([
  '[mensagem]', '[mensagem sem texto]', '[mensagem sem conteudo]', '[payload invalido]',
  '[acao]', '[action]', '[reacao]', '[reaction]',
  '[atualizacao de midia]', '[media update]', '[voto em enquete]',
]);

export const DEFAULT_WAVEFORM = [0.24, 0.36, 0.52, 0.72, 0.46, 0.62, 0.28, 0.54, 0.4, 0.66, 0.32, 0.58, 0.42, 0.74, 0.38, 0.5, 0.3, 0.64, 0.44, 0.56];

export const inboxInlineActionClassName = getPanelButtonClass({
  variant: 'soft',
  size: 'sm',
  className: 'h-8 rounded-xl px-3 text-[11px] font-semibold',
});

export const WHATSAPP_TEXT_FORMAT_MARKERS: Array<{ marker: string; format: WhatsAppTextFormat }> = [
  { marker: '**', format: 'bold' },
  { marker: '__', format: 'italic' },
  { marker: '*', format: 'bold' },
  { marker: '_', format: 'italic' },
  { marker: '~', format: 'strike' },
];

export const REACTION_OPTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

export const CHAT_PREVIEW_ICON_CONFIG: Record<ChatPreviewIconType, { label: string; Icon: React.ComponentType<{ className?: string }> }> = {
  image: { label: 'foto', Icon: FileImage },
  video: { label: 'vídeo', Icon: Images },
  audio: { label: 'áudio', Icon: FileAudio },
  document: { label: 'documento', Icon: FileText },
  link: { label: 'link', Icon: Link2 },
  location: { label: 'localização', Icon: MapPin },
  sticker: { label: 'figurinha', Icon: Sticker },
  contact: { label: 'contato', Icon: UserRound },
  poll: { label: 'enquete', Icon: Vote },
  interactive: { label: 'mensagem', Icon: MessageCircle },
};

const EDITABLE_OUTBOUND_MESSAGE_TYPES = new Set(['text', 'image', 'video', 'gif', 'short', 'document']);

/* ------------------------------------------------------------------ */
/*  Utility Functions                                                  */
/* ------------------------------------------------------------------ */

export const isVideoLikeMessageType = (messageType: string) => VIDEO_LIKE_MESSAGE_TYPES.has(messageType.trim().toLowerCase());

export const normalizeTechnicalMarker = (value?: string | null) =>
  String(value ?? '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ');

const isBracketOnlyMarker = (value?: string | null) => /^\[[^\]]+\]$/.test(String(value ?? '').trim());

const getUnknownMessageMarker = (messageType: string) => {
  const normalized = messageType.trim().toLowerCase();
  return normalized ? `[${normalized}]` : '[Mensagem sem conteudo]';
};

export const getMessageSummaryMarker = (messageType: string) => {
  const normalized = messageType.trim().toLowerCase();
  if (normalized === 'text') return '[Mensagem]';
  if (normalized === 'image') return '[Imagem]';
  if (VIDEO_LIKE_MESSAGE_TYPES.has(normalized)) return '[Video]';
  if (normalized === 'audio' || normalized === 'voice') return '[Audio]';
  if (normalized === 'document') return '[Documento]';
  if (normalized === 'link_preview') return '[Link]';
  if (normalized === 'location' || normalized === 'live_location') return '[Localizacao]';
  if (normalized === 'sticker') return '[Sticker]';
  if (normalized === 'contact' || normalized === 'contact_list') return '[Contato]';
  if (normalized === 'poll') return '[Enquete]';
  if (normalized === 'reply') return '[Resposta]';
  if (normalized === 'interactive' || normalized === 'hsm' || normalized === 'carousel') return '[Mensagem interativa]';
  return getUnknownMessageMarker(normalized);
};

export const isMessageSummaryMarker = (value?: string | null, messageType?: string) => {
  const normalized = normalizeTechnicalMarker(value);
  if (!normalized) return false;
  if (VISIBLE_SUMMARY_MARKERS.has(normalized) || HIDDEN_TECHNICAL_MESSAGE_MARKERS.has(normalized)) return true;
  if (messageType?.trim()) return normalized === normalizeTechnicalMarker(getMessageSummaryMarker(messageType));
  return false;
};

export const isHiddenTechnicalMessageMarker = (value?: string | null, messageType?: string) => {
  const normalized = normalizeTechnicalMarker(value);
  if (!normalized) return false;
  if (HIDDEN_TECHNICAL_MESSAGE_MARKERS.has(normalized)) return true;
  if (messageType?.trim() && normalized === normalizeTechnicalMarker(getMessageSummaryMarker(messageType))) return !VISIBLE_SUMMARY_MARKERS.has(normalized);
  return isBracketOnlyMarker(value) && !VISIBLE_SUMMARY_MARKERS.has(normalized);
};

export const getVisiblePreviewText = (value?: string | null, messageType?: string) =>
  isHiddenTechnicalMessageMarker(value, messageType) ? '' : String(value ?? '').trim();

export const getChatPreviewIconType = (value: string | null | undefined): ChatPreviewIconType | null => {
  const normalized = normalizeTechnicalMarker(value);
  if (normalized === '[imagem]' || normalized.startsWith('[imagem] ')) return 'image';
  if (normalized === '[video]' || normalized.startsWith('[video] ')) return 'video';
  if (normalized === '[audio]' || normalized.startsWith('[audio] ')) return 'audio';
  if (normalized === '[documento]' || normalized.startsWith('[documento] ')) return 'document';
  if (normalized === '[link]' || normalized.startsWith('[link] ')) return 'link';
  if (normalized === '[localizacao]' || normalized.startsWith('[localizacao] ')) return 'location';
  if (normalized === '[sticker]' || normalized.startsWith('[sticker] ')) return 'sticker';
  if (normalized === '[contato]' || normalized.startsWith('[contato] ')) return 'contact';
  if (normalized === '[enquete]' || normalized.startsWith('[enquete] ')) return 'poll';
  if (normalized === '[resposta]' || normalized.startsWith('[resposta] ')) return 'interactive';
  if (normalized === '[mensagem interativa]' || normalized.startsWith('[mensagem interativa] ')) return 'interactive';
  return null;
};

export const getMessageVisibleCaption = (message: CommWhatsAppMessage) => {
  const directCaption = String(message.media_caption ?? '').trim();
  if (directCaption && !isMessageSummaryMarker(directCaption, message.message_type) && !isHiddenTechnicalMessageMarker(directCaption, message.message_type)) return directCaption;
  const fallbackText = String(message.text_content ?? '').trim();
  if (!fallbackText || isMessageSummaryMarker(fallbackText, message.message_type) || isHiddenTechnicalMessageMarker(fallbackText, message.message_type)) return '';
  const marker = getMessageSummaryMarker(message.message_type);
  if (message.message_type.trim().toLowerCase() !== 'text' && marker && fallbackText.startsWith(`${marker} `)) return fallbackText.slice(marker.length).trim();
  return fallbackText;
};

export const getMessageEditableText = (message: CommWhatsAppMessage) => {
  const messageType = message.message_type.trim().toLowerCase();
  if (messageType === 'text') return String(message.text_content ?? '').trim();
  return getMessageVisibleCaption(message);
};

export const normalizeComparableMessageText = (messageType: string, value: unknown) => {
  const text = String(value ?? '').trim();
  if (!text) return '';
  if (messageType.trim().toLowerCase() === 'text') return text;
  const marker = getMessageSummaryMarker(messageType);
  if (!marker) return text;
  if (text === marker) return '';
  if (text.startsWith(`${marker} `)) return text.slice(marker.length).trim();
  return text;
};

export const getMessageSearchPreviewText = (message: CommWhatsAppMessage) => {
  const text = getVisiblePreviewText(getMessageEditableText(message), message.message_type);
  const marker = getVisiblePreviewText(getMessageSummaryMarker(message.message_type), message.message_type);
  return text || marker;
};

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

export const formatMessageTime = (value?: string | null) => {
  const date = parseCommMessageDate(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: SAO_PAULO_TIMEZONE,
    day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit',
    hour12: false,
  }).format(date);
};

export const formatDurationLabel = (seconds: number) => {
  const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
  const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
};

export const formatFileSize = (value?: number | null) => {
  if (!value || value <= 0) return '';
  if (value >= 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  if (value >= 1024) return `${Math.round(value / 1024)} KB`;
  return `${value} B`;
};

export const normalizeChatDraftPreview = (value: string) => {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  if (normalized.length <= 100) return normalized;
  return `${normalized.slice(0, 97).trimEnd()}...`;
};

export const getSafeChatDisplayName = (chat: CommWhatsAppChat | null, connectedUserName?: string | null) => {
  if (!chat) return 'Conversa';
  const savedContactName = String(chat.saved_contact_name ?? '').trim();
  if (savedContactName) return savedContactName;
  const displayName = String(chat.display_name ?? '').trim();
  const pushName = String(chat.push_name ?? '').trim();
  const ownName = String(connectedUserName ?? '').trim().toLowerCase();
  if (!chat.saved_contact_name && !chat.lead_id && displayName && ownName && displayName.toLowerCase() === ownName) return pushName || formatCommWhatsAppPhoneLabel(chat.phone_number);
  return displayName || pushName || formatCommWhatsAppPhoneLabel(chat.phone_number);
};

export const getDeliveryStatusMetaFromValues = (deliveryStatus?: string | null, messageType?: string | null) => {
  const status = String(deliveryStatus ?? '').trim().toLowerCase();
  switch (status) {
    case 'pending': return { icon: Clock3, label: 'Enviando', tone: 'pending' as const };
    case 'sent': return { icon: Check, label: 'Enviado', tone: 'sent' as const };
    case 'delivered': return { icon: CheckCheck, label: 'Entregue', tone: 'delivered' as const };
    case 'read': return { icon: CheckCheck, label: 'Vista', tone: 'read' as const };
    case 'played': return { icon: Volume2, label: messageType === 'voice' ? 'Ouvida' : 'Reproduzida', tone: 'played' as const };
    case 'failed': return { icon: AlertCircle, label: 'Falhou', tone: 'failed' as const };
    case 'deleted': return { icon: AlertTriangle, label: 'Apagada', tone: 'deleted' as const };
    default: return { icon: Clock3, label: status || 'Pendente', tone: 'pending' as const };
  }
};

export const getDeliveryStatusMeta = (message: CommWhatsAppMessage) => getDeliveryStatusMetaFromValues(message.delivery_status, message.message_type);

const readRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;

const getMessageMetadataRecord = (message?: CommWhatsAppMessage | null) => readRecord(message?.metadata) ?? {};

export const getMessageLinkPreview = (message: CommWhatsAppMessage) => {
  const metadata = getMessageMetadataRecord(message);
  const preview = metadata.link_preview;
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
  try { const parsed = new URL(canonical || url); domain = parsed.hostname.replace(/^www\./i, ''); }
  catch { domain = ''; }
  return { url: url || canonical || null, title: title || null, description: description || null, body: body || null, previewImage: previewImage || null, domain: domain || null };
};

export const hasMessageQuote = (message?: CommWhatsAppMessage | null) => Boolean(getMessageQuoteInfo(message));

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

export const getMessageContactCardInfo = (message?: CommWhatsAppMessage | null): MessageContactCardInfo | null => {
  if (!message) return null;
  const messageType = message.message_type.trim().toLowerCase();
  const contactCard = readRecord(getMessageMetadataRecord(message).contact_card);
  const kind = String(contactCard?.kind ?? '').trim().toLowerCase();
  if (kind !== 'contact' && kind !== 'contact_list') {
    if (messageType !== 'contact' && messageType !== 'contact_list') return null;
    const fallbackText = String(message.text_content ?? '').trim();
    return { kind: messageType as 'contact' | 'contact_list', count: messageType === 'contact' ? 1 : 0, items: fallbackText && !isMessageSummaryMarker(fallbackText, message.message_type) ? [{ name: fallbackText, phoneNumber: null }] : [] };
  }
  const items = Array.isArray(contactCard?.items)
    ? contactCard.items.map((item) => {
        const record = readRecord(item);
        if (!record) return null;
        const name = String(record.name ?? '').trim() || null;
        const phoneNumber = String(record.phone_number ?? '').trim() || null;
        if (!name && !phoneNumber) return null;
        return { name, phoneNumber };
      }).filter((item): item is { name: string | null; phoneNumber: string | null } => Boolean(item))
    : [];
  const rawCount = Number(contactCard?.count ?? items.length);
  const count = Number.isFinite(rawCount) ? Math.max(items.length, Math.max(0, Math.round(rawCount))) : items.length;
  return { kind: kind as 'contact' | 'contact_list', count: count || (kind === 'contact' ? 1 : 0), items };
};

export const getDeletedMessageMarker = (messageType: string) => {
  const normalized = messageType.trim().toLowerCase();
  switch (normalized) {
    case 'image': return '[Imagem apagada]';
    case 'video': case 'gif': case 'short': return '[Video apagado]';
    case 'audio': case 'voice': return '[Audio apagado]';
    case 'document': return '[Documento apagado]';
    case 'sticker': return '[Sticker apagado]';
    case 'contact': case 'contact_list': return '[Contato apagado]';
    case 'poll': return '[Enquete apagada]';
    default: return '[Mensagem apagada]';
  }
};

export const getEditedMessageInfo = (message?: CommWhatsAppMessage | null) => {
  if (!message) return { edited: false, originalText: null, previousText: null, currentText: null, editedAt: null };
  const metadata = message.metadata && typeof message.metadata === 'object' && !Array.isArray(message.metadata) ? message.metadata as Record<string, unknown> : {};
  const messageType = message.message_type.trim().toLowerCase();
  const currentText = getMessageEditableText(message) || normalizeComparableMessageText(message.message_type, message.text_content);
  const originalText = normalizeComparableMessageText(message.message_type, metadata.original_text_content);
  const editHistory = Array.isArray(metadata.edit_history) ? metadata.edit_history.filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null && !Array.isArray(item)) : [];
  const lastEdit = editHistory.length > 0 ? editHistory[editHistory.length - 1] : null;
  const previousText = normalizeComparableMessageText(message.message_type, lastEdit?.previous_text) || originalText || null;
  const visibleCurrentText = getMessageEditableText(message) || currentText || null;
  const editedAt = String(metadata.edited_at ?? '').trim() || null;
  const inferredTextEdit = messageType === 'text' && Boolean(originalText && originalText !== visibleCurrentText);
  const edited = metadata.edited === true || Boolean(editedAt) || editHistory.length > 0 || inferredTextEdit;
  return { edited, originalText: originalText && originalText !== currentText ? originalText : null, previousText: previousText && previousText !== visibleCurrentText ? previousText : null, currentText: visibleCurrentText, editedAt };
};

export const getDeletedMessageInfo = (message?: CommWhatsAppMessage | null) => {
  if (!message) return { deleted: false, deletedAt: null, deletedBy: null, preservedText: '[Mensagem apagada]' };
  const metadata = message.metadata && typeof message.metadata === 'object' && !Array.isArray(message.metadata) ? message.metadata as Record<string, unknown> : {};
  const currentText = String(message.text_content ?? message.media_caption ?? '').trim();
  const originalText = String(metadata.deleted_original_text_content ?? '').trim();
  const deletedAt = String(metadata.deleted_at ?? '').trim() || null;
  const deletedBy = String(metadata.deleted_by ?? '').trim() || null;
  const deleted = message.delivery_status.trim().toLowerCase() === 'deleted' || metadata.deleted === true;
  return { deleted, deletedAt, deletedBy, preservedText: originalText || currentText || getDeletedMessageMarker(message.message_type) };
};

export const getMessageReactions = (message?: CommWhatsAppMessage | null) => {
  if (!message) return [];
  const metadata = message.metadata && typeof message.metadata === 'object' && !Array.isArray(message.metadata) ? message.metadata as Record<string, unknown> : {};
  const rawReactions = Array.isArray(metadata.reactions) ? metadata.reactions as Record<string, unknown>[] : [];
  const normalized = rawReactions.filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null && !Array.isArray(item))
    .map((item) => ({
      emoji: String(item.emoji ?? '').trim(),
      fromMe: item.from_me === true,
      reactedAt: String(item.reacted_at ?? '').trim(),
      actorLabel: item.from_me === true ? 'Você' : String(item.from_name ?? item.from ?? '').trim() || 'Contato',
    })).filter((item) => Boolean(item.emoji));
  const grouped = new Map<string, { emoji: string; count: number; fromMe: boolean; actors: string[] }>();
  for (const reaction of normalized) {
    const current = grouped.get(reaction.emoji);
    if (current) { current.count += 1; current.fromMe = current.fromMe || reaction.fromMe; if (!current.actors.includes(reaction.actorLabel)) current.actors.push(reaction.actorLabel); }
    else { grouped.set(reaction.emoji, { emoji: reaction.emoji, count: 1, fromMe: reaction.fromMe, actors: [reaction.actorLabel] }); }
  }
  return Array.from(grouped.values()).sort((left, right) => right.count - left.count || left.emoji.localeCompare(right.emoji, 'pt-BR'));
};

export const getReactionTooltipText = (message?: CommWhatsAppMessage | null) => {
  if (!message) return '';
  const chatId = String(message.metadata?.chat_id ?? '').trim().toLowerCase();
  if (!chatId.endsWith('@g.us')) return '';
  const reactions = getMessageReactions(message);
  if (reactions.length === 0) return '';
  return reactions.map((r) => `${r.emoji} ${r.actors.join(', ')}`).join('\n');
};

export const getOwnReactionEmoji = (message?: CommWhatsAppMessage | null) => {
  if (!message) return null;
  const metadata = message.metadata && typeof message.metadata === 'object' && !Array.isArray(message.metadata) ? message.metadata as Record<string, unknown> : {};
  const rawReactions = Array.isArray(metadata.reactions) ? metadata.reactions as Record<string, unknown>[] : [];
  const ownReaction = rawReactions.filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null && !Array.isArray(item)).find((item) => String(item.actor_key ?? '').trim() === 'self');
  return ownReaction ? String(ownReaction.emoji ?? '').trim() || null : null;
};

export const canEditOutboundMessage = (message: CommWhatsAppMessage) =>
  message.direction === 'outbound' && Boolean(message.external_message_id?.trim()) && message.delivery_status.trim().toLowerCase() !== 'deleted' && EDITABLE_OUTBOUND_MESSAGE_TYPES.has(message.message_type.trim().toLowerCase());

export const canDeleteOutboundMessage = (message: CommWhatsAppMessage) =>
  message.direction === 'outbound' && Boolean(message.external_message_id?.trim()) && message.delivery_status.trim().toLowerCase() !== 'deleted';

export const canReplyOrForwardMessage = (message: CommWhatsAppMessage) =>
  message.direction !== 'system' && Boolean(message.external_message_id?.trim()) && message.delivery_status.trim().toLowerCase() !== 'deleted';

/* ------------------------------------------------------------------ */
/*  WhatsApp text formatting helpers + LinkifiedText component        */
/* ------------------------------------------------------------------ */

const isWhitespace = (value: string | undefined) => !value || /\s/.test(value);

const findWhatsAppFormatMatch = (text: string, startIndex: number = 0): WhatsAppFormatMatch | null => {
  let bestMatch: WhatsAppFormatMatch | null = null;
  for (let index = startIndex; index < text.length; index += 1) {
    for (const candidate of WHATSAPP_TEXT_FORMAT_MARKERS) {
      const { marker, format } = candidate;
      if (!text.startsWith(marker, index) || isWhitespace(text[index + marker.length])) continue;
      let closingIndex = text.indexOf(marker, index + marker.length);
      while (closingIndex !== -1) {
        const content = text.slice(index + marker.length, closingIndex);
        if (content.trim() && !isWhitespace(text[closingIndex - 1])) {
          const match = { start: index, end: closingIndex, marker, format };
          if (!bestMatch || match.start < bestMatch.start || (match.start === bestMatch.start && marker.length > bestMatch.marker.length)) bestMatch = match;
          break;
        }
        closingIndex = text.indexOf(marker, closingIndex + marker.length);
      }
    }
    if (bestMatch?.start === index) return bestMatch;
  }
  return bestMatch;
};

const renderWhatsAppFormattedText = (text: string, keyPrefix: string, depth: number = 0): ReactNode[] => {
  if (!text || depth > 8) return text ? [text] : [];
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let matchIndex = 0;
  while (cursor < text.length) {
    const match = findWhatsAppFormatMatch(text, cursor);
    if (!match) { nodes.push(text.slice(cursor)); break; }
    if (match.start > cursor) nodes.push(text.slice(cursor, match.start));
    const contentStart = match.start + match.marker.length;
    const content = text.slice(contentStart, match.end);
    const children = renderWhatsAppFormattedText(content, `${keyPrefix}-${matchIndex}`, depth + 1);
    const key = `${keyPrefix}-${match.format}-${match.start}-${matchIndex}`;
    if (match.format === 'bold') nodes.push(<strong key={key}>{children}</strong>);
    else if (match.format === 'italic') nodes.push(<em key={key}>{children}</em>);
    else nodes.push(<s key={key}>{children}</s>);
    cursor = match.end + match.marker.length;
    matchIndex += 1;
  }
  return nodes;
};

const URL_PATTERN = /https?:\/\/[^\s<]+/gi;

const normalizeRenderableUrl = (value: string) => value.replace(/[),.;!?]+$/g, '');

const extractRenderableUrls = (value: string) =>
  Array.from(value.matchAll(URL_PATTERN)).map((match) => {
    const raw = match[0] ?? '';
    const url = normalizeRenderableUrl(raw);
    const index = match.index ?? 0;
    return url ? { index, raw, url } : null;
  }).filter((item): item is { index: number; raw: string; url: string } => Boolean(item));

export function LinkifiedText({ text, className, linkClassName }: { text: string; className?: string; linkClassName?: string }) {
  const matches = extractRenderableUrls(text);
  if (matches.length === 0) return <p className={className}>{renderWhatsAppFormattedText(text, 'text')}</p>;
  const parts: ReactNode[] = [];
  let cursor = 0;
  matches.forEach((match, index) => {
    if (match.index > cursor) parts.push(...renderWhatsAppFormattedText(text.slice(cursor, match.index), `text-${index}`));
    parts.push(
      <a key={`${match.url}-${index}`} href={match.url} target="_blank" rel="noreferrer" className={cx('underline underline-offset-2 decoration-[rgba(255,255,255,0.38)] hover:decoration-current break-all', linkClassName)}>
        {match.url}
      </a>,
    );
    cursor = match.index + match.raw.length;
  });
  if (cursor < text.length) parts.push(...renderWhatsAppFormattedText(text.slice(cursor), 'text-tail'));
  return <p className={className}>{parts}</p>;
}
