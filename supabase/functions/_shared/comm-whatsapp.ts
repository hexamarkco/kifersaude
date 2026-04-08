// @ts-expect-error Deno npm import
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.57.4';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

export const WHAPI_BASE_URL = 'https://gate.whapi.cloud';
export const COMM_WHATSAPP_INTEGRATION_SLUG = 'whatsapp_auto_contact';
export const COMM_WHATSAPP_CHANNEL_SLUG = 'primary';
export const COMM_WHATSAPP_MODULE = 'whatsapp-inbox';

export type CommWhatsAppChannelRow = {
  id: string;
  slug: string;
  name: string;
  enabled: boolean;
  whapi_channel_id: string | null;
  connection_status: string;
  health_status: string;
  phone_number: string | null;
  connected_user_name: string | null;
  webhook_secret: string;
  last_health_check_at: string | null;
  last_webhook_received_at: string | null;
  last_error: string | null;
  health_snapshot: Record<string, unknown> | null;
  limits_snapshot: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type CommWhatsAppSettings = {
  enabled: boolean;
  token: string;
};

export type CommWhatsAppPersistMessageInput = {
  channelId: string;
  externalChatId: string;
  phoneNumber: string | null;
  displayName: string | null;
  pushName: string | null;
  lastMessageText: string | null;
  lastMessageDirection: 'inbound' | 'outbound' | 'system';
  lastMessageAt: string;
  incrementUnread: boolean;
  externalMessageId: string | null;
  direction: 'inbound' | 'outbound' | 'system';
  messageType: string;
  deliveryStatus: string;
  textContent: string | null;
  createdBy: string | null;
  source: string | null;
  senderName: string | null;
  senderPhone: string | null;
  statusUpdatedAt: string | null;
  errorMessage: string | null;
  mediaId: string | null;
  mediaUrl: string | null;
  mediaMimeType: string | null;
  mediaFileName: string | null;
  mediaSizeBytes: number | null;
  mediaDurationSeconds: number | null;
  mediaCaption: string | null;
  metadata: Record<string, unknown>;
};

export type CommWhatsAppPersistMessageResult = {
  chatId: string;
  messageId: string;
  inserted: boolean;
  unreadCount: number;
  summaryUpdated: boolean;
};

export type CommWhatsAppSavedContact = {
  contactId: string;
  phoneNumber: string;
  displayName: string;
  shortName: string | null;
  saved: boolean;
};

export type CommWhatsAppMediaMeta = {
  mediaId: string | null;
  mediaUrl: string | null;
  mediaMimeType: string | null;
  mediaFileName: string | null;
  mediaSizeBytes: number | null;
  mediaDurationSeconds: number | null;
  mediaCaption: string | null;
};

export type CommWhatsAppLinkPreviewMeta = {
  body: string | null;
  url: string | null;
  title: string | null;
  description: string | null;
  canonical: string | null;
  preview: string | null;
};

export type CommWhatsAppQuotedMessageMeta = {
  external_message_id: string | null;
  author_phone: string | null;
  quoted_type: string | null;
  preview_text: string | null;
};

export type CommWhatsAppContactCardMetaItem = {
  name: string | null;
  phone_number: string | null;
};

export type CommWhatsAppContactCardMeta = {
  kind: 'contact' | 'contact_list';
  count: number;
  items: CommWhatsAppContactCardMetaItem[];
};

export type CommWhatsAppEditedMessageEvent = {
  eventExternalMessageId: string | null;
  targetExternalMessageId: string | null;
  editedText: string | null;
  originalText: string | null;
  editedAt: string | null;
  actionType: string | null;
};

export type CommWhatsAppDeletedMessageEvent = {
  eventExternalMessageId: string | null;
  targetExternalMessageId: string | null;
  originalText: string | null;
  deletedAt: string;
  actionType: string | null;
  deletedBy: string | null;
};

export type CommWhatsAppReactionEvent = {
  eventExternalMessageId: string | null;
  targetExternalMessageId: string | null;
  emoji: string | null;
  fromMe: boolean;
  from: string | null;
  fromName: string | null;
  actorKey: string;
  reactedAt: string;
};

const getSettingsToken = (settings: Record<string, unknown>): string => {
  const directToken = sanitizeWhapiToken(toTrimmedString(settings.token));
  if (directToken) return directToken;
  return sanitizeWhapiToken(toTrimmedString(settings.apiKey));
};

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const toTrimmedString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

export const sanitizeWhapiToken = (value: string): string => value.replace(/^Bearer\s+/i, '').trim();

export const normalizePhoneDigits = (value: unknown): string => {
  const raw = toTrimmedString(value);
  return raw.replace(/\D/g, '');
};

export const normalizeCommWhatsAppPhone = (value: unknown): string => {
  const digits = normalizePhoneDigits(value);

  if (!digits) return '';
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) return digits;
  if (!digits.startsWith('55') && (digits.length === 10 || digits.length === 11)) return `55${digits}`;
  return digits;
};

export const getCommWhatsAppPhoneLookupKeys = (value: unknown): string[] => {
  const digits = normalizePhoneDigits(value);
  if (!digits) return [];

  const keys = new Set<string>();

  const appendKey = (candidate: string) => {
    const normalized = normalizePhoneDigits(candidate);
    if (!normalized) return;
    keys.add(normalized);
  };

  const appendBrazilMobileVariants = (candidate: string) => {
    if (candidate.length === 10) {
      const mobilePrefix = candidate[2] ?? '';
      if (/[6-9]/.test(mobilePrefix)) {
        appendKey(`${candidate.slice(0, 2)}9${candidate.slice(2)}`);
      }
      return;
    }

    if (candidate.length === 11) {
      const ninthDigit = candidate[2] ?? '';
      const mobilePrefix = candidate[3] ?? '';
      if (ninthDigit === '9' && /[6-9]/.test(mobilePrefix)) {
        appendKey(`${candidate.slice(0, 2)}${candidate.slice(3)}`);
      }
    }
  };

  appendKey(digits);

  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    const nationalDigits = digits.slice(2);
    appendKey(nationalDigits);
    appendBrazilMobileVariants(nationalDigits);
    for (const variant of Array.from(keys)) {
      if (!variant.startsWith('55') && (variant.length === 10 || variant.length === 11)) {
        appendKey(`55${variant}`);
      }
    }
  }

  if (!digits.startsWith('55') && (digits.length === 10 || digits.length === 11)) {
    appendKey(`55${digits}`);
    appendBrazilMobileVariants(digits);
    for (const variant of Array.from(keys)) {
      if (!variant.startsWith('55') && (variant.length === 10 || variant.length === 11)) {
        appendKey(`55${variant}`);
      }
    }
  }

  return Array.from(keys);
};

export const normalizeWhapiChatId = (value: unknown): string => {
  const raw = toTrimmedString(value);
  if (!raw) return '';

  if (/@c\.us$/i.test(raw)) {
    return raw.replace(/@c\.us$/i, '@s.whatsapp.net');
  }

  if (/@s\.whatsapp\.net$/i.test(raw)) {
    return raw.replace(/(@s\.whatsapp\.net)+$/i, '@s.whatsapp.net');
  }

  if (raw.includes('@')) {
    return raw;
  }

  const phone = normalizeCommWhatsAppPhone(raw);
  return phone ? `${phone}@s.whatsapp.net` : raw;
};

export const buildWhapiDirectChatId = (value: unknown): string => {
  const phone = normalizeCommWhatsAppPhone(value);
  return phone ? `${phone}@s.whatsapp.net` : '';
};

export const isDirectWhapiChatId = (value: unknown): boolean => {
  const chatId = normalizeWhapiChatId(value);
  return /@s\.whatsapp\.net$/i.test(chatId);
};

export const extractPhoneFromChatId = (value: unknown): string => {
  const chatId = normalizeWhapiChatId(value);
  return chatId.replace(/@s\.whatsapp\.net$/i, '').replace(/\D/g, '');
};

export const formatPhoneFromDigits = (digits: string): string => {
  if (digits.length === 13 && digits.startsWith('55')) {
    return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
  }

  if (digits.length === 12 && digits.startsWith('55')) {
    return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 8)}-${digits.slice(8)}`;
  }

  return digits || 'Numero desconhecido';
};

export const formatPhoneLabel = (value: unknown): string => {
  const digits = normalizeCommWhatsAppPhone(value);
  return formatPhoneFromDigits(digits);
};

export const unixTimestampToIso = (value: unknown): string | null => {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return new Date(numeric * 1000).toISOString();
};

export const stringTimestampToIso = (value: unknown): string | null => {
  const raw = toTrimmedString(value);
  if (!raw) return null;

  const numeric = Number(raw);
  if (Number.isFinite(numeric) && numeric > 0) {
    return new Date(numeric * 1000).toISOString();
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

export const getNowIso = (): string => new Date().toISOString();

export const getDirectChatDisplayNameCandidate = (
  message: Record<string, unknown>,
  direction: 'inbound' | 'outbound' | 'system',
): string => {
  if (direction === 'outbound') {
    return pickHumanName(
      message.chat_name,
      message.pushname,
      message.push_name,
      isRecord(message.chat) ? message.chat.name : null,
      isRecord(message.business) ? message.business.name : null,
      isRecord(message.profile) ? message.profile.name : null,
    );
  }

  return pickHumanName(
    message.chat_name,
    message.from_name,
    message.pushname,
    message.push_name,
    message.notify_name,
    message.sender_name,
    isRecord(message.chat) ? message.chat.name : null,
    isRecord(message.business) ? message.business.name : null,
    isRecord(message.profile) ? message.profile.name : null,
  );
};

export const isPhoneLabelLikeDisplayName = (value: string): boolean => {
  const trimmed = value.trim();
  if (!trimmed) return true;

  const withoutSymbols = trimmed.replace(/[\s()+-]/g, '');
  return /^\+?\d+$/.test(withoutSymbols);
};

const pickHumanName = (...candidates: unknown[]): string => {
  for (const candidate of candidates) {
    const normalized = toTrimmedString(candidate);
    if (!normalized) continue;
    if (isPhoneLabelLikeDisplayName(normalized)) continue;
    return normalized;
  }

  return '';
};

const readNestedBody = (container: unknown, key: string): string => {
  if (!isRecord(container)) return '';
  const nested = container[key];
  if (!isRecord(nested)) return '';
  return toTrimmedString(nested.body);
};

const collectButtonLikeTexts = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];

  const collected = value
    .map((entry) => {
      if (!isRecord(entry)) return '';
      return toTrimmedString(entry.text) || toTrimmedString(entry.title) || toTrimmedString(entry.name);
    })
    .filter(Boolean);

  return collected;
};

const collectTextFragments = (value: unknown): string[] => {
  if (!value) return [];

  if (typeof value === 'string') {
    const normalized = value.trim();
    return normalized ? [normalized] : [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry) => collectTextFragments(entry));
  }

  if (!isRecord(value)) {
    return [];
  }

  const fragments: string[] = [];
  const directFields = ['body', 'text', 'title', 'caption', 'description', 'header', 'footer', 'subtitle', 'name', 'full_name', 'display_name'];
  for (const key of directFields) {
    const normalized = toTrimmedString(value[key]);
    if (normalized) {
      fragments.push(normalized);
    }
  }

  fragments.push(...collectButtonLikeTexts(value.buttons));
  fragments.push(...collectButtonLikeTexts(value.options));

  if (Array.isArray(value.cards)) {
    for (const card of value.cards) {
      if (!isRecord(card)) continue;
      fragments.push(...collectTextFragments(card));
      fragments.push(...collectButtonLikeTexts(card.buttons));
    }
  }

  if (isRecord(value.action)) {
    fragments.push(...collectTextFragments(value.action));
    fragments.push(...collectButtonLikeTexts(value.action.buttons));
  }

  return fragments.filter(Boolean);
};

const pickBestSummary = (candidates: string[]): string => {
  const cleaned = candidates
    .map((candidate) => candidate.trim())
    .filter(Boolean)
    .filter((candidate) => !isPhoneLabelLikeDisplayName(candidate));

  if (cleaned.length === 0) return '';

  return [...cleaned].sort((a, b) => b.length - a.length)[0] || '';
};

const getDeletedMessageMarker = (messageType: string) => {
  const normalized = messageType.trim().toLowerCase();

  switch (normalized) {
    case 'image':
      return '[Imagem apagada]';
    case 'video':
    case 'gif':
    case 'short':
      return '[Video apagado]';
    case 'audio':
    case 'voice':
      return '[Audio apagado]';
    case 'document':
      return '[Documento apagado]';
    case 'sticker':
      return '[Sticker apagado]';
    case 'contact':
    case 'contact_list':
      return '[Contato apagado]';
    case 'poll':
      return '[Enquete apagada]';
    default:
      return '[Mensagem apagada]';
  }
};

export const buildDeletedMessageSummary = (messageType: string, preservedText?: string | null) => {
  const normalizedText = toTrimmedString(preservedText);
  if (normalizedText) {
    return `[Apagada] ${normalizedText}`;
  }

  return getDeletedMessageMarker(messageType);
};

const summarizeInteractiveLikeMessage = (message: Record<string, unknown>): string => {
  const directCandidates = [
    ...collectTextFragments(message.interactive),
    ...collectTextFragments(message.hsm),
    ...collectTextFragments(message.carousel),
    ...collectTextFragments(message.reply),
  ].filter(Boolean);

  const bestDirectCandidate = pickBestSummary(directCandidates);
  if (bestDirectCandidate) {
    return bestDirectCandidate;
  }

  const interactive = isRecord(message.interactive) ? message.interactive : null;
  const hsm = isRecord(message.hsm) ? message.hsm : null;
  const carousel = isRecord(message.carousel) ? message.carousel : null;

  const buttonTexts = [
    ...collectButtonLikeTexts(interactive?.buttons),
    ...collectButtonLikeTexts((interactive?.action as Record<string, unknown> | undefined)?.buttons),
    ...collectButtonLikeTexts(hsm?.buttons),
    ...collectButtonLikeTexts(carousel?.cards),
  ];

  if (buttonTexts.length > 0) {
    return buttonTexts.slice(0, 3).join(' • ');
  }

  const quotedContent = isRecord(message.context) && isRecord(message.context.quoted_content)
    ? message.context.quoted_content
    : null;

  const quotedText = pickBestSummary(collectTextFragments(quotedContent));

  if (quotedText) {
    return quotedText;
  }

  const quotedButtons = collectButtonLikeTexts(quotedContent?.buttons);
  if (quotedButtons.length > 0) {
    return quotedButtons.slice(0, 3).join(' • ');
  }

  return '';
};

const readMediaPayload = (message: unknown): Record<string, unknown> | null => {
  if (!isRecord(message)) return null;

  const type = toTrimmedString(message.type).toLowerCase();
  switch (type) {
    case 'image':
      return isRecord(message.image) ? message.image : null;
    case 'video':
    case 'gif':
    case 'short':
      return isRecord(message.video) ? message.video : null;
    case 'document':
      return isRecord(message.document) ? message.document : null;
    case 'audio':
      return isRecord(message.audio) ? message.audio : null;
    case 'voice':
      return isRecord(message.voice) ? message.voice : null;
    default:
      return null;
  }
};

const toNullableNumber = (value: unknown): number | null => {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

export const extractWhapiMediaMeta = (message: unknown): CommWhatsAppMediaMeta => {
  const payload = readMediaPayload(message);

  if (!payload) {
    return {
      mediaId: null,
      mediaUrl: null,
      mediaMimeType: null,
      mediaFileName: null,
      mediaSizeBytes: null,
      mediaDurationSeconds: null,
      mediaCaption: null,
    };
  }

  return {
    mediaId: toTrimmedString(payload.id) || null,
    mediaUrl: toTrimmedString(payload.link) || null,
    mediaMimeType: toTrimmedString(payload.mime_type) || null,
    mediaFileName: toTrimmedString(payload.file_name) || toTrimmedString(payload.filename) || null,
    mediaSizeBytes: toNullableNumber(payload.file_size),
    mediaDurationSeconds: toNullableNumber(payload.seconds),
    mediaCaption: toTrimmedString(payload.caption) || null,
  };
};

export const extractWhapiLinkPreviewMeta = (message: unknown): CommWhatsAppLinkPreviewMeta | null => {
  if (!isRecord(message)) {
    return null;
  }

  const payload = isRecord(message.link_preview) ? message.link_preview : null;
  if (!payload) {
    return null;
  }

  const body = toTrimmedString(payload.body) || null;
  const url = toTrimmedString(payload.url) || toTrimmedString(payload.link) || null;
  const title = toTrimmedString(payload.title) || null;
  const description = toTrimmedString(payload.description) || null;
  const canonical = toTrimmedString(payload.canonical) || null;
  const preview = toTrimmedString(payload.preview) || null;

  if (!body && !url && !title && !description && !canonical && !preview) {
    return null;
  }

  return {
    body,
    url,
    title,
    description,
    canonical,
    preview,
  };
};

export const summarizeWhapiMessage = (message: unknown): string => {
  if (!isRecord(message)) return '[Mensagem]';

  const type = toTrimmedString(message.type).toLowerCase();
  const textBody = readNestedBody(message, 'text');
  if (textBody) return textBody;

  const linkPreviewBody = readNestedBody(message, 'link_preview');
  if (linkPreviewBody) return linkPreviewBody;

  const documentCaption = readNestedBody(message, 'document');
  if (documentCaption) return documentCaption;

  const imageCaption = readNestedBody(message, 'image');
  if (imageCaption) return imageCaption;

  const videoCaption = readNestedBody(message, 'video');
  if (videoCaption) return videoCaption;

  const contactSummary = summarizeWhapiContactCard(extractWhapiContactCardMeta(message));
  if (contactSummary) return contactSummary;

  const reply = isRecord(message.reply) ? message.reply : null;
  if (reply) {
    const buttonsReply = isRecord(reply.buttons_reply) ? reply.buttons_reply : null;
    const listReply = isRecord(reply.list_reply) ? reply.list_reply : null;
    const replyTitle = toTrimmedString(buttonsReply?.title) || toTrimmedString(listReply?.title);
    if (replyTitle) return replyTitle;
  }

  if (type === 'interactive' || type === 'hsm' || type === 'carousel' || type === 'reply') {
    const interactiveSummary = summarizeInteractiveLikeMessage(message);
    if (interactiveSummary) return interactiveSummary;
  }

  switch (type) {
    case 'image':
      return '[Imagem]';
    case 'video':
    case 'gif':
    case 'short':
      return '[Video]';
    case 'audio':
    case 'voice':
      return '[Audio]';
    case 'document':
      return '[Documento]';
    case 'location':
    case 'live_location':
      return '[Localizacao]';
    case 'sticker':
      return '[Sticker]';
    case 'contact':
    case 'contact_list':
      return '[Contato]';
    case 'poll':
      return '[Enquete]';
    case 'order':
      return '[Pedido]';
    case 'reply':
      return '[Resposta interativa]';
    case 'interactive':
    case 'hsm':
    case 'carousel':
      return '[Mensagem interativa]';
    case 'action': {
      const action = isRecord(message.action) ? message.action : null;
      const actionType = toTrimmedString(action?.type).toLowerCase();
      const actionSummary = pickBestSummary([
        ...collectTextFragments(action),
        ...collectTextFragments(isRecord(message.context) ? message.context.quoted_content : null),
      ]);
      if (actionSummary) return actionSummary;
      if (actionType.includes('delete') || actionType.includes('deleted') || actionType.includes('revoke') || actionType.includes('revoked')) {
        return '[Mensagem apagada]';
      }
      if (actionType === 'reaction') return '[Reação]';
      if (actionType === 'vote') return '[Voto em enquete]';
      if (actionType === 'media_notify') return '[Atualização de mídia]';
      return '[Ação]';
    }
    default:
      return '[Mensagem]';
  }
};

const firstNonEmpty = (...candidates: unknown[]) => {
  for (const candidate of candidates) {
    const normalized = toTrimmedString(candidate);
    if (normalized) {
      return normalized;
    }
  }

  return '';
};

const extractPhoneFromVcard = (value: unknown): string | null => {
  const raw = toTrimmedString(value);
  if (!raw) {
    return null;
  }

  const waidMatch = raw.match(/waid=(\d{7,15})/i);
  if (waidMatch?.[1]) {
    return normalizeCommWhatsAppPhone(waidMatch[1]) || waidMatch[1];
  }

  const telMatch = raw.match(/TEL[^:]*:([^\n\r]+)/i);
  if (!telMatch?.[1]) {
    return null;
  }

  const normalizedPhone = normalizeCommWhatsAppPhone(telMatch[1]);
  return normalizedPhone || null;
};

const buildWhapiContactCardItem = (value: unknown): CommWhatsAppContactCardMetaItem | null => {
  if (!isRecord(value)) {
    return null;
  }

  const name = pickHumanName(value.name, value.full_name, value.display_name, value.short_name) || null;
  const phoneNumber = normalizeCommWhatsAppPhone(
    firstNonEmpty(
      value.phone_number,
      value.phone,
      value.wa_id,
      value.id,
      extractPhoneFromVcard(value.vcard),
    ),
  ) || null;

  if (!name && !phoneNumber) {
    return null;
  }

  return {
    name,
    phone_number: phoneNumber,
  };
};

const summarizeWhapiContactCard = (card: CommWhatsAppContactCardMeta | null): string => {
  if (!card) {
    return '';
  }

  const labels = card.items
    .map((item) => item.name || (item.phone_number ? formatPhoneLabel(item.phone_number) : ''))
    .filter(Boolean);

  if (card.kind === 'contact') {
    return labels[0] || '[Contato]';
  }

  if (labels.length === 0) {
    return card.count > 1 ? `${card.count} contatos` : '[Contato]';
  }

  if (card.count > 1) {
    const prefix = labels.slice(0, 2).join(' • ');
    const remainder = Math.max(0, card.count - 2);
    return remainder > 0 ? `${prefix} • +${remainder}` : prefix;
  }

  return labels[0] || '[Contato]';
};

export const extractWhapiContactCardMeta = (message: unknown): CommWhatsAppContactCardMeta | null => {
  if (!isRecord(message)) {
    return null;
  }

  const type = toTrimmedString(message.type).toLowerCase();

  if (type === 'contact') {
    const item = buildWhapiContactCardItem(isRecord(message.contact) ? message.contact : null);
    return {
      kind: 'contact',
      count: 1,
      items: item ? [item] : [],
    };
  }

  if (type === 'contact_list') {
    const payload = isRecord(message.contact_list) ? message.contact_list : null;
    const rawItems = Array.isArray(payload?.list) ? payload.list : [];
    const items = rawItems
      .map((entry) => buildWhapiContactCardItem(entry))
      .filter((entry): entry is CommWhatsAppContactCardMetaItem => Boolean(entry));

    if (rawItems.length === 0 && items.length === 0) {
      return null;
    }

    return {
      kind: 'contact_list',
      count: rawItems.length || items.length,
      items,
    };
  }

  return null;
};

const summarizeMessageLikeValue = (value: unknown) => {
  if (!value) {
    return '';
  }

  if (typeof value === 'string') {
    return value.trim();
  }

  if (!isRecord(value)) {
    return '';
  }

  const summary = summarizeWhapiMessage(value);
  if (summary && !/^\[[^\]]+\]$/.test(summary)) {
    return summary;
  }

  return pickBestSummary(collectTextFragments(value));
};

export const extractWhapiQuotedMessageMeta = (message: unknown): CommWhatsAppQuotedMessageMeta | null => {
  if (!isRecord(message)) {
    return null;
  }

  const context = isRecord(message.context) ? message.context : null;
  if (!context) {
    return null;
  }

  const quotedContent = context.quoted_content;
  const quotedContentRecord = isRecord(quotedContent) ? quotedContent : null;
  const quotedType = firstNonEmpty(
    context.quoted_type,
    quotedContentRecord?.type,
    quotedContentRecord?.message_type,
  ) || null;
  const previewText = firstNonEmpty(
    summarizeMessageLikeValue(quotedContent),
    quotedType ? summarizeWhapiMessage({ type: quotedType }) : null,
  ) || null;
  const externalMessageId = firstNonEmpty(
    context.quoted_id,
    context.quoted_message_id,
    context.stanza_id,
    context.message_id,
    context.messageId,
    quotedContentRecord?.id,
    quotedContentRecord?.message_id,
  ) || null;
  const authorPhone = normalizeCommWhatsAppPhone(context.quoted_author) || null;

  if (!externalMessageId && !previewText && !authorPhone && !quotedType) {
    return null;
  }

  return {
    external_message_id: externalMessageId,
    author_phone: authorPhone,
    quoted_type: quotedType,
    preview_text: previewText,
  };
};

const isGenericMessageMarker = (value: string) => /^\[[^\]]+\]$/.test(value.trim());

const extractTextLikeValue = (value: unknown): string => {
  if (!value) {
    return '';
  }

  if (typeof value === 'string') {
    return value.trim();
  }

  if (!isRecord(value)) {
    return '';
  }

  const directText = firstNonEmpty(
    value.body,
    value.text,
    value.caption,
    value.content,
    value.message,
    value.edited_text,
    value.edited_body,
    value.new_text,
    value.new_body,
  );
  if (directText && !isGenericMessageMarker(directText)) {
    return directText;
  }

  const nestedText = firstNonEmpty(
    readNestedBody(value, 'text'),
    readNestedBody(value, 'document'),
    readNestedBody(value, 'image'),
    readNestedBody(value, 'video'),
    readNestedBody(value, 'link_preview'),
  );
  if (nestedText && !isGenericMessageMarker(nestedText)) {
    return nestedText;
  }

  const summarized = summarizeMessageLikeValue(value);
  if (summarized && !isGenericMessageMarker(summarized)) {
    return summarized;
  }

  const fragmentText = pickBestSummary(collectTextFragments(value));
  if (fragmentText && !isGenericMessageMarker(fragmentText)) {
    return fragmentText;
  }

  return '';
};

export const extractWhapiEditedMessageEvent = (
  message: unknown,
  eventAction: string,
): CommWhatsAppEditedMessageEvent | null => {
  if (!isRecord(message)) {
    return null;
  }

  const action = isRecord(message.action) ? message.action : null;
  const context = isRecord(message.context) ? message.context : null;
  const quotedContent = isRecord(context?.quoted_content) ? context.quoted_content : null;
  const normalizedActionType = firstNonEmpty(
    action?.type,
    action?.event,
    action?.action,
    message.edit_type,
    eventAction,
  ).toLowerCase();

  const likelyEditEvent = normalizedActionType.includes('edit') || normalizedActionType.includes('edited');
  if (!likelyEditEvent) {
    return null;
  }

  const actionMessage = isRecord(action?.message) ? action.message : null;
  const actionEditedMessage = isRecord(action?.edited_message) ? action.edited_message : null;
  const nestedEditedMessage = isRecord(message.edited_message) ? message.edited_message : null;
  const targetExternalMessageId = firstNonEmpty(
    action?.target_message_id,
    action?.targetMessageId,
    action?.message_id,
    action?.messageId,
    message.edited_message_id,
    context?.stanza_id,
    context?.message_id,
    context?.messageId,
    context?.quoted_message_id,
    context?.id,
    actionMessage?.id,
    actionMessage?.message_id,
    actionEditedMessage?.id,
    actionEditedMessage?.message_id,
    quotedContent?.id,
    quotedContent?.message_id,
  ) || null;

  const editedText = firstNonEmpty(
    extractTextLikeValue(nestedEditedMessage),
    extractTextLikeValue(actionEditedMessage),
    extractTextLikeValue(actionMessage),
    extractTextLikeValue(message.text),
    extractTextLikeValue(action?.text),
    extractTextLikeValue(action?.edited_text),
    extractTextLikeValue(action?.edited_body),
    extractTextLikeValue(message.edited_text),
    extractTextLikeValue(message.edited_body),
    extractTextLikeValue(message.body),
    extractTextLikeValue(action?.body),
  ) || null;

  const originalText = firstNonEmpty(
    extractTextLikeValue(quotedContent),
    extractTextLikeValue(isRecord(action?.previous_message) ? action.previous_message : null),
    extractTextLikeValue(isRecord(action?.old_message) ? action.old_message : null),
    extractTextLikeValue(action?.previous_text),
    extractTextLikeValue(action?.previous_body),
    extractTextLikeValue(action?.old_text),
    extractTextLikeValue(action?.old_body),
  ) || null;

  const editedAt = unixTimestampToIso(message.timestamp) || stringTimestampToIso(message.timestamp) || getNowIso();
  const eventExternalMessageId = toTrimmedString(message.type).toLowerCase() === 'action'
    ? toTrimmedString(message.id) || null
    : null;

  if (!targetExternalMessageId && !editedText) {
    return null;
  }

  return {
    eventExternalMessageId,
    targetExternalMessageId,
    editedText,
    originalText,
    editedAt,
    actionType: normalizedActionType || null,
  };
};

export const extractWhapiDeletedMessageEvent = (
  message: unknown,
  eventAction: string,
): CommWhatsAppDeletedMessageEvent | null => {
  if (!isRecord(message)) {
    return null;
  }

  const action = isRecord(message.action) ? message.action : null;
  const context = isRecord(message.context) ? message.context : null;
  const quotedContent = isRecord(context?.quoted_content) ? context.quoted_content : null;
  const normalizedActionType = firstNonEmpty(
    action?.type,
    action?.event,
    action?.action,
    message.edit_type,
    eventAction,
  ).toLowerCase();
  const normalizedStatus = toTrimmedString(message.status).toLowerCase();
  const likelyDeleteEvent = normalizedStatus === 'deleted'
    || normalizedActionType.includes('delete')
    || normalizedActionType.includes('deleted')
    || normalizedActionType.includes('revoke')
    || normalizedActionType.includes('revoked');

  if (!likelyDeleteEvent) {
    return null;
  }

  const targetExternalMessageId = firstNonEmpty(
    action?.target,
    action?.target_message_id,
    action?.targetMessageId,
    action?.message_id,
    action?.messageId,
    message.target,
    message.target_message_id,
    message.targetMessageId,
    context?.quoted_id,
    context?.stanza_id,
    context?.message_id,
    context?.messageId,
    context?.id,
    quotedContent?.id,
    quotedContent?.message_id,
    normalizedStatus === 'deleted' ? message.id : null,
  ) || null;
  const originalText = firstNonEmpty(
    summarizeMessageLikeValue(quotedContent),
    summarizeMessageLikeValue(isRecord(action?.previous_message) ? action.previous_message : null),
    summarizeMessageLikeValue(isRecord(action?.old_message) ? action.old_message : null),
    summarizeMessageLikeValue(isRecord(action?.message) ? action.message : null),
    summarizeMessageLikeValue(isRecord(message.text) ? { type: 'text', text: message.text } : null),
    summarizeMessageLikeValue(isRecord(action?.text) ? { type: 'text', text: action.text } : null),
    action?.previous_text,
    action?.previous_body,
    action?.old_text,
  ) || null;
  const deletedAt = unixTimestampToIso(message.timestamp) || stringTimestampToIso(message.timestamp) || getNowIso();
  const eventExternalMessageId = toTrimmedString(message.type).toLowerCase() === 'action'
    ? toTrimmedString(message.id) || null
    : null;

  if (!targetExternalMessageId) {
    return null;
  }

  return {
    eventExternalMessageId,
    targetExternalMessageId,
    originalText,
    deletedAt,
    actionType: normalizedActionType || (normalizedStatus === 'deleted' ? 'deleted' : null),
    deletedBy: message.from_me === true ? 'self' : 'contact',
  };
};

export const extractWhapiReactionEvent = (
  message: unknown,
  eventAction: string,
): CommWhatsAppReactionEvent | null => {
  if (!isRecord(message)) {
    return null;
  }

  const action = isRecord(message.action) ? message.action : null;
  const context = isRecord(message.context) ? message.context : null;
  const normalizedActionType = firstNonEmpty(
    action?.type,
    action?.event,
    action?.action,
    eventAction,
  ).toLowerCase();

  if (normalizedActionType !== 'reaction') {
    return null;
  }

  const fromMe = message.from_me === true;
  const fromPhone = normalizeCommWhatsAppPhone(message.from);
  const actorKey = fromMe ? 'self' : fromPhone || toTrimmedString(message.from_name) || 'contact';
  const targetExternalMessageId = firstNonEmpty(
    action?.target,
    action?.target_message_id,
    action?.targetMessageId,
    context?.quoted_id,
    context?.stanza_id,
    context?.message_id,
    context?.messageId,
  ) || null;
  const emoji = firstNonEmpty(action?.emoji, isRecord(action?.reaction) ? action.reaction.emoji : null) || null;
  const reactedAt = unixTimestampToIso(message.timestamp) || stringTimestampToIso(message.timestamp) || getNowIso();

  if (!targetExternalMessageId) {
    return null;
  }

  return {
    eventExternalMessageId: toTrimmedString(message.id) || null,
    targetExternalMessageId,
    emoji,
    fromMe,
    from: fromPhone || null,
    fromName: toTrimmedString(message.from_name) || null,
    actorKey,
    reactedAt,
  };
};

export async function markCommWhatsAppMessageDeleted(
  supabaseAdmin: SupabaseClient,
  input: {
    channelId: string;
    targetExternalMessageId: string;
    deletedAt: string;
    originalText?: string | null;
    actionType?: string | null;
    deletedBy?: string | null;
    eventExternalMessageId?: string | null;
  },
): Promise<{ chatId: string } | null> {
  const { data: existingMessage, error: existingMessageError } = await supabaseAdmin
    .from('comm_whatsapp_messages')
    .select('id, chat_id, text_content, media_caption, message_type, message_at, metadata')
    .eq('channel_id', input.channelId)
    .eq('external_message_id', input.targetExternalMessageId)
    .maybeSingle();

  if (existingMessageError) {
    throw new Error(`Erro ao localizar mensagem apagada: ${existingMessageError.message}`);
  }

  if (!existingMessage) {
    return null;
  }

  const existingMetadata = isRecord(existingMessage.metadata) ? existingMessage.metadata : {};
  const preservedText = firstNonEmpty(
    existingMetadata.deleted_original_text_content,
    input.originalText,
    existingMessage.text_content,
    existingMessage.media_caption,
  ) || null;
  const nextMetadata = {
    ...existingMetadata,
    deleted: true,
    deleted_at: input.deletedAt,
    deleted_action_type: input.actionType ?? null,
    deleted_by: input.deletedBy ?? existingMetadata.deleted_by ?? null,
    deleted_original_text_content: preservedText,
    deleted_source_message_id: input.eventExternalMessageId ?? existingMetadata.deleted_source_message_id ?? null,
  };

  const { error: updateMessageError } = await supabaseAdmin
    .from('comm_whatsapp_messages')
    .update({
      delivery_status: 'deleted',
      status_updated_at: input.deletedAt,
      error_message: null,
      metadata: nextMetadata,
    })
    .eq('id', existingMessage.id);

  if (updateMessageError) {
    throw new Error(`Erro ao marcar mensagem como apagada: ${updateMessageError.message}`);
  }

  if (input.eventExternalMessageId && input.eventExternalMessageId !== input.targetExternalMessageId) {
    const { error: cleanupError } = await supabaseAdmin
      .from('comm_whatsapp_messages')
      .delete()
      .eq('channel_id', input.channelId)
      .eq('external_message_id', input.eventExternalMessageId)
      .eq('message_type', 'action');

    if (cleanupError) {
      throw new Error(`Erro ao limpar evento auxiliar de exclusao: ${cleanupError.message}`);
    }
  }

  const { error: updateChatError } = await supabaseAdmin
    .from('comm_whatsapp_chats')
    .update({
      last_message_text: buildDeletedMessageSummary(toTrimmedString(existingMessage.message_type), preservedText),
      updated_at: getNowIso(),
    })
    .eq('id', existingMessage.chat_id)
    .eq('last_message_at', existingMessage.message_at);

  if (updateChatError) {
    throw new Error(`Erro ao atualizar resumo do chat apos exclusao: ${updateChatError.message}`);
  }

  return {
    chatId: toTrimmedString(existingMessage.chat_id),
  };
}

export async function applyCommWhatsAppMessageEdit(
  supabaseAdmin: SupabaseClient,
  input: {
    channelId: string;
    eventExternalMessageId?: string | null;
    targetExternalMessageId: string;
    editedText: string;
    editedAt: string;
    originalText?: string | null;
    actionType?: string | null;
  },
): Promise<{ chatId: string } | null> {
  const { data: existingMessage, error: existingMessageError } = await supabaseAdmin
    .from('comm_whatsapp_messages')
    .select('id, chat_id, text_content, message_type, media_caption, message_at, metadata')
    .eq('channel_id', input.channelId)
    .eq('external_message_id', input.targetExternalMessageId)
    .maybeSingle();

  if (existingMessageError) {
    throw new Error(`Erro ao localizar mensagem editada: ${existingMessageError.message}`);
  }

  if (!existingMessage) {
    return null;
  }

  const existingMetadata = isRecord(existingMessage.metadata) ? existingMessage.metadata : {};
  const existingHistory = Array.isArray(existingMetadata.edit_history) ? existingMetadata.edit_history : [];
  const originalText =
    toTrimmedString(existingMetadata.original_text_content)
    || input.originalText
    || toTrimmedString(existingMessage.text_content)
    || toTrimmedString(existingMessage.media_caption);
  const isMediaMessage = ['image', 'video', 'gif', 'short', 'document', 'audio', 'voice', 'sticker'].includes(
    toTrimmedString(existingMessage.message_type).toLowerCase(),
  );
  const nextMetadata = {
    ...existingMetadata,
    edited: true,
    edited_at: input.editedAt,
    original_text_content: originalText || null,
    edit_action_type: input.actionType ?? existingMetadata.edit_action_type ?? null,
    edit_history: [
      ...existingHistory,
      {
        at: input.editedAt,
        previous_text: toTrimmedString(existingMessage.text_content) || toTrimmedString(existingMessage.media_caption) || null,
        next_text: input.editedText,
        action_type: input.actionType ?? null,
      },
    ].slice(-10),
  };

  const { error: updateMessageError } = await supabaseAdmin
    .from('comm_whatsapp_messages')
    .update({
      text_content: input.editedText,
      media_caption: isMediaMessage ? input.editedText : existingMessage.media_caption,
      status_updated_at: input.editedAt,
      metadata: nextMetadata,
    })
    .eq('id', existingMessage.id);

  if (updateMessageError) {
    throw new Error(`Erro ao atualizar mensagem editada: ${updateMessageError.message}`);
  }

  if (input.eventExternalMessageId && input.eventExternalMessageId !== input.targetExternalMessageId) {
    const { error: cleanupError } = await supabaseAdmin
      .from('comm_whatsapp_messages')
      .delete()
      .eq('channel_id', input.channelId)
      .eq('external_message_id', input.eventExternalMessageId)
      .eq('message_type', 'action');

    if (cleanupError) {
      throw new Error(`Erro ao limpar evento auxiliar de edicao: ${cleanupError.message}`);
    }
  }

  const { error: updateChatError } = await supabaseAdmin
    .from('comm_whatsapp_chats')
    .update({
      last_message_text: input.editedText,
      updated_at: getNowIso(),
    })
    .eq('id', existingMessage.chat_id)
    .eq('last_message_at', existingMessage.message_at);

  if (updateChatError) {
    throw new Error(`Erro ao atualizar resumo do chat apos edicao: ${updateChatError.message}`);
  }

  return {
    chatId: toTrimmedString(existingMessage.chat_id),
  };
}

export const parseWhapiError = (payload: unknown): string => {
  if (typeof payload === 'string' && payload.trim()) {
    const raw = payload.trim();

    if ((raw.startsWith('{') && raw.endsWith('}')) || (raw.startsWith('[') && raw.endsWith(']'))) {
      try {
        return parseWhapiError(JSON.parse(raw));
      } catch {
        return raw;
      }
    }

    return raw;
  }

  if (isRecord(payload)) {
    const directError = toTrimmedString(payload.error);
    if (directError) return directError;

    if (isRecord(payload.error)) {
      const nestedMessage = toTrimmedString(payload.error.message);
      if (nestedMessage) return nestedMessage;
    }

    const message = toTrimmedString(payload.message);
    if (message) return message;

    const details = toTrimmedString(payload.details);
    if (details) return details;
  }

  return 'Erro ao processar resposta da Whapi.';
};

export const readResponsePayload = async (response: Response): Promise<unknown> => {
  const raw = await response.text();
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
};

export const extractWhapiMessageId = (payload: unknown): string => {
  if (!payload) return '';
  if (typeof payload === 'string') return '';

  if (isRecord(payload)) {
    const directId = toTrimmedString(payload.id) || toTrimmedString(payload.message_id);
    if (directId) return directId;

    if (isRecord(payload.message)) {
      const nestedId = toTrimmedString(payload.message.id) || toTrimmedString(payload.message.message_id);
      if (nestedId) return nestedId;
    }

    if (Array.isArray(payload.messages)) {
      for (const item of payload.messages) {
        if (isRecord(item)) {
          const itemId = toTrimmedString(item.id);
          if (itemId) return itemId;
        }
      }
    }

    if (Array.isArray(payload.data)) {
      for (const item of payload.data) {
        if (isRecord(item)) {
          const itemId = toTrimmedString(item.id);
          if (itemId) return itemId;
        }
      }
    }
  }

  return '';
};

export const extractWhapiMessageStatus = (payload: unknown): string => {
  if (!isRecord(payload)) return '';
  return toTrimmedString(payload.status) || toTrimmedString(payload.state);
};

export const extractWhapiMediaId = (payload: unknown): string => {
  if (!payload) return '';

  if (isRecord(payload)) {
    const directId = toTrimmedString(payload.media_id);
    if (directId) return directId;

    if (isRecord(payload.media)) {
      const nestedId = toTrimmedString(payload.media.id) || toTrimmedString(payload.media.media_id);
      if (nestedId) return nestedId;
    }

    if (Array.isArray(payload.data)) {
      for (const item of payload.data) {
        if (isRecord(item)) {
          const itemId = toTrimmedString(item.id) || toTrimmedString(item.media_id);
          if (itemId) return itemId;
        }
      }
    }
  }

  return '';
};

export const extractWhapiUploadMediaId = (payload: unknown): string => {
  if (!payload) return '';

  if (isRecord(payload)) {
    const directId = toTrimmedString(payload.id) || toTrimmedString(payload.media_id);
    if (directId) return directId;

    if (isRecord(payload.media)) {
      const nestedId = toTrimmedString(payload.media.id) || toTrimmedString(payload.media.media_id);
      if (nestedId) return nestedId;
    }
  }

  return '';
};

export const extractWhapiChatName = (payload: unknown): string => {
  if (!isRecord(payload)) return '';

  const directName = pickHumanName(
    payload.name,
    payload.chat_name,
    payload.pushname,
    payload.push_name,
    payload.notify_name,
    payload.from_name,
  );
  if (directName) return directName;

  if (isRecord(payload.contact)) {
    const contactName = pickHumanName(
      payload.contact.name,
      payload.contact.pushname,
      payload.contact.push_name,
      payload.contact.short_name,
      payload.contact.notify_name,
    );
    if (contactName) return contactName;
  }

  if (isRecord(payload.chat)) {
    const chatName = pickHumanName(payload.chat.name, payload.chat.pushname, payload.chat.short_name);
    if (chatName) return chatName;
  }

  if (isRecord(payload.business)) {
    const businessName = pickHumanName(payload.business.name, payload.business.display_name);
    if (businessName) return businessName;
  }

  if (isRecord(payload.profile)) {
    const profileName = pickHumanName(payload.profile.name, payload.profile.display_name);
    if (profileName) return profileName;
  }

  if (isRecord(payload.user)) {
    const userName = pickHumanName(payload.user.name, payload.user.pushname, payload.user.short_name);
    if (userName) return userName;
  }

  if (isRecord(payload.last_message)) {
    const lastMessageFromMe = payload.last_message.from_me === true;
    const lastMessageName = pickHumanName(
      payload.last_message.chat_name,
      payload.last_message.pushname,
      payload.last_message.push_name,
      payload.last_message.notify_name,
      lastMessageFromMe ? null : payload.last_message.from_name,
    );
    if (lastMessageName) return lastMessageName;
  }

  return '';
};

export const extractWhapiMessages = (payload: unknown): Array<Record<string, unknown>> => {
  if (Array.isArray(payload)) {
    return payload.filter(isRecord);
  }

  if (isRecord(payload)) {
    if (Array.isArray(payload.messages)) {
      return payload.messages.filter(isRecord);
    }

    if (Array.isArray(payload.data)) {
      return payload.data.filter(isRecord);
    }
  }

  return [];
};

export const extractWhapiContacts = (payload: unknown): Array<Record<string, unknown>> => {
  if (Array.isArray(payload)) {
    return payload.filter(isRecord);
  }

  if (isRecord(payload)) {
    if (Array.isArray(payload.contacts)) {
      return payload.contacts.filter(isRecord);
    }

    if (Array.isArray(payload.data)) {
      return payload.data.filter(isRecord);
    }
  }

  return [];
};

export const extractWhapiContactPhone = (payload: unknown): string => {
  if (!isRecord(payload)) return '';

  const candidates = [payload.wa_id, payload.id, payload.phone, payload.contact_id, payload.user, payload.value];
  for (const candidate of candidates) {
    const normalized = normalizeCommWhatsAppPhone(candidate);
    if (normalized) return normalized;
  }

  return '';
};

export const extractWhapiContactName = (payload: unknown): string => {
  if (!isRecord(payload)) return '';

  const candidates = [payload.name, payload.short, payload.short_name, payload.pushname, payload.full_name];
  for (const candidate of candidates) {
    const normalized = toTrimmedString(candidate);
    if (normalized) return normalized;
  }

  return '';
};

export const extractWhapiContactSaved = (payload: unknown): boolean => {
  if (!isRecord(payload)) return false;
  return payload.saved === true;
};

export const extractWhapiSavedContactName = (payload: unknown): string => {
  if (!isRecord(payload)) return '';

  const candidates = [payload.name, payload.pushname, payload.short, payload.short_name, payload.full_name];
  for (const candidate of candidates) {
    const normalized = toTrimmedString(candidate);
    if (normalized) return normalized;
  }

  return '';
};

export const extractWhapiContactShortName = (payload: unknown): string => {
  if (!isRecord(payload)) return '';
  return toTrimmedString(payload.short) || toTrimmedString(payload.short_name) || '';
};

export const extractWhapiContactId = (payload: unknown): string => {
  if (!isRecord(payload)) return '';

  const candidates = [payload.id, payload.wa_id, payload.phone, payload.contact_id];
  for (const candidate of candidates) {
    const normalized = toTrimmedString(candidate) || normalizeCommWhatsAppPhone(candidate);
    if (normalized) return normalized;
  }

  return '';
};

export const getHealthStatusText = (payload: unknown): string => {
  if (!isRecord(payload)) return 'unknown';

  if (isRecord(payload.health) && isRecord(payload.health.status)) {
    const text = toTrimmedString(payload.health.status.text);
    if (text) return text;
  }

  if (isRecord(payload.status)) {
    const text = toTrimmedString(payload.status.text);
    if (text) return text;
  }

  return 'unknown';
};

export const buildWebhookUrl = (supabaseUrl: string, secret: string): string => {
  const normalizedUrl = supabaseUrl.replace(/\/$/, '');
  const query = new URLSearchParams({
    channel: COMM_WHATSAPP_CHANNEL_SLUG,
    secret,
  });
  return `${normalizedUrl}/functions/v1/comm-whatsapp-webhook?${query.toString()}`;
};

export async function fetchWhapiChatName(params: {
  token: string;
  chatId: string;
}): Promise<string> {
  const response = await fetch(`${WHAPI_BASE_URL}/chats/${encodeURIComponent(params.chatId)}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${params.token}`,
    },
  });

  const payload = await readResponsePayload(response);
  if (!response.ok) {
    return '';
  }

  return extractWhapiChatName(payload);
}

export async function fetchWhapiContactName(params: {
  token: string;
  contactId: string;
}): Promise<string> {
  const response = await fetch(`${WHAPI_BASE_URL}/contacts/${encodeURIComponent(params.contactId)}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${params.token}`,
    },
  });

  const payload = await readResponsePayload(response);
  if (!response.ok) {
    return '';
  }

  return extractWhapiChatName(payload) || extractWhapiContactName(payload) || '';
}

export async function fetchWhapiChatMessages(params: {
  token: string;
  chatId: string;
}): Promise<Array<Record<string, unknown>>> {
  const response = await fetch(`${WHAPI_BASE_URL}/messages/list/${encodeURIComponent(params.chatId)}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${params.token}`,
    },
  });

  const payload = await readResponsePayload(response);
  if (!response.ok) {
    throw new Error(parseWhapiError(payload) || 'Falha ao consultar mensagens do chat na Whapi.');
  }

  return extractWhapiMessages(payload);
}

export async function fetchWhapiContactsPage(params: {
  token: string;
  count?: number;
  offset?: number;
}): Promise<{ contacts: Array<Record<string, unknown>>; total: number | null; count: number }> {
  const query = new URLSearchParams();
  if (typeof params.count === 'number' && Number.isFinite(params.count)) {
    query.set('count', String(Math.max(1, Math.min(500, Math.floor(params.count)))));
  }
  if (typeof params.offset === 'number' && Number.isFinite(params.offset) && params.offset > 0) {
    query.set('offset', String(Math.max(0, Math.floor(params.offset))));
  }

  const response = await fetch(`${WHAPI_BASE_URL}/contacts${query.size ? `?${query.toString()}` : ''}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${params.token}`,
    },
  });

  const payload = await readResponsePayload(response);
  if (!response.ok) {
    throw new Error(parseWhapiError(payload) || 'Falha ao consultar contatos na Whapi.');
  }

  return {
    contacts: extractWhapiContacts(payload),
    total: isRecord(payload) && typeof payload.total === 'number' ? payload.total : null,
    count: isRecord(payload) && typeof payload.count === 'number' ? payload.count : 0,
  };
}

export async function fetchWhapiContacts(params: {
  token: string;
}): Promise<Array<Record<string, unknown>>> {
  const seen = new Set<string>();
  const merged: Array<Record<string, unknown>> = [];
  const pageSize = 100;
  let offset = 0;
  let total: number | null = null;

  for (let page = 0; page < 50; page += 1) {
    const result = await fetchWhapiContactsPage({
      token: params.token,
      count: pageSize,
      offset,
    });

    if (total === null) {
      total = result.total;
    }

    let addedInPage = 0;
    for (const contact of result.contacts) {
      const contactId = extractWhapiContactId(contact) || `${offset}:${addedInPage}`;
      if (seen.has(contactId)) {
        continue;
      }
      seen.add(contactId);
      merged.push(contact);
      addedInPage += 1;
    }

    if (result.contacts.length === 0 || addedInPage === 0) {
      break;
    }

    offset += result.contacts.length;

    if (total !== null && merged.length >= total) {
      break;
    }

    if (result.contacts.length < pageSize) {
      break;
    }
  }

  return merged;
}

export async function fetchWhapiMediaBlob(params: {
  token: string;
  mediaId?: string | null;
  mediaUrl?: string | null;
  fallbackFileName?: string | null;
  fallbackMimeType?: string | null;
}): Promise<{ blob: Blob; mimeType: string; fileName: string }> {
  const headers = {
    Accept: '*/*',
    Authorization: `Bearer ${params.token}`,
  };

  const buildResult = async (response: Response) => {
    if (!response.ok) {
      const payload = await readResponsePayload(response);
      throw new Error(parseWhapiError(payload) || 'Falha ao obter midia na Whapi.');
    }

    const blob = await response.blob();
    const rawMimeType = response.headers.get('content-type')?.trim() || params.fallbackMimeType?.trim() || blob.type || 'audio/ogg';
    const contentDisposition = response.headers.get('content-disposition')?.trim() || '';
    const fileNameMatch = contentDisposition.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
    const rawFileName =
      decodeURIComponent(fileNameMatch?.[1] || '').trim() ||
      params.fallbackFileName?.trim() ||
      `whatsapp-audio.${rawMimeType.includes('mpeg') ? 'mp3' : rawMimeType.includes('webm') ? 'webm' : 'ogg'}`;

    const mimeType = rawMimeType.toLowerCase() === 'audio/oga' ? 'audio/ogg' : rawMimeType;
    const fileName = /\.oga$/i.test(rawFileName) ? rawFileName.replace(/\.oga$/i, '.ogg') : rawFileName;

    return { blob, mimeType, fileName };
  };

  if (params.mediaUrl?.trim()) {
    try {
      const response = await fetch(params.mediaUrl.trim(), {
        method: 'GET',
        headers,
      });

      return await buildResult(response);
    } catch {
      // Fall through to mediaId resolution below.
    }
  }

  const mediaId = toTrimmedString(params.mediaId);
  if (!mediaId) {
    throw new Error('A mensagem nao possui MediaID nem URL valida para transcricao.');
  }

  const response = await fetch(`${WHAPI_BASE_URL}/media/${encodeURIComponent(mediaId)}`, {
    method: 'GET',
    headers,
  });

  return await buildResult(response);
}

export async function checkWhapiContactExists(params: {
  token: string;
  contactId: string;
}): Promise<boolean> {
  const digits = normalizeCommWhatsAppPhone(params.contactId);
  if (!digits) {
    return false;
  }

  const response = await fetch(`${WHAPI_BASE_URL}/contacts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${params.token}`,
    },
    body: JSON.stringify({
      contacts: [digits],
      force_check: true,
    }),
  });

  if (!response.ok) {
    return false;
  }

  const payload = await readResponsePayload(response);
  const contacts = extractWhapiContacts(payload);
  const first = contacts[0] ?? null;
  return toTrimmedString(first?.status).toLowerCase() === 'valid';
}

export async function ensurePrimaryChannel(
  supabaseAdmin: SupabaseClient,
): Promise<CommWhatsAppChannelRow> {
  const { data: existing, error } = await supabaseAdmin
    .from('comm_whatsapp_channels')
    .select('*')
    .eq('slug', COMM_WHATSAPP_CHANNEL_SLUG)
    .maybeSingle();

  if (error) {
    throw new Error(`Erro ao carregar canal WhatsApp: ${error.message}`);
  }

  if (existing) {
    return existing as CommWhatsAppChannelRow;
  }

  const { data: created, error: createError } = await supabaseAdmin
    .from('comm_whatsapp_channels')
    .insert({
      slug: COMM_WHATSAPP_CHANNEL_SLUG,
      name: 'WhatsApp principal',
      enabled: false,
    })
    .select('*')
    .single();

  if (createError || !created) {
    throw new Error(createError?.message || 'Nao foi possivel criar o canal WhatsApp principal.');
  }

  return created as CommWhatsAppChannelRow;
}

export async function ensureCommWhatsAppSettings(
  supabaseAdmin: SupabaseClient,
): Promise<CommWhatsAppSettings> {
  const { data: existing, error } = await supabaseAdmin
    .from('integration_settings')
    .select('id, settings')
    .eq('slug', COMM_WHATSAPP_INTEGRATION_SLUG)
    .maybeSingle();

  if (error) {
    throw new Error(`Erro ao carregar configuracao do WhatsApp: ${error.message}`);
  }

  if (!existing) {
    const { data: created, error: createError } = await supabaseAdmin
      .from('integration_settings')
      .insert({
        slug: COMM_WHATSAPP_INTEGRATION_SLUG,
        name: 'Integração WhatsApp',
        description: 'Configurações do canal principal de WhatsApp via Whapi.',
        settings: { enabled: false, token: '' },
      })
      .select('settings')
      .single();

    if (createError || !created) {
      throw new Error(createError?.message || 'Nao foi possivel criar configuracao do WhatsApp.');
    }

    return {
      enabled: false,
      token: '',
    };
  }

  const settings = isRecord(existing.settings) ? existing.settings : {};

  return {
    enabled: typeof settings.enabled === 'boolean' ? settings.enabled : false,
    token: getSettingsToken(settings),
  };
}

export async function persistCommWhatsAppMessage(
  supabaseAdmin: SupabaseClient,
  input: CommWhatsAppPersistMessageInput,
): Promise<CommWhatsAppPersistMessageResult> {
  const { data, error } = await supabaseAdmin.rpc('comm_whatsapp_persist_message', {
    p_channel_id: input.channelId,
    p_external_chat_id: input.externalChatId,
    p_phone_number: input.phoneNumber,
    p_display_name: input.displayName,
    p_push_name: input.pushName,
    p_last_message_text: input.lastMessageText,
    p_last_message_direction: input.lastMessageDirection,
    p_last_message_at: input.lastMessageAt,
    p_increment_unread: input.incrementUnread,
    p_external_message_id: input.externalMessageId,
    p_direction: input.direction,
    p_message_type: input.messageType,
    p_delivery_status: input.deliveryStatus,
    p_text_content: input.textContent,
    p_created_by: input.createdBy,
    p_source: input.source,
    p_sender_name: input.senderName,
    p_sender_phone: input.senderPhone,
    p_status_updated_at: input.statusUpdatedAt,
    p_error_message: input.errorMessage,
    p_metadata: input.metadata,
    p_media_id: input.mediaId,
    p_media_url: input.mediaUrl,
    p_media_mime_type: input.mediaMimeType,
    p_media_file_name: input.mediaFileName,
    p_media_size_bytes: input.mediaSizeBytes,
    p_media_duration_seconds: input.mediaDurationSeconds,
    p_media_caption: input.mediaCaption,
  });

  if (error) {
    throw new Error(`Erro ao persistir mensagem do WhatsApp: ${error.message}`);
  }

  const row = Array.isArray(data) ? data[0] : null;
  if (!row) {
    throw new Error('Persistencia da mensagem nao retornou resultado.');
  }

  return {
    chatId: toTrimmedString(row.chat_id),
    messageId: toTrimmedString(row.message_id),
    inserted: row.inserted === true,
    unreadCount: typeof row.unread_count === 'number' ? row.unread_count : 0,
    summaryUpdated: row.summary_updated === true,
  };
}

export async function updateCommWhatsAppMessageStatus(
  supabaseAdmin: SupabaseClient,
  input: {
    channelId: string;
    externalMessageId: string;
    deliveryStatus: string;
    statusUpdatedAt: string | null;
    errorMessage?: string | null;
  },
): Promise<boolean> {
  const { data, error } = await supabaseAdmin.rpc('comm_whatsapp_update_message_status', {
    p_channel_id: input.channelId,
    p_external_message_id: input.externalMessageId,
    p_delivery_status: input.deliveryStatus,
    p_status_updated_at: input.statusUpdatedAt,
    p_error_message: input.errorMessage ?? null,
  });

  if (error) {
    throw new Error(`Erro ao atualizar status da mensagem do WhatsApp: ${error.message}`);
  }

  return data === true;
}

export const sanitizeChannelForClient = (channel: CommWhatsAppChannelRow) => ({
  id: channel.id,
  slug: channel.slug,
  name: channel.name,
  enabled: channel.enabled,
  whapi_channel_id: channel.whapi_channel_id,
  connection_status: channel.connection_status,
  health_status: channel.health_status,
  phone_number: channel.phone_number,
  connected_user_name: channel.connected_user_name,
  last_health_check_at: channel.last_health_check_at,
  last_webhook_received_at: channel.last_webhook_received_at,
  last_error: channel.last_error,
  health_snapshot: channel.health_snapshot,
  limits_snapshot: channel.limits_snapshot,
  created_at: channel.created_at,
  updated_at: channel.updated_at,
});
