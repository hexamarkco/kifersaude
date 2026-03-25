import { createClient } from 'npm:@supabase/supabase-js@^2.57.4';
import { authorizeDashboardUser, isServiceRoleRequest } from '../_shared/dashboard-auth.ts';
import {
  buildDirectChatIdVariantsFromPhone as buildDirectChatIdVariantsFromPhoneShared,
  extractDirectLid as extractChatLidShared,
  extractDirectPhoneNumber as extractChatPhoneNumberShared,
  getWhatsAppChatIdType as getChatIdTypeShared,
  normalizeMaybeDirectChatId as normalizeMaybeDirectIdShared,
  normalizeWhatsAppChatId as normalizeDirectChatIdShared,
  resolveInboundCanonicalDirectChatId as resolveInboundCanonicalDirectChatIdShared,
} from '../../../src/lib/whatsappChatIdentity.ts';

declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
  env: {
    get: (name: string) => string | undefined;
  };
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey, X-API-Key',
};

const jsonResponse = (body: Record<string, unknown>, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const throwIfMutationError = (operation: string, error: { message: string } | null) => {
  if (error) {
    throw new Error(`${operation}: ${error.message}`);
  }
};

const DEFAULT_SYNC_COUNT = 200;
const MAX_SYNC_COUNT = 500;

type WhapiMessage = {
  id: string;
  type: string;
  subtype?: string;
  chat_id: string;
  chat_name?: string;
  from?: string;
  from_me: boolean;
  from_name?: string;
  source?: string;
  timestamp: number | string | null;
  status?: string;
  edited_at?: number;
  edit_history?: Array<{ body?: string; timestamp?: number }>;
  text?: { body: string };
  image?: { caption?: string };
  video?: { caption?: string };
  audio?: Record<string, unknown>;
  voice?: Record<string, unknown>;
  document?: { filename?: string; caption?: string };
  link_preview?: { body?: string; title?: string; description?: string; url?: string };
  location?: Record<string, unknown>;
  live_location?: Record<string, unknown>;
  contact?: { name: string };
  contact_list?: { list: Array<{ name: string }> };
  sticker?: Record<string, unknown>;
  action?: {
    type: string;
    emoji?: string;
    target?: string;
    edited_type?: string;
    edited_content?: Record<string, unknown>;
    ephemeral?: number;
  };
  reply?: {
    buttons_reply?: { title?: string };
    list_reply?: { title?: string; description?: string };
  };
  interactive?: {
    body?: { text?: string } | string;
    footer?: { text?: string } | string;
    header?: { text?: string } | string;
    action?: {
      buttons?: Array<{ title?: string; text?: string; id?: string; type?: string }>;
      list?: {
        label?: string;
        button?: string;
        sections?: Array<{ title?: string; rows?: Array<{ title?: string; description?: string; id?: string }> }>;
      };
    };
  };
  hsm?: {
    body?: string;
    footer?: string;
    header?: { text?: string } | string;
    buttons?: Array<{ text?: string; title?: string; type?: string; id?: string; url?: string; phone_number?: string }>;
  };
  system?: {
    body?: string;
  };
  group_invite?: Record<string, unknown>;
  poll?: { title: string };
  product?: Record<string, unknown>;
  order?: { order_id: string };
};

type WhapiMessageListResponse = {
  messages: WhapiMessage[];
  count: number;
  total: number;
  offset: number;
};

const WHAPI_BASE_URL = 'https://gate.whapi.cloud';
const UNRESOLVED_DIRECT_CHAT_NAME = 'Contato WhatsApp';

type ChatIdKind = 'group' | 'direct' | 'newsletter' | 'broadcast' | 'status' | 'unknown';

type WhapiNewsletter = {
  id: string;
  name?: string;
};

type WhapiGroup = {
  id: string;
  name?: string;
};

type WhapiNewsletterListResponse = {
  newsletters?: WhapiNewsletter[];
  count?: number;
  total?: number;
  offset?: number;
};

const getChatIdKind = (chatId: string): ChatIdKind => {
  const type = getChatIdTypeShared(chatId);
  if (type === 'phone' || type === 'lid') return 'direct';
  if (type === 'group') return 'group';
  if (type === 'newsletter') return 'newsletter';
  if (type === 'broadcast') return 'broadcast';
  if (type === 'status') return 'status';
  return 'unknown';
};

const isStatusChatId = (chatId: string | null | undefined): boolean => {
  const cleaned = toCleanText(chatId);
  if (!cleaned) return false;
  return getChatIdKind(normalizeDirectChatId(cleaned)) === 'status';
};

const isStatusStoryMessage = (message: WhapiMessage | null | undefined): boolean => {
  if (!message) return false;
  if (toCleanText(message.type).toLowerCase() === 'story') return true;
  return isStatusChatId(message.chat_id);
};

const fetchNewsletterName = async (token: string, chatId: string): Promise<string | null> => {
  const pageSize = 100;
  let offset = 0;

  for (let page = 0; page < 10; page += 1) {
    const response = await fetch(`${WHAPI_BASE_URL}/newsletters?count=${pageSize}&offset=${offset}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as WhapiNewsletterListResponse;
    const newsletters = payload.newsletters || [];
    const match = newsletters.find((item) => item.id === chatId);
    const resolvedName = match?.name?.trim();
    if (resolvedName) {
      return resolvedName;
    }

    if (newsletters.length < pageSize) {
      break;
    }

    offset += newsletters.length;
    if (newsletters.length === 0) {
      break;
    }
  }

  return null;
};

const fetchGroupName = async (token: string, chatId: string): Promise<string | null> => {
  const response = await fetch(`${WHAPI_BASE_URL}/groups/${encodeURIComponent(chatId)}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as WhapiGroup;
  const groupName = payload.name?.trim();
  if (!groupName || groupName === chatId) {
    return null;
  }

  return groupName;
};

const sanitizeWhapiToken = (token: string): string => token?.replace(/^Bearer\s+/i, '').trim();

const mapStatusToAck = (status?: string): number | null => {
  if (!status) return null;
  const normalized = status.trim().toLowerCase();
  const statusMap: Record<string, number | null> = {
    failed: 0,
    error: 0,
    pending: 1,
    queued: 1,
    sending: 1,
    sent: 2,
    server: 2,
    delivered: 3,
    device: 3,
    received: 3,
    read: 4,
    played: 4,
    viewed: 4,
    deleted: null,
  };
  return statusMap[normalized] ?? null;
};

const toCleanText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const toArray = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

const getLatestIsoTimestamp = (...values: Array<string | null | undefined>): string | null => {
  let bestTimestamp: number | null = null;
  let bestIso: string | null = null;

  values.forEach((value) => {
    if (!value) return;
    const parsed = new Date(value);
    const timestamp = parsed.getTime();
    if (Number.isNaN(timestamp)) return;

    if (bestTimestamp === null || timestamp > bestTimestamp) {
      bestTimestamp = timestamp;
      bestIso = parsed.toISOString();
    }
  });

  return bestIso;
};

const normalizeDirectChatId = (chatId: string): string => {
  return normalizeDirectChatIdShared(chatId);
};

const normalizeMaybeDirectId = (value: string | null | undefined): string | null => {
  return normalizeMaybeDirectIdShared(value);
};

const resolveInboundCanonicalDirectChatId = (
  rawChatId: string,
  normalizedChatId: string,
  normalizedFrom: string | null,
): string => {
  return resolveInboundCanonicalDirectChatIdShared(rawChatId, normalizedChatId, normalizedFrom);
};

const resolveRequestedChatIdFromMessages = (requestedChatId: string, messages: WhapiMessage[]): string => {
  if (getChatIdKind(requestedChatId) !== 'direct') {
    return requestedChatId;
  }

  for (const message of messages) {
    if (message.from_me) continue;
    const normalizedFrom = normalizeMaybeDirectId(message.from);
    if (!normalizedFrom || getChatIdKind(normalizedFrom) !== 'direct') continue;
    if (normalizedFrom.trim().toLowerCase().endsWith('@lid')) continue;
    if (normalizedFrom === requestedChatId) return requestedChatId;
    return normalizedFrom;
  }

  return requestedChatId;
};

const mergeAckStatus = (currentAck: number | null | undefined, incomingAck: number | null | undefined): number | null => {
  if (incomingAck === null || incomingAck === undefined) {
    return typeof currentAck === 'number' ? currentAck : null;
  }
  return incomingAck;
};

const toEpochMillis = (value: string | null | undefined): number => {
  if (!value) return Number.NaN;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? Number.NaN : parsed;
};

const mergeMessageTimestamp = (
  currentTimestamp: string | null | undefined,
  incomingTimestamp: string | null | undefined,
  currentCreatedAt?: string | null | undefined,
): string | null => {
  const current = toCleanText(currentTimestamp);
  const incoming = toCleanText(incomingTimestamp);
  const createdAt = toCleanText(currentCreatedAt);

  const currentMillis = toEpochMillis(current || null);
  const incomingMillis = toEpochMillis(incoming || null);
  const createdAtMillis = toEpochMillis(createdAt || null);

  if (Number.isNaN(currentMillis) && Number.isNaN(incomingMillis)) {
    return createdAt || current || incoming || null;
  }

  if (Number.isNaN(currentMillis)) {
    if (!Number.isNaN(createdAtMillis) && !Number.isNaN(incomingMillis) && incomingMillis - createdAtMillis > 20 * 60 * 1000) {
      return createdAt || incoming || null;
    }
    return incoming || createdAt || null;
  }

  if (Number.isNaN(incomingMillis)) {
    return current || createdAt || null;
  }

  if (incomingMillis < currentMillis) {
    return incoming || current || createdAt || null;
  }

  return current || incoming || createdAt || null;
};

const toPayloadObject = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : null;

const extractContentBody = (content: unknown): string | null => {
  const payload = toPayloadObject(content);
  if (!payload) return null;

  const bodyText = toCleanText(payload.body);
  if (bodyText) return bodyText;

  const captionText = toCleanText(payload.caption);
  if (captionText) return captionText;

  const textValue = toCleanText(payload.text);
  if (textValue) return textValue;

  const titleText = toCleanText(payload.title);
  if (titleText) return titleText;

  const descriptionText = toCleanText(payload.description);
  if (descriptionText) return descriptionText;

  const urlText = toCleanText(payload.url);
  if (urlText) return urlText;

  return null;
};

const normalizeActionType = (actionType: unknown): string => toCleanText(actionType).toLowerCase();

const isHiddenTechnicalActionMessage = (message: {
  type?: string | null;
  action?: { type?: string | null } | null;
  payload?: unknown;
}): boolean => {
  const messageType = toCleanText(message.type).toLowerCase();
  if (messageType !== 'action') {
    return false;
  }

  const directActionType = normalizeActionType(message.action?.type);
  if (directActionType === 'label_change') {
    return true;
  }

  const payload = toPayloadObject(message.payload);
  const payloadAction = payload ? toPayloadObject(payload.action) : null;
  return normalizeActionType(payloadAction?.type) === 'label_change';
};

const extractLinkPreviewBody = (message: WhapiMessage): string | null => {
  const linkPreview = toPayloadObject(message.link_preview);
  if (!linkPreview) return null;

  const bodyText = toCleanText(linkPreview.body);
  if (bodyText && bodyText !== '[link_preview]') return bodyText;

  const titleText = toCleanText(linkPreview.title);
  if (titleText) return titleText;

  const descriptionText = toCleanText(linkPreview.description);
  if (descriptionText) return descriptionText;

  const urlText = toCleanText(linkPreview.url);
  if (urlText) return urlText;

  return '[Link]';
};

const extractSystemBody = (message: WhapiMessage): string | null => {
  const directBody = toCleanText(message.system?.body);
  if (directBody) {
    return directBody;
  }

  const subtype = toCleanText(message.subtype).toLowerCase();
  if (subtype === 'revoke') {
    return '[Mensagem apagada]';
  }
  if (subtype === 'ciphertext') {
    return '[Mensagem criptografada]';
  }
  if (subtype === 'ephemeral') {
    return '[Mensagem temporária]';
  }
  if (subtype) {
    return `[Sistema: ${subtype}]`;
  }

  return '[Evento do WhatsApp]';
};

const extractEditedActionBody = (message: WhapiMessage): string | null => {
  const action = message.action;
  if (!action) return null;

  const actionType = normalizeActionType(action.type);
  if (actionType !== 'edit' && actionType !== 'edited') {
    return null;
  }

  const editedType = normalizeActionType(action.edited_type);
  const editedContentBody = extractContentBody(action.edited_content);
  if (editedContentBody) {
    return editedContentBody;
  }

  const fallbackLabelByType: Record<string, string> = {
    image: '[Imagem editada]',
    video: '[Vídeo editado]',
    short: '[Vídeo editado]',
    gif: '[GIF editado]',
    audio: '[Áudio editado]',
    voice: '[Mensagem de voz editada]',
    document: '[Documento editado]',
    link_preview: '[Link editado]',
    location: '[Localização editada]',
    live_location: '[Localização ao vivo editada]',
    contact: '[Contato editado]',
    contact_list: '[Lista de contatos editada]',
    sticker: '[Sticker editado]',
    hsm: '[Template editado]',
    interactive: '[Mensagem interativa editada]',
    poll: '[Enquete editada]',
    order: '[Pedido editado]',
    product: '[Produto editado]',
    story: '[Status editado]',
    text: '[Mensagem editada]',
  };

  if (editedType && fallbackLabelByType[editedType]) {
    return fallbackLabelByType[editedType];
  }

  return '[Mensagem editada]';
};

const extractInteractiveBody = (message: WhapiMessage): string | null => {
  const interactive = message.interactive;
  if (!interactive) return null;

  const bodyText =
    typeof interactive.body === 'string' ? toCleanText(interactive.body) : toCleanText(interactive.body?.text);
  if (bodyText) return bodyText;

  const headerText =
    typeof interactive.header === 'string' ? toCleanText(interactive.header) : toCleanText(interactive.header?.text);
  const footerText =
    typeof interactive.footer === 'string' ? toCleanText(interactive.footer) : toCleanText(interactive.footer?.text);

  const buttonTitles = toArray<{ title?: string; text?: string }>(interactive.action?.buttons)
    .map((button) => toCleanText(button.title || button.text))
    .filter(Boolean);

  const listLabel = toCleanText(interactive.action?.list?.label || interactive.action?.list?.button);
  const listRows = toArray<{ rows?: Array<{ title?: string }> }>(interactive.action?.list?.sections)
    .flatMap((section) => toArray<{ title?: string }>(section.rows))
    .map((row) => toCleanText(row.title))
    .filter(Boolean);

  const summaryParts = [headerText, footerText, listLabel, ...buttonTitles.slice(0, 2), ...listRows.slice(0, 2)]
    .filter(Boolean);

  if (summaryParts.length > 0) {
    return `Interativo: ${summaryParts.join(' • ')}`;
  }

  return null;
};

const extractHsmBody = (message: WhapiMessage): string | null => {
  const hsm = message.hsm;
  if (!hsm) return null;

  const bodyText = toCleanText(hsm.body);
  if (bodyText) return bodyText;

  const headerText = typeof hsm.header === 'string' ? toCleanText(hsm.header) : toCleanText(hsm.header?.text);
  const footerText = toCleanText(hsm.footer);
  const buttonTexts = toArray<{ text?: string; title?: string }>(hsm.buttons)
    .map((button) => toCleanText(button.text || button.title))
    .filter(Boolean);

  const summaryParts = [headerText, footerText, ...buttonTexts.slice(0, 2)].filter(Boolean);
  if (summaryParts.length > 0) {
    return `Template: ${summaryParts.join(' • ')}`;
  }

  return null;
};

const extractReplyBody = (message: WhapiMessage): string | null => {
  const buttonReplyTitle = toCleanText(message.reply?.buttons_reply?.title);
  if (buttonReplyTitle) {
    return `Resposta: ${buttonReplyTitle}`;
  }

  const listReplyTitle = toCleanText(message.reply?.list_reply?.title);
  const listReplyDescription = toCleanText(message.reply?.list_reply?.description);
  if (listReplyTitle && listReplyDescription) {
    return `Resposta: ${listReplyTitle} - ${listReplyDescription}`;
  }
  if (listReplyTitle) {
    return `Resposta: ${listReplyTitle}`;
  }

  return null;
};

const buildMessageBody = (message: WhapiMessage): { body: string; hasMedia: boolean } => {
  if (message.text?.body) return { body: message.text.body, hasMedia: false };
  const linkPreviewBody = extractLinkPreviewBody(message);
  if (message.link_preview) return { body: linkPreviewBody || '[Link]', hasMedia: true };
  if (message.image) {
    const fallback = message.type === 'story' ? '[Imagem de status]' : '[Imagem]';
    return { body: message.image.caption || fallback, hasMedia: true };
  }
  if (message.video) {
    const fallback = message.type === 'story' ? '[Vídeo de status]' : '[Vídeo]';
    return { body: message.video.caption || fallback, hasMedia: true };
  }
  if (message.type === 'short' || message.type === 'gif') return { body: '[Vídeo]', hasMedia: true };
  if (message.audio) return { body: '[Áudio]', hasMedia: true };
  if (message.voice) return { body: '[Mensagem de voz]', hasMedia: true };
  if (message.document) {
    const fileName = message.document.filename || '';
    const caption = message.document.caption;
    return {
      body: caption ? `${caption} [Documento: ${fileName}]` : `[Documento${fileName ? `: ${fileName}` : ''}]`,
      hasMedia: true,
    };
  }
  if (message.location) return { body: '[Localização]', hasMedia: true };
  if (message.live_location) return { body: '[Localização ao vivo]', hasMedia: true };
  if (message.contact) return { body: `[Contato: ${message.contact.name}]`, hasMedia: false };
  if (message.contact_list) return { body: `[${toArray(message.contact_list.list).length} contato(s)]`, hasMedia: false };
  if (message.sticker) return { body: '[Sticker]', hasMedia: true };
  if (message.action) {
    const actionType = normalizeActionType(message.action.type);
    if (actionType === 'reaction') {
      const emoji = toCleanText(message.action.emoji);
      if (emoji) return { body: `Reagiu com ${emoji}`, hasMedia: false };
      return { body: '[Reação removida]', hasMedia: false };
    }
    if (actionType === 'delete') return { body: '[Mensagem apagada]', hasMedia: false };
    if (actionType === 'vote') return { body: '[Votou em enquete]', hasMedia: false };
    if (actionType === 'ephemeral') return { body: '[Configuração de mensagens temporárias]', hasMedia: false };

    const editedBody = extractEditedActionBody(message);
    if (editedBody) return { body: editedBody, hasMedia: false };

    return { body: `[Ação: ${message.action.type}]`, hasMedia: false };
  }
  const replyBody = extractReplyBody(message);
  if (replyBody) return { body: replyBody, hasMedia: false };
  const interactiveBody = extractInteractiveBody(message);
  if (interactiveBody) return { body: interactiveBody, hasMedia: false };
  const hsmBody = extractHsmBody(message);
  if (hsmBody) return { body: hsmBody, hasMedia: false };
  if (message.type === 'system') return { body: extractSystemBody(message) || '[Evento do WhatsApp]', hasMedia: false };
  if (message.type === 'interactive') return { body: '[Mensagem interativa]', hasMedia: false };
  if (message.type === 'hsm') return { body: '[Template WhatsApp]', hasMedia: false };
  if (message.type === 'link_preview') return { body: linkPreviewBody || '[Link]', hasMedia: true };
  if (message.type === 'story') return { body: '[Status]', hasMedia: false };
  if (message.type === 'call') return { body: '[Ligação do WhatsApp]', hasMedia: false };
  if (message.type === 'revoked') return { body: '[Mensagem apagada]', hasMedia: false };
  if (message.type === 'unknown') return { body: '[Mensagem não suportada]', hasMedia: false };
  if (message.group_invite) return { body: '[Convite para grupo]', hasMedia: false };
  if (message.poll) return { body: `[Enquete: ${message.poll.title}]`, hasMedia: false };
  if (message.product) return { body: '[Produto do catálogo]', hasMedia: false };
  if (message.order) return { body: `[Pedido #${message.order.order_id}]`, hasMedia: false };
  return { body: `[${message.type}]`, hasMedia: false };
};

const provisionalBodyMarkers = new Set([
  '[mensagem criptografada]',
  '[evento do whatsapp]',
  '[sistema: ciphertext]',
]);

const ignoredChatPreviewBodies = new Set([
  '[evento do whatsapp]',
  '[atualização do whatsapp]',
  '[atualizacao do whatsapp]',
  '[mensagem não suportada]',
  '[mensagem nao suportada]',
]);

const normalizePreviewBody = (value: string | null | undefined): string => toCleanText(value).toLowerCase();

const isWaitingPlaceholderText = (body: string | null | undefined): boolean => {
  const normalized = normalizePreviewBody(body);
  if (!normalized) return false;
  return (
    normalized.includes('aguardando esta mensagem') ||
    normalized.includes('aguardando essa mensagem') ||
    normalized.includes('waiting for this message')
  );
};

const resolveStoredChatPreview = (message: {
  type?: string | null;
  body?: string | null;
  payload?: unknown;
  has_media?: boolean | null;
  is_deleted?: boolean | null;
}): string | null => {
  if (message.is_deleted) {
    return 'Mensagem apagada';
  }

  const payload = toPayloadObject(message.payload);
  const payloadAction = payload ? toPayloadObject(payload.action) : null;
  const actionType = normalizeActionType(payloadAction?.type);
  if (actionType === 'reaction' || actionType === 'edit' || actionType === 'edited' || isHiddenTechnicalActionMessage(message)) {
    return null;
  }

  const normalizedType = normalizePreviewBody(message.type);
  const normalizedBody = normalizePreviewBody(message.body);
  const payloadSubtype = normalizePreviewBody(typeof payload?.subtype === 'string' ? payload.subtype : null);
  const payloadSystem = payload ? toPayloadObject(payload.system) : null;
  const payloadSystemBody = payloadSystem ? toCleanText(payloadSystem.body) : '';

  if (
    normalizedType === 'system' &&
    (
      provisionalBodyMarkers.has(normalizedBody) ||
      payloadSubtype === 'ciphertext' ||
      isWaitingPlaceholderText(message.body) ||
      isWaitingPlaceholderText(payloadSystemBody)
    )
  ) {
    return null;
  }

  const body = toCleanText(message.body);
  if (normalizedBody) {
    if (ignoredChatPreviewBodies.has(normalizedBody)) {
      return null;
    }

    return body;
  }

  if (normalizedType === 'image') return '[Imagem]';
  if (normalizedType === 'video' || normalizedType === 'short' || normalizedType === 'gif') return '[Vídeo]';
  if (normalizedType === 'audio' || normalizedType === 'voice' || normalizedType === 'ptt') return '[Áudio]';
  if (normalizedType === 'document') return '[Documento]';
  if (normalizedType === 'contact') return '[Contato]';
  if (normalizedType === 'location' || normalizedType === 'live_location') return '[Localização]';
  if (message.has_media) return '[Anexo]';
  return null;
};

const normalizeChatPreviewDirection = (value: string | null | undefined): 'inbound' | 'outbound' | null =>
  value === 'inbound' || value === 'outbound' ? value : null;

const buildChatRefreshVariants = (chatId: string, phoneNumber?: string | null, lid?: string | null) => {
  const variants = new Set<string>();
  const normalizedChatId = toCleanText(chatId);
  if (!normalizedChatId) {
    return [];
  }

  variants.add(normalizedChatId);

  if (getChatIdKind(normalizedChatId) === 'direct') {
    const normalizedDirectChatId = normalizeDirectChatId(normalizedChatId);
    variants.add(normalizedDirectChatId);

    if (normalizedDirectChatId.endsWith('@s.whatsapp.net')) {
      variants.add(normalizedDirectChatId.replace(/@s\.whatsapp\.net$/i, '@c.us'));
    }

    const resolvedPhoneNumber = toCleanText(phoneNumber) || extractChatPhoneNumber(normalizedChatId) || '';
    if (resolvedPhoneNumber) {
      buildDirectChatIdVariantsFromPhoneShared(resolvedPhoneNumber).forEach((variant) => variants.add(variant));
    }

    const resolvedLid = toCleanText(lid) || extractChatLid(normalizedChatId) || '';
    if (resolvedLid) {
      variants.add(resolvedLid);
    }
  }

  return Array.from(variants);
};

const refreshChatLastMessageState = async (supabaseAdmin: ReturnType<typeof createClient>, chatId: string) => {
  const normalizedChatId = toCleanText(chatId);
  if (!normalizedChatId) return;

  const { data: currentChat, error: currentChatError } = await supabaseAdmin
    .from('whatsapp_chats')
    .select('phone_number, lid')
    .eq('id', normalizedChatId)
    .maybeSingle();

  if (currentChatError) {
    throw new Error(currentChatError.message);
  }

  const refreshVariants = buildChatRefreshVariants(
    normalizedChatId,
    currentChat?.phone_number ?? null,
    currentChat?.lid ?? null,
  );
  if (refreshVariants.length === 0) {
    return;
  }

  const refreshPageSize = 200;
  let latestMeaningfulMessage:
    | {
        body?: string | null;
        type?: string | null;
        payload?: unknown;
        has_media?: boolean | null;
        is_deleted?: boolean | null;
        direction?: string | null;
        timestamp?: string | null;
        created_at?: string | null;
      }
    | undefined;
  let offset = 0;

  while (true) {
    const { data: recentMessages, error: recentMessagesError } = await supabaseAdmin
      .from('whatsapp_messages')
      .select('timestamp, created_at, body, type, payload, has_media, is_deleted, direction')
      .in('chat_id', refreshVariants)
      .order('timestamp', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + refreshPageSize - 1);

    if (recentMessagesError) {
      throw new Error(recentMessagesError.message);
    }

    if (!recentMessages || recentMessages.length === 0) {
      break;
    }

    latestMeaningfulMessage = (recentMessages || []).find((message) =>
      Boolean(
        resolveStoredChatPreview(message as {
          body?: string | null;
          type?: string | null;
          payload?: unknown;
          has_media?: boolean | null;
          is_deleted?: boolean | null;
        }),
      ),
    ) as
      | {
          body?: string | null;
          type?: string | null;
          payload?: unknown;
          has_media?: boolean | null;
          is_deleted?: boolean | null;
          direction?: string | null;
          timestamp?: string | null;
          created_at?: string | null;
        }
      | undefined;

    if (latestMeaningfulMessage || recentMessages.length < refreshPageSize) {
      break;
    }

    offset += recentMessages.length;
  }

  const nextLastMessage = latestMeaningfulMessage ? resolveStoredChatPreview(latestMeaningfulMessage) : null;
  const nextLastMessageAt = latestMeaningfulMessage?.timestamp || latestMeaningfulMessage?.created_at || null;
  const nextLastMessageDirection = normalizeChatPreviewDirection(latestMeaningfulMessage?.direction ?? null);

  const { error: updateError } = await supabaseAdmin
    .from('whatsapp_chats')
    .update({
      last_message: nextLastMessage,
      last_message_direction: nextLastMessageDirection,
      last_message_at: nextLastMessageAt,
      updated_at: new Date().toISOString(),
    })
    .eq('id', normalizedChatId);

  if (updateError) {
    throw new Error(updateError.message);
  }
};

const isMissingRelationError = (error: { code?: string; message?: string } | null | undefined, relationName: string) => {
  if (!error) return false;
  const code = typeof error.code === 'string' ? error.code.toUpperCase() : '';
  const message = typeof error.message === 'string' ? error.message.toLowerCase() : '';
  const relation = relationName.toLowerCase();
  return (
    code === '42P01' ||
    message.includes(`relation "${relation}"`) ||
    message.includes(`relation '${relation}'`) ||
    message.includes(relation)
  );
};

const mergeChatReadCursor = async (
  supabaseAdmin: ReturnType<typeof createClient>,
  sourceChatId: string,
  targetChatId: string,
) => {
  const { data, error } = await supabaseAdmin
    .from('whatsapp_chat_read_cursors')
    .select('chat_id, last_read_at, last_read_message_id, marked_by_user_id, created_at, updated_at')
    .in('chat_id', [sourceChatId, targetChatId]);

  if (error) {
    if (!isMissingRelationError(error, 'whatsapp_chat_read_cursors')) {
      throw new Error(`Erro ao carregar cursores de leitura dos chats: ${error.message}`);
    }
    return;
  }

  const sourceCursor = (data || []).find((row) => row.chat_id === sourceChatId);
  const targetCursor = (data || []).find((row) => row.chat_id === targetChatId);
  if (!sourceCursor) {
    return;
  }

  const sourceAt = new Date(sourceCursor.last_read_at || '').getTime();
  const targetAt = new Date(targetCursor?.last_read_at || '').getTime();
  const preferSource = Number.isNaN(targetAt) || (!Number.isNaN(sourceAt) && sourceAt >= targetAt);
  const preferredCursor = preferSource ? sourceCursor : targetCursor;
  const nowIso = new Date().toISOString();

  const { error: upsertError } = await supabaseAdmin.from('whatsapp_chat_read_cursors').upsert(
    {
      chat_id: targetChatId,
      last_read_at: getLatestIsoTimestamp(sourceCursor.last_read_at, targetCursor?.last_read_at) || nowIso,
      last_read_message_id: preferredCursor?.last_read_message_id ?? targetCursor?.last_read_message_id ?? null,
      marked_by_user_id: preferredCursor?.marked_by_user_id ?? targetCursor?.marked_by_user_id ?? null,
      created_at: targetCursor?.created_at ?? sourceCursor.created_at ?? nowIso,
      updated_at: nowIso,
    },
    { onConflict: 'chat_id' },
  );
  throwIfMutationError('Erro ao consolidar cursor de leitura do chat canônico', upsertError);

  const { error: deleteError } = await supabaseAdmin
    .from('whatsapp_chat_read_cursors')
    .delete()
    .eq('chat_id', sourceChatId);
  throwIfMutationError('Erro ao remover cursor legado do chat canônico', deleteError);
};

const moveSupplementaryChatReferences = async (
  supabaseAdmin: ReturnType<typeof createClient>,
  sourceChatId: string,
  targetChatId: string,
) => {
  const { error: campaignTargetsError } = await supabaseAdmin
    .from('whatsapp_campaign_targets')
    .update({ chat_id: targetChatId })
    .eq('chat_id', sourceChatId);

  if (campaignTargetsError && !isMissingRelationError(campaignTargetsError, 'whatsapp_campaign_targets')) {
    throw new Error(`Erro ao atualizar campaign targets do chat canônico: ${campaignTargetsError.message}`);
  }

  await mergeChatReadCursor(supabaseAdmin, sourceChatId, targetChatId);
};

const extractChatPhoneNumber = (chatId: string): string | null => {
  return extractChatPhoneNumberShared(chatId);
};

const extractChatLid = (chatId: string): string | null => {
  return extractChatLidShared(chatId);
};

const toIsoString = (timestamp: unknown): string | null => {
  if (typeof timestamp === 'number' && Number.isFinite(timestamp)) {
    const milliseconds = timestamp > 10_000_000_000 ? timestamp : timestamp * 1000;
    const parsed = new Date(milliseconds);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }

  if (typeof timestamp === 'string') {
    const trimmed = timestamp.trim();
    if (!trimmed) return null;

    const numeric = Number(trimmed);
    if (Number.isFinite(numeric)) {
      const milliseconds = numeric > 10_000_000_000 ? numeric : numeric * 1000;
      const parsed = new Date(milliseconds);
      return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
    }

    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }

  return null;
};

type SyncRequestPayload = {
  action?: unknown;
  chatId?: unknown;
  count?: unknown;
};

type SyncSingleChatResult = {
  chatId: string;
  count: number;
  skipped?: string;
};

const parseSyncCount = (rawCount: unknown): number => {
  const numericCount = typeof rawCount === 'number' ? rawCount : Number(rawCount);
  const requestedCount = Number.isFinite(numericCount) ? Math.trunc(numericCount) : DEFAULT_SYNC_COUNT;
  return Math.min(Math.max(requestedCount, 1), MAX_SYNC_COUNT);
};

const loadWhapiToken = async (supabaseAdmin: ReturnType<typeof createClient>) => {
  const { data: settingsRow, error: settingsError } = await supabaseAdmin
    .from('integration_settings')
    .select('settings')
    .eq('slug', 'whatsapp_auto_contact')
    .maybeSingle();

  if (settingsError) {
    throw new Error(settingsError.message);
  }

  const token = sanitizeWhapiToken(settingsRow?.settings?.apiKey || settingsRow?.settings?.token || '');
  if (!token) {
    throw new Error('Token Whapi nao configurado');
  }

  return token;
};

const syncSingleChat = async ({
  supabaseAdmin,
  token,
  rawChatId,
  count,
}: {
  supabaseAdmin: ReturnType<typeof createClient>;
  token: string;
  rawChatId: string;
  count: number;
}): Promise<SyncSingleChatResult> => {
  const requestedChatId = normalizeDirectChatId(rawChatId);
  if (!requestedChatId) {
    throw new Error('chatId obrigatorio.');
  }

  if (isStatusChatId(requestedChatId)) {
    return { chatId: requestedChatId, count: 0, skipped: 'status_chat_ignored' };
  }

  const queryParams = new URLSearchParams();
  queryParams.append('count', String(count));
  queryParams.append('offset', '0');
  queryParams.append('sort', 'desc');

  const response = await fetch(`${WHAPI_BASE_URL}/messages/list/${encodeURIComponent(requestedChatId)}?${queryParams}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Falha ao sincronizar mensagens na Whapi. Status ${response.status}`);
  }

  const payload = (await response.json()) as WhapiMessageListResponse;
  const messages = (payload.messages || []).filter((message) => !isStatusStoryMessage(message));

  if (messages.length === 0) {
    return { chatId: requestedChatId, count: 0 };
  }

  const resolvedRequestedChatId = resolveRequestedChatIdFromMessages(requestedChatId, messages);
  const chatKind = getChatIdKind(resolvedRequestedChatId);
  if (chatKind === 'status') {
    return { chatId: requestedChatId, count: 0, skipped: 'status_chat_ignored' };
  }

  const isGroup = chatKind === 'group';
  const isChannelChat = chatKind === 'newsletter' || chatKind === 'broadcast';
  const nowIso = new Date().toISOString();
  const latestMessageAt = messages
    .map((message) => toIsoString(message.timestamp))
    .reduce<string | null>((latest, current) => getLatestIsoTimestamp(latest, current), null);
  const lastMessageAt = latestMessageAt ?? nowIso;
  const messageChatNameRaw = messages.find((message) => message.chat_name?.trim())?.chat_name?.trim() || null;
  const messageChatName = messageChatNameRaw && messageChatNameRaw !== resolvedRequestedChatId ? messageChatNameRaw : null;
  const { data: existingChat } = await supabaseAdmin
    .from('whatsapp_chats')
    .select('name, last_message_at, last_message, last_message_direction, phone_number, lid')
    .eq('id', resolvedRequestedChatId)
    .maybeSingle();

  const existingChatName = existingChat?.name?.trim() || null;

  let chatName = existingChatName;
  if (isGroup) {
    const canonicalGroupName = await fetchGroupName(token, resolvedRequestedChatId);
    chatName = canonicalGroupName ?? messageChatName ?? existingChatName ?? resolvedRequestedChatId;
  } else if (isChannelChat) {
    const channelName = messageChatName ?? (await fetchNewsletterName(token, resolvedRequestedChatId));
    if (channelName) {
      chatName = channelName;
    } else if (chatKind === 'newsletter') {
      chatName = existingChatName ?? 'Canal sem nome';
    } else {
      chatName = existingChatName ?? 'Transmissao sem nome';
    }
  } else if (chatKind === 'direct' && !existingChatName && !extractChatPhoneNumber(resolvedRequestedChatId)) {
    chatName = UNRESOLVED_DIRECT_CHAT_NAME;
  }

  const nextLastMessageAt =
    getLatestIsoTimestamp(existingChat?.last_message_at ?? null, lastMessageAt) ??
    existingChat?.last_message_at ??
    lastMessageAt;

  const { error: upsertChatError } = await supabaseAdmin.from('whatsapp_chats').upsert(
    {
      id: resolvedRequestedChatId,
      name: chatName,
      is_group: isGroup,
      phone_number:
        chatKind === 'direct' ? extractChatPhoneNumber(resolvedRequestedChatId) ?? existingChat?.phone_number ?? null : null,
      lid: chatKind === 'direct' ? extractChatLid(resolvedRequestedChatId) ?? existingChat?.lid ?? null : null,
      last_message: existingChat?.last_message ?? null,
      last_message_direction: existingChat?.last_message_direction ?? null,
      last_message_at: nextLastMessageAt,
      updated_at: nowIso,
    },
    { onConflict: 'id' },
  );
  throwIfMutationError('Erro ao atualizar chat sincronizado', upsertChatError);

  if (resolvedRequestedChatId !== requestedChatId) {
    const { error: outboundChatRewriteError } = await supabaseAdmin
      .from('whatsapp_messages')
      .update({ to_number: resolvedRequestedChatId })
      .eq('chat_id', requestedChatId)
      .eq('direction', 'outbound');
    throwIfMutationError('Erro ao atualizar destino das mensagens de saida do chat canonico', outboundChatRewriteError);

    const { error: messageChatRewriteError } = await supabaseAdmin
      .from('whatsapp_messages')
      .update({ chat_id: resolvedRequestedChatId })
      .eq('chat_id', requestedChatId);
    throwIfMutationError('Erro ao atualizar mensagens para o chat canonico', messageChatRewriteError);

    const { error: historyUpdateError } = await supabaseAdmin
      .from('whatsapp_message_history')
      .update({ chat_id: resolvedRequestedChatId })
      .eq('chat_id', requestedChatId);
    throwIfMutationError('Erro ao atualizar historico do chat canonico apos sync', historyUpdateError);

    await moveSupplementaryChatReferences(supabaseAdmin, requestedChatId, resolvedRequestedChatId);

    const { error: deleteCanonicalSourceChatError } = await supabaseAdmin
      .from('whatsapp_chats')
      .delete()
      .eq('id', requestedChatId);
    throwIfMutationError('Erro ao remover chat substituido pela versao canonica', deleteCanonicalSourceChatError);
  }

  if (isGroup && chatName) {
    const { error: upsertGroupError } = await supabaseAdmin
      .from('whatsapp_groups')
      .upsert(
        {
          id: resolvedRequestedChatId,
          name: chatName,
          type: 'group',
          created_at: nowIso,
          created_by: 'system',
          name_at: nowIso,
          admin_add_member_mode: true,
          first_seen_at: nowIso,
          last_updated_at: nowIso,
        },
        { onConflict: 'id', ignoreDuplicates: true },
      );
    throwIfMutationError('Erro ao registrar grupo sincronizado', upsertGroupError);

    const { error: updateGroupError } = await supabaseAdmin
      .from('whatsapp_groups')
      .update({ name: chatName, type: 'group', name_at: nowIso, last_updated_at: nowIso })
      .eq('id', resolvedRequestedChatId);
    throwIfMutationError('Erro ao atualizar metadados do grupo sincronizado', updateGroupError);
  }

  const normalized = messages
    .filter((message) => {
      if (message.type !== 'action') return true;
      const actionType = normalizeActionType(message.action?.type);
      return actionType !== 'edit' && actionType !== 'edited';
    })
    .map((message) => {
      const direction = message.from_me ? 'outbound' : 'inbound';
      const { body, hasMedia } = buildMessageBody(message);
      const actionType = normalizeActionType(message.action?.type);
      const messageChatIdRaw = actionType === 'reaction' && message.action?.target ? resolvedRequestedChatId : message.chat_id;
      let messageChatId = normalizeDirectChatId(messageChatIdRaw || resolvedRequestedChatId);
      const normalizedFrom = normalizeMaybeDirectId(message.from);
      if (direction === 'inbound') {
        messageChatId = resolveInboundCanonicalDirectChatId(messageChatIdRaw || '', messageChatId, normalizedFrom);
      }
      const normalizedFromNumber = direction === 'inbound' ? (normalizedFrom || messageChatId) : null;
      const normalizedToNumber = direction === 'outbound' ? messageChatId : null;
      const incomingTimestamp = toIsoString(message.timestamp);

      return {
        id: message.id,
        chat_id: messageChatId,
        from_number: normalizedFromNumber,
        to_number: normalizedToNumber,
        type: message.type,
        body,
        has_media: hasMedia,
        timestamp: incomingTimestamp,
        payload: {
          ...message,
          ...(isGroup && chatName && !message.chat_name ? { chat_name: chatName } : {}),
        },
        direction,
        ack_status: mapStatusToAck(message.status),
        author: message.from_name ?? null,
        is_deleted: actionType === 'delete' || message.type === 'revoked',
        edit_count: message.edit_history?.length ?? 0,
        edited_at: toIsoString(message.edited_at),
        original_body: message.text?.body ?? body,
      };
    });

  const messageIds = normalized.map((message) => message.id);
  type ExistingMessageSnapshot = {
    id: string;
    timestamp: string | null;
    created_at: string | null;
    is_deleted: boolean | null;
    deleted_at: string | null;
    deleted_by: string | null;
    edit_count: number | null;
    edited_at: string | null;
    original_body: string | null;
    ack_status: number | null;
    payload: Record<string, unknown> | null;
    transcription_text: string | null;
  };

  const { data: existingMessages, error: existingMessagesError } = await supabaseAdmin
    .from('whatsapp_messages')
    .select('id, timestamp, created_at, is_deleted, deleted_at, deleted_by, edit_count, edited_at, original_body, ack_status, payload, transcription_text')
    .in('id', messageIds);

  if (existingMessagesError) {
    throw new Error(existingMessagesError.message);
  }

  const existingById = new Map<string, ExistingMessageSnapshot>(
    ((existingMessages as ExistingMessageSnapshot[] | null) || []).map((row) => [row.id, row]),
  );

  const mergedMessages = normalized.map((message) => {
    const existing = existingById.get(message.id);
    if (!existing) {
      return message;
    }

    const mergedIsDeleted = Boolean(existing.is_deleted) || Boolean(message.is_deleted);
    return {
      ...message,
      payload:
        existing.payload && typeof existing.payload === 'object'
          ? {
              ...existing.payload,
              ...message.payload,
            }
          : message.payload,
      transcription_text: existing.transcription_text ?? null,
      is_deleted: mergedIsDeleted,
      deleted_at: mergedIsDeleted ? existing.deleted_at ?? message.timestamp ?? nowIso : null,
      deleted_by: mergedIsDeleted ? existing.deleted_by ?? 'unknown' : null,
      edit_count: Math.max(existing.edit_count ?? 0, message.edit_count ?? 0),
      edited_at: existing.edited_at ?? message.edited_at,
      original_body: existing.original_body ?? message.original_body ?? message.body,
      ack_status: mergeAckStatus(existing.ack_status, message.ack_status),
      timestamp: mergeMessageTimestamp(existing.timestamp, message.timestamp, existing.created_at),
    };
  });

  const { error: insertError } = await supabaseAdmin
    .from('whatsapp_messages')
    .upsert(mergedMessages, { onConflict: 'id' });

  if (insertError) {
    throw new Error(insertError.message);
  }

  await refreshChatLastMessageState(supabaseAdmin, resolvedRequestedChatId);

  return { chatId: resolvedRequestedChatId, count: mergedMessages.length };
};

const loadChatsForBulkSync = async (supabaseAdmin: ReturnType<typeof createClient>) => {
  const chats: Array<{ id: string; name: string | null; phone_number: string | null }> = [];
  const pageSize = 500;
  let offset = 0;

  while (true) {
    const { data, error } = await supabaseAdmin
      .from('whatsapp_chats')
      .select('id, name, phone_number')
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (error) {
      throw new Error(`Erro ao carregar chats para sincronizacao em massa: ${error.message}`);
    }

    const rows = (data ?? []) as Array<{ id: string; name: string | null; phone_number: string | null }>;
    if (rows.length === 0) {
      break;
    }

    chats.push(...rows);

    if (rows.length < pageSize) {
      break;
    }

    offset += pageSize;
  }

  return chats;
};

const syncAllChats = async ({
  supabaseAdmin,
  token,
  count,
}: {
  supabaseAdmin: ReturnType<typeof createClient>;
  token: string;
  count: number;
}) => {
  const chatRows = await loadChatsForBulkSync(supabaseAdmin);
  const uniqueChats = Array.from(new Map(chatRows.map((chat) => [chat.id, chat])).values());

  let syncedChats = 0;
  let failedChats = 0;
  let skippedChats = 0;
  let syncedMessages = 0;
  const failures: Array<{ chatId: string; chatName: string | null; error: string }> = [];

  for (const chat of uniqueChats) {
    try {
      const result = await syncSingleChat({
        supabaseAdmin,
        token,
        rawChatId: chat.id,
        count,
      });

      syncedMessages += result.count;
      if (result.skipped) {
        skippedChats += 1;
      } else {
        syncedChats += 1;
      }
    } catch (error) {
      failedChats += 1;
      failures.push({
        chatId: chat.id,
        chatName: chat.name?.trim() || chat.phone_number?.trim() || chat.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    totalChats: uniqueChats.length,
    syncedChats,
    failedChats,
    skippedChats,
    syncedMessages,
    failures: failures.slice(0, 20),
  };
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      return jsonResponse({ error: 'Configuracao do servidor incompleta.' }, 500);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const serviceRoleCall = isServiceRoleRequest(req, supabaseServiceKey);
    if (!serviceRoleCall) {
      const authResult = await authorizeDashboardUser({
        req,
        supabaseUrl,
        supabaseAnonKey,
        supabaseAdmin: supabase,
        module: 'whatsapp',
        requiredPermission: 'view',
      });

      if (!authResult.authorized) {
        return jsonResponse(authResult.body, authResult.status);
      }
    }

    const requestPayload = (await req.json().catch(() => null)) as SyncRequestPayload | null;
    const action = typeof requestPayload?.action === 'string' ? requestPayload.action.trim().toLowerCase() : 'sync_chat';
    const count = parseSyncCount(requestPayload?.count);
    const token = await loadWhapiToken(supabase);

    if (action === 'sync_all_chats') {
      const summary = await syncAllChats({
        supabaseAdmin: supabase,
        token,
        count,
      });

      return jsonResponse({ success: true, mode: 'sync_all_chats', ...summary }, 200);
    }

    const rawChatId = typeof requestPayload?.chatId === 'string' ? requestPayload.chatId.trim() : '';
    if (!rawChatId) {
      return jsonResponse({ error: 'chatId obrigatorio.' }, 400);
    }

    const result = await syncSingleChat({
      supabaseAdmin: supabase,
      token,
      rawChatId,
      count,
    });

    return jsonResponse({ success: true, ...result }, 200);
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
