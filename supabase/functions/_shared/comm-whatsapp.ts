// @ts-ignore Deno npm import
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
  metadata: Record<string, unknown>;
};

export type CommWhatsAppPersistMessageResult = {
  chatId: string;
  messageId: string;
  inserted: boolean;
  unreadCount: number;
  summaryUpdated: boolean;
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
  const chatName = toTrimmedString(message.chat_name);
  const fromName = toTrimmedString(message.from_name);

  if (direction === 'outbound') {
    return chatName;
  }

  return chatName || fromName;
};

export const isPhoneLabelLikeDisplayName = (value: string): boolean => {
  const trimmed = value.trim();
  if (!trimmed) return true;

  const withoutSymbols = trimmed.replace(/[\s()+-]/g, '');
  return /^\+?\d+$/.test(withoutSymbols);
};

const readNestedBody = (container: unknown, key: string): string => {
  if (!isRecord(container)) return '';
  const nested = container[key];
  if (!isRecord(nested)) return '';
  return toTrimmedString(nested.body);
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

  const reply = isRecord(message.reply) ? message.reply : null;
  if (reply) {
    const buttonsReply = isRecord(reply.buttons_reply) ? reply.buttons_reply : null;
    const listReply = isRecord(reply.list_reply) ? reply.list_reply : null;
    const replyTitle = toTrimmedString(buttonsReply?.title) || toTrimmedString(listReply?.title);
    if (replyTitle) return replyTitle;
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
    default:
      return '[Mensagem]';
  }
};

export const parseWhapiError = (payload: unknown): string => {
  if (typeof payload === 'string' && payload.trim()) {
    return payload.trim();
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

export const extractWhapiChatName = (payload: unknown): string => {
  if (!isRecord(payload)) return '';

  const directName = toTrimmedString(payload.name) || toTrimmedString(payload.chat_name);
  if (directName) return directName;

  if (isRecord(payload.contact)) {
    const contactName = toTrimmedString(payload.contact.name) || toTrimmedString(payload.contact.pushname);
    if (contactName) return contactName;
  }

  if (isRecord(payload.last_message)) {
    const lastMessageName = toTrimmedString(payload.last_message.chat_name) || toTrimmedString(payload.last_message.from_name);
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
