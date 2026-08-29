import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.57.4';

// Antes '*': qualquer origem podia ler a resposta dessas Edge Functions no
// navegador. Restrito à origem conhecida do CRM (configurável via env para
// permitir staging/local sem precisar editar código).
//
// Acesso a `Deno` feito via globalThis (não `Deno.env.get` direto) para este
// módulo continuar importável sob Node/vitest — vários testes de regressão
// importam funções puras deste arquivo sem precisar de um runtime Deno real.
const DEFAULT_COMM_WHATSAPP_ALLOWED_ORIGIN = 'https://www.kifersaude.com.br';
const getCommWhatsAppAllowedOrigin = (): string => {
  const denoGlobal = (globalThis as { Deno?: { env: { get: (key: string) => string | undefined } } }).Deno;
  return denoGlobal?.env.get('COMM_WHATSAPP_ALLOWED_ORIGIN')?.trim() || DEFAULT_COMM_WHATSAPP_ALLOWED_ORIGIN;
};

export const corsHeaders = {
  'Access-Control-Allow-Origin': getCommWhatsAppAllowedOrigin(),
  'Access-Control-Allow-Methods': 'POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey, X-Supabase-Api-Version, X-Region, Accept, X-Kifer-Webhook-Secret',
  Vary: 'Origin',
};

export const WHAPI_BASE_URL = 'https://gate.whapi.cloud';
export const COMM_WHATSAPP_INTEGRATION_SLUG = 'whatsapp_auto_contact';
export const COMM_WHATSAPP_CHANNEL_SLUG = 'primary';
export const COMM_WHATSAPP_MODULE = 'whatsapp-inbox';
export const COMM_WHATSAPP_WEBHOOK_SECRET_ENV = 'COMM_WHATSAPP_WEBHOOK_SECRET';
export const COMM_WHATSAPP_WEBHOOK_SECRET_HEADER = 'X-Kifer-Webhook-Secret';
// A Whapi nem sempre expoe um campo de header customizado na configuracao de
// webhook do painel dela (so URL, modo do body e metodos por evento) — nesses
// planos/telas o unico jeito de autenticar a chamada e embutir o segredo na
// propria URL. Aceito como fallback do header, nao como substituto: quando o
// header vier presente e valido ele tem prioridade.
export const COMM_WHATSAPP_WEBHOOK_SECRET_QUERY_PARAM = 'secret';

const MAX_WHAPI_MEDIA_RESPONSE_BYTES = 32 * 1024 * 1024;
const DEFAULT_WHAPI_REQUEST_TIMEOUT_MS = 12_000;

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

export const DEFAULT_WHAPI_RETRY_COUNT = 1;
export const DEFAULT_WHAPI_RETRY_DELAY_MS = 1_000;

export type WhapiSendTextOpts = {
  replyMessageId?: string;
  replyPreviewText?: string;
  replyType?: string;
  replyAuthorPhone?: string;
};

export type WhapiPagination = {
  count?: number;
  offset?: number;
  sort?: 'asc' | 'desc';
  timeTo?: number;
};

export type WhapiClient = {
  health(): Promise<Response>;
  limits(): Promise<Response>;
  sendText(chatId: string, text: string, opts?: WhapiSendTextOpts): Promise<Response>;
  sendMedia(kind: string, body: BodyInit | FormData, headers: Record<string, string>, timeoutMs?: number): Promise<Response>;
  uploadMedia(body: FormData, timeoutMs?: number): Promise<Response>;
  fetchMessage(messageId: string): Promise<Response>;
  fetchChatMessages(chatId: string, pagination?: WhapiPagination): Promise<Response>;
  fetchChat(chatId: string): Promise<Response>;
  fetchContact(contactId: string): Promise<Response>;
  resolveLid(chatId: string): Promise<Response>;
  checkContact(phone: string): Promise<Response>;
  fetchContacts(pagination?: WhapiPagination): Promise<Response>;
  deleteMessage(messageId: string): Promise<Response>;
  editMessage(messageId: string, body: BodyInit, kind: string): Promise<Response>;
  forwardMessage(messageId: string, body: BodyInit, headers: Record<string, string>): Promise<Response>;
  sendReaction(messageId: string, chatId: string, emoji: string | null): Promise<Response>;
  starMessage(messageId: string, starred: boolean): Promise<Response>;
  get(url: string, timeoutMs?: number): Promise<Response>;
  post(url: string, body: BodyInit, headers: Record<string, string>, timeoutMs?: number): Promise<Response>;
  del(url: string, timeoutMs?: number): Promise<Response>;
  put(url: string, body: BodyInit, headers: Record<string, string>, timeoutMs?: number): Promise<Response>;
};

function whapiRetryFetch(
  url: string,
  init: RequestInit,
  timeoutMs = DEFAULT_WHAPI_REQUEST_TIMEOUT_MS,
  retries = DEFAULT_WHAPI_RETRY_COUNT,
): Promise<Response> {
  return whapiRetryFetchImpl(url, init, timeoutMs, retries);
}

async function whapiRetryFetchImpl(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  retries: number,
): Promise<Response> {
  let response = await fetchWhapiWithTimeout(url, init, timeoutMs);

  for (let attempt = 0; attempt < retries && response.status >= 429; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, DEFAULT_WHAPI_RETRY_DELAY_MS * (attempt + 1)));
    response = await fetchWhapiWithTimeout(url, init, timeoutMs);
  }

  return response;
}

export const createWhapiClient = (token: string): WhapiClient => {
  const authHeaders = {
    'Authorization': `Bearer ${sanitizeWhapiToken(token)}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };

  const client: WhapiClient = {
    health: () => whapiRetryFetch(`${WHAPI_BASE_URL}/health`, { headers: authHeaders }),

    limits: () => whapiRetryFetch(`${WHAPI_BASE_URL}/limits`, { headers: authHeaders }),

    sendText: (chatId, text, opts) => whapiRetryFetch(
      `${WHAPI_BASE_URL}/messages/text`,
      {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          to: chatId,
          body: text,
          ...(opts?.replyMessageId ? {
            quoted: {
              id: opts.replyMessageId,
              preview_text: opts.replyPreviewText,
              type: opts.replyType,
              author_phone: opts.replyAuthorPhone,
            },
          } : {}),
        }),
      },
    ),

    sendMedia: (kind, body, extraHeaders, timeoutMs) => whapiRetryFetch(
      `${WHAPI_BASE_URL}/messages/${kind}`,
      { method: 'POST', headers: { ...authHeaders, ...extraHeaders }, body },
      timeoutMs,
    ),

    uploadMedia: (body, timeoutMs) => whapiRetryFetch(
      `${WHAPI_BASE_URL}/media`,
      { method: 'POST', headers: { Authorization: authHeaders.Authorization }, body },
      timeoutMs || 60_000,
    ),

    fetchMessage: (messageId) => whapiRetryFetch(
      `${WHAPI_BASE_URL}/messages/${messageId}`,
      { headers: authHeaders },
    ),

    fetchChatMessages: (chatId, pagination) => {
      const params = new URLSearchParams();
      if (pagination?.count) params.set('count', String(pagination.count));
      if (pagination?.offset) params.set('count', String(pagination.offset));
      if (pagination?.sort) params.set('sort', pagination.sort);
      if (pagination?.timeTo) params.set('time_to', String(pagination.timeTo));

      const qs = params.toString();
      return whapiRetryFetch(
        `${WHAPI_BASE_URL}/messages/list/${chatId}${qs ? `?${qs}` : ''}`,
        { headers: authHeaders },
      );
    },

    fetchChat: (chatId) => whapiRetryFetch(
      `${WHAPI_BASE_URL}/chats/${chatId}`,
      { headers: authHeaders },
    ),

    fetchContact: (contactId) => whapiRetryFetch(
      `${WHAPI_BASE_URL}/contacts/${contactId}`,
      { headers: authHeaders },
    ),

    resolveLid: (chatId) => whapiRetryFetch(
      `${WHAPI_BASE_URL}/contacts/ids/${chatId}`,
      { headers: authHeaders },
    ),

    checkContact: (phone) => whapiRetryFetch(
      `${WHAPI_BASE_URL}/contacts`,
      {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ blocking: 'wait', contacts: [phone] }),
      },
    ),

    fetchContacts: (pagination) => {
      const params = new URLSearchParams();
      if (pagination?.count) params.set('count', String(pagination.count));
      if (pagination?.offset) params.set('count', String(pagination.offset));

      const qs = params.toString();
      return whapiRetryFetch(
        `${WHAPI_BASE_URL}/contacts${qs ? `?${qs}` : ''}`,
        { headers: authHeaders },
      );
    },

    deleteMessage: (messageId) => whapiRetryFetch(
      `${WHAPI_BASE_URL}/messages/${messageId}`,
      { method: 'DELETE', headers: authHeaders },
    ),

    editMessage: (messageId, body, kind) => whapiRetryFetch(
      `${WHAPI_BASE_URL}/messages/${kind}`,
      {
        method: 'POST',
        headers: authHeaders,
        body,
      },
    ),

    forwardMessage: (messageId, body, extraHeaders) => whapiRetryFetch(
      `${WHAPI_BASE_URL}/messages/${messageId}`,
      { method: 'POST', headers: { ...authHeaders, ...extraHeaders }, body },
    ),

    sendReaction: (messageId, chatId, emoji) => {
      if (emoji) {
        return whapiRetryFetch(
          `${WHAPI_BASE_URL}/messages/${messageId}/reaction`,
          {
            method: 'PUT',
            headers: authHeaders,
            body: JSON.stringify({ to: chatId, emoji }),
          },
        );
      }

      return whapiRetryFetch(
        `${WHAPI_BASE_URL}/messages/${messageId}/reaction`,
        { method: 'DELETE', headers: authHeaders, body: JSON.stringify({ to: chatId }) },
      );
    },

    starMessage: (messageId, starred) => whapiRetryFetch(
      `${WHAPI_BASE_URL}/messages/${messageId}/star`,
      {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({ starred }),
      },
    ),

    get: (url, timeoutMs) => whapiRetryFetch(url, { headers: authHeaders }, timeoutMs),
    post: (url, body, extraHeaders, timeoutMs) => whapiRetryFetch(
      url,
      { method: 'POST', headers: { ...authHeaders, ...extraHeaders }, body },
      timeoutMs,
    ),
    del: (url, timeoutMs) => whapiRetryFetch(url, { method: 'DELETE', headers: authHeaders }, timeoutMs),
    put: (url, body, extraHeaders, timeoutMs) => whapiRetryFetch(
      url,
      { method: 'PUT', headers: { ...authHeaders, ...extraHeaders }, body },
      timeoutMs,
    ),
  };

  return client;
};

export type CommWhatsAppSettings = {
  enabled: boolean;
  token: string;
  nonSecretSettings: Record<string, unknown>;
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

export type CommWhatsAppStarEvent = {
  eventExternalMessageId: string | null;
  targetExternalMessageId: string | null;
  starred: boolean;
  starredAt: string;
};

export type CommWhatsAppMessageMutationInput = {
  channelId: string;
  targetExternalMessageId: string;
  mutationType: 'edit' | 'delete' | 'reaction' | 'star';
  eventExternalMessageId?: string | null;
  occurredAt: string;
  payload: Record<string, unknown>;
  dedupeKey: string;
};

export type CommWhatsAppMessageMutationResult = {
  chatId: string | null;
  applied: boolean;
  queued: boolean;
};

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const toTrimmedString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

export const sanitizeWhapiToken = (value: string): string => value.replace(/^Bearer\s+/i, '').trim();

export const getWhapiToken = (): string => sanitizeWhapiToken(Deno.env.get('WHAPI_TOKEN') || '');

export const getCommWhatsAppWebhookSecret = (): string =>
  toTrimmedString(Deno.env.get(COMM_WHATSAPP_WEBHOOK_SECRET_ENV));

/**
 * Compara duas strings em tempo constante (não retorna assim que acha a
 * primeira diferença), para não vazar por timing quantos caracteres iniciais
 * do segredo o chamador acertou. Tamanhos diferentes já revelam que não bate
 * — isso é inevitável e de baixo valor para um atacante (só diz "não é do
 * mesmo tamanho", não qual byte diverge).
 */
const timingSafeStringEqual = (a: string, b: string): boolean => {
  if (a.length !== b.length) {
    return false;
  }

  const bytesA = new TextEncoder().encode(a);
  const bytesB = new TextEncoder().encode(b);

  let diff = 0;
  for (let i = 0; i < bytesA.length; i += 1) {
    diff |= bytesA[i] ^ bytesB[i];
  }

  return diff === 0;
};

/**
 * Valida o header de autenticidade do webhook (`X-Kifer-Webhook-Secret`) contra o
 * segredo configurado via Edge Secret. Extraída como função pura para poder ser
 * coberta por teste de regressão sem precisar subir a Edge Function inteira.
 */
export const isCommWhatsAppWebhookSecretValid = (
  providedHeaderValue: string | null | undefined,
  expectedSecret: string,
): boolean => {
  const provided = toTrimmedString(providedHeaderValue);
  return Boolean(provided) && Boolean(expectedSecret) && timingSafeStringEqual(provided, expectedSecret);
};

/**
 * Resolve o segredo do webhook informado na requisicao, priorizando o header
 * (`X-Kifer-Webhook-Secret`) e caindo para o query param `secret` quando o
 * header nao vier — a tela de configuracao de webhook da Whapi nem sempre
 * expoe um campo de header customizado, entao o segredo pode ter que viajar
 * embutido na URL. Extraída como função pura para ser coberta por teste sem
 * precisar subir a Edge Function inteira.
 */
export const resolveCommWhatsAppWebhookProvidedSecret = (
  headerValue: string | null | undefined,
  queryValue: string | null | undefined,
): string | null => {
  const header = toTrimmedString(headerValue);
  if (header) return header;

  const query = toTrimmedString(queryValue);
  return query || null;
};

export async function fetchWhapiWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = DEFAULT_WHAPI_REQUEST_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

const getNonSecretCommWhatsAppSettings = (settings: Record<string, unknown>): Record<string, unknown> => {
  const nonSecretSettings: Record<string, unknown> = {};

  for (const key of Object.keys(settings)) {
    if (key === 'token' || key === 'apiKey') continue;
    nonSecretSettings[key] = settings[key];
  }

  return nonSecretSettings;
};

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

  if (/@c\.us$/i.test(raw) || /@s\.whatsapp\.net$/i.test(raw)) {
    const normalizedDomain = raw
      .replace(/@c\.us$/i, '@s.whatsapp.net')
      .replace(/(@s\.whatsapp\.net)+$/i, '@s.whatsapp.net');
    const phone = normalizeCommWhatsAppPhone(normalizedDomain.replace(/@s\.whatsapp\.net$/i, ''));
    return phone ? `${phone}@s.whatsapp.net` : normalizedDomain;
  }

  if (/@lid$/i.test(raw)) {
    const identifier = raw.replace(/@lid$/i, '').trim();
    return identifier ? `${identifier}@lid` : '';
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

export const isWhapiPhoneDirectChatId = (value: unknown): boolean => /@s\.whatsapp\.net$/i.test(normalizeWhapiChatId(value));

export const isWhapiLidChatId = (value: unknown): boolean => /@lid$/i.test(normalizeWhapiChatId(value));

export const isDirectWhapiChatId = (value: unknown): boolean => {
  return isWhapiPhoneDirectChatId(value) || isWhapiLidChatId(value);
};

export const extractPhoneFromChatId = (value: unknown): string => {
  const chatId = normalizeWhapiChatId(value);
  if (!isWhapiPhoneDirectChatId(chatId)) return '';
  return chatId.replace(/@s\.whatsapp\.net$/i, '').replace(/\D/g, '');
};

export const normalizeWhapiPhoneChatId = (value: unknown): string => {
  const raw = toTrimmedString(value);
  if (!raw || /@lid$/i.test(raw)) return '';

  const chatId = normalizeWhapiChatId(raw);
  if (!isWhapiPhoneDirectChatId(chatId)) return '';

  const phone = extractPhoneFromChatId(chatId);
  return phone.length >= 7 && phone.length <= 15 ? `${phone}@s.whatsapp.net` : '';
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

  // Whapi normally returns seconds, but historical records may contain milliseconds or microseconds.
  const timestampMs = numeric >= 1e15 ? numeric / 1000 : numeric >= 1e12 ? numeric : numeric * 1000;
  const date = new Date(timestampMs);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
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

export async function applyCommWhatsAppMessageMutation(
  supabaseAdmin: SupabaseClient,
  input: CommWhatsAppMessageMutationInput,
): Promise<CommWhatsAppMessageMutationResult> {
  const { data, error } = await supabaseAdmin.rpc('comm_whatsapp_apply_message_mutation', {
    p_channel_id: input.channelId,
    p_target_external_message_id: input.targetExternalMessageId,
    p_mutation_type: input.mutationType,
    p_event_external_message_id: input.eventExternalMessageId || null,
    p_occurred_at: input.occurredAt,
    p_payload: input.payload,
    p_dedupe_key: input.dedupeKey,
  });

  if (error) {
    throw new Error(`Erro ao aplicar mutacao da mensagem do WhatsApp: ${error.message}`);
  }

  const result = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null;
  if (!result) {
    throw new Error('A mutacao da mensagem do WhatsApp nao retornou resultado.');
  }

  return {
    chatId: toTrimmedString(result.chat_id) || null,
    applied: result.applied === true,
    queued: result.queued === true,
  };
}

export async function cacheCommWhatsAppChatContactName(
  supabaseAdmin: SupabaseClient,
  input: {
    channelId: string;
    phoneNumber: string | null | undefined;
    displayName: string | null | undefined;
  },
): Promise<boolean> {
  const phoneNumber = normalizeCommWhatsAppPhone(input.phoneNumber);
  const displayName = toTrimmedString(input.displayName);
  if (!phoneNumber || !isValidCommWhatsAppDisplayName(displayName)) {
    return false;
  }

  const nowIso = getNowIso();
  const { error } = await supabaseAdmin
    .from('comm_whatsapp_phone_contacts_cache')
    .upsert(
      {
        channel_id: input.channelId,
        contact_id: `chat:${phoneNumber}`,
        phone_number: phoneNumber,
        phone_digits: phoneNumber,
        display_name: displayName,
        short_name: displayName.split(/\s+/).filter(Boolean).slice(0, 2).join(' ') || null,
        saved: false,
        last_synced_at: nowIso,
        updated_at: nowIso,
      },
      { onConflict: 'channel_id,contact_id' },
    );

  if (error) {
    console.warn('[comm-whatsapp] failed to cache chat contact name', { phoneNumber, error: error.message });
    return false;
  }

  return true;
}

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
    isRecord(message.business) ? message.business.name : null,
    isRecord(message.profile) ? message.profile.name : null,
    isRecord(message.chat) ? message.chat.name : null,
    message.pushname,
    message.push_name,
    message.notify_name,
    message.sender_name,
  );
};

export const isPhoneLabelLikeDisplayName = (value: string): boolean => {
  const trimmed = value.trim();
  if (!trimmed) return true;

  const withoutSymbols = trimmed.replace(/[\s()+-]/g, '');
  return /^\+?\d+$/.test(withoutSymbols);
};

export const isSentenceLikeDisplayName = (value: string): boolean => {
  const trimmed = value.trim();
  if (!trimmed) return false;

  if (trimmed.length > 50) return true;

  const wordCount = trimmed.split(/\s+/).length;
  if (wordCount > 6) return true;

  if (/[.!?]\s+\p{L}/u.test(trimmed)) return true;

  return false;
};

export const isValidCommWhatsAppDisplayName = (value: unknown): value is string => {
  const trimmed = toTrimmedString(value);
  if (!trimmed) return false;
  if (/@(?:lid|s\.whatsapp\.net|c\.us|g\.us)$/i.test(trimmed)) return false;
  if (isPhoneLabelLikeDisplayName(trimmed)) return false;
  if (isSentenceLikeDisplayName(trimmed)) return false;
  return /[\p{L}\p{N}]/u.test(trimmed);
};

const pickHumanName = (...candidates: unknown[]): string => {
  for (const candidate of candidates) {
    const normalized = toTrimmedString(candidate);
    if (!isValidCommWhatsAppDisplayName(normalized)) continue;
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
    case 'sticker':
      return isRecord(message.sticker) ? message.sticker : null;
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
    mediaFileName: normalizeWhapiMediaFileName(payload.file_name) || normalizeWhapiMediaFileName(payload.filename) || null,
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
  const mediaMeta = extractWhapiMediaMeta(message);
  const textBody = readNestedBody(message, 'text');
  if (textBody) return textBody;

  const linkPreviewBody = readNestedBody(message, 'link_preview');
  if (linkPreviewBody) return linkPreviewBody;

  if (mediaMeta.mediaCaption) return mediaMeta.mediaCaption;

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

  // Whapi can emit edits as an explicit `edit` action or as a PATCH payload
  // containing edited fields, depending on the channel webhook mode.
  const hasEditedFields = Boolean(
    message.edited_message_id
    || message.edited_text
    || message.edited_body
    || action?.edited_message
    || action?.edited_text
    || action?.edited_body,
  );
  const likelyEditEvent = normalizedActionType.includes('edit')
    || normalizedActionType.includes('edited')
    || (normalizedActionType === 'patch' && hasEditedFields);
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

export const extractWhapiStarEvent = (
  message: unknown,
  eventAction: string,
): CommWhatsAppStarEvent | null => {
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

  const isStarAction = normalizedActionType === 'star'
    || normalizedActionType === 'starred'
    || normalizedActionType === 'unstar'
    || normalizedActionType === 'unstarred';
  if (!isStarAction) {
    return null;
  }

  const targetExternalMessageId = firstNonEmpty(
    toTrimmedString(message.id),
    action?.target,
    action?.target_message_id,
    action?.targetMessageId,
    context?.quoted_id,
    context?.stanza_id,
    context?.message_id,
    context?.messageId,
  ) || null;

  if (!targetExternalMessageId) {
    return null;
  }

  const explicitStarred = firstNonEmpty(action?.starred, message.starred);
  const starred = explicitStarred === 'true'
    ? true
    : explicitStarred === 'false'
      ? false
      : normalizedActionType === 'unstar' || normalizedActionType === 'unstarred';

  return {
    eventExternalMessageId: toTrimmedString(message.id) || null,
    targetExternalMessageId,
    starred,
    starredAt: unixTimestampToIso(message.timestamp) || stringTimestampToIso(message.timestamp) || getNowIso(),
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
  const top = toTrimmedString(payload.status) || toTrimmedString(payload.state);
  if (top) return top;
  if (isRecord(payload.message)) {
    return toTrimmedString(payload.message.status) || toTrimmedString(payload.message.state);
  }
  return '';
};

export const resolveWhapiOutboundDeliveryStatus = (payload: unknown, externalMessageId?: string | null): string => {
  const status = extractWhapiMessageStatus(payload);
  if (status) return status;
  return toTrimmedString(externalMessageId) ? 'sent' : 'pending';
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

    const nestedRecords = [payload.document, payload.image, payload.video, payload.audio, payload.voice, payload.sticker];
    for (const item of nestedRecords) {
      if (isRecord(item)) {
        const nestedId = toTrimmedString(item.id) || toTrimmedString(item.media_id);
        if (nestedId) return nestedId;
      }
    }

    if (isRecord(payload.message)) {
      const nestedId = extractWhapiMediaId(payload.message);
      if (nestedId) return nestedId;
    }

    if (Array.isArray(payload.data)) {
      for (const item of payload.data) {
        if (isRecord(item)) {
          const itemId = extractWhapiMediaId(item);
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

    if (Array.isArray(payload.media)) {
      for (const item of payload.media) {
        if (isRecord(item)) {
          const nestedId = toTrimmedString(item.id) || toTrimmedString(item.media_id);
          if (nestedId) return nestedId;
        }
      }
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

    if (isRecord(payload.message)) {
      return [payload.message];
    }

    if (Array.isArray(payload.data)) {
      return payload.data.filter(isRecord);
    }

    if (isRecord(payload.data)) {
      if (Array.isArray(payload.data.messages)) {
        return payload.data.messages.filter(isRecord);
      }

      if (isRecord(payload.data.message)) {
        return [payload.data.message];
      }
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

export const extractWhapiChats = (payload: unknown): Array<Record<string, unknown>> => {
  if (Array.isArray(payload)) {
    return payload.filter(isRecord);
  }

  if (isRecord(payload)) {
    if (Array.isArray(payload.chats)) {
      return payload.chats.filter(isRecord);
    }

    if (Array.isArray(payload.data)) {
      return payload.data.filter(isRecord);
    }
  }

  return [];
};

export const extractWhapiChatId = (payload: unknown): string => {
  if (!isRecord(payload)) return '';

  const candidates = [payload.id, payload.chat_id, payload.wa_id];
  for (const candidate of candidates) {
    const normalized = normalizeWhapiChatId(candidate);
    if (normalized) return normalized;
  }

  return '';
};

export const extractWhapiContactPhone = (payload: unknown): string => {
  if (!isRecord(payload)) return '';

  const candidates = [payload.phone, payload.wa_id, payload.id, payload.contact_id, payload.user, payload.value];
  for (const candidate of candidates) {
    const phoneChatId = normalizeWhapiPhoneChatId(candidate);
    if (phoneChatId) return extractPhoneFromChatId(phoneChatId);
  }

  return '';
};

export const extractWhapiContactName = (payload: unknown): string => {
  if (!isRecord(payload)) return '';

  const candidates = [payload.name, payload.pushname, payload.short, payload.short_name, payload.full_name];
  for (const candidate of candidates) {
    const normalized = toTrimmedString(candidate);
    if (isValidCommWhatsAppDisplayName(normalized)) return normalized;
  }

  return '';
};

export const normalizeWhapiMediaFileName = (value: unknown): string => {
  const original = toTrimmedString(value);
  if (!original || !/[\u00c2\u00c3\u00e2]/.test(original)) return original;

  const byteValues = Array.from(original, (character) => character.charCodeAt(0));
  if (byteValues.some((byte) => byte > 0xff)) return original;

  try {
    const repaired = new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(byteValues));
    const encoded = new TextEncoder().encode(repaired);
    if (encoded.length !== byteValues.length || encoded.some((byte, index) => byte !== byteValues[index])) {
      return original;
    }

    return repaired;
  } catch {
    return original;
  }
};

export const extractWhapiContactSaved = (payload: unknown): boolean => {
  if (!isRecord(payload)) return false;
  // Whapi marks every contact the account has ever chatted with as `saved: true`,
  // regardless of whether it's actually in the phone's address book. Only
  // `phonebook: true` reflects a real, user-saved contact.
  return payload.phonebook === true;
};

export const extractWhapiSavedContactName = (payload: unknown): string => {
  if (!isRecord(payload)) return '';
  if (!extractWhapiContactSaved(payload)) return '';

  const name = toTrimmedString(payload.name);
  return isValidCommWhatsAppDisplayName(name) ? name : '';
};

export const extractWhapiContactPushName = (payload: unknown): string => {
  if (!isRecord(payload)) return '';

  const candidates = [payload.pushname, payload.short, payload.short_name, payload.full_name];
  for (const candidate of candidates) {
    const normalized = toTrimmedString(candidate);
    if (isValidCommWhatsAppDisplayName(normalized)) return normalized;
  }

  return '';
};

export const extractWhapiContactShortName = (payload: unknown): string => {
  if (!isRecord(payload)) return '';
  const shortName = toTrimmedString(payload.short) || toTrimmedString(payload.short_name) || '';
  return isValidCommWhatsAppDisplayName(shortName) ? shortName : '';
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

export const buildWebhookUrl = (supabaseUrl: string, secret?: string): string => {
  const normalizedUrl = supabaseUrl.replace(/\/$/, '');
  const query = new URLSearchParams({ channel: COMM_WHATSAPP_CHANNEL_SLUG });
  const trimmedSecret = toTrimmedString(secret);
  if (trimmedSecret) {
    query.set(COMM_WHATSAPP_WEBHOOK_SECRET_QUERY_PARAM, trimmedSecret);
  }

  return `${normalizedUrl}/functions/v1/comm-whatsapp-webhook?${query.toString()}`;
};

export async function fetchWhapiChatName(params: {
  token: string;
  chatId: string;
}): Promise<string> {
  const response = await fetchWhapiWithTimeout(`${WHAPI_BASE_URL}/chats/${encodeURIComponent(params.chatId)}`, {
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
  const response = await fetchWhapiWithTimeout(`${WHAPI_BASE_URL}/contacts/${encodeURIComponent(params.contactId)}`, {
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

  return extractWhapiSavedContactName(payload);
}

export type WhapiContactIdentity = {
  exists: boolean;
  waId: string;
  phone: string;
};

export const extractWhapiCheckedContactIdentity = (payload: unknown): WhapiContactIdentity => {
  const [contact] = extractWhapiContacts(payload);
  if (!contact || toTrimmedString(contact.status).toLowerCase() !== 'valid') {
    return { exists: false, waId: '', phone: '' };
  }

  const waId = normalizeWhapiPhoneChatId(contact.wa_id);
  if (!waId) {
    return { exists: false, waId: '', phone: '' };
  }

  return { exists: true, waId, phone: extractPhoneFromChatId(waId) };
};

export async function resolveWhapiLidToPhone(params: {
  token: string;
  chatId: string;
}): Promise<string> {
  const chatId = normalizeWhapiChatId(params.chatId);
  if (!isWhapiLidChatId(chatId)) return extractPhoneFromChatId(chatId);

  const response = await fetchWhapiWithTimeout(
    `${WHAPI_BASE_URL}/contacts/ids/${encodeURIComponent(chatId)}`,
    {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${params.token}`,
      },
    },
  );
  if (!response.ok) return '';

  const payload = await readResponsePayload(response);
  if (!isRecord(payload)) return '';

  const resolvedChatId = normalizeWhapiPhoneChatId(payload.id);
  if (!resolvedChatId) return '';

  const phone = extractPhoneFromChatId(resolvedChatId);
  const lidDigits = normalizePhoneDigits(chatId.replace(/@lid$/i, ''));
  return phone && phone !== lidDigits ? phone : '';
}

export async function resolveWhapiPhoneToLid(params: {
  token: string;
  chatId: string;
}): Promise<string> {
  const phoneChatId = normalizeWhapiPhoneChatId(params.chatId);
  if (!phoneChatId) return '';

  const response = await fetchWhapiWithTimeout(
    `${WHAPI_BASE_URL}/contacts/lids/${encodeURIComponent(phoneChatId)}`,
    {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${params.token}`,
      },
    },
  );
  if (!response.ok) return '';

  const payload = await readResponsePayload(response);
  if (!isRecord(payload)) return '';

  const lid = normalizeWhapiChatId(payload.lid);
  return isWhapiLidChatId(lid) ? lid : '';
}

export type VerifiedWhapiDirectIdentity = {
  verified: boolean;
  lidChatId: string;
  phoneChatId: string;
  phone: string;
  reason: 'verified' | 'invalid_chat_id' | 'counterpart_unresolved' | 'reverse_unresolved' | 'reverse_mismatch';
};

export async function resolveVerifiedWhapiDirectIdentity(params: {
  token: string;
  chatId: string;
}): Promise<VerifiedWhapiDirectIdentity> {
  const inputChatId = normalizeWhapiChatId(params.chatId);
  const inputIsLid = isWhapiLidChatId(inputChatId);
  let lidChatId = '';
  let phoneChatId = '';

  if (inputIsLid) {
    lidChatId = inputChatId;
    const phone = await resolveWhapiLidToPhone({ token: params.token, chatId: lidChatId });
    phoneChatId = normalizeWhapiPhoneChatId(phone);
  } else if (isWhapiPhoneDirectChatId(inputChatId)) {
    phoneChatId = normalizeWhapiPhoneChatId(inputChatId);
    lidChatId = await resolveWhapiPhoneToLid({ token: params.token, chatId: phoneChatId });
  } else {
    return { verified: false, lidChatId: '', phoneChatId: '', phone: '', reason: 'invalid_chat_id' };
  }

  if (!lidChatId || !phoneChatId) {
    return {
      verified: false,
      lidChatId,
      phoneChatId,
      phone: extractPhoneFromChatId(phoneChatId),
      reason: 'counterpart_unresolved',
    };
  }

  const reverseLid = inputIsLid
    ? await resolveWhapiPhoneToLid({ token: params.token, chatId: phoneChatId })
    : lidChatId;
  const reversePhone = inputIsLid
    ? phoneChatId
    : normalizeWhapiPhoneChatId(await resolveWhapiLidToPhone({ token: params.token, chatId: lidChatId }));

  if (!reverseLid || !reversePhone) {
    return {
      verified: false,
      lidChatId,
      phoneChatId,
      phone: extractPhoneFromChatId(phoneChatId),
      reason: 'reverse_unresolved',
    };
  }

  const phoneLookupKeys = new Set(getCommWhatsAppPhoneLookupKeys(phoneChatId));
  const reversePhoneIsEquivalent = getCommWhatsAppPhoneLookupKeys(reversePhone)
    .some((key) => phoneLookupKeys.has(key));

  if (reverseLid.toLowerCase() !== lidChatId.toLowerCase() || !reversePhoneIsEquivalent) {
    return {
      verified: false,
      lidChatId,
      phoneChatId,
      phone: extractPhoneFromChatId(phoneChatId),
      reason: 'reverse_mismatch',
    };
  }

  return {
    verified: true,
    lidChatId,
    phoneChatId: reversePhone,
    phone: extractPhoneFromChatId(reversePhone),
    reason: 'verified',
  };
}

export type WhapiChatMessagesPage = {
  messages: Array<Record<string, unknown>>;
  nextOffset: number;
  hasMore: boolean;
};

export async function fetchWhapiChatMessagesPage(params: {
  token: string;
  chatId: string;
  count?: number;
  offset?: number;
  timeTo?: number;
  sort?: 'asc' | 'desc';
}): Promise<WhapiChatMessagesPage> {
  const count = Math.min(Math.max(Math.floor(Number(params.count) || 100), 1), 500);
  const offset = Math.max(Math.floor(Number(params.offset) || 0), 0);
  const timeTo = Number(params.timeTo);
  const url = new URL(`${WHAPI_BASE_URL}/messages/list/${encodeURIComponent(params.chatId)}`);
  url.searchParams.set('count', String(count));
  url.searchParams.set('offset', String(offset));
  url.searchParams.set('sort', params.sort === 'asc' ? 'asc' : 'desc');
  if (Number.isFinite(timeTo) && timeTo > 0) {
    url.searchParams.set('time_to', String(Math.floor(timeTo)));
  }

  const response = await fetchWhapiWithTimeout(url.toString(), {
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

  const messages = extractWhapiMessages(payload);
  return {
    messages,
    nextOffset: offset + messages.length,
    hasMore: messages.length >= count,
  };
}

export async function fetchWhapiChatMessages(params: {
  token: string;
  chatId: string;
}): Promise<Array<Record<string, unknown>>> {
  const page = await fetchWhapiChatMessagesPage({ ...params, sort: 'desc' });
  return page.messages;
}

export async function fetchWhapiMessage(params: {
  token: string;
  messageId: string;
}): Promise<Record<string, unknown> | null> {
  const messageId = toTrimmedString(params.messageId);
  if (!messageId) {
    return null;
  }

  const response = await fetchWhapiWithTimeout(`${WHAPI_BASE_URL}/messages/${encodeURIComponent(messageId)}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${params.token}`,
    },
  });

  const payload = await readResponsePayload(response);
  if (!response.ok) {
    return null;
  }

  if (isRecord(payload)) {
    if (isRecord(payload.message)) {
      return payload.message;
    }

    const payloadId = toTrimmedString(payload.id) || toTrimmedString(payload.message_id);
    if (payloadId) {
      return payload;
    }
  }

  const [message] = extractWhapiMessages(payload);
  return message ?? null;
}

export async function fetchWhapiChatsPage(params: {
  token: string;
  count?: number;
  offset?: number;
}): Promise<{ chats: Array<Record<string, unknown>>; hasMore: boolean }> {
  const count = Math.min(Math.max(Math.floor(Number(params.count) || 100), 1), 200);
  const offset = Math.max(Math.floor(Number(params.offset) || 0), 0);

  const query = new URLSearchParams();
  query.set('count', String(count));
  if (offset > 0) {
    query.set('offset', String(offset));
  }

  const response = await fetchWhapiWithTimeout(`${WHAPI_BASE_URL}/chats?${query.toString()}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${params.token}`,
    },
  }, 15_000);

  const payload = await readResponsePayload(response);
  if (!response.ok) {
    throw new Error(parseWhapiError(payload) || 'Falha ao consultar conversas na Whapi.');
  }

  const chats = extractWhapiChats(payload);
  return { chats, hasMore: chats.length >= count };
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

  const response = await fetchWhapiWithTimeout(`${WHAPI_BASE_URL}/contacts${query.size ? `?${query.toString()}` : ''}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${params.token}`,
    },
  }, 15_000);

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

export const MIME_TO_EXT: Record<string, string> = {
  'audio/flac': '.flac',
  'audio/m4a': '.m4a',
  'audio/mp4': '.mp4',
  'audio/mpeg': '.mp3',
  'audio/mpga': '.mpga',
  'audio/oga': '.oga',
  'audio/ogg': '.ogg',
  'audio/wav': '.wav',
  'audio/wave': '.wav',
  'audio/webm': '.webm',
  'audio/x-m4a': '.m4a',
  'audio/x-wav': '.wav',
  'audio/aac': '.aac',
};

const mimeTypeToExtension = (mimeType: string): string => MIME_TO_EXT[mimeType] || '.ogg';

export const isTrustedWhapiMediaUrl = (value: unknown): boolean => {
  const rawUrl = toTrimmedString(value);
  if (!rawUrl) return false;

  try {
    const mediaUrl = new URL(rawUrl);

    return mediaUrl.protocol === 'https:'
      && !mediaUrl.username
      && !mediaUrl.password
      && !mediaUrl.port
      && mediaUrl.hostname.endsWith('.whapi.cloud');
  } catch {
    return false;
  }
};

const readWhapiMediaBlob = async (response: Response): Promise<Blob> => {
  const contentLength = Number(response.headers.get('content-length'));
  if (Number.isSafeInteger(contentLength) && contentLength > MAX_WHAPI_MEDIA_RESPONSE_BYTES) {
    throw new Error('A midia da Whapi excede o limite de 32 MiB.');
  }

  if (!response.body) {
    return new Blob();
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      totalBytes += value.byteLength;
      if (totalBytes > MAX_WHAPI_MEDIA_RESPONSE_BYTES) {
        await reader.cancel();
        throw new Error('A midia da Whapi excede o limite de 32 MiB.');
      }

      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  return new Blob(chunks as BlobPart[], { type: response.headers.get('content-type') || '' });
};

async function fetchWhapiMediaBlob(params: {
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

    const stripMimeParameters = (value: string): string => value.split(';')[0]?.trim() || value.trim();

    const blob = await readWhapiMediaBlob(response);
    const cleanFallbackMime = params.fallbackMimeType?.trim() ? stripMimeParameters(params.fallbackMimeType.trim()) : '';
    const rawMimeType = stripMimeParameters(response.headers.get('content-type') || '') || cleanFallbackMime || blob.type || 'audio/ogg';
    const contentDisposition = response.headers.get('content-disposition')?.trim() || '';
    const fileNameMatch = contentDisposition.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
    const rawFileName =
      decodeURIComponent(fileNameMatch?.[1] || '').trim() ||
      params.fallbackFileName?.trim() ||
      `whatsapp-audio${mimeTypeToExtension(rawMimeType.toLowerCase())}`;

    const mimeType = rawMimeType.toLowerCase() === 'audio/oga' ? 'audio/ogg' : rawMimeType.toLowerCase();
    const fileName = /\.oga$/i.test(rawFileName) ? rawFileName.replace(/\.oga$/i, '.ogg') : rawFileName;

    return { blob, mimeType, fileName };
  };

  const mediaUrl = toTrimmedString(params.mediaUrl);
  if (isTrustedWhapiMediaUrl(mediaUrl)) {
    try {
        const response = await fetchWhapiWithTimeout(mediaUrl, {
          method: 'GET',
          headers,
          redirect: 'error',
      });

      return await buildResult(response);
    } catch {
      // Rejected URLs and failed direct downloads resolve through the Whapi media endpoint.
    }
  }

  const mediaId = toTrimmedString(params.mediaId);
  if (!mediaId) {
    throw new Error('A mensagem nao possui MediaID nem URL valida para transcricao.');
  }

  // Whapi can emit the "new message" webhook slightly before the media
  // finishes syncing to their storage, so a fetch right after receipt can
  // 404 with "specified media not found" even though the file shows up
  // moments later. Retry a few times before giving up on that specific case.
  const NOT_FOUND_RETRY_DELAYS_MS = [1500, 3000];
  for (let attempt = 0; ; attempt += 1) {
    try {
      const response = await fetchWhapiWithTimeout(`${WHAPI_BASE_URL}/media/${encodeURIComponent(mediaId)}`, {
        method: 'GET',
        headers,
        redirect: 'error',
      });

      return await buildResult(response);
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      const isNotFound = /not found/i.test(message);
      const delay = NOT_FOUND_RETRY_DELAYS_MS[attempt];
      if (!isNotFound || delay === undefined) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}


const COMM_WHATSAPP_MEDIA_BUCKET = 'comm-whatsapp-media';

const sanitizeCommWhatsAppStorageSegment = (value: string) =>
  value
    .trim()
    .replace(/[^a-zA-Z0-9._=-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 160) || 'media';

const getCommWhatsAppMediaStoragePath = (mediaId: string) => `${sanitizeCommWhatsAppStorageSegment(mediaId)}`;

export async function getCachedCommWhatsAppMedia(supabaseAdmin: SupabaseClient, mediaId: string): Promise<Blob | null> {
  const normalizedMediaId = toTrimmedString(mediaId);
  if (!normalizedMediaId) return null;

  const { data, error } = await supabaseAdmin.storage
    .from(COMM_WHATSAPP_MEDIA_BUCKET)
    .download(getCommWhatsAppMediaStoragePath(normalizedMediaId));

  if (error) {
    return null;
  }

  return data ?? null;
}

export async function archiveCommWhatsAppMedia(supabaseAdmin: SupabaseClient, params: {
  mediaId: string;
  blob: Blob;
  mimeType?: string | null;
}): Promise<void> {
  const mediaId = toTrimmedString(params.mediaId);
  if (!mediaId) return;

  const { error } = await supabaseAdmin.storage
    .from(COMM_WHATSAPP_MEDIA_BUCKET)
    .upload(getCommWhatsAppMediaStoragePath(mediaId), params.blob, {
      contentType: params.mimeType?.trim() || params.blob.type || 'application/octet-stream',
      upsert: true,
    });

  if (error) {
    throw new Error(`Falha ao arquivar midia do WhatsApp: ${error.message}`);
  }
}

export async function archiveCommWhatsAppMediaFromWhapi(supabaseAdmin: SupabaseClient, params: {
  token: string;
  mediaId?: string | null;
  mediaUrl?: string | null;
  fallbackFileName?: string | null;
  fallbackMimeType?: string | null;
}): Promise<{ blob: Blob; mimeType: string; fileName: string; cached: boolean }> {
  const mediaId = toTrimmedString(params.mediaId);
  if (mediaId) {
    const cachedBlob = await getCachedCommWhatsAppMedia(supabaseAdmin, mediaId);
    if (cachedBlob) {
      const stripMimeParameters = (value: string): string => value.split(';')[0]?.trim() || value.trim();
      const rawFallbackMime = params.fallbackMimeType?.trim();
      return {
        blob: cachedBlob,
        mimeType: rawFallbackMime ? stripMimeParameters(rawFallbackMime) : cachedBlob.type || 'application/octet-stream',
        fileName: params.fallbackFileName?.trim() || mediaId,
        cached: true,
      };
    }
  }

  const result = await fetchWhapiMediaBlob(params);
  if (mediaId) {
    await archiveCommWhatsAppMedia(supabaseAdmin, {
      mediaId,
      blob: result.blob,
      mimeType: result.mimeType,
    });
  }

  return { ...result, cached: false };
}

export async function cacheCommWhatsAppMedia(supabaseAdmin: SupabaseClient, params: {
  token: string;
  mediaId?: string | null;
  mediaUrl?: string | null;
  fallbackFileName?: string | null;
  fallbackMimeType?: string | null;
}): Promise<{ blob: Blob; mimeType: string; fileName: string; cached: boolean }> {
  return await archiveCommWhatsAppMediaFromWhapi(supabaseAdmin, params);
}

export async function addWhapiContact(params: {
  token: string;
  phone: string;
  name: string;
}): Promise<Record<string, unknown> | null> {
  const digits = normalizeCommWhatsAppPhone(params.phone);
  const displayName = toTrimmedString(params.name);
  if (!digits || !isValidCommWhatsAppDisplayName(displayName)) {
    return null;
  }

  const response = await fetchWhapiWithTimeout(`${WHAPI_BASE_URL}/contacts`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${params.token}`,
    },
    body: JSON.stringify({ phone: digits, name: displayName }),
  }, 10_000);

  if (!response.ok) {
    const payload = await readResponsePayload(response).catch(() => null);
    if (isRecord(payload) && isRecord(payload.error) && payload.error.code === 409) {
      return null;
    }
    throw new Error(parseWhapiError(payload) || 'Falha ao adicionar contato na Whapi.');
  }

  const payload = await readResponsePayload(response);
  return isRecord(payload) ? payload : null;
}

export async function editWhapiContact(params: {
  token: string;
  phone: string;
  name: string;
}): Promise<Record<string, unknown> | null> {
  const digits = normalizeCommWhatsAppPhone(params.phone);
  const displayName = toTrimmedString(params.name);
  if (!digits || !isValidCommWhatsAppDisplayName(displayName)) {
    return null;
  }

  const response = await fetchWhapiWithTimeout(`${WHAPI_BASE_URL}/contacts/${encodeURIComponent(digits)}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${params.token}`,
    },
    body: JSON.stringify({ name: displayName }),
  }, 10_000);

  if (!response.ok) {
    const payload = await readResponsePayload(response).catch(() => null);
    throw new Error(parseWhapiError(payload) || 'Falha ao renomear contato na Whapi.');
  }

  const payload = await readResponsePayload(response);
  return isRecord(payload) ? payload : null;
}

export async function checkWhapiContactExists(params: {
  token: string;
  contactId: string;
}): Promise<boolean> {
  const identity = await checkWhapiContactIdentity(params);
  return identity.exists;
}

export async function checkWhapiContactIdentity(params: {
  token: string;
  contactId: string;
}): Promise<WhapiContactIdentity> {
  const digits = normalizeCommWhatsAppPhone(params.contactId);
  if (!digits) {
    return { exists: false, waId: '', phone: '' };
  }

  const response = await fetchWhapiWithTimeout(`${WHAPI_BASE_URL}/contacts`, {
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
  }, 10_000);

  if (!response.ok) {
    return { exists: false, waId: '', phone: '' };
  }

  const payload = await readResponsePayload(response);
  return extractWhapiCheckedContactIdentity(payload);
}

export type WhapiContactCheckOutcome = 'valid' | 'invalid' | 'unknown';

export type WhapiContactCheckResult = {
  outcome: WhapiContactCheckOutcome;
  waId: string;
  phone: string;
};

/**
 * Variante de checkWhapiContactIdentity que NAO colapsa falha de
 * rede/rate-limit (HTTP nao-ok) nem um status ausente/inesperado no payload
 * em "nao existe" - usada por fluxos em lote (validacao de campanha) onde
 * tratar ambiguidade como "invalido" marcaria numeros validos como sem
 * WhatsApp so por terem sido rate-limited durante uma checagem concorrente.
 * So retorna 'invalid' numa confirmacao explicita (status 'invalid' no
 * payload); qualquer outra coisa vira 'unknown' pra o chamador tentar de
 * novo depois em vez de excluir o contato.
 */
export async function checkWhapiContactStatus(params: {
  token: string;
  contactId: string;
}): Promise<WhapiContactCheckResult> {
  const digits = normalizeCommWhatsAppPhone(params.contactId);
  if (!digits) {
    return { outcome: 'unknown', waId: '', phone: '' };
  }

  let response: Response;
  try {
    response = await fetchWhapiWithTimeout(`${WHAPI_BASE_URL}/contacts`, {
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
    }, 10_000);
  } catch {
    return { outcome: 'unknown', waId: '', phone: '' };
  }

  if (!response.ok) {
    return { outcome: 'unknown', waId: '', phone: '' };
  }

  const payload = await readResponsePayload(response);
  const [contact] = extractWhapiContacts(payload);
  const status = toTrimmedString(contact?.status).toLowerCase();

  if (status === 'valid') {
    const waId = normalizeWhapiPhoneChatId(contact?.wa_id);
    if (!waId) return { outcome: 'unknown', waId: '', phone: '' };
    return { outcome: 'valid', waId, phone: extractPhoneFromChatId(waId) };
  }

  if (status === 'invalid') {
    return { outcome: 'invalid', waId: '', phone: '' };
  }

  return { outcome: 'unknown', waId: '', phone: '' };
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
        settings: { enabled: false },
      })
      .select('settings')
      .single();

    if (createError || !created) {
      throw new Error(createError?.message || 'Nao foi possivel criar configuracao do WhatsApp.');
    }

    return {
      enabled: false,
      token: getWhapiToken(),
      nonSecretSettings: { enabled: false },
    };
  }

  const settings = isRecord(existing.settings) ? existing.settings : {};
  const nonSecretSettings = getNonSecretCommWhatsAppSettings(settings);

  return {
    enabled: typeof settings.enabled === 'boolean' ? settings.enabled : false,
    token: getWhapiToken(),
    nonSecretSettings,
  };
}

export type CommWhatsAppCanonicalChatRoute = {
  chatId: string | null;
  externalChatId: string;
  phoneNumber: string | null;
  displayName: string | null;
  pushName: string | null;
  leadId: string | null;
  identityConflict: boolean;
  deletedAt: string | null;
};

type CommWhatsAppCanonicalChatRouteRow = {
  chat_id?: unknown;
  external_chat_id?: unknown;
  phone_number?: unknown;
  display_name?: unknown;
  push_name?: unknown;
  lead_id?: unknown;
  identity_conflict?: unknown;
  deleted_at?: unknown;
};

const parseCommWhatsAppCanonicalChatRoute = (
  value: unknown,
): CommWhatsAppCanonicalChatRoute | null => {
  const row = (Array.isArray(value) ? value[0] : value) as CommWhatsAppCanonicalChatRouteRow | null;
  const chatId = toTrimmedString(row?.chat_id);
  const externalChatId = normalizeWhapiChatId(row?.external_chat_id);
  if (!row || !chatId || !externalChatId) return null;

  return {
    chatId,
    externalChatId,
    phoneNumber: normalizeCommWhatsAppPhone(row.phone_number) || null,
    displayName: toTrimmedString(row.display_name) || null,
    pushName: toTrimmedString(row.push_name) || null,
    leadId: toTrimmedString(row.lead_id) || null,
    identityConflict: row.identity_conflict === true,
    deletedAt: toTrimmedString(row.deleted_at) || null,
  };
};

export async function resolveCommWhatsAppCanonicalChatRoute(
  supabaseAdmin: SupabaseClient,
  input: { channelId: string; externalChatId: string },
): Promise<CommWhatsAppCanonicalChatRoute> {
  const externalChatId = normalizeWhapiChatId(input.externalChatId);
  if (!input.channelId || !isDirectWhapiChatId(externalChatId)) {
    throw new Error('Canal ou identificador invalido para resolver a conversa canonica.');
  }

  const { data, error } = await supabaseAdmin.rpc(
    'comm_whatsapp_get_canonical_chat_route',
    {
      p_chat_id: null,
      p_channel_id: input.channelId,
      p_external_chat_id: externalChatId,
    },
  );
  if (error) {
    throw new Error(`Erro ao resolver conversa canonica: ${error.message}`);
  }

  const route = parseCommWhatsAppCanonicalChatRoute(data);
  if (!route) {
    return {
      chatId: null,
      externalChatId,
      phoneNumber: extractPhoneFromChatId(externalChatId) || null,
      displayName: null,
      pushName: null,
      leadId: null,
      identityConflict: false,
      deletedAt: null,
    };
  }

  return route;
}

export async function resolveCommWhatsAppCanonicalChatRouteByUuid(
  supabaseAdmin: SupabaseClient,
  chatId: string,
): Promise<CommWhatsAppCanonicalChatRoute | null> {
  const requestedChatId = toTrimmedString(chatId);
  if (!requestedChatId) return null;

  const { data, error } = await supabaseAdmin.rpc('comm_whatsapp_get_canonical_chat_route', {
    p_chat_id: requestedChatId,
    p_channel_id: null,
    p_external_chat_id: null,
  });
  if (error) throw new Error(`Erro ao resolver UUID canonico da conversa: ${error.message}`);

  return parseCommWhatsAppCanonicalChatRoute(data);
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

const isOwnCommWhatsAppChannelName = (value: string | null | undefined, connectedUserName: string | null | undefined) => {
  const normalizedValue = toTrimmedString(value).toLowerCase();
  const normalizedChannelUser = toTrimmedString(connectedUserName).toLowerCase();
  return Boolean(normalizedValue && normalizedChannelUser && normalizedValue === normalizedChannelUser);
};

const normalizeCommWhatsAppSemanticText = (value: unknown) => toTrimmedString(value).replace(/\s+/g, ' ').toLowerCase();

const buildWhapiHistoryMessageKey = (message: Record<string, unknown>) => {
  const externalMessageId = extractWhapiMessageId(message);
  if (externalMessageId) {
    return `external:${externalMessageId}`;
  }

  const direction = message.from_me === true ? 'outbound' : 'inbound';
  const messageAt = unixTimestampToIso(message.timestamp) || '';
  const messageType = toTrimmedString(message.type) || 'text';
  const text = normalizeCommWhatsAppSemanticText(summarizeWhapiMessage(message));
  const mediaId = extractWhapiMediaMeta(message).mediaId || '';
  const sender = toTrimmedString(message.from) || toTrimmedString(message.from_name) || '';

  if (!mediaId && text.length < 12) {
    return '';
  }

  return `semantic:${direction}:${messageType}:${messageAt}:${sender}:${mediaId}:${text}`;
};

const dedupeWhapiHistoryMessages = (messages: Array<Record<string, unknown>>) => {
  const byKey = new Map<string, Record<string, unknown>>();
  const passthrough: Array<Record<string, unknown>> = [];

  for (const message of messages) {
    const key = buildWhapiHistoryMessageKey(message);
    if (!key) {
      passthrough.push(message);
      continue;
    }

    if (byKey.has(key)) {
      continue;
    }

    byKey.set(key, message);
  }

  return [...passthrough, ...byKey.values()];
};

export type SyncWhapiDirectChatMessagesParams = {
  channel: Pick<CommWhatsAppChannelRow, 'id' | 'connected_user_name' | 'phone_number'>;
  token: string;
  externalChatId: string;
  offset?: number;
  count?: number;
  timeTo?: number;
};

export type SyncWhapiDirectChatMessagesResult = {
  chatId: string;
  canonicalExternalChatId: string;
  fetched: number;
  inserted: number;
  updated: number;
  hasMore: boolean;
  nextOffset: number | null;
  timeTo: number;
  identityConflict: boolean;
};

// Nucleo compartilhado de sincronizacao de historico por conversa, usado tanto
// pela recuperacao manual de um unico chat (comm-whatsapp-sync-chat) quanto
// pela sincronizacao em lote de todo o inbox (comm-whatsapp-sync-all-chats).
export async function syncWhapiDirectChatMessages(
  supabaseAdmin: SupabaseClient,
  params: SyncWhapiDirectChatMessagesParams,
): Promise<SyncWhapiDirectChatMessagesResult> {
  const { channel, token } = params;
  const externalChatId = normalizeWhapiChatId(params.externalChatId);
  const offset = Math.max(Math.floor(Number(params.offset) || 0), 0);
  const pageSize = Math.min(Math.max(Math.floor(Number(params.count) || 100), 1), 500);
  const requestedTimeTo = Number(params.timeTo);
  const timeTo = Number.isFinite(requestedTimeTo) && requestedTimeTo > 0
    ? Math.floor(requestedTimeTo)
    : Math.floor(Date.now() / 1000);

  if (!externalChatId || !isDirectWhapiChatId(externalChatId)) {
    throw new Error('Conversa invalida para sincronizacao.');
  }

  let phoneDigits = extractPhoneFromChatId(externalChatId);
  let canonicalExternalChatId = externalChatId;
  const identity = await resolveVerifiedWhapiDirectIdentity({ token, chatId: externalChatId }).catch(() => null);
  let identityConflict = false;

  if (identity?.verified) {
    const { data: reconcileData, error: reconcileError } = await supabaseAdmin.rpc('comm_whatsapp_reconcile_lid_identifier', {
      p_channel_id: channel.id,
      p_lid_external_chat_id: identity.lidChatId,
      p_phone_external_chat_id: identity.phoneChatId,
      p_mapping_evidence: {
        round_trip_verified: true,
        source: 'comm-whatsapp-sync-chat',
      },
    });
    if (reconcileError) throw new Error(`Erro ao reconciliar identidade da conversa: ${reconcileError.message}`);

    const reconcileRow = Array.isArray(reconcileData) ? reconcileData[0] : reconcileData;
    if (!reconcileRow?.merged || !reconcileRow.external_chat_id) {
      throw new Error(`Identidade nao reconciliada: ${reconcileRow?.conflict_reason || 'sem chat canonico'}.`);
    }

    canonicalExternalChatId = reconcileRow.external_chat_id;
    phoneDigits = identity.phone;
  } else if (isWhapiLidChatId(externalChatId)) {
    phoneDigits = '';
  }

  let whapiName = await fetchWhapiChatName({ token, chatId: externalChatId }).catch(() => '');
  if (
    whapiName &&
    channel.connected_user_name &&
    whapiName.trim().toLowerCase() === channel.connected_user_name.trim().toLowerCase()
  ) {
    whapiName = '';
  }
  if (whapiName && isPhoneLabelLikeDisplayName(whapiName)) {
    whapiName = '';
  }

  const { data: ensuredData, error: ensureError } = await supabaseAdmin.rpc('comm_whatsapp_ensure_observed_chat', {
    p_channel_id: channel.id,
    p_external_chat_id: canonicalExternalChatId,
    p_phone_number: phoneDigits || null,
    p_push_name: isValidCommWhatsAppDisplayName(whapiName) ? whapiName : null,
  });
  if (ensureError) throw new Error(`Nao foi possivel preparar a conversa para sincronizacao: ${ensureError.message}`);

  const chat = (Array.isArray(ensuredData) ? ensuredData[0] : ensuredData) as {
    id: string;
    unread_count: number;
    display_name: string;
    push_name: string | null;
  } | null;
  if (!chat?.id) throw new Error('A conversa canonica nao foi retornada pela preparacao da sincronizacao.');

  if (identity?.reason === 'reverse_mismatch') {
    identityConflict = true;
    const dedupeKey = `reverse:${channel.id}:${identity.lidChatId || externalChatId}:${identity.phoneChatId || 'unknown'}`;
    const { error: conflictError } = await supabaseAdmin
      .from('comm_whatsapp_identity_conflicts')
      .upsert({
        dedupe_key: dedupeKey,
        channel_id: channel.id,
        chat_id: chat.id,
        conflict_type: 'reverse_mapping_conflict',
        status: 'open',
        details: {
          observed_chat_id: externalChatId,
          lid_chat_id: identity.lidChatId || null,
          phone_chat_id: identity.phoneChatId || null,
          source: 'comm-whatsapp-sync-chat',
        },
        updated_at: getNowIso(),
        resolved_at: null,
        resolved_by: null,
      }, { onConflict: 'dedupe_key' });
    if (conflictError) throw new Error(`Erro ao registrar conflito de identidade: ${conflictError.message}`);

    const { error: flagError } = await supabaseAdmin
      .from('comm_whatsapp_chats')
      .update({ identity_conflict: true, updated_at: getNowIso() })
      .eq('id', chat.id);
    if (flagError) throw new Error(`Erro ao sinalizar conflito de identidade: ${flagError.message}`);
  }

  const displayName = chat.display_name;
  const pushName = whapiName || (!isOwnCommWhatsAppChannelName(chat.push_name, channel.connected_user_name) ? chat.push_name : null);

  const messagePage = await fetchWhapiChatMessagesPage({
    token,
    chatId: externalChatId,
    count: pageSize,
    offset,
    timeTo,
    sort: 'asc',
  });
  const messages = dedupeWhapiHistoryMessages(messagePage.messages);
  const orderedMessages = [...messages].sort((a, b) => {
    const aTime = Number(a.timestamp ?? 0);
    const bTime = Number(b.timestamp ?? 0);
    return aTime - bTime;
  });

  let insertedCount = 0;
  let updatedCount = 0;

  for (const message of orderedMessages) {
    const reactionEvent = extractWhapiReactionEvent(message, 'messages');
    if (reactionEvent?.targetExternalMessageId) {
      await applyCommWhatsAppMessageMutation(supabaseAdmin, {
        channelId: channel.id,
        targetExternalMessageId: reactionEvent.targetExternalMessageId,
        mutationType: 'reaction',
        eventExternalMessageId: reactionEvent.eventExternalMessageId,
        occurredAt: reactionEvent.reactedAt,
        payload: {
          actor_key: reactionEvent.actorKey,
          emoji: reactionEvent.emoji,
          from_me: reactionEvent.fromMe,
          from: reactionEvent.from,
          from_name: reactionEvent.fromName,
        },
        dedupeKey: reactionEvent.eventExternalMessageId
          || `history-reaction:${reactionEvent.targetExternalMessageId}:${reactionEvent.actorKey}:${reactionEvent.reactedAt}`,
      });
      continue;
    }

    const deletedEvent = extractWhapiDeletedMessageEvent(message, 'messages');
    if (deletedEvent?.targetExternalMessageId) {
      await applyCommWhatsAppMessageMutation(supabaseAdmin, {
        channelId: channel.id,
        targetExternalMessageId: deletedEvent.targetExternalMessageId,
        mutationType: 'delete',
        eventExternalMessageId: deletedEvent.eventExternalMessageId,
        occurredAt: deletedEvent.deletedAt,
        payload: {
          original_text: deletedEvent.originalText,
          action_type: deletedEvent.actionType,
          deleted_by: deletedEvent.deletedBy,
        },
        dedupeKey: deletedEvent.eventExternalMessageId
          || `history-delete:${deletedEvent.targetExternalMessageId}:${deletedEvent.deletedAt}`,
      });
      continue;
    }

    const editedEvent = extractWhapiEditedMessageEvent(message, 'messages');
    if (editedEvent?.targetExternalMessageId && editedEvent.editedText) {
      const editedAt = editedEvent.editedAt || getNowIso();
      await applyCommWhatsAppMessageMutation(supabaseAdmin, {
        channelId: channel.id,
        targetExternalMessageId: editedEvent.targetExternalMessageId,
        mutationType: 'edit',
        eventExternalMessageId: editedEvent.eventExternalMessageId,
        occurredAt: editedAt,
        payload: {
          edited_text: editedEvent.editedText,
          original_text: editedEvent.originalText,
          action_type: editedEvent.actionType,
        },
        dedupeKey: editedEvent.eventExternalMessageId
          || `history-edit:${editedEvent.targetExternalMessageId}:${editedAt}`,
      });
      continue;
    }

    const direction = message.from_me === true ? 'outbound' : 'inbound';
    const messageAt = unixTimestampToIso(message.timestamp) || getNowIso();
    const externalMessageId = extractWhapiMessageId(message);
    const mediaMeta = extractWhapiMediaMeta(message);
    const linkPreviewMeta = extractWhapiLinkPreviewMeta(message);
    const quoteMeta = extractWhapiQuotedMessageMeta(message);
    const contactCardMeta = extractWhapiContactCardMeta(message);
    const summaryText = summarizeWhapiMessage(message);

    if (!externalMessageId) {
      // Mensagens sem id externo (resyncs de historico antigo) nao voltam a
      // ser inseridas quando ja existe conteudo identico (media ou texto) no
      // mesmo chat/direcao/tipo. Nao depende de message_at exato: re-imports
      // com timestamp ausente (fallback para agora) recriavam duplicatas.
      const hasContentSignal = Boolean(mediaMeta.mediaId || normalizeCommWhatsAppSemanticText(summaryText).length > 0);
      const canCheckSemanticDuplicate = hasContentSignal && (
        Boolean(mediaMeta.mediaId)
        || (toTrimmedString(message.type) || 'text') === 'text'
      );

      if (canCheckSemanticDuplicate) {
        let existingMessageQuery = supabaseAdmin
          .from('comm_whatsapp_messages')
          .select('id')
          .eq('chat_id', chat.id)
          .eq('direction', direction)
          .eq('message_type', toTrimmedString(message.type) || 'text');

        if (mediaMeta.mediaId) {
          existingMessageQuery = existingMessageQuery.eq('media_id', mediaMeta.mediaId);
        } else if ((normalizeCommWhatsAppSemanticText(summaryText).length || 0) > 0) {
          existingMessageQuery = existingMessageQuery.eq('text_content', summaryText);
        }

        const { data: existingMessage, error: existingMessageError } = await existingMessageQuery
          .limit(1)
          .maybeSingle();

        if (existingMessageError) {
          throw new Error(`Erro ao verificar duplicata sem ID externo: ${existingMessageError.message}`);
        }

        if (existingMessage) {
          updatedCount += 1;
          continue;
        }
      }
    }

    const persisted = await persistCommWhatsAppMessage(supabaseAdmin, {
      channelId: channel.id,
      externalChatId,
      phoneNumber: phoneDigits,
      displayName,
      pushName,
      lastMessageText: summaryText,
      lastMessageDirection: direction,
      lastMessageAt: messageAt,
      incrementUnread: false,
      externalMessageId: externalMessageId || null,
      direction,
      messageType: toTrimmedString(message.type) || 'text',
      deliveryStatus: toTrimmedString(message.status) || (direction === 'inbound' ? 'received' : 'sent'),
      textContent: summaryText,
      createdBy: null,
      source: toTrimmedString(message.source) || null,
      senderName: getDirectChatDisplayNameCandidate(message, direction) || (direction === 'outbound' ? displayName : whapiName) || null,
      senderPhone: direction === 'outbound' ? channel.phone_number || null : phoneDigits,
      statusUpdatedAt: messageAt,
      errorMessage: null,
      mediaId: mediaMeta.mediaId,
      mediaUrl: mediaMeta.mediaUrl,
      mediaMimeType: mediaMeta.mediaMimeType,
      mediaFileName: mediaMeta.mediaFileName,
      mediaSizeBytes: mediaMeta.mediaSizeBytes,
      mediaDurationSeconds: mediaMeta.mediaDurationSeconds,
      mediaCaption: mediaMeta.mediaCaption,
      metadata: {
        from_me: message.from_me === true,
        chat_id: externalChatId,
        from: toTrimmedString(message.from) || null,
        from_name: toTrimmedString(message.from_name) || null,
        chat_name: toTrimmedString(message.chat_name) || null,
        link_preview: linkPreviewMeta,
        ...(quoteMeta ? { quote: quoteMeta } : {}),
        ...(contactCardMeta ? { contact_card: contactCardMeta } : {}),
      },
    });

    if (persisted.inserted) {
      insertedCount += 1;
    } else {
      updatedCount += 1;
    }
  }

  const hasMore = messagePage.hasMore && messagePage.nextOffset > offset;

  return {
    chatId: chat.id,
    canonicalExternalChatId,
    fetched: orderedMessages.length,
    inserted: insertedCount,
    updated: updatedCount,
    hasMore,
    nextOffset: hasMore ? messagePage.nextOffset : null,
    timeTo,
    identityConflict,
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
