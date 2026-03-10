import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers':
    'Content-Type, Authorization, X-Client-Info, Apikey, X-Whapi-Event, X-Webhook-Secret, X-Webhook-Signature, X-Whapi-Signature',
};

type StoredEvent = {
  event: string;
  payload: Record<string, unknown>;
  headers: Record<string, string>;
};

type WhapiMessage = {
  id: string;
  from_me: boolean;
  type: string;
  subtype?: string;
  chat_id: string;
  chat_name?: string;
  timestamp: number | string | null;
  source?: string;
  status?: string;
  edited_at?: number;
  edit_history?: Array<{
    body: string;
    timestamp: number;
  }>;
  text?: {
    body: string;
  };
  from?: string;
  from_name?: string;
  image?: {
    mime_type: string;
    file_size: number;
    link?: string;
    caption?: string;
  };
  video?: {
    mime_type: string;
    file_size: number;
    link?: string;
    caption?: string;
  };
  audio?: {
    mime_type: string;
    file_size: number;
    link?: string;
  };
  voice?: {
    mime_type: string;
    file_size: number;
    link?: string;
  };
  document?: {
    mime_type: string;
    file_size: number;
    link?: string;
    filename?: string;
    caption?: string;
  };
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  live_location?: {
    latitude: number;
    longitude: number;
    caption?: string;
  };
  contact?: {
    name: string;
    vcard: string;
  };
  contact_list?: {
    list: Array<{
      name: string;
      vcard: string;
    }>;
  };
  link_preview?: {
    body: string;
    url: string;
    title?: string;
    description?: string;
  };
  sticker?: {
    mime_type: string;
    link?: string;
    animated?: boolean;
  };
  action?: {
    target: string;
    type: string;
    emoji?: string;
    votes?: string[];
    ephemeral?: number;
    edited_type?: string;
    edited_content?: Record<string, unknown>;
  };
  context?: {
    quoted_id?: string;
    quoted_author?: string;
    quoted_type?: string;
    quoted_content?: Record<string, unknown>;
  };
  reply?: {
    type: string;
    buttons_reply?: {
      id: string;
      title: string;
    };
    list_reply?: {
      id?: string;
      title?: string;
      description?: string;
    };
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
  group_invite?: {
    body: string;
    url: string;
    invite_code: string;
  };
  poll?: {
    title: string;
    options: string[];
    total: number;
  };
  product?: {
    product_id: string;
    catalog_id: string;
  };
  order?: {
    order_id: string;
    status: string;
    item_count: number;
  };
};

type WhapiStatus = {
  id: string;
  code: number | string | null;
  status: string;
  recipient_id: string;
  timestamp: string;
};

type WhapiParticipant = {
  id: string;
  rank: 'creator' | 'admin' | 'member';
};

type WhapiGroup = {
  id: string;
  name: string;
  type: string;
  timestamp?: number;
  participants: WhapiParticipant[];
  name_at?: number;
  created_at: number;
  created_by: string;
  chat_pic?: string;
  chat_pic_full?: string;
  adminAddMemberMode?: boolean;
};

type WhapiGroupParticipants = {
  group_id: string;
  participants: string[];
  action: 'add' | 'remove' | 'promote' | 'demote' | 'request';
};

type WhapiGroupUpdate = {
  before_update: WhapiGroup;
  after_update: WhapiGroup;
  changes: string[];
};

type WhapiMessageUpdate = {
  id: string;
  trigger?: WhapiMessage;
  before_update: WhapiMessage;
  after_update: WhapiMessage;
  changes: string[];
};

type WhapiChatSnapshot = {
  id?: string;
  chat_id?: string;
  last_message?: WhapiMessage;
};

type WhapiChatUpdate = {
  before_update?: WhapiChatSnapshot;
  after_update?: WhapiChatSnapshot;
  chat?: WhapiChatSnapshot;
  last_message?: WhapiMessage;
  changes?: string[];
};

type WhapiWebhook = {
  messages?: WhapiMessage[];
  messages_updates?: WhapiMessageUpdate[];
  messages_removed?: Array<string | { id?: string; message_id?: string; chat_id?: string }>;
  messages_removed_all?: string;
  chats_updates?: WhapiChatUpdate[];
  statuses?: WhapiStatus[];
  groups?: WhapiGroup[];
  groups_participants?: WhapiGroupParticipants[];
  groups_updates?: WhapiGroupUpdate[];
  event: {
    type: string;
    event: string;
  };
  channel_id?: string;
};

type NormalizedMessage = {
  chatId: string;
  messageId: string;
  direction: 'inbound' | 'outbound';
  fromNumber: string | null;
  toNumber: string | null;
  type: string | null;
  body: string | null;
  hasMedia: boolean;
  timestamp: string | null;
  contactName: string | null;
  chatName: string | null;
  isGroup: boolean;
  author: string | null;
  ackStatus: number | null;
  payload: Record<string, unknown>;
};

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const webhookSecret = Deno.env.get('WHATSAPP_WEBHOOK_SECRET')?.trim() ?? '';
const webhookSignatureSecret = Deno.env.get('WHATSAPP_WEBHOOK_SIGNATURE_SECRET')?.trim() || webhookSecret;
const allowUnverifiedWebhook = Deno.env.get('WHATSAPP_WEBHOOK_ALLOW_UNVERIFIED') === 'true';
const WHAPI_BASE_URL = (Deno.env.get('WHAPI_BASE_URL')?.trim() || 'https://gate.whapi.cloud').replace(/\/+$/, '');

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing Supabase environment variables.');
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

const sensitiveHeaderKeys = new Set([
  'authorization',
  'apikey',
  'x-api-key',
  'x-webhook-secret',
  'x-whapi-secret',
  'x-webhook-signature',
  'x-whapi-signature',
  'x-signature',
]);

const timingSafeEqual = (left: string, right: string): boolean => {
  if (left.length !== right.length) {
    return false;
  }

  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return mismatch === 0;
};

const getWebhookSecretCandidate = (headers: Headers): string | null => {
  const directSecret = headers.get('x-webhook-secret') ?? headers.get('x-whapi-secret');
  if (directSecret && directSecret.trim()) {
    return directSecret.trim();
  }

  const authHeader = headers.get('authorization');
  const bearerMatch = authHeader?.match(/^Bearer\s+(.+)$/i);
  return bearerMatch?.[1]?.trim() || null;
};

const normalizeSignatureHeader = (value: string | null): string | null => {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const lower = trimmed.toLowerCase();
  const knownPrefixes = ['sha256=', 'sha1=', 'v1='];
  for (const prefix of knownPrefixes) {
    if (lower.startsWith(prefix)) {
      return trimmed.slice(prefix.length).trim();
    }
  }

  return trimmed;
};

const bytesToHex = (bytes: Uint8Array): string =>
  Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

const bytesToBase64 = (bytes: Uint8Array): string => btoa(String.fromCharCode(...bytes));

const createExpectedSignatures = async (
  secret: string,
  payload: string,
): Promise<{ hex: string; base64: string }> => {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  const signatureBytes = new Uint8Array(signature);

  return {
    hex: bytesToHex(signatureBytes),
    base64: bytesToBase64(signatureBytes),
  };
};

const verifyWebhookRequest = async (
  req: Request,
  rawBody: string,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> => {
  if (allowUnverifiedWebhook) {
    return { ok: true };
  }

  if (!webhookSecret && !webhookSignatureSecret) {
    return {
      ok: false,
      status: 500,
      error: 'Webhook sem segredo configurado. Configure WHATSAPP_WEBHOOK_SECRET.',
    };
  }

  if (webhookSecret) {
    const providedSecret = getWebhookSecretCandidate(req.headers);
    if (providedSecret && timingSafeEqual(providedSecret, webhookSecret)) {
      return { ok: true };
    }
  }

  const providedSignature = normalizeSignatureHeader(
    req.headers.get('x-whapi-signature') ?? req.headers.get('x-webhook-signature') ?? req.headers.get('x-signature'),
  );

  if (providedSignature && webhookSignatureSecret) {
    const expected = await createExpectedSignatures(webhookSignatureSecret, rawBody);
    const signatureLooksHex = /^[0-9a-f]+$/i.test(providedSignature);

    if (signatureLooksHex && timingSafeEqual(providedSignature.toLowerCase(), expected.hex)) {
      return { ok: true };
    }

    if (!signatureLooksHex && timingSafeEqual(providedSignature, expected.base64)) {
      return { ok: true };
    }
  }

  return {
    ok: false,
    status: 401,
    error: 'Assinatura ou segredo do webhook inválido',
  };
};

function respond(body: Record<string, unknown>, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function extractEventName(payload: WhapiWebhook, headers: Headers): string {
  const headerEvent = headers.get('x-whapi-event');
  if (headerEvent && headerEvent.trim()) {
    return headerEvent.trim();
  }

  if (payload.event && typeof payload.event === 'object') {
    const eventType = payload.event.type || '';
    const eventAction = payload.event.event || '';
    return `${eventType}.${eventAction}`.trim();
  }

  return 'unknown';
}

function extractHeaders(headers: Headers): Record<string, string> {
  const result: Record<string, string> = {};
  headers.forEach((value, key) => {
    const normalizedKey = key.toLowerCase();
    result[normalizedKey] = sensitiveHeaderKeys.has(normalizedKey) ? '[redacted]' : value;
  });
  return result;
}

async function storeEvent(event: StoredEvent) {
  const { error } = await supabase.from('whatsapp_webhook_events').insert(event);

  if (error) {
    throw new Error(`Erro ao salvar evento: ${error.message}`);
  }
}

let cachedWhapiToken: string | null = null;
let cachedWhapiTokenExpiresAt = 0;

function sanitizeWhapiToken(rawToken: unknown): string {
  if (typeof rawToken !== 'string') {
    return '';
  }

  return rawToken.replace(/^Bearer\s+/i, '').trim();
}

async function getWhapiToken(): Promise<string | null> {
  const now = Date.now();
  if (cachedWhapiToken && now < cachedWhapiTokenExpiresAt) {
    return cachedWhapiToken;
  }

  const { data: settingsRow, error } = await supabase
    .from('integration_settings')
    .select('settings')
    .eq('slug', 'whatsapp_auto_contact')
    .maybeSingle();

  if (error) {
    console.warn('whatsapp-webhook: erro ao carregar token Whapi da integração', {
      error: error.message,
    });
    return null;
  }

  const settings = settingsRow?.settings && typeof settingsRow.settings === 'object'
    ? (settingsRow.settings as Record<string, unknown>)
    : null;

  const token = sanitizeWhapiToken(settings?.apiKey ?? settings?.token ?? '');
  if (!token) {
    cachedWhapiToken = null;
    cachedWhapiTokenExpiresAt = 0;
    return null;
  }

  cachedWhapiToken = token;
  cachedWhapiTokenExpiresAt = now + 45_000;
  return cachedWhapiToken;
}

function toIsoString(timestamp: unknown): string | null {
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
}

function toCleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function toArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function getLatestIsoTimestamp(...values: Array<string | null | undefined>): string | null {
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
}

function normalizeDirectChatId(chatId: string): string {
  const trimmed = chatId.trim();
  if (!trimmed) return trimmed;

  if (/@c\.us$/i.test(trimmed)) {
    return trimmed.replace(/@c\.us$/i, '@s.whatsapp.net');
  }

  if (/@s\.whatsapp\.net$/i.test(trimmed)) {
    return trimmed.replace(/(@s\.whatsapp\.net)+$/i, '@s.whatsapp.net');
  }

  if (!trimmed.includes('@')) {
    const digits = trimmed.replace(/\D/g, '');
    if (digits.length >= 7 && digits.length <= 15) {
      return `${digits}@s.whatsapp.net`;
    }
  }

  return trimmed;
}

function normalizeMaybeDirectId(value: string | null | undefined): string | null {
  const cleaned = toCleanText(value);
  if (!cleaned) return null;

  const type = getChatIdType(cleaned);
  if (type === 'phone') {
    return normalizeDirectChatId(cleaned);
  }

  return cleaned;
}

function resolveInboundCanonicalDirectChatId(
  rawChatId: string,
  normalizedChatId: string,
  normalizedFrom: string | null,
): string {
  if (!normalizedFrom || getChatIdType(normalizedFrom) !== 'phone') {
    return normalizedChatId;
  }

  const chatType = getChatIdType(normalizedChatId);
  if (chatType === 'group' || chatType === 'newsletter' || chatType === 'broadcast' || chatType === 'status') {
    return normalizedChatId;
  }

  if (chatType === 'lid' || chatType === 'unknown') {
    return normalizedFrom;
  }

  if (chatType === 'phone' && normalizedChatId !== normalizedFrom) {
    const raw = rawChatId.trim().toLowerCase();
    if (!raw || raw.endsWith('@lid') || !raw.includes('@')) {
      return normalizedFrom;
    }

    return normalizedFrom;
  }

  return normalizedChatId;
}

function toPayloadObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function extractContentBody(content: unknown): string | null {
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
}

function normalizeActionType(actionType: unknown): string {
  return toCleanText(actionType).toLowerCase();
}

function extractLinkPreviewBody(message: WhapiMessage): string | null {
  if (!message.link_preview) return null;

  const bodyText = toCleanText(message.link_preview.body);
  if (bodyText && bodyText !== '[link_preview]') return bodyText;

  const titleText = toCleanText(message.link_preview.title);
  if (titleText) return titleText;

  const descriptionText = toCleanText(message.link_preview.description);
  if (descriptionText) return descriptionText;

  const urlText = toCleanText(message.link_preview.url);
  if (urlText) return urlText;

  return '[Link]';
}

function extractSystemBody(message: WhapiMessage): string | null {
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
}

function extractEditedActionBody(message: WhapiMessage): string | null {
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
}

function extractInteractiveBody(message: WhapiMessage): string | null {
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
}

function extractHsmBody(message: WhapiMessage): string | null {
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
}

function extractReplyBody(message: WhapiMessage): string | null {
  const buttonsReplyTitle = toCleanText(message.reply?.buttons_reply?.title);
  if (buttonsReplyTitle) {
    return `Resposta: ${buttonsReplyTitle}`;
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
}

function buildMessageBody(message: WhapiMessage): { body: string; hasMedia: boolean } {
  if (message.text?.body) {
    return { body: message.text.body, hasMedia: false };
  }

  const linkPreviewBody = extractLinkPreviewBody(message);
  if (message.link_preview) {
    return { body: linkPreviewBody || '[Link]', hasMedia: true };
  }

  if (message.image) {
    const fallback = message.type === 'story' ? '[Imagem de status]' : '[Imagem]';
    return { body: message.image.caption || fallback, hasMedia: true };
  }

  if (message.video) {
    const fallback = message.type === 'story' ? '[Vídeo de status]' : '[Vídeo]';
    return { body: message.video.caption || fallback, hasMedia: true };
  }

  if (message.type === 'short' || message.type === 'gif') {
    return { body: '[Vídeo]', hasMedia: true };
  }

  if (message.audio) {
    return { body: '[Áudio]', hasMedia: true };
  }

  if (message.voice) {
    return { body: '[Mensagem de voz]', hasMedia: true };
  }

  if (message.document) {
    const fileName = message.document.filename || '';
    const caption = message.document.caption;
    return {
      body: caption ? `${caption} [Documento: ${fileName}]` : `[Documento${fileName ? ': ' + fileName : ''}]`,
      hasMedia: true,
    };
  }

  if (message.location) {
    return { body: `[Localização${message.location.address ? ': ' + message.location.address : ''}]`, hasMedia: true };
  }

  if (message.live_location) {
    return { body: `[Localização ao vivo${message.live_location.caption ? ': ' + message.live_location.caption : ''}]`, hasMedia: true };
  }

  if (message.contact) {
    return { body: `[Contato: ${message.contact.name}]`, hasMedia: false };
  }

  if (message.contact_list) {
    const count = toArray(message.contact_list.list).length;
    return { body: `[${count} contato${count > 1 ? 's' : ''}]`, hasMedia: false };
  }

  if (message.sticker) {
    return { body: message.sticker.animated ? '[Sticker animado]' : '[Sticker]', hasMedia: true };
  }

  if (message.action) {
    const actionType = normalizeActionType(message.action.type);

    if (actionType === 'reaction') {
      const emoji = toCleanText(message.action.emoji);
      if (emoji) {
        return { body: `Reagiu com ${emoji}`, hasMedia: false };
      }
      return { body: '[Reação removida]', hasMedia: false };
    }

    if (actionType === 'delete') {
      return { body: '[Mensagem apagada]', hasMedia: false };
    }

    if (actionType === 'vote') {
      return { body: '[Votou em enquete]', hasMedia: false };
    }

    if (actionType === 'ephemeral') {
      return { body: '[Configuração de mensagens temporárias]', hasMedia: false };
    }

    const editedBody = extractEditedActionBody(message);
    if (editedBody) {
      return { body: editedBody, hasMedia: false };
    }

    return { body: `[Ação: ${message.action.type}]`, hasMedia: false };
  }

  const replyBody = extractReplyBody(message);
  if (replyBody) {
    return { body: replyBody, hasMedia: false };
  }

  const interactiveBody = extractInteractiveBody(message);
  if (interactiveBody) {
    return { body: interactiveBody, hasMedia: false };
  }

  const hsmBody = extractHsmBody(message);
  if (hsmBody) {
    return { body: hsmBody, hasMedia: false };
  }

  if (message.type === 'system') {
    return { body: extractSystemBody(message) || '[Evento do WhatsApp]', hasMedia: false };
  }

  if (message.type === 'interactive') {
    return { body: '[Mensagem interativa]', hasMedia: false };
  }

  if (message.type === 'hsm') {
    return { body: '[Template WhatsApp]', hasMedia: false };
  }

  if (message.type === 'link_preview') {
    return { body: linkPreviewBody || '[Link]', hasMedia: true };
  }

  if (message.type === 'story') {
    return { body: '[Status]', hasMedia: false };
  }

  if (message.type === 'call') {
    return { body: '[Ligação do WhatsApp]', hasMedia: false };
  }

  if (message.type === 'revoked') {
    return { body: '[Mensagem apagada]', hasMedia: false };
  }

  if (message.type === 'unknown') {
    return { body: '[Mensagem não suportada]', hasMedia: false };
  }

  if (message.group_invite) {
    return { body: `[Convite para grupo: ${message.group_invite.url}]`, hasMedia: false };
  }

  if (message.poll) {
    return { body: `[Enquete: ${message.poll.title}]`, hasMedia: false };
  }

  if (message.product) {
    return { body: '[Produto do catálogo]', hasMedia: false };
  }

  if (message.order) {
    return { body: `[Pedido #${message.order.order_id}]`, hasMedia: false };
  }

  return { body: `[${message.type}]`, hasMedia: false };
}

const provisionalBodyMarkers = new Set([
  '[mensagem criptografada]',
  '[evento do whatsapp]',
  '[sistema: ciphertext]',
]);

function normalizeBodyForComparison(body: string | null | undefined): string {
  return toCleanText(body).toLowerCase();
}

function isCiphertextSubtype(subtype: unknown): boolean {
  return normalizeBodyForComparison(typeof subtype === 'string' ? subtype : '').includes('ciphertext');
}

function isWaitingPlaceholderText(body: string | null | undefined): boolean {
  const normalized = normalizeBodyForComparison(body);
  if (!normalized) {
    return false;
  }

  return (
    normalized.includes('aguardando esta mensagem') ||
    normalized.includes('waiting for this message') ||
    normalized.includes('aguardando essa mensagem')
  );
}

function isLikelyProvisionalWhapiMessage(message: WhapiMessage): boolean {
  const messageType = normalizeBodyForComparison(message.type);
  if (messageType !== 'system') {
    return false;
  }

  if (isCiphertextSubtype(message.subtype)) {
    return true;
  }

  const systemBody = toCleanText(message.system?.body);
  if (isWaitingPlaceholderText(systemBody)) {
    return true;
  }

  const { body } = buildMessageBody(message);
  return provisionalBodyMarkers.has(normalizeBodyForComparison(body));
}

function isLikelyProvisionalStoredMessage(message: {
  type?: string | null;
  body?: string | null;
  payload?: unknown;
}): boolean {
  const normalizedType = normalizeBodyForComparison(message.type || '');
  if (normalizedType !== 'system') {
    return false;
  }

  if (provisionalBodyMarkers.has(normalizeBodyForComparison(message.body || ''))) {
    return true;
  }

  const payload = toPayloadObject(message.payload);
  if (!payload) {
    return false;
  }

  if (isCiphertextSubtype(payload.subtype)) {
    return true;
  }

  const payloadSystem = toPayloadObject(payload.system);
  const payloadSystemBody = payloadSystem ? toCleanText(payloadSystem.body) : '';
  return isWaitingPlaceholderText(payloadSystemBody);
}

function shouldReplaceProvisionalMessageWithFetched(original: WhapiMessage, fetched: WhapiMessage): boolean {
  if (toCleanText(original.id) !== toCleanText(fetched.id)) {
    return false;
  }

  const originalIsProvisional = isLikelyProvisionalWhapiMessage(original);
  if (!originalIsProvisional) {
    return false;
  }

  const fetchedIsProvisional = isLikelyProvisionalWhapiMessage(fetched);
  if (!fetchedIsProvisional) {
    return true;
  }

  const originalBody = normalizeBodyForComparison(buildMessageBody(original).body);
  const fetchedBody = normalizeBodyForComparison(buildMessageBody(fetched).body);
  if (fetchedBody && fetchedBody !== originalBody && !provisionalBodyMarkers.has(fetchedBody)) {
    return true;
  }

  return false;
}

function normalizeWhapiMessage(message: WhapiMessage): NormalizedMessage {
  const messageId = message.id;
  const direction: 'inbound' | 'outbound' = message.from_me ? 'outbound' : 'inbound';
  const rawChatId = toCleanText(message.chat_id);
  let chatId = normalizeDirectChatId(rawChatId || '');
  const normalizedFrom = normalizeMaybeDirectId(message.from);

  if (direction === 'inbound') {
    chatId = resolveInboundCanonicalDirectChatId(rawChatId, chatId, normalizedFrom);
  }

  const chatIdType = getChatIdType(chatId);
  const isGroup = chatIdType === 'group';
  const { body, hasMedia } = buildMessageBody(message);

  const fromNumber = direction === 'inbound' ? (normalizedFrom || chatId) : null;
  const toNumber = direction === 'outbound' ? chatId : null;
  const contactName = message.from_name || null;
  const chatName = message.chat_name || null;
  const timestamp = toIsoString(message.timestamp);

  const ackStatus = message.status ? mapStatusToAck(message.status) : null;

  const normalized: NormalizedMessage = {
    chatId,
    messageId,
    direction,
    fromNumber,
    toNumber,
    type: message.type,
    body,
    hasMedia,
    timestamp,
    contactName,
    chatName,
    isGroup,
    author: isGroup && fromNumber ? fromNumber : null,
    ackStatus,
    payload: JSON.parse(JSON.stringify(message)),
  };

  console.log('whatsapp-webhook: mensagem Whapi normalizada', {
    messageId: normalized.messageId,
    incomingChatId: message.chat_id,
    chatId: normalized.chatId,
    direction: normalized.direction,
    contactName: normalized.contactName,
    body: normalized.body?.substring(0, 50),
    type: message.type,
  });

  return normalized;
}

function mapStatusToAck(status?: string | null): number | null {
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
}

function mapStatusCodeToAck(code?: number | string | null): number | null {
  const numericCode =
    typeof code === 'number'
      ? code
      : typeof code === 'string' && code.trim() !== ''
        ? Number(code)
        : Number.NaN;

  if (Number.isNaN(numericCode)) return null;

  const codeMap: Record<number, number | null> = {
    0: 0,
    1: 1,
    2: 2,
    3: 3,
    4: 4,
    5: 4,
    6: null,
  };

  if (numericCode in codeMap) {
    return codeMap[numericCode];
  }

  return numericCode <= 0 ? 0 : null;
}

function resolveStatusAck(status?: string | null, code?: number | string | null): number | null {
  const fromStatus = mapStatusToAck(status);
  const fromCode = mapStatusCodeToAck(code);

  return fromStatus ?? fromCode;
}

async function fetchWhapiMessageById(messageId: string, attempt = 0): Promise<WhapiMessage | null> {
  const normalizedMessageId = toCleanText(messageId);
  if (!normalizedMessageId) {
    return null;
  }

  const token = await getWhapiToken();
  if (!token) {
    console.warn('whatsapp-webhook: token Whapi indisponivel para buscar mensagem por ID', {
      messageId: normalizedMessageId,
    });
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort('timeout'), 12_000);

  try {
    const response = await fetch(`${WHAPI_BASE_URL}/messages/${encodeURIComponent(normalizedMessageId)}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      signal: controller.signal,
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      const errorBody = await response.text();

      if ((response.status === 401 || response.status === 403) && attempt === 0) {
        cachedWhapiToken = null;
        cachedWhapiTokenExpiresAt = 0;
        return fetchWhapiMessageById(normalizedMessageId, attempt + 1);
      }

      console.warn('whatsapp-webhook: falha ao buscar mensagem na Whapi por ID', {
        messageId: normalizedMessageId,
        status: response.status,
        error: errorBody.slice(0, 240),
      });
      return null;
    }

    const payload = (await response.json()) as Partial<WhapiMessage> | null;
    if (!payload || typeof payload !== 'object') {
      return null;
    }

    const payloadId = toCleanText(payload.id);
    const payloadType = toCleanText(payload.type);
    const payloadChatId = toCleanText(payload.chat_id);

    if (!payloadId || !payloadType || !payloadChatId || typeof payload.from_me !== 'boolean') {
      console.warn('whatsapp-webhook: payload incompleto ao buscar mensagem na Whapi por ID', {
        messageId: normalizedMessageId,
        payloadId,
        payloadType,
        payloadChatId,
        hasFromMe: typeof payload.from_me === 'boolean',
      });
      return null;
    }

    return payload as WhapiMessage;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn('whatsapp-webhook: excecao ao buscar mensagem na Whapi por ID', {
      messageId: normalizedMessageId,
      error: message,
    });
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function getChatIdType(chatId: string): 'group' | 'phone' | 'lid' | 'newsletter' | 'broadcast' | 'status' | 'unknown' {
  const normalized = chatId.trim().toLowerCase();
  if (normalized.endsWith('@g.us')) return 'group';
  if (normalized === 'status@broadcast' || normalized === 'stories') return 'status';
  if (normalized.endsWith('@newsletter')) return 'newsletter';
  if (normalized.endsWith('@broadcast')) return 'broadcast';
  if (normalized.endsWith('@c.us') || normalized.endsWith('@s.whatsapp.net')) return 'phone';
  if (normalized.endsWith('@lid')) return 'lid';

  if (!normalized.includes('@')) {
    const digits = normalized.replace(/\D/g, '');
    if (digits.length >= 7 && digits.length <= 15) {
      return 'phone';
    }
  }

  return 'unknown';
}

function extractPhoneNumber(chatId: string): string | null {
  const normalizedChatId = normalizeDirectChatId(chatId);
  if (getChatIdType(normalizedChatId) !== 'phone') return null;
  const phone = normalizedChatId.replace(/@c\.us$|@s\.whatsapp\.net$/i, '').replace(/\D/g, '');
  return phone || null;
}

function buildPhoneLookupVariants(phoneNumber: string): string[] {
  const rawDigits = phoneNumber.replace(/\D/g, '');
  if (!rawDigits) return [];

  const variants = new Set<string>();
  const push = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (!digits) return;
    variants.add(digits);

    if (digits.startsWith('55') && digits.length > 11) {
      variants.add(digits.slice(2));
    }

    if (!digits.startsWith('55') && (digits.length === 10 || digits.length === 11)) {
      variants.add(`55${digits}`);
    }
  };

  push(rawDigits);

  const snapshot = Array.from(variants);
  snapshot.forEach((value) => {
    const local = value.startsWith('55') && (value.length === 12 || value.length === 13) ? value.slice(2) : value;

    if (local.length === 11 && local[2] === '9') {
      const withoutNinthDigit = `${local.slice(0, 2)}${local.slice(3)}`;
      push(withoutNinthDigit);
      push(`55${withoutNinthDigit}`);
    }

    if (local.length === 10) {
      const withNinthDigit = `${local.slice(0, 2)}9${local.slice(2)}`;
      push(withNinthDigit);
      push(`55${withNinthDigit}`);
    }
  });

  return Array.from(variants);
}

function buildDirectChatIdVariantsFromPhone(phoneNumber: string): string[] {
  const phoneVariants = buildPhoneLookupVariants(phoneNumber);
  const chatIdVariants = new Set<string>();

  phoneVariants.forEach((digits) => {
    chatIdVariants.add(`${digits}@s.whatsapp.net`);
    chatIdVariants.add(`${digits}@c.us`);
  });

  return Array.from(chatIdVariants);
}

function getDirectChatMergePriority(chatId: string, phoneNumber: string | null): number {
  const normalized = chatId.trim().toLowerCase();
  if (!normalized) return -1;

  if (phoneNumber) {
    if (normalized === `${phoneNumber}@s.whatsapp.net`) return 120;
    if (normalized === `${phoneNumber}@c.us`) return 110;
  }

  if (normalized.endsWith('@s.whatsapp.net')) return 90;
  if (normalized.endsWith('@c.us')) return 80;
  if (normalized.endsWith('@lid')) return 20;
  if (!normalized.includes('@')) return 10;
  return 0;
}

function choosePreferredDirectChatId(primaryChatId: string, secondaryChatId: string, phoneNumber: string | null): string {
  const primaryScore = getDirectChatMergePriority(primaryChatId, phoneNumber);
  const secondaryScore = getDirectChatMergePriority(secondaryChatId, phoneNumber);
  if (secondaryScore > primaryScore) {
    return secondaryChatId;
  }
  return primaryChatId;
}

async function findExistingChatByPhone(phoneNumber: string, currentChatId: string): Promise<string | null> {
  const phoneVariants = buildPhoneLookupVariants(phoneNumber);
  if (phoneVariants.length === 0) {
    return null;
  }

  const chatIdVariants = buildDirectChatIdVariantsFromPhone(phoneNumber).filter((variant) => variant !== currentChatId);
  if (chatIdVariants.length > 0) {
    const { data: byId, error: byIdError } = await supabase
      .from('whatsapp_chats')
      .select('id')
      .in('id', chatIdVariants)
      .neq('id', currentChatId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!byIdError && byId?.id) {
      return byId.id;
    }
  }

  const { data, error } = await supabase
    .from('whatsapp_chats')
    .select('id, phone_number, lid')
    .in('phone_number', phoneVariants)
    .neq('id', currentChatId)
    .not('id', 'ilike', '%@lid')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!error && data?.id) {
    return data.id;
  }

  const { data: fallbackData, error: fallbackError } = await supabase
    .from('whatsapp_chats')
    .select('id, phone_number, lid')
    .in('phone_number', phoneVariants)
    .neq('id', currentChatId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (fallbackError || !fallbackData) {
    return null;
  }

  return fallbackData.id;
}

function extractMessageConversationKey(messageId: string): string | null {
  const normalized = toCleanText(messageId);
  if (!normalized || normalized.length < 6) {
    return null;
  }

  return normalized.slice(-8);
}

function toEpochMillis(value: string | null | undefined): number {
  if (!value) return Number.NaN;
  const parsed = new Date(value);
  const timestamp = parsed.getTime();
  return Number.isNaN(timestamp) ? Number.NaN : timestamp;
}

type ConversationKeyCandidate = {
  chatId: string;
  score: number;
  inboundHits: number;
  latestAt: number;
};

async function findDirectChatByMessageConversationKey(
  messageId: string,
  options?: {
    excludeChatIds?: string[];
    referenceIso?: string | null;
    requireInboundEvidence?: boolean;
  },
): Promise<string | null> {
  const key = extractMessageConversationKey(messageId);
  if (!key) {
    return null;
  }

  const referenceMillis = toEpochMillis(options?.referenceIso ?? null);
  const excludedChatIds = new Set((options?.excludeChatIds || []).map((chatId) => normalizeDirectChatId(chatId || '')));

  const { data, error } = await supabase
    .from('whatsapp_messages')
    .select('id, chat_id, direction, timestamp, created_at')
    .ilike('id', `%${key}`)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    console.warn('whatsapp-webhook: erro ao buscar mensagens por chave de conversa', {
      messageId,
      key,
      error: error.message,
    });
    return null;
  }

  const byChat = new Map<string, ConversationKeyCandidate>();

  for (const row of data || []) {
    const rowId = toCleanText((row as { id?: string }).id);
    if (!rowId.endsWith(key)) {
      continue;
    }

    const rowChatId = normalizeDirectChatId(toCleanText((row as { chat_id?: string }).chat_id));
    if (!rowChatId || excludedChatIds.has(rowChatId)) {
      continue;
    }

    const chatType = getChatIdType(rowChatId);
    if (chatType !== 'phone' && chatType !== 'lid') {
      continue;
    }

    const direction = toCleanText((row as { direction?: string | null }).direction).toLowerCase();
    const rowTimestamp =
      toEpochMillis(toCleanText((row as { timestamp?: string | null }).timestamp)) ||
      toEpochMillis(toCleanText((row as { created_at?: string | null }).created_at));

    let score = direction === 'inbound' ? 8 : 2;

    if (!Number.isNaN(referenceMillis) && !Number.isNaN(rowTimestamp)) {
      const diff = Math.abs(rowTimestamp - referenceMillis);
      if (diff <= 2 * 60 * 60 * 1000) {
        score += 8;
      } else if (diff <= 12 * 60 * 60 * 1000) {
        score += 5;
      } else if (diff <= 48 * 60 * 60 * 1000) {
        score += 3;
      } else if (diff <= 7 * 24 * 60 * 60 * 1000) {
        score += 1;
      }
    }

    const previous = byChat.get(rowChatId) || {
      chatId: rowChatId,
      score: 0,
      inboundHits: 0,
      latestAt: Number.NaN,
    };

    byChat.set(rowChatId, {
      chatId: rowChatId,
      score: previous.score + score,
      inboundHits: previous.inboundHits + (direction === 'inbound' ? 1 : 0),
      latestAt: Number.isNaN(previous.latestAt)
        ? rowTimestamp
        : Number.isNaN(rowTimestamp)
          ? previous.latestAt
          : Math.max(previous.latestAt, rowTimestamp),
    });
  }

  const candidates = Array.from(byChat.values()).sort((left, right) => {
    if (right.score !== left.score) return right.score - left.score;
    if (right.inboundHits !== left.inboundHits) return right.inboundHits - left.inboundHits;
    return (right.latestAt || 0) - (left.latestAt || 0);
  });

  if (candidates.length === 0) {
    return null;
  }

  const [best, secondBest] = candidates;
  if (options?.requireInboundEvidence && best.inboundHits === 0) {
    return null;
  }

  if (secondBest) {
    const scoreDelta = best.score - secondBest.score;
    if (scoreDelta <= 0 && best.inboundHits === secondBest.inboundHits) {
      return null;
    }

    if (scoreDelta < 2 && best.inboundHits <= secondBest.inboundHits) {
      return null;
    }
  }

  return best.chatId;
}

async function resolveCanonicalDirectChatIdFromStatusRecipient(
  recipientId: string | null | undefined,
  currentChatId: string,
  messageId: string,
  referenceIso: string | null,
): Promise<string | null> {
  const normalizedRecipient = normalizeMaybeDirectId(recipientId);
  if (!normalizedRecipient) {
    return findDirectChatByMessageConversationKey(messageId, {
      excludeChatIds: [currentChatId],
      referenceIso,
      requireInboundEvidence: true,
    });
  }

  const recipientType = getChatIdType(normalizedRecipient);
  if (recipientType === 'phone') {
    const phoneNumber = extractPhoneNumber(normalizedRecipient);
    if (phoneNumber) {
      const existingChatId = await findExistingChatByPhone(phoneNumber, currentChatId);
      if (existingChatId) {
        return normalizeDirectChatId(existingChatId);
      }
    }

    return normalizeDirectChatId(normalizedRecipient);
  }

  if (recipientType === 'lid') {
    const { data: byId, error: byIdError } = await supabase
      .from('whatsapp_chats')
      .select('id, phone_number')
      .eq('id', normalizedRecipient)
      .maybeSingle();

    if (!byIdError && byId?.id) {
      const normalizedById = normalizeDirectChatId(byId.id);
      if (getChatIdType(normalizedById) === 'phone') {
        return normalizedById;
      }

      const phoneFromChat = toCleanText(byId.phone_number);
      if (phoneFromChat) {
        const existingChatId = await findExistingChatByPhone(phoneFromChat, currentChatId);
        if (existingChatId) {
          return normalizeDirectChatId(existingChatId);
        }
      }
    }

    const { data: byLid, error: byLidError } = await supabase
      .from('whatsapp_chats')
      .select('id, phone_number')
      .eq('lid', normalizedRecipient)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!byLidError && byLid?.id) {
      const normalizedByLid = normalizeDirectChatId(byLid.id);
      if (getChatIdType(normalizedByLid) === 'phone') {
        return normalizedByLid;
      }

      const phoneFromLid = toCleanText(byLid.phone_number);
      if (phoneFromLid) {
        const existingChatId = await findExistingChatByPhone(phoneFromLid, currentChatId);
        if (existingChatId) {
          return normalizeDirectChatId(existingChatId);
        }
      }
    }

    return findDirectChatByMessageConversationKey(messageId, {
      excludeChatIds: [currentChatId],
      referenceIso,
      requireInboundEvidence: true,
    });
  }

  if (recipientType === 'group' || recipientType === 'newsletter' || recipientType === 'broadcast' || recipientType === 'status') {
    return normalizedRecipient;
  }

  return findDirectChatByMessageConversationKey(messageId, {
    excludeChatIds: [currentChatId],
    referenceIso,
    requireInboundEvidence: true,
  });
}

async function resolveOutboundCanonicalDirectChatIdFromMessage(
  rawMessage: WhapiMessage,
  normalized: NormalizedMessage,
): Promise<string | null> {
  if (normalized.direction !== 'outbound') {
    return null;
  }

  const chatType = getChatIdType(normalized.chatId);
  if (chatType !== 'phone' && chatType !== 'lid') {
    return null;
  }

  const source = toCleanText(rawMessage.source).toLowerCase();
  if (source !== 'web' && source !== 'mobile') {
    return null;
  }

  const normalizedFrom = normalizeMaybeDirectId(rawMessage.from);
  if (!normalizedFrom || getChatIdType(normalizedFrom) !== 'phone') {
    return null;
  }

  const normalizedChatId = normalizeDirectChatId(normalized.chatId);
  if (normalizeDirectChatId(normalizedFrom) !== normalizedChatId) {
    return null;
  }

  return findDirectChatByMessageConversationKey(normalized.messageId, {
    excludeChatIds: [normalizedChatId],
    referenceIso: normalized.timestamp,
    requireInboundEvidence: true,
  });
}

function isSuspiciousOutboundSelfStoredMessage(row: {
  chat_id?: string | null;
  direction?: string | null;
  payload?: unknown;
}): boolean {
  if (toCleanText(row.direction).toLowerCase() !== 'outbound') {
    return false;
  }

  const chatId = normalizeDirectChatId(toCleanText(row.chat_id));
  if (getChatIdType(chatId) !== 'phone') {
    return false;
  }

  const payload = row.payload && typeof row.payload === 'object'
    ? (row.payload as Record<string, unknown>)
    : null;

  if (!payload || payload.from_me !== true) {
    return false;
  }

  const source = toCleanText(payload.source).toLowerCase();
  if (source !== 'web' && source !== 'mobile') {
    return false;
  }

  const normalizedFrom = normalizeMaybeDirectId(payload.from as string | null | undefined);
  if (!normalizedFrom || getChatIdType(normalizedFrom) !== 'phone') {
    return false;
  }

  const payloadChatId = normalizeDirectChatId(toCleanText(payload.chat_id as string | null | undefined));
  if (payloadChatId && payloadChatId !== chatId) {
    return false;
  }

  return normalizeDirectChatId(normalizedFrom) === chatId;
}

async function reconcileSiblingOutboundMessagesByConversationKey(params: {
  messageId: string;
  targetChatId: string;
  referenceIso?: string | null;
}): Promise<number> {
  const conversationKey = extractMessageConversationKey(params.messageId);
  if (!conversationKey) {
    return 0;
  }

  const referenceMillis = toEpochMillis(params.referenceIso ?? null);
  const normalizedTargetChatId = normalizeDirectChatId(params.targetChatId);
  if (!normalizedTargetChatId) {
    return 0;
  }

  const { data: candidates, error } = await supabase
    .from('whatsapp_messages')
    .select('id, chat_id, direction, timestamp, created_at, to_number, payload')
    .eq('direction', 'outbound')
    .ilike('id', `%${conversationKey}`)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    console.warn('whatsapp-webhook: erro ao buscar siblings outbound por chave de conversa', {
      messageId: params.messageId,
      conversationKey,
      targetChatId: normalizedTargetChatId,
      error: error.message,
    });
    return 0;
  }

  let updatedCount = 0;

  for (const candidate of candidates || []) {
    const candidateId = toCleanText((candidate as { id?: string }).id);
    if (!candidateId.endsWith(conversationKey)) {
      continue;
    }

    const candidateChatId = normalizeDirectChatId(toCleanText((candidate as { chat_id?: string | null }).chat_id));
    if (!candidateChatId || candidateChatId === normalizedTargetChatId) {
      continue;
    }

    if (!isSuspiciousOutboundSelfStoredMessage(candidate as {
      chat_id?: string | null;
      direction?: string | null;
      payload?: unknown;
    })) {
      continue;
    }

    const candidateMillis =
      toEpochMillis(toCleanText((candidate as { timestamp?: string | null }).timestamp)) ||
      toEpochMillis(toCleanText((candidate as { created_at?: string | null }).created_at));

    if (!Number.isNaN(referenceMillis) && !Number.isNaN(candidateMillis)) {
      const diff = Math.abs(candidateMillis - referenceMillis);
      if (diff > 6 * 60 * 60 * 1000) {
        continue;
      }
    }

    const { error: updateError } = await supabase
      .from('whatsapp_messages')
      .update({
        chat_id: normalizedTargetChatId,
        to_number: normalizedTargetChatId,
      })
      .eq('id', candidateId);

    if (updateError) {
      console.warn('whatsapp-webhook: erro ao reconciliar sibling outbound', {
        messageId: candidateId,
        conversationKey,
        fromChatId: candidateChatId,
        toChatId: normalizedTargetChatId,
        error: updateError.message,
      });
      continue;
    }

    updatedCount += 1;
    await refreshChatLastMessageTimestamp(candidateChatId);
  }

  if (updatedCount > 0) {
    await refreshChatLastMessageTimestamp(normalizedTargetChatId);
  }

  return updatedCount;
}

async function ensureStatusResolvedChatExists(
  targetChatId: string,
  recipientId: string | null | undefined,
  referenceTimestamp: string | null,
) {
  const nowIso = new Date().toISOString();
  const { data: existingChat, error: existingChatError } = await supabase
    .from('whatsapp_chats')
    .select('id, name, is_group, phone_number, lid, last_message_at')
    .eq('id', targetChatId)
    .maybeSingle();

  if (existingChatError) {
    console.warn('whatsapp-webhook: erro ao carregar chat para reconciliação de status', {
      chatId: targetChatId,
      error: existingChatError.message,
    });
    return;
  }

  const chatType = getChatIdType(targetChatId);
  const isDirect = chatType === 'phone' || chatType === 'lid';
  const recipientNormalized = normalizeMaybeDirectId(recipientId);
  const recipientType = recipientNormalized ? getChatIdType(recipientNormalized) : 'unknown';

  const phoneNumber =
    isDirect
      ? extractPhoneNumber(targetChatId) || toCleanText(existingChat?.phone_number) || null
      : null;

  const lid =
    isDirect
      ? chatType === 'lid'
        ? targetChatId
        : toCleanText(existingChat?.lid) || (recipientType === 'lid' ? recipientNormalized : null)
      : null;

  const nextLastMessageAt =
    getLatestIsoTimestamp(existingChat?.last_message_at ?? null, referenceTimestamp, nowIso) ??
    existingChat?.last_message_at ??
    referenceTimestamp ??
    nowIso;

  const { error: upsertError } = await supabase.from('whatsapp_chats').upsert(
    {
      id: targetChatId,
      name: existingChat?.name ?? (phoneNumber || targetChatId),
      is_group: existingChat?.is_group ?? chatType === 'group',
      phone_number: isDirect ? phoneNumber : null,
      lid: isDirect ? lid : null,
      last_message_at: nextLastMessageAt,
      updated_at: nowIso,
    },
    { onConflict: 'id' },
  );

  if (upsertError) {
    console.warn('whatsapp-webhook: erro ao garantir chat após reconciliação por status', {
      chatId: targetChatId,
      error: upsertError.message,
    });
  }
}

async function refreshChatLastMessageTimestamp(chatId: string) {
  const normalizedChatId = toCleanText(chatId);
  if (!normalizedChatId) return;

  const { data: latestMessage, error: latestMessageError } = await supabase
    .from('whatsapp_messages')
    .select('timestamp, created_at')
    .eq('chat_id', normalizedChatId)
    .order('timestamp', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestMessageError) {
    console.warn('whatsapp-webhook: erro ao recalcular último horário do chat', {
      chatId: normalizedChatId,
      error: latestMessageError.message,
    });
    return;
  }

  const nextLastMessageAt = latestMessage?.timestamp || latestMessage?.created_at || null;
  const { error: updateError } = await supabase
    .from('whatsapp_chats')
    .update({ last_message_at: nextLastMessageAt, updated_at: new Date().toISOString() })
    .eq('id', normalizedChatId);

  if (updateError) {
    console.warn('whatsapp-webhook: erro ao atualizar último horário do chat', {
      chatId: normalizedChatId,
      error: updateError.message,
    });
  }
}

type StatusMessageResolution = {
  messageId: string;
  strategy: 'exact' | 'conversation_key' | 'status_id';
  confidence: number;
};

async function resolveStatusMessageId(status: WhapiStatus): Promise<StatusMessageResolution> {
  const statusMessageId = toCleanText(status.id);
  if (!statusMessageId) {
    return { messageId: '', strategy: 'status_id', confidence: 0 };
  }

  const { data: byExactId, error: byExactIdError } = await supabase
    .from('whatsapp_messages')
    .select('id')
    .eq('id', statusMessageId)
    .maybeSingle();

  if (byExactIdError) {
    console.warn('whatsapp-webhook: erro ao validar id exato do status', {
      statusId: statusMessageId,
      error: byExactIdError.message,
    });
  }

  if (byExactId?.id) {
    return { messageId: statusMessageId, strategy: 'exact', confidence: 100 };
  }

  const conversationKey = extractMessageConversationKey(statusMessageId);
  if (!conversationKey) {
    return { messageId: statusMessageId, strategy: 'status_id', confidence: 0 };
  }

  const statusTimestampIso = toIsoString(status.timestamp);
  const statusTimestampMillis = toEpochMillis(statusTimestampIso);
  const canonicalRecipientChatId = await resolveCanonicalDirectChatIdFromStatusRecipient(
    status.recipient_id,
    '',
    statusMessageId,
    statusTimestampIso,
  );

  const { data: candidates, error: candidatesError } = await supabase
    .from('whatsapp_messages')
    .select('id, chat_id, to_number, direction, timestamp, created_at')
    .eq('direction', 'outbound')
    .ilike('id', `%${conversationKey}`)
    .order('created_at', { ascending: false })
    .limit(200);

  if (candidatesError) {
    console.warn('whatsapp-webhook: erro ao buscar candidatos por chave de conversa para status', {
      statusId: statusMessageId,
      conversationKey,
      error: candidatesError.message,
    });
    return { messageId: statusMessageId, strategy: 'status_id', confidence: 0 };
  }

  const rankedCandidates = (candidates || [])
    .filter((candidate) => toCleanText((candidate as { id?: string }).id).endsWith(conversationKey))
    .map((candidate) => {
      const candidateId = toCleanText((candidate as { id?: string }).id);
      const candidateChatId = normalizeDirectChatId(toCleanText((candidate as { chat_id?: string }).chat_id));
      const candidateTo = normalizeDirectChatId(toCleanText((candidate as { to_number?: string | null }).to_number || ''));
      const candidateTimestamp =
        toEpochMillis(toCleanText((candidate as { timestamp?: string | null }).timestamp)) ||
        toEpochMillis(toCleanText((candidate as { created_at?: string | null }).created_at));

      let score = 0;
      if (canonicalRecipientChatId && candidateChatId === canonicalRecipientChatId) {
        score += 12;
      }

      if (canonicalRecipientChatId && candidateTo === canonicalRecipientChatId) {
        score += 8;
      }

      if (!Number.isNaN(statusTimestampMillis) && !Number.isNaN(candidateTimestamp)) {
        const diff = Math.abs(candidateTimestamp - statusTimestampMillis);
        if (diff <= 60_000) {
          score += 7;
        } else if (diff <= 5 * 60_000) {
          score += 5;
        } else if (diff <= 30 * 60_000) {
          score += 3;
        } else if (diff <= 6 * 60 * 60_000) {
          score += 1;
        }
      }

      return {
        id: candidateId,
        score,
        timestamp: candidateTimestamp,
      };
    })
    .filter((candidate) => candidate.id);

  rankedCandidates.sort((left, right) => {
    if (right.score !== left.score) return right.score - left.score;
    return (right.timestamp || 0) - (left.timestamp || 0);
  });

  const [best, secondBest] = rankedCandidates;
  if (!best || best.score < 6) {
    return { messageId: statusMessageId, strategy: 'status_id', confidence: 0 };
  }

  if (secondBest && best.score - secondBest.score < 2 && best.score < 12) {
    return { messageId: statusMessageId, strategy: 'status_id', confidence: 0 };
  }

  return {
    messageId: best.id,
    strategy: 'conversation_key',
    confidence: best.score,
  };
}

async function reconcileMessageChatFromStatus(
  status: WhapiStatus,
  messageIdOverride?: string | null,
): Promise<{ fromChatId: string; toChatId: string } | null> {
  const messageId = toCleanText(messageIdOverride) || toCleanText(status.id);
  if (!messageId) {
    return null;
  }

  const { data: existingMessage, error: fetchError } = await supabase
    .from('whatsapp_messages')
    .select('id, chat_id, direction, timestamp, created_at, to_number')
    .eq('id', messageId)
    .maybeSingle();

  if (fetchError) {
    console.warn('whatsapp-webhook: erro ao buscar mensagem para reconciliação de status', {
      messageId,
      error: fetchError.message,
    });
    return null;
  }

  if (!existingMessage || existingMessage.direction !== 'outbound') {
    return null;
  }

  const currentChatId = normalizeDirectChatId(toCleanText(existingMessage.chat_id));
  if (!currentChatId) {
    return null;
  }

  const targetChatId = await resolveCanonicalDirectChatIdFromStatusRecipient(
    status.recipient_id,
    currentChatId,
    messageId,
    existingMessage.timestamp || existingMessage.created_at || null,
  );

  if (!targetChatId) {
    return null;
  }

  const normalizedTargetChatId = normalizeDirectChatId(targetChatId);
  if (!normalizedTargetChatId || normalizedTargetChatId === currentChatId) {
    return null;
  }

  const targetType = getChatIdType(normalizedTargetChatId);
  if (targetType === 'unknown') {
    return null;
  }

  const { error: updateError } = await supabase
    .from('whatsapp_messages')
    .update({
      chat_id: normalizedTargetChatId,
      to_number: normalizedTargetChatId,
    })
    .eq('id', messageId);

  if (updateError) {
    console.warn('whatsapp-webhook: erro ao reconciliar chat da mensagem pelo status', {
      messageId,
      fromChatId: currentChatId,
      toChatId: normalizedTargetChatId,
      error: updateError.message,
    });
    return null;
  }

  const referenceTimestamp =
    existingMessage.timestamp || existingMessage.created_at || toIsoString(status.timestamp) || new Date().toISOString();

  await ensureStatusResolvedChatExists(normalizedTargetChatId, status.recipient_id, referenceTimestamp);
  await refreshChatLastMessageTimestamp(currentChatId);
  await refreshChatLastMessageTimestamp(normalizedTargetChatId);

  console.log('whatsapp-webhook: chat da mensagem reconciliado via status', {
    messageId,
    fromChatId: currentChatId,
    toChatId: normalizedTargetChatId,
    recipientId: status.recipient_id,
  });

  return {
    fromChatId: currentChatId,
    toChatId: normalizedTargetChatId,
  };
}

async function mergeChatMessages(fromChatId: string, toChatId: string) {
  console.log('whatsapp-webhook: mesclando mensagens de chats duplicados', {
    fromChatId,
    toChatId,
  });

  const { error: updateError } = await supabase
    .from('whatsapp_messages')
    .update({ chat_id: toChatId })
    .eq('chat_id', fromChatId);

  if (updateError) {
    console.error('whatsapp-webhook: erro ao mesclar mensagens', updateError);
    return;
  }

  const { error: deleteError } = await supabase
    .from('whatsapp_chats')
    .delete()
    .eq('id', fromChatId);

  if (deleteError) {
    console.error('whatsapp-webhook: erro ao deletar chat duplicado', deleteError);
  }
}

async function findLeadByPhone(phoneNumber: string): Promise<string | null> {
  const phoneVariants = buildPhoneLookupVariants(phoneNumber);
  if (phoneVariants.length === 0) {
    return null;
  }

  const { data, error } = await supabase
    .from('leads')
    .select('nome_completo, telefone')
    .in('telefone', phoneVariants)
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data.nome_completo;
}

function getValidChatName(value: string | null | undefined, chatId: string): string | null {
  const trimmed = value?.trim();
  if (!trimmed || trimmed === chatId) {
    return null;
  }
  return trimmed;
}

async function resolveChatName(message: NormalizedMessage): Promise<string> {
  const chatType = getChatIdType(message.chatId);

  if (message.isGroup || chatType === 'group') {
    const { data: existingGroup } = await supabase
      .from('whatsapp_groups')
      .select('name')
      .eq('id', message.chatId)
      .maybeSingle();

    const canonicalGroupName = getValidChatName(existingGroup?.name, message.chatId);
    if (canonicalGroupName) {
      return canonicalGroupName;
    }

    const messageGroupName = getValidChatName(message.chatName, message.chatId);
    if (messageGroupName) {
      return messageGroupName;
    }

    const { data: existingChat } = await supabase
      .from('whatsapp_chats')
      .select('name')
      .eq('id', message.chatId)
      .maybeSingle();

    const existingChatName = getValidChatName(existingChat?.name, message.chatId);
    if (existingChatName) {
      return existingChatName;
    }

    return message.chatId;
  }

  if (chatType === 'newsletter' || chatType === 'broadcast' || chatType === 'status') {
    if (chatType === 'status') {
      return 'Status';
    }

    const { data: existingChat } = await supabase
      .from('whatsapp_chats')
      .select('name')
      .eq('id', message.chatId)
      .maybeSingle();

    if (existingChat?.name) {
      return existingChat.name;
    }

    const channelName = message.chatName?.trim() || message.contactName?.trim();
    if (channelName && channelName !== message.chatId) {
      return channelName;
    }

    if (chatType === 'newsletter') {
      return 'Canal sem nome';
    }

    return 'Transmissao sem nome';
  }

  const phoneNumber = extractPhoneNumber(message.chatId);

  if (phoneNumber) {
    const leadName = await findLeadByPhone(phoneNumber);
    if (leadName) {
      console.log('whatsapp-webhook: nome do lead encontrado no CRM', {
        chatId: message.chatId,
        leadName,
      });
      return leadName;
    }
  }

  const { data: existingChat } = await supabase
    .from('whatsapp_chats')
    .select('name')
    .eq('id', message.chatId)
    .maybeSingle();

  if (existingChat?.name) {
    return existingChat.name;
  }

  if (message.direction === 'inbound' && message.contactName) {
    return message.contactName;
  }

  if (message.chatName?.trim() && message.chatName !== message.chatId) {
    return message.chatName;
  }

  return phoneNumber || message.chatId;
}

type UpsertChatOptions = {
  touchLastMessageAt?: boolean;
};

async function upsertChat(message: NormalizedMessage, options?: UpsertChatOptions) {
  const touchLastMessageAt = options?.touchLastMessageAt !== false;
  const nowIso = new Date().toISOString();

  let chatIdType = getChatIdType(message.chatId);
  let lid = chatIdType === 'lid' ? message.chatId : null;
  const chatPhone = extractPhoneNumber(message.chatId);
  const fromPhone = extractPhoneNumber(message.fromNumber || '');
  const toPhone = extractPhoneNumber(message.toNumber || '');
  const phoneNumber =
    chatIdType === 'phone'
      ? message.direction === 'inbound'
        ? fromPhone || chatPhone || toPhone
        : chatPhone || toPhone || fromPhone
      : fromPhone || toPhone || chatPhone;

  if (chatIdType === 'lid') {
    const { data: chatByLid, error: chatByLidError } = await supabase
      .from('whatsapp_chats')
      .select('id, last_message_at, lid')
      .eq('lid', message.chatId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (chatByLidError) {
      console.warn('whatsapp-webhook: erro ao buscar chat por LID', {
        lid: message.chatId,
        error: chatByLidError.message,
      });
    } else if (chatByLid?.id && chatByLid.id !== message.chatId) {
      message.chatId = chatByLid.id;
      chatIdType = getChatIdType(message.chatId);
      lid = chatByLid.lid || lid;
    }
  }

  const chatName = await resolveChatName(message);
  const isDirectChat = chatIdType === 'phone' || chatIdType === 'lid';

  console.log('whatsapp-webhook: upsert chat', {
    chatId: message.chatId,
    chatName,
    chatIdType,
    phoneNumber,
    lid,
    direction: message.direction,
    contactName: message.contactName,
    touchLastMessageAt,
  });

  const { data: existingChatById, error: existingChatError } = await supabase
    .from('whatsapp_chats')
    .select('id, lid, phone_number, last_message_at')
    .eq('id', message.chatId)
    .maybeSingle();

  if (existingChatError) {
    throw new Error(`Erro ao consultar chat existente: ${existingChatError.message}`);
  }

  if (phoneNumber && isDirectChat) {
    const existingChatId = await findExistingChatByPhone(phoneNumber, message.chatId);

    if (existingChatId) {
      const preferredChatId = choosePreferredDirectChatId(message.chatId, existingChatId, phoneNumber);
      const sourceChatId = preferredChatId === message.chatId ? existingChatId : message.chatId;

      console.log('whatsapp-webhook: chat existente encontrado para o mesmo telefone', {
        newChatId: sourceChatId,
        existingChatId,
        preferredChatId,
        phoneNumber,
      });

      await mergeChatMessages(sourceChatId, preferredChatId);

      const { data: existingChat } = await supabase
        .from('whatsapp_chats')
        .select('lid, last_message_at')
        .eq('id', preferredChatId)
        .maybeSingle();

      const incomingActivityAt = touchLastMessageAt ? message.timestamp ?? nowIso : null;
      const nextLastMessageAt =
        getLatestIsoTimestamp(existingChat?.last_message_at, incomingActivityAt) ?? existingChat?.last_message_at ?? nowIso;

      const updateData: Record<string, unknown> = {
        name: chatName,
        phone_number: phoneNumber,
        last_message_at: nextLastMessageAt,
        updated_at: nowIso,
      };

      if (lid && !existingChat?.lid) {
        updateData.lid = lid;
        console.log('whatsapp-webhook: vinculando LID ao chat existente', {
          chatId: preferredChatId,
          lid,
        });
      }

      const { error: updateError } = await supabase
        .from('whatsapp_chats')
        .update(updateData)
        .eq('id', preferredChatId);

      if (updateError) {
        throw new Error(`Erro ao atualizar chat existente: ${updateError.message}`);
      }

      message.chatId = preferredChatId;
      return;
    }
  }

  const incomingActivityAt = touchLastMessageAt ? message.timestamp ?? nowIso : null;
  const nextLastMessageAt =
    getLatestIsoTimestamp(existingChatById?.last_message_at, incomingActivityAt) ??
    existingChatById?.last_message_at ??
    message.timestamp ??
    nowIso;

  const { error } = await supabase.from('whatsapp_chats').upsert(
    {
      id: message.chatId,
      name: chatName,
      is_group: message.isGroup,
      phone_number: isDirectChat ? phoneNumber ?? existingChatById?.phone_number ?? null : null,
      lid: chatIdType === 'lid' ? lid : existingChatById?.lid ?? null,
      last_message_at: nextLastMessageAt,
      updated_at: nowIso,
    },
    { onConflict: 'id' },
  );

  if (error) {
    throw new Error(`Erro ao salvar chat: ${error.message}`);
  }

  if (chatIdType === 'group' && chatName && chatName !== message.chatId) {
    await supabase
      .from('whatsapp_groups')
      .update({ name: chatName, last_updated_at: nowIso })
      .eq('id', message.chatId);
  }
}

function mergeAckStatus(currentAck: number | null | undefined, incomingAck: number | null | undefined): number | null {
  if (incomingAck === null || incomingAck === undefined) {
    return typeof currentAck === 'number' ? currentAck : null;
  }

  if (typeof currentAck !== 'number') {
    return incomingAck;
  }

  if (incomingAck === 0) {
    return currentAck <= 1 ? 0 : currentAck;
  }

  if (currentAck === 0 && incomingAck > 0) {
    return incomingAck;
  }

  return Math.max(currentAck, incomingAck);
}

function mergeMessageTimestamp(
  currentTimestamp: string | null | undefined,
  incomingTimestamp: string | null | undefined,
  currentCreatedAt?: string | null | undefined,
): string | null {
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
}

async function upsertMessage(message: NormalizedMessage) {
  const { data: existingMessage, error: fetchError } = await supabase
    .from('whatsapp_messages')
    .select('id, body, timestamp, created_at, original_body, is_deleted, deleted_at, deleted_by, edit_count, edited_at, ack_status')
    .eq('id', message.messageId)
    .maybeSingle();

  if (fetchError) {
    throw new Error(`Erro ao consultar mensagem existente: ${fetchError.message}`);
  }

  const mergedAckStatus = mergeAckStatus(existingMessage?.ack_status, message.ackStatus);

  if (existingMessage?.id) {
    const { error: updateError } = await supabase
      .from('whatsapp_messages')
      .update({
        chat_id: message.chatId,
        from_number: message.fromNumber,
        to_number: message.toNumber,
        type: message.type,
        body: message.body ?? existingMessage.body,
        original_body: existingMessage.original_body ?? existingMessage.body ?? message.body,
        has_media: message.hasMedia,
        timestamp: mergeMessageTimestamp(existingMessage.timestamp, message.timestamp, existingMessage.created_at),
        payload: message.payload,
        direction: message.direction,
        author: message.author,
        ack_status: mergedAckStatus,
        is_deleted: Boolean(existingMessage.is_deleted),
        deleted_at: existingMessage.deleted_at ?? null,
        deleted_by: existingMessage.deleted_by ?? null,
        edit_count: existingMessage.edit_count ?? 0,
        edited_at: existingMessage.edited_at ?? null,
      })
      .eq('id', message.messageId);

    if (updateError) {
      throw new Error(`Erro ao atualizar mensagem existente: ${updateError.message}`);
    }

    return;
  }

  const { error: insertError } = await supabase.from('whatsapp_messages').insert({
    id: message.messageId,
    chat_id: message.chatId,
    from_number: message.fromNumber,
    to_number: message.toNumber,
    type: message.type,
    body: message.body,
    original_body: message.body,
    has_media: message.hasMedia,
    timestamp: message.timestamp,
    payload: message.payload,
    direction: message.direction,
    author: message.author,
    ack_status: mergedAckStatus,
    is_deleted: false,
    edit_count: 0,
    edited_at: null,
    deleted_at: null,
    deleted_by: null,
  });

  if (insertError) {
    throw new Error(`Erro ao salvar mensagem: ${insertError.message}`);
  }
}

async function updateMessageAck(messageId: string, ackStatus: number) {
  const { data: existingMessage, error: fetchError } = await supabase
    .from('whatsapp_messages')
    .select('ack_status')
    .eq('id', messageId)
    .maybeSingle();

  if (fetchError) {
    throw new Error(`Erro ao buscar ACK atual: ${fetchError.message}`);
  }

  const currentAck = typeof existingMessage?.ack_status === 'number' ? existingMessage.ack_status : null;
  const nextAck = mergeAckStatus(currentAck, ackStatus);

  if (nextAck === null || (currentAck !== null && currentAck === nextAck)) {
    return;
  }

  console.log('whatsapp-webhook: atualizando ack da mensagem', {
    messageId,
    ackStatus: nextAck,
    ackLabel: getAckLabel(nextAck),
    previousAck: currentAck,
  });

  const { error } = await supabase
    .from('whatsapp_messages')
    .update({ ack_status: nextAck })
    .eq('id', messageId);

  if (error) {
    throw new Error(`Erro ao atualizar ACK da mensagem: ${error.message}`);
  }
}

function getAckLabel(ack: number): string {
  const labels: Record<number, string> = {
    0: 'falhou',
    1: 'pendente',
    2: 'enviado',
    3: 'entregue',
    4: 'lido',
  };
  return labels[ack] || 'desconhecido';
}

async function processMessageEdit(message: WhapiMessage, normalized: NormalizedMessage) {
  console.log('whatsapp-webhook: processando edição de mensagem', {
    messageId: message.id,
    chatId: message.chat_id,
    editedAt: message.edited_at,
  });

  const { data: existingMessage, error: fetchError } = await supabase
    .from('whatsapp_messages')
    .select('body, original_body, edit_count, edited_at, payload')
    .eq('id', message.id)
    .maybeSingle();

  if (fetchError) {
    console.error('whatsapp-webhook: erro ao buscar mensagem existente', fetchError);
    return;
  }

  if (!existingMessage) {
    console.log('whatsapp-webhook: mensagem não existe ainda, salvando como nova');
    await upsertMessage(normalized);
    return;
  }

  const oldBody = existingMessage.body;
  const newBody = normalized.body;
  const incomingEditedAtIso = message.edited_at ? toIsoString(message.edited_at) : null;
  const hasBodyChanged = (oldBody ?? '') !== (newBody ?? '');
  const hasEditedAtChanged = Boolean(incomingEditedAtIso && incomingEditedAtIso !== existingMessage.edited_at);

  if (!hasBodyChanged && !hasEditedAtChanged) {
    console.log('whatsapp-webhook: atualização de edição ignorada (idempotente)', {
      messageId: message.id,
    });
    return;
  }

  const editCount = hasBodyChanged ? (existingMessage.edit_count || 0) + 1 : existingMessage.edit_count || 0;
  const originalBody = existingMessage.original_body || existingMessage.body;

  const { error: updateError } = await supabase
    .from('whatsapp_messages')
    .update({
      body: newBody,
      original_body: originalBody,
      edit_count: editCount,
      edited_at: incomingEditedAtIso || new Date().toISOString(),
      payload: normalized.payload,
    })
    .eq('id', message.id);

  if (updateError) {
    console.error('whatsapp-webhook: erro ao atualizar mensagem editada', updateError);
    return;
  }

  console.log('whatsapp-webhook: mensagem editada com sucesso', {
    messageId: message.id,
    editCount,
    oldBodyLength: oldBody?.length || 0,
    newBodyLength: newBody?.length || 0,
  });
}

async function processMessageDeleteById(
  targetMessageId: string,
  options?: { deletedBy?: string | null; deleteEvent?: unknown; eventId?: string | null },
) {
  const normalizedTargetMessageId = toCleanText(targetMessageId);
  if (!normalizedTargetMessageId) {
    return;
  }

  const { data: existingMessage, error: fetchError } = await supabase
    .from('whatsapp_messages')
    .select('payload')
    .eq('id', normalizedTargetMessageId)
    .maybeSingle();

  if (fetchError) {
    console.error('whatsapp-webhook: erro ao buscar mensagem para deletar', fetchError);
    return;
  }

  if (!existingMessage) {
    console.log('whatsapp-webhook: mensagem não encontrada para deleção', {
      messageId: normalizedTargetMessageId,
      eventId: options?.eventId || null,
    });
    return;
  }

  const deletedBy = toCleanText(options?.deletedBy) || 'unknown';
  const deleteEvent = options?.deleteEvent;

  const { error: updateError } = await supabase
    .from('whatsapp_messages')
    .update({
      is_deleted: true,
      deleted_at: new Date().toISOString(),
      deleted_by: deletedBy,
      payload: {
        ...(existingMessage?.payload && typeof existingMessage.payload === 'object' ? existingMessage.payload : {}),
        ...(deleteEvent ? { delete_event: JSON.parse(JSON.stringify(deleteEvent)) } : {}),
      },
    })
    .eq('id', normalizedTargetMessageId);

  if (updateError) {
    console.error('whatsapp-webhook: erro ao marcar mensagem como deletada', updateError);
    return;
  }

  console.log('whatsapp-webhook: mensagem marcada como deletada', {
    messageId: normalizedTargetMessageId,
    eventId: options?.eventId || null,
    deletedBy,
  });
}

async function processMessageDelete(message: WhapiMessage) {
  const targetMessageId = message.action?.target || message.id;

  console.log('whatsapp-webhook: processando deleção de mensagem', {
    messageId: targetMessageId,
    eventId: message.id,
    chatId: message.chat_id,
  });

  const deletedBy = message.from_me ? 'outbound_user' : message.from || 'unknown';
  await processMessageDeleteById(targetMessageId, {
    deletedBy,
    deleteEvent: message,
    eventId: message.id,
  });
}

async function resolveReactionTargetChatId(message: WhapiMessage): Promise<string | null> {
  if (normalizeActionType(message.action?.type) !== 'reaction') return null;

  const targetMessageId = message.action?.target?.trim();
  if (!targetMessageId) return null;

  const { data: targetMessage, error } = await supabase
    .from('whatsapp_messages')
    .select('chat_id')
    .eq('id', targetMessageId)
    .maybeSingle();

  if (error) {
    console.error('whatsapp-webhook: erro ao resolver chat de reacao pelo alvo', {
      targetMessageId,
      error: error.message,
    });
    return null;
  }

  const targetChatId =
    typeof targetMessage?.chat_id === 'string' && targetMessage.chat_id.trim()
      ? targetMessage.chat_id.trim()
      : null;

  return targetChatId;
}

type ProcessWhapiMessageOptions = {
  sourceEvent?: string;
  statusRecipientId?: string | null;
  touchLastMessageAt?: boolean;
  allowProvisionalResolution?: boolean;
};

type ProcessWhapiMessageResult = {
  processed: boolean;
  reason?: string;
  messageId: string;
  chatId: string | null;
  direction?: 'inbound' | 'outbound';
};

async function processWhapiMessage(message: WhapiMessage, options?: ProcessWhapiMessageOptions): Promise<ProcessWhapiMessageResult> {
  const messageType = toCleanText(message.type).toLowerCase();
  const actionType = normalizeActionType(message.action?.type);
  const isDeleted = actionType === 'delete' || messageType === 'revoked';
  const isEditAction = messageType === 'action' && (actionType === 'edit' || actionType === 'edited');

  if (isEditAction) {
    return {
      processed: false,
      reason: 'edit_action_ignored',
      messageId: toCleanText(message.id),
      chatId: toCleanText(message.chat_id) || null,
    };
  }

  if (isDeleted) {
    await processMessageDelete(message);
    return {
      processed: true,
      reason: 'deleted_message_processed',
      messageId: toCleanText(message.id),
      chatId: toCleanText(message.chat_id) || null,
    };
  }

  const provisionalMessage = isLikelyProvisionalWhapiMessage(message);
  const canResolveProvisional = options?.allowProvisionalResolution !== false;
  if (canResolveProvisional && provisionalMessage) {
    const fetchedMessage = await fetchWhapiMessageById(message.id);
    if (fetchedMessage && shouldReplaceProvisionalMessageWithFetched(message, fetchedMessage)) {
      console.log('whatsapp-webhook: mensagem provisoria substituida por payload completo', {
        messageId: message.id,
        sourceEvent: options?.sourceEvent || null,
        provisionalType: message.type,
        provisionalSubtype: message.subtype || null,
        fetchedType: fetchedMessage.type,
      });

      return processWhapiMessage(fetchedMessage, {
        ...options,
        sourceEvent: `${options?.sourceEvent || 'unknown'}.provisional_refresh`,
        allowProvisionalResolution: false,
        touchLastMessageAt: true,
      });
    }
  }

  if (provisionalMessage) {
    console.log('whatsapp-webhook: mensagem provisoria ignorada para timeline', {
      messageId: message.id,
      sourceEvent: options?.sourceEvent || null,
      type: message.type,
      subtype: message.subtype || null,
      source: message.source || null,
    });

    return {
      processed: false,
      reason: 'provisional_message_ignored',
      messageId: toCleanText(message.id),
      chatId: toCleanText(message.chat_id) || null,
      direction: message.from_me ? 'outbound' : 'inbound',
    };
  }

  const normalized = normalizeWhapiMessage(message);
  const isReactionAction = actionType === 'reaction';

  if (isReactionAction) {
    const targetChatId = await resolveReactionTargetChatId(message);

    if (!targetChatId) {
      console.warn('whatsapp-webhook: reacao ignorada por nao localizar mensagem alvo', {
        reactionMessageId: message.id,
        targetMessageId: message.action?.target,
        incomingChatId: normalized.chatId,
        sourceEvent: options?.sourceEvent || null,
      });

      return {
        processed: false,
        reason: 'reaction_target_not_found',
        messageId: normalized.messageId,
        chatId: normalized.chatId,
        direction: normalized.direction,
      };
    }

    if (targetChatId !== normalized.chatId) {
      const originalChatId = normalized.chatId;
      const resolvedTargetChatId = normalizeDirectChatId(targetChatId);
      normalized.chatId = resolvedTargetChatId;
      normalized.isGroup = resolvedTargetChatId.endsWith('@g.us');

      if (normalized.direction === 'outbound') {
        normalized.toNumber = resolvedTargetChatId;
      }

      if (normalized.direction === 'inbound' && (!normalized.fromNumber || normalized.fromNumber === originalChatId)) {
        normalized.fromNumber = normalizeMaybeDirectId(message.from) || resolvedTargetChatId;
      }

      console.log('whatsapp-webhook: chat da reacao corrigido com base na mensagem alvo', {
        reactionMessageId: message.id,
        targetMessageId: message.action?.target,
        originalChatId,
        resolvedChatId: resolvedTargetChatId,
        sourceEvent: options?.sourceEvent || null,
      });
    }
  }

  if (!isReactionAction) {
    let resolvedOutboundChatId: string | null = null;

    if (normalized.direction === 'outbound' && options?.statusRecipientId) {
      resolvedOutboundChatId = await resolveCanonicalDirectChatIdFromStatusRecipient(
        options.statusRecipientId,
        normalized.chatId,
        normalized.messageId,
        normalized.timestamp,
      );
    }

    if (!resolvedOutboundChatId) {
      resolvedOutboundChatId = await resolveOutboundCanonicalDirectChatIdFromMessage(message, normalized);
    }

    if (resolvedOutboundChatId && resolvedOutboundChatId !== normalized.chatId) {
      const originalChatId = normalized.chatId;
      normalized.chatId = normalizeDirectChatId(resolvedOutboundChatId);
      normalized.isGroup = getChatIdType(normalized.chatId) === 'group';
      if (normalized.direction === 'outbound') {
        normalized.toNumber = normalized.chatId;
      }

      console.log('whatsapp-webhook: chat outbound corrigido por reconciliacao', {
        messageId: normalized.messageId,
        originalChatId,
        resolvedChatId: normalized.chatId,
        source: message.source,
        sourceEvent: options?.sourceEvent || null,
        recipientId: options?.statusRecipientId || null,
      });
    }
  }

  const shouldTouchLastMessageAt =
    typeof options?.touchLastMessageAt === 'boolean'
      ? options.touchLastMessageAt
      : !isReactionAction && !['system'].includes(messageType);

  await upsertChat(normalized, { touchLastMessageAt: shouldTouchLastMessageAt });
  await upsertMessage(normalized);

  return {
    processed: true,
    messageId: normalized.messageId,
    chatId: normalized.chatId,
    direction: normalized.direction,
  };
}

function toWhapiMessageFromChatUpdate(update: WhapiChatUpdate): WhapiMessage | null {
  const fallbackChatId =
    normalizeDirectChatId(toCleanText(update.after_update?.id || update.after_update?.chat_id || update.before_update?.id || update.before_update?.chat_id || update.chat?.id || update.chat?.chat_id || '')) ||
    null;

  const rawCandidate = update.after_update?.last_message || update.chat?.last_message || update.last_message;
  if (!rawCandidate || typeof rawCandidate !== 'object') {
    return null;
  }

  const candidate = rawCandidate as WhapiMessage;
  const messageId = toCleanText(candidate.id);
  const messageType = toCleanText(candidate.type);
  const chatId = normalizeDirectChatId(toCleanText(candidate.chat_id || fallbackChatId || ''));
  if (!messageId || !messageType || !chatId) {
    return null;
  }

  let inferredFromMe = candidate.from_me;
  if (typeof inferredFromMe !== 'boolean') {
    const normalizedFrom = normalizeMaybeDirectId(candidate.from);
    const chatType = getChatIdType(chatId);
    if (chatType === 'phone' && normalizedFrom && getChatIdType(normalizedFrom) === 'phone') {
      inferredFromMe = normalizeDirectChatId(normalizedFrom) !== chatId;
    } else {
      inferredFromMe = false;
    }
  }

  return {
    ...candidate,
    id: messageId,
    type: messageType,
    chat_id: chatId,
    from_me: inferredFromMe,
    timestamp: candidate.timestamp ?? null,
  };
}

function resolveChatUpdateChatId(update: WhapiChatUpdate): string | null {
  return normalizeDirectChatId(
    toCleanText(
      update.after_update?.id ||
      update.after_update?.chat_id ||
      update.before_update?.id ||
      update.before_update?.chat_id ||
      update.chat?.id ||
      update.chat?.chat_id ||
      '',
    ),
  ) || null;
}

function extractChatUpdateLastMessageId(update: WhapiChatUpdate): string | null {
  const rawCandidate = update.after_update?.last_message || update.chat?.last_message || update.last_message;
  if (!rawCandidate || typeof rawCandidate !== 'object') {
    return null;
  }

  return toCleanText((rawCandidate as { id?: string }).id) || null;
}

async function touchChatFromChatUpdate(update: WhapiChatUpdate) {
  const chatId = resolveChatUpdateChatId(update);
  if (!chatId) {
    return null;
  }

  const rawCandidate = update.after_update?.last_message || update.chat?.last_message || update.last_message;
  const referenceTimestamp = rawCandidate && typeof rawCandidate === 'object'
    ? toIsoString((rawCandidate as { timestamp?: unknown }).timestamp)
    : null;
  const nowIso = new Date().toISOString();
  const chatType = getChatIdType(chatId);
  const isDirectChat = chatType === 'phone' || chatType === 'lid';
  const phoneNumber = isDirectChat ? extractPhoneNumber(chatId) : null;
  const lid = chatType === 'lid' ? chatId : null;

  const { data: existingChat, error: existingChatError } = await supabase
    .from('whatsapp_chats')
    .select('id, name, is_group, phone_number, lid, last_message_at')
    .eq('id', chatId)
    .maybeSingle();

  if (existingChatError) {
    console.warn('whatsapp-webhook: erro ao tocar chat via chats.patch', {
      chatId,
      error: existingChatError.message,
    });
    return null;
  }

  const nextLastMessageAt =
    getLatestIsoTimestamp(existingChat?.last_message_at ?? null, referenceTimestamp, nowIso) ??
    existingChat?.last_message_at ??
    referenceTimestamp ??
    nowIso;

  const fallbackName =
    chatType === 'status'
      ? 'Status'
      : chatType === 'newsletter'
        ? 'Canal sem nome'
        : chatType === 'broadcast'
          ? 'Transmissao sem nome'
          : phoneNumber || chatId;

  const { error: upsertError } = await supabase.from('whatsapp_chats').upsert(
    {
      id: chatId,
      name: existingChat?.name ?? fallbackName,
      is_group: existingChat?.is_group ?? chatType === 'group',
      phone_number: isDirectChat ? phoneNumber ?? existingChat?.phone_number ?? null : null,
      lid: chatType === 'lid' ? lid : existingChat?.lid ?? null,
      last_message_at: nextLastMessageAt,
      updated_at: nowIso,
    },
    { onConflict: 'id' },
  );

  if (upsertError) {
    console.warn('whatsapp-webhook: erro ao atualizar atividade do chat via chats.patch', {
      chatId,
      error: upsertError.message,
    });
    return null;
  }

  return { chatId, lastMessageAt: nextLastMessageAt };
}

type EnsureStatusMessageResult = {
  ensured: boolean;
  source: 'existing' | 'existing_provisional' | 'fetched' | 'not_found' | 'failed';
  messageId: string;
};

async function ensureMessageMaterializedFromStatus(
  status: WhapiStatus,
  messageIdHint?: string | null,
): Promise<EnsureStatusMessageResult> {
  const messageId = toCleanText(status.id);
  if (!messageId) {
    return { ensured: false, source: 'failed', messageId: '' };
  }

  const hintedMessageId = toCleanText(messageIdHint);

  type ExistingStatusMessageSnapshot = {
    id: string;
    type: string | null;
    body: string | null;
    payload: unknown;
  };

  let existingMessage: ExistingStatusMessageSnapshot | null = null;

  if (hintedMessageId && hintedMessageId !== messageId) {
    const { data: hintedMessage, error: hintedMessageError } = await supabase
      .from('whatsapp_messages')
      .select('id, type, body, payload')
      .eq('id', hintedMessageId)
      .maybeSingle();

    if (hintedMessageError) {
      console.warn('whatsapp-webhook: erro ao validar mensagem sugerida para status', {
        statusId: messageId,
        hintedMessageId,
        error: hintedMessageError.message,
      });
    } else if (hintedMessage) {
      existingMessage = hintedMessage as ExistingStatusMessageSnapshot;
    }
  }

  if (!existingMessage) {
    const { data: exactMessage, error: exactMessageError } = await supabase
      .from('whatsapp_messages')
      .select('id, type, body, payload')
      .eq('id', messageId)
      .maybeSingle();

    if (exactMessageError) {
      console.warn('whatsapp-webhook: erro ao verificar existencia da mensagem para status', {
        messageId,
        error: exactMessageError.message,
      });
      return { ensured: false, source: 'failed', messageId };
    }

    existingMessage = exactMessage as ExistingStatusMessageSnapshot;
  }

  const existingMessageId = existingMessage ? toCleanText(existingMessage.id) : '';

  const existingIsProvisional = existingMessage
    ? isLikelyProvisionalStoredMessage({
      type: existingMessage.type,
      body: existingMessage.body,
      payload: existingMessage.payload,
    })
    : false;

  if (existingMessageId && !existingIsProvisional) {
    return { ensured: true, source: 'existing', messageId: existingMessageId };
  }

  const fetchedMessage = await fetchWhapiMessageById(messageId);
  if (!fetchedMessage) {
    if (existingMessageId && existingIsProvisional) {
      return { ensured: true, source: 'existing_provisional', messageId: existingMessageId };
    }
    return { ensured: false, source: 'not_found', messageId };
  }

  const processed = await processWhapiMessage(fetchedMessage, {
    sourceEvent: 'statuses.fetch',
    statusRecipientId: status.recipient_id,
    touchLastMessageAt: true,
    allowProvisionalResolution: false,
  });

  if (!processed.processed) {
    if (existingMessageId && existingIsProvisional) {
      return { ensured: true, source: 'existing_provisional', messageId: existingMessageId };
    }
    return { ensured: false, source: 'failed', messageId };
  }

  console.log('whatsapp-webhook: mensagem materializada via statuses.post', {
    messageId,
    recipientId: status.recipient_id,
    chatId: processed.chatId,
    direction: processed.direction || null,
  });

  return { ensured: true, source: 'fetched', messageId: processed.messageId || messageId };
}

async function processGroupCreation(group: WhapiGroup) {
  console.log('whatsapp-webhook: processando criação de grupo', {
    groupId: group.id,
    groupName: group.name,
    participantsCount: group.participants.length,
  });

  const { error: groupError } = await supabase.from('whatsapp_groups').upsert(
    {
      id: group.id,
      name: group.name,
      type: group.type,
      chat_pic: group.chat_pic || null,
      chat_pic_full: group.chat_pic_full || null,
      created_at: toIsoString(group.created_at) || new Date().toISOString(),
      created_by: group.created_by,
      name_at: group.name_at ? toIsoString(group.name_at) : null,
      admin_add_member_mode: group.adminAddMemberMode ?? true,
      first_seen_at: new Date().toISOString(),
      last_updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' },
  );

  if (groupError) {
    throw new Error(`Erro ao salvar grupo: ${groupError.message}`);
  }

  for (const participant of group.participants) {
    const { error: participantError } = await supabase.from('whatsapp_group_participants').upsert(
      {
        group_id: group.id,
        phone: participant.id,
        rank: participant.rank,
        joined_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'group_id,phone' },
    );

    if (participantError) {
      console.error('whatsapp-webhook: erro ao salvar participante', {
        groupId: group.id,
        phone: participant.id,
        error: participantError.message,
      });
    }
  }

  const { error: eventError } = await supabase.from('whatsapp_group_events').insert({
    group_id: group.id,
    event_type: 'created',
    participants: group.participants.map((p) => p.id),
    triggered_by: group.created_by,
    occurred_at: toIsoString(group.created_at) || new Date().toISOString(),
    created_at: new Date().toISOString(),
  });

  if (eventError) {
    console.error('whatsapp-webhook: erro ao salvar evento de criação do grupo', eventError.message);
  }

  await supabase.from('whatsapp_chats').upsert(
    {
      id: group.id,
      name: group.name,
      is_group: true,
      phone_number: null,
      lid: null,
      last_message_at: toIsoString(group.created_at) || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' },
  );
}

async function processGroupParticipantChange(change: WhapiGroupParticipants) {
  console.log('whatsapp-webhook: processando mudança de participantes', {
    groupId: change.group_id,
    action: change.action,
    participantsCount: change.participants.length,
  });

  const eventTypeMap: Record<string, string> = {
    add: 'participant_added',
    remove: 'participant_removed',
    promote: 'participant_promoted',
    demote: 'participant_demoted',
    request: 'join_request',
  };

  const eventType = eventTypeMap[change.action] || change.action;

  if (change.action === 'add') {
    for (const phone of change.participants) {
      const { error } = await supabase.from('whatsapp_group_participants').upsert(
        {
          group_id: change.group_id,
          phone,
          rank: 'member',
          joined_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'group_id,phone' },
      );

      if (error) {
        console.error('whatsapp-webhook: erro ao adicionar participante', {
          groupId: change.group_id,
          phone,
          error: error.message,
        });
      }
    }
  } else if (change.action === 'remove') {
    for (const phone of change.participants) {
      const { error } = await supabase
        .from('whatsapp_group_participants')
        .delete()
        .eq('group_id', change.group_id)
        .eq('phone', phone);

      if (error) {
        console.error('whatsapp-webhook: erro ao remover participante', {
          groupId: change.group_id,
          phone,
          error: error.message,
        });
      }
    }
  } else if (change.action === 'promote') {
    for (const phone of change.participants) {
      const { error } = await supabase
        .from('whatsapp_group_participants')
        .update({ rank: 'admin', updated_at: new Date().toISOString() })
        .eq('group_id', change.group_id)
        .eq('phone', phone);

      if (error) {
        console.error('whatsapp-webhook: erro ao promover participante', {
          groupId: change.group_id,
          phone,
          error: error.message,
        });
      }
    }
  } else if (change.action === 'demote') {
    for (const phone of change.participants) {
      const { error } = await supabase
        .from('whatsapp_group_participants')
        .update({ rank: 'member', updated_at: new Date().toISOString() })
        .eq('group_id', change.group_id)
        .eq('phone', phone);

      if (error) {
        console.error('whatsapp-webhook: erro ao rebaixar participante', {
          groupId: change.group_id,
          phone,
          error: error.message,
        });
      }
    }
  }

  const { error: eventError } = await supabase.from('whatsapp_group_events').insert({
    group_id: change.group_id,
    event_type: eventType,
    participants: change.participants,
    occurred_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  });

  if (eventError) {
    console.error('whatsapp-webhook: erro ao salvar evento de participante', eventError.message);
  }
}

async function processGroupUpdate(update: WhapiGroupUpdate) {
  console.log('whatsapp-webhook: processando atualização de grupo', {
    groupId: update.after_update.id,
    changes: update.changes,
  });

  const updateData: Record<string, unknown> = {
    last_updated_at: new Date().toISOString(),
  };

  let eventType: string | null = null;
  let oldValue: string | null = null;
  let newValue: string | null = null;

  for (const change of update.changes) {
    if (change === 'name') {
      updateData.name = update.after_update.name;
      updateData.name_at = update.after_update.name_at
        ? toIsoString(update.after_update.name_at)
        : new Date().toISOString();
      eventType = 'name_changed';
      oldValue = update.before_update.name;
      newValue = update.after_update.name;
    } else if (change === 'chat_pic' || change === 'chat_pic_full') {
      updateData.chat_pic = update.after_update.chat_pic || null;
      updateData.chat_pic_full = update.after_update.chat_pic_full || null;
      if (!eventType) {
        eventType = 'picture_changed';
        oldValue = update.before_update.chat_pic || 'sem foto';
        newValue = update.after_update.chat_pic || 'sem foto';
      }
    }
  }

  const { error: groupError } = await supabase
    .from('whatsapp_groups')
    .update(updateData)
    .eq('id', update.after_update.id);

  if (groupError) {
    throw new Error(`Erro ao atualizar grupo: ${groupError.message}`);
  }

  if (eventType && updateData.name) {
    await supabase
      .from('whatsapp_chats')
      .update({ name: updateData.name, updated_at: new Date().toISOString() })
      .eq('id', update.after_update.id);
  }

  if (eventType) {
    const { error: eventError } = await supabase.from('whatsapp_group_events').insert({
      group_id: update.after_update.id,
      event_type: eventType,
      old_value: oldValue,
      new_value: newValue,
      occurred_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    });

    if (eventError) {
      console.error('whatsapp-webhook: erro ao salvar evento de atualização do grupo', eventError.message);
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST' && req.method !== 'PATCH' && req.method !== 'PUT' && req.method !== 'DELETE') {
    return respond({ error: 'Method not allowed' }, { status: 405 });
  }

  let payload: WhapiWebhook;
  let rawBody = '';

  try {
    rawBody = await req.text();
  } catch (error) {
    console.error('whatsapp-webhook: erro ao ler corpo da requisição', error);
    return respond({ error: 'Payload inválido' }, { status: 400 });
  }

  if (!rawBody.trim()) {
    return respond({ error: 'Payload vazio' }, { status: 400 });
  }

  const verification = await verifyWebhookRequest(req, rawBody);
  if (!verification.ok) {
    console.warn('whatsapp-webhook: requisição rejeitada por falha de autenticação', {
      status: verification.status,
      reason: verification.error,
    });
    return respond({ error: verification.error }, { status: verification.status });
  }

  try {
    payload = JSON.parse(rawBody) as WhapiWebhook;
  } catch (error) {
    console.error('whatsapp-webhook: erro ao converter payload para JSON', error);
    return respond({ error: 'Payload inválido' }, { status: 400 });
  }

  const headers = extractHeaders(req.headers);
  const eventName = extractEventName(payload, req.headers);

  console.log('whatsapp-webhook: evento Whapi recebido', {
    eventName,
    channelId: payload.channel_id,
    messagesCount: payload.messages?.length || 0,
    eventType: payload.event?.type,
    eventAction: payload.event?.event,
  });

  try {
    await storeEvent({ event: eventName, payload: payload as unknown as Record<string, unknown>, headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('whatsapp-webhook: erro ao salvar evento', message, { eventName, payload });
  }

  if (Array.isArray(payload.messages)) {
    for (const message of payload.messages) {
      try {
        const processedMessage = await processWhapiMessage(message, {
          sourceEvent: eventName,
        });

        if (!processedMessage.processed && processedMessage.reason === 'edit_action_ignored') {
          console.log('whatsapp-webhook: ignorando ação de edição (será processada via messages_updates)', {
            actionId: message.id,
            targetId: message.action?.target,
          });
        }
      } catch (error) {
        const message_error = error instanceof Error ? error.message : 'Erro desconhecido';
        console.error('whatsapp-webhook: erro ao processar mensagem', message_error, { messageId: message.id });
      }
    }
  }

  if (Array.isArray(payload.messages_updates)) {
    for (const update of payload.messages_updates) {
      try {
        console.log('whatsapp-webhook: processando atualização de mensagem', {
          messageId: update.id,
          changes: update.changes,
        });

        const normalized = normalizeWhapiMessage(update.after_update);
        await upsertChat(normalized, { touchLastMessageAt: false });
        await processMessageEdit(update.after_update, normalized);
      } catch (error) {
        const update_error = error instanceof Error ? error.message : 'Erro desconhecido';
        console.error('whatsapp-webhook: erro ao processar atualização de mensagem', update_error, { messageId: update.id });
      }
    }
  }

  if (Array.isArray(payload.messages_removed)) {
    for (const removed of payload.messages_removed) {
      const removedMessageId =
        typeof removed === 'string'
          ? toCleanText(removed)
          : toCleanText(removed.id || removed.message_id);

      if (!removedMessageId) {
        continue;
      }

      await processMessageDeleteById(removedMessageId, {
        deletedBy: 'messages_removed_event',
        deleteEvent: removed,
        eventId: removedMessageId,
      });
    }
  }

  if (typeof payload.messages_removed_all === 'string' && payload.messages_removed_all.trim()) {
    console.log('whatsapp-webhook: evento messages_removed_all recebido', {
      chatId: payload.messages_removed_all,
      note: 'evento registrado para auditoria; sem deleção em massa automática',
    });
  }

  if (Array.isArray(payload.chats_updates)) {
    for (const update of payload.chats_updates) {
      try {
        const changedFields = Array.isArray(update.changes) ? update.changes : [];
        if (changedFields.length > 0 && !changedFields.includes('last_message')) {
          continue;
        }

        const touchedChat = await touchChatFromChatUpdate(update);
        const chatUpdateLastMessageId = extractChatUpdateLastMessageId(update);

        const chatUpdateMessage = toWhapiMessageFromChatUpdate(update);
        if (chatUpdateMessage) {
          const processedFromChatPatch = await processWhapiMessage(chatUpdateMessage, {
            sourceEvent: 'chats.patch',
          });

          if (processedFromChatPatch.processed) {
            console.log('whatsapp-webhook: mensagem processada via chats.patch', {
              messageId: processedFromChatPatch.messageId,
              chatId: processedFromChatPatch.chatId,
            });
            continue;
          }
        }

        if (chatUpdateLastMessageId) {
          const fetchedMessage = await fetchWhapiMessageById(chatUpdateLastMessageId);
          if (fetchedMessage) {
            const processedFetchedMessage = await processWhapiMessage(fetchedMessage, {
              sourceEvent: 'chats.patch.fetch',
              touchLastMessageAt: true,
              allowProvisionalResolution: false,
            });

            if (processedFetchedMessage.processed) {
              console.log('whatsapp-webhook: mensagem materializada via chats.patch.fetch', {
                messageId: processedFetchedMessage.messageId,
                chatId: processedFetchedMessage.chatId,
              });
              continue;
            }
          }
        }

        if (touchedChat) {
          console.log('whatsapp-webhook: atividade de chat registrada via chats.patch', {
            chatId: touchedChat.chatId,
            lastMessageAt: touchedChat.lastMessageAt,
            lastMessageId: chatUpdateLastMessageId,
          });
        }
      } catch (error) {
        const chat_update_error = error instanceof Error ? error.message : 'Erro desconhecido';
        console.error('whatsapp-webhook: erro ao processar chats.patch', chat_update_error, {
          chatId: update.after_update?.id || update.before_update?.id || null,
        });
      }
    }
  }

  if (Array.isArray(payload.statuses)) {
    for (const status of payload.statuses) {
      try {
        const statusMessageResolution = await resolveStatusMessageId(status);
        const ackTargetMessageId =
          toCleanText(statusMessageResolution.messageId) ||
          toCleanText(status.id);

        const ackStatus = resolveStatusAck(status.status, status.code);
        const materialized = await ensureMessageMaterializedFromStatus(status, ackTargetMessageId);
        const reconciled = await reconcileMessageChatFromStatus(status, ackTargetMessageId);
        const siblingReconciledCount = reconciled
          ? await reconcileSiblingOutboundMessagesByConversationKey({
            messageId: ackTargetMessageId,
            targetChatId: reconciled.toChatId,
            referenceIso: toIsoString(status.timestamp),
          })
          : 0;

        if (ackStatus !== null && ackTargetMessageId) {
          await updateMessageAck(ackTargetMessageId, ackStatus);
        }

        console.log('whatsapp-webhook: status de mensagem atualizado', {
          statusId: status.id,
          messageId: ackTargetMessageId,
          ackTargetStrategy: statusMessageResolution.strategy,
          ackTargetConfidence: statusMessageResolution.confidence,
          status: status.status,
          code: status.code,
          ackStatus,
          recipientId: status.recipient_id,
          materializedSource: materialized.source,
          materialized: materialized.ensured,
          reconciledFromChatId: reconciled?.fromChatId || null,
          reconciledToChatId: reconciled?.toChatId || null,
          siblingReconciledCount,
        });
      } catch (error) {
        const status_error = error instanceof Error ? error.message : 'Erro desconhecido';
        console.error('whatsapp-webhook: erro ao processar status', status_error, { statusId: status.id });
      }
    }
  }

  if (Array.isArray(payload.groups)) {
    for (const group of payload.groups) {
      try {
        await processGroupCreation(group);
        console.log('whatsapp-webhook: grupo criado/atualizado', {
          groupId: group.id,
          groupName: group.name,
        });
      } catch (error) {
        const group_error = error instanceof Error ? error.message : 'Erro desconhecido';
        console.error('whatsapp-webhook: erro ao processar grupo', group_error, { groupId: group.id });
      }
    }
  }

  if (Array.isArray(payload.groups_participants)) {
    for (const change of payload.groups_participants) {
      try {
        await processGroupParticipantChange(change);
        console.log('whatsapp-webhook: participantes do grupo atualizados', {
          groupId: change.group_id,
          action: change.action,
          participants: change.participants,
        });
      } catch (error) {
        const participant_error = error instanceof Error ? error.message : 'Erro desconhecido';
        console.error('whatsapp-webhook: erro ao processar participantes', participant_error, {
          groupId: change.group_id,
        });
      }
    }
  }

  if (Array.isArray(payload.groups_updates)) {
    for (const update of payload.groups_updates) {
      try {
        await processGroupUpdate(update);
        console.log('whatsapp-webhook: grupo atualizado', {
          groupId: update.after_update.id,
          changes: update.changes,
        });
      } catch (error) {
        const update_error = error instanceof Error ? error.message : 'Erro desconhecido';
        console.error('whatsapp-webhook: erro ao processar atualização de grupo', update_error, {
          groupId: update.after_update.id,
        });
      }
    }
  }

  const processed =
    (payload.messages?.length || 0) +
    (payload.messages_updates?.length || 0) +
    (payload.messages_removed?.length || 0) +
    (payload.messages_removed_all ? 1 : 0) +
    (payload.chats_updates?.length || 0) +
    (payload.statuses?.length || 0) +
    (payload.groups?.length || 0) +
    (payload.groups_participants?.length || 0) +
    (payload.groups_updates?.length || 0);
  return respond({ success: true, event: eventName, processed });
});
