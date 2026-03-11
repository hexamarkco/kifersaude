import { supabase } from './supabase';

interface WhatsAppSettings {
  token: string;
  enabled?: boolean;
}

const WHAPI_BASE_URL = 'https://gate.whapi.cloud';

const DIRECT_CHAT_SUFFIXES = ['@s.whatsapp.net', '@c.us', '@lid'] as const;
const GROUP_CHAT_SUFFIX = '@g.us';
const NEWSLETTER_CHAT_SUFFIX = '@newsletter';
const BROADCAST_CHAT_SUFFIX = '@broadcast';
const STATUS_CHAT_ID = 'status@broadcast';

export type WhatsAppChatKind = 'group' | 'direct' | 'newsletter' | 'broadcast' | 'status' | 'unknown';

export function getWhatsAppChatKind(chatId: string): WhatsAppChatKind {
  if (!chatId) return 'unknown';

  const normalized = chatId.trim().toLowerCase();
  if (!normalized) return 'unknown';

  if (normalized.endsWith(GROUP_CHAT_SUFFIX)) return 'group';
  if (normalized === STATUS_CHAT_ID || normalized === 'stories') return 'status';
  if (normalized.endsWith(NEWSLETTER_CHAT_SUFFIX)) return 'newsletter';
  if (normalized.endsWith(BROADCAST_CHAT_SUFFIX)) return 'broadcast';
  if (DIRECT_CHAT_SUFFIXES.some((suffix) => normalized.endsWith(suffix))) return 'direct';

  if (!normalized.includes('@')) {
    const digits = normalized.replace(/\D/g, '');
    if (digits.length >= 7 && digits.length <= 15) {
      return 'direct';
    }
  }

  return 'unknown';
}

export function isDirectWhatsAppChatId(chatId: string): boolean {
  return getWhatsAppChatKind(chatId) === 'direct';
}

function sanitizeWhapiToken(rawToken: string): string {
  if (!rawToken) return '';

  return rawToken.replace(/^Bearer\s+/i, '').trim();
}

type WhapiContactStatus = 'valid' | 'invalid';

type WhapiContactResponse = {
  contacts?: Array<{
    input?: string;
    status?: WhapiContactStatus;
    wa_id?: string;
  }>;
};

function formatApiError(errorObj: unknown): string {
  if (typeof errorObj === 'object' && errorObj !== null) {
    const record = errorObj as Record<string, unknown>;

    if (typeof record.error === 'string') {
      return record.error;
    }

    if (record.error && typeof record.error === 'object') {
      const nestedError = record.error as Record<string, unknown>;
      if (typeof nestedError.message === 'string') {
        return nestedError.message;
      }
    }

    if (typeof record.message === 'string') {
      return record.message;
    }

    if (typeof record.details === 'string') {
      return record.details;
    }

    if (Array.isArray(record.details)) {
      return record.details.join(', ');
    }
  }

  if (typeof errorObj === 'string') {
    return errorObj;
  }

  try {
    return JSON.stringify(errorObj);
  } catch {
    return 'Erro ao processar resposta da API';
  }
}

async function getWhatsAppSettings(): Promise<WhatsAppSettings> {
  const { data, error } = await supabase
    .from('integration_settings')
    .select('settings')
    .eq('slug', 'whatsapp_auto_contact')
    .maybeSingle();

  if (error || !data?.settings) {
    throw new Error('Integração de mensagens automáticas não configurada.');
  }

  const rawSettings =
    data.settings && typeof data.settings === 'object'
      ? (data.settings as Record<string, unknown>)
      : {};
  const token = sanitizeWhapiToken(
    typeof rawSettings.apiKey === 'string'
      ? rawSettings.apiKey
      : typeof rawSettings.token === 'string'
        ? rawSettings.token
        : '',
  );

  if (!token) {
    throw new Error('Token da Whapi Cloud não configurado. Verifique as configurações em Automação do WhatsApp.');
  }

  return {
    token,
    enabled: typeof rawSettings.enabled === 'boolean' ? rawSettings.enabled : undefined,
  };
}

export function normalizeChatId(chatIdOrPhone: string): string {
  if (!chatIdOrPhone) return chatIdOrPhone;

  const trimmed = chatIdOrPhone.trim();
  if (!trimmed) return trimmed;

  if (!trimmed.includes('@')) {
    return buildChatIdFromPhone(trimmed);
  }

  if (/@c\.us$/i.test(trimmed)) {
    return trimmed.replace(/@c\.us$/i, '@s.whatsapp.net');
  }

  if (/@s\.whatsapp\.net$/i.test(trimmed)) {
    return trimmed.replace(/(@s\.whatsapp\.net)+$/i, '@s.whatsapp.net');
  }

  const chatKind = getWhatsAppChatKind(trimmed);
  if (chatKind !== 'unknown') {
    return trimmed;
  }

  return trimmed;
}

function normalizePhoneFromChatId(chatId: string): string | null {
  const normalizedChatId = normalizeChatId(chatId);

  if (!normalizedChatId.endsWith('@s.whatsapp.net')) return null;

  const phone = normalizedChatId.replace(/@s\.whatsapp\.net$/, '').replace(/\D/g, '');

  return phone || null;
}

async function validateWhatsAppRecipient(chatId: string, token: string): Promise<string> {
  const phone = normalizePhoneFromChatId(chatId);

  if (!phone) return chatId;

  console.info('[WhatsAppAPI] Validando destinatário com Check phones', {
    endpoint: `${WHAPI_BASE_URL}/contacts`,
    body: { contacts: [phone], force_check: false },
  });

  const response = await fetch(`${WHAPI_BASE_URL}/contacts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      contacts: [phone],
      force_check: false,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro ao validar contato' }));
    throw new Error(formatApiError(error));
  }

  const data = (await response.json().catch(() => ({}))) as WhapiContactResponse;
  const contactInfo = data.contacts?.[0];

  if (!contactInfo || contactInfo.status !== 'valid' || !contactInfo.wa_id) {
    throw new Error('Número não possui WhatsApp ou é inválido.');
  }

  const normalizedWaId = normalizeChatId(contactInfo.wa_id);

  console.info('[WhatsAppAPI] Resultado do Check phones', {
    contact: contactInfo.input,
    status: contactInfo.status,
    wa_id: normalizedWaId,
  });

  return normalizedWaId;
}

function isInvalidRecipientError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes('nao possui whatsapp') ||
    normalized.includes('não possui whatsapp') ||
    normalized.includes('recipient not found') ||
    normalized.includes('recipient does not exist') ||
    normalized.includes('does not exist') ||
    normalized.includes('not on whatsapp') ||
    normalized.includes('chat not found') ||
    normalized.includes('invalid chatid') ||
    normalized.includes('invalid wid') ||
    normalized.includes('invalido') ||
    normalized.includes('inválido')
  );
}

function shouldFallbackAfterRecipientValidation(errorMessage: string): boolean {
  const normalized = errorMessage.toLowerCase();

  if (!normalized) return true;
  if (isInvalidRecipientError(normalized)) return false;

  if (
    normalized.includes('token da whapi') ||
    normalized.includes('autentica') ||
    normalized.includes('unauthorized') ||
    normalized.includes('forbidden')
  ) {
    return false;
  }

  return true;
}

function buildRecipientCandidates(chatId: string, validatedRecipient?: string | null): string[] {
  const normalized = normalizeChatId(chatId);
  const candidates = new Set<string>();

  const add = (value: string | null | undefined) => {
    if (!value) return;
    const trimmed = value.trim();
    if (trimmed) candidates.add(trimmed);
  };

  add(validatedRecipient);
  add(normalized);

  if (/@s\.whatsapp\.net$/i.test(normalized)) {
    add(normalized.replace(/@s\.whatsapp\.net$/i, '@c.us'));
  }

  if (/@c\.us$/i.test(normalized)) {
    add(normalized.replace(/@c\.us$/i, '@s.whatsapp.net'));
  }

  const digits = normalized.replace(/@.+$/, '').replace(/\D/g, '');
  if (digits.length >= 10 && digits.length <= 15) {
    add(`${digits}@s.whatsapp.net`);
    add(`${digits}@c.us`);
  }

  return Array.from(candidates);
}

async function resolveSendRecipientCandidates(chatId: string, token: string): Promise<string[]> {
  try {
    const validatedRecipient = await validateWhatsAppRecipient(chatId, token);
    return buildRecipientCandidates(chatId, validatedRecipient);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (!shouldFallbackAfterRecipientValidation(errorMessage)) {
      throw error;
    }

    console.warn('[WhatsAppAPI] Falha ao validar destinatário; tentando envio direto', {
      chatId,
      error: errorMessage,
    });

    return buildRecipientCandidates(chatId);
  }
}

function canRetryWithAlternateRecipient(status: number, errorMessage: string): boolean {
  if (![400, 404, 409, 422].includes(status)) return false;

  const normalized = errorMessage.toLowerCase();
  return (
    normalized.includes('recipient') ||
    normalized.includes('chat') ||
    normalized.includes('invalid') ||
    normalized.includes('invalido') ||
    normalized.includes('inválido') ||
    normalized.includes('not found') ||
    normalized.includes('does not exist') ||
    normalized.includes('wid')
  );
}

export interface MediaContent {
  mimetype?: string;
  data?: string;
  url?: string;
  filename?: string;
  caption?: string;
  preview?: string;
  width?: number;
  height?: number;
  mentions?: string[];
  viewOnce?: boolean;
  seconds?: number;
  waveform?: string;
  recordingTime?: number;
  autoplay?: boolean;
}

export interface SendMessageParams {
  chatId: string;
  contentType:
    | 'string'
    | 'image'
    | 'video'
    | 'gif'
    | 'short'
    | 'audio'
    | 'voice'
    | 'document'
    | 'Location'
    | 'Contact'
    | 'LinkPreview';
  content: string | MediaContent | {
    latitude?: number;
    longitude?: number;
    description?: string;
    contactId?: string;
    name?: string;
    vcard?: string;
    body?: string;
    title?: string;
    canonical?: string;
    preview?: string;
    media?: MediaContent;
  };
  quotedMessageId?: string;
  editMessageId?: string;
}

export async function sendWhatsAppMessage(params: SendMessageParams) {
  const settings = await getWhatsAppSettings();

  const normalizedChatId = normalizeChatId(params.chatId);
  const recipientCandidates = await resolveSendRecipientCandidates(normalizedChatId, settings.token);

  let endpoint = '';
  const body: Record<string, unknown> = {};

  if (params.quotedMessageId) {
    body.quoted = params.quotedMessageId;
  }

  if (params.editMessageId) {
    body.edit = params.editMessageId;
  }

  if (params.contentType === 'string') {
    endpoint = '/messages/text';
    body.body = params.content as string;
  } else if (['image', 'video', 'gif', 'short', 'audio', 'voice', 'document'].includes(params.contentType) && typeof params.content === 'object') {
    const media = params.content as MediaContent;

    endpoint = `/messages/${params.contentType}`;

    if (media.url) {
      body.media = media.url;
    } else if (media.data) {
      const useRawBase64 = ['audio', 'voice'].includes(params.contentType);
      body.media = useRawBase64 ? media.data : `data:${media.mimetype};base64,${media.data}`;
    } else {
      throw new Error('Mídia deve conter URL ou dados base64');
    }

    if (media.mimetype) {
      body.mime_type = media.mimetype;
    }

    if (media.caption) {
      body.caption = media.caption;
    }

    if (media.filename && params.contentType === 'document') {
      body.filename = media.filename;
    }

    if (media.preview) {
      body.preview = media.preview;
    }

    if (media.width) {
      body.width = media.width;
    }

    if (media.height) {
      body.height = media.height;
    }

    if (media.mentions && media.mentions.length > 0) {
      body.mentions = media.mentions;
    }

    if (media.viewOnce !== undefined) {
      body.view_once = media.viewOnce;
    }

    if (media.seconds !== undefined && ['audio', 'voice'].includes(params.contentType)) {
      body.seconds = media.seconds;
    }

    if (media.waveform && params.contentType === 'voice') {
      body.waveform = media.waveform;
    }

    if (media.recordingTime !== undefined && params.contentType === 'voice') {
      body.recording_time = media.recordingTime;
    }

    if (media.autoplay !== undefined && params.contentType === 'gif') {
      body.autoplay = media.autoplay;
    }
  } else if (params.contentType === 'Location' && typeof params.content === 'object') {
    endpoint = '/messages/location';
    const location = params.content as { latitude?: number; longitude?: number; description?: string };
    body.latitude = location.latitude;
    body.longitude = location.longitude;
    if (location.description) {
      body.address = location.description;
    }
  } else if (params.contentType === 'Contact' && typeof params.content === 'object') {
    endpoint = '/messages/contact';
    const contact = params.content as { name?: string; vcard?: string; contactId?: string };
    if (contact.vcard) {
      body.contact = {
        name: contact.name || 'Contato',
        vcard: contact.vcard,
      };
    } else if (contact.contactId) {
      body.contact = { id: contact.contactId };
    } else {
      throw new Error('Contato inválido para envio');
    }
  } else if (params.contentType === 'LinkPreview' && typeof params.content === 'object') {
    endpoint = '/messages/link_preview';
    const linkPreview = params.content as {
      body?: string;
      title?: string;
      description?: string;
      canonical?: string;
      preview?: string;
      media?: MediaContent;
    };
    if (!linkPreview.body || !linkPreview.title) {
      throw new Error('Link preview exige body e title');
    }
    body.body = linkPreview.body;
    body.title = linkPreview.title;
    if (linkPreview.description) body.description = linkPreview.description;
    if (linkPreview.canonical) body.canonical = linkPreview.canonical;
    if (linkPreview.preview) body.preview = linkPreview.preview;
    if (linkPreview.media) {
      if (linkPreview.media.url) {
        body.media = linkPreview.media.url;
      } else if (linkPreview.media.data) {
        body.media = `data:${linkPreview.media.mimetype};base64,${linkPreview.media.data}`;
      }
      if (linkPreview.media.mimetype) body.mime_type = linkPreview.media.mimetype;
      if (linkPreview.media.mentions && linkPreview.media.mentions.length > 0) {
        body.mentions = linkPreview.media.mentions;
      }
    }
  } else {
    throw new Error('Tipo de conteúdo não suportado');
  }

  let lastErrorMessage = 'Erro desconhecido ao enviar mensagem';

  for (let index = 0; index < recipientCandidates.length; index += 1) {
    const recipient = recipientCandidates[index];
    const requestBody = {
      ...body,
      to: recipient,
    };

    console.info('[WhatsAppAPI] Enviando requisição para Whapi Cloud', {
      endpoint: `${WHAPI_BASE_URL}${endpoint}`,
      body: requestBody,
      attempt: index + 1,
      totalAttempts: recipientCandidates.length,
    });

    const response = await fetch(`${WHAPI_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.token}`,
        'Accept': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (response.ok) {
      return response.json();
    }

    const error = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
    const errorMessage = formatApiError(error);
    lastErrorMessage = errorMessage;

    const hasAlternateRecipient = index < recipientCandidates.length - 1;
    if (hasAlternateRecipient && canRetryWithAlternateRecipient(response.status, errorMessage)) {
      console.warn('[WhatsAppAPI] Falha ao enviar com destinatário atual; tentando alternativa', {
        recipient,
        status: response.status,
        error: errorMessage,
      });
      continue;
    }

    throw new Error(errorMessage);
  }

  throw new Error(lastErrorMessage);
}

type WhapiPresenceState = 'typing' | 'recording';

function normalizePresenceEntryId(chatId: string): string {
  const normalizedChatId = normalizeChatId(chatId);
  if (/@s\.whatsapp\.net$/i.test(normalizedChatId)) {
    return normalizedChatId.replace(/@s\.whatsapp\.net$/i, '@c.us');
  }

  return normalizedChatId;
}

async function sendPresenceState(chatId: string, presence: WhapiPresenceState) {
  const settings = await getWhatsAppSettings();
  const entryId = normalizePresenceEntryId(chatId);

  const response = await fetch(`${WHAPI_BASE_URL}/presences/${encodeURIComponent(entryId)}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${settings.token}`,
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      presence,
      delay: 3,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
    const presenceLabel = presence === 'typing' ? 'digitação' : 'gravação';
    console.error(`Erro ao enviar estado de ${presenceLabel}: ${formatApiError(error)}`);
  }

  return response.ok;
}

export async function sendTypingState(chatId: string) {
  return sendPresenceState(chatId, 'typing');
}

export async function sendRecordingState(chatId: string) {
  return sendPresenceState(chatId, 'recording');
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const base64 = reader.result as string;
      const base64Data = base64.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = error => reject(error);
  });
}

export function detectMediaType(mimetype: string): 'image' | 'video' | 'audio' | 'voice' | 'document' {
  if (mimetype.startsWith('image/')) {
    return 'image';
  } else if (mimetype.startsWith('video/')) {
    return 'video';
  } else if (mimetype.startsWith('audio/')) {
    return 'audio';
  } else {
    return 'document';
  }
}

export async function sendMediaMessage(
  chatId: string,
  file: File,
  options?: {
    caption?: string;
    quotedMessageId?: string;
    viewOnce?: boolean;
    asVoice?: boolean;
    seconds?: number;
    recordingTime?: number;
    waveform?: string;
  }
) {
  const base64Data = await fileToBase64(file);
  const mimetype = file.type;
  let contentType = detectMediaType(mimetype);

  if (options?.asVoice && mimetype.startsWith('audio/')) {
    contentType = 'voice';
  }

  const mediaContent: MediaContent = {
    mimetype,
    data: base64Data,
    filename: file.name,
    caption: options?.caption,
    viewOnce: options?.viewOnce,
    seconds: options?.seconds,
    recordingTime: options?.recordingTime,
    waveform: options?.waveform,
  };

  return sendWhatsAppMessage({
    chatId,
    contentType,
    content: mediaContent,
    quotedMessageId: options?.quotedMessageId,
  });
}

export interface WhapiChat {
  id: string;
  name?: string;
  type?: string;
  timestamp?: number;
  last_message?: {
    id: string;
    type: string;
    timestamp: number;
    from_me: boolean;
  };
  unread_count?: number;
  archived?: boolean;
  pinned?: number;
  mute_until?: number;
}

export interface WhapiChatListResponse {
  chats: WhapiChat[];
  count: number;
  total: number;
  offset: number;
}

export interface WhapiChatMetadata {
  id: string;
  name?: string;
  type?: string;
  timestamp?: number;
  unread_count?: number;
  archived?: boolean;
  pinned?: number;
  mute_until?: number;
  description?: string;
}

export interface WhapiNewsletter {
  id: string;
  name?: string;
  type?: string;
  timestamp?: number;
  unread?: number;
  read_only?: boolean;
  description?: string;
  [key: string]: unknown;
}

export interface WhapiGroup {
  id: string;
  name?: string;
  type?: string;
  timestamp?: number;
  chat_pic?: string;
  chat_pic_full?: string;
  participants_count?: number;
  [key: string]: unknown;
}

export interface WhapiGroupListResponse {
  groups: WhapiGroup[];
  count: number;
  total: number;
  offset: number;
}

export interface WhapiNewsletterListResponse {
  newsletters: WhapiNewsletter[];
  count: number;
  total: number;
  offset: number;
}

function normalizeWhapiGroupListPayload(payload: unknown, requestedOffset: number): WhapiGroupListResponse {
  if (Array.isArray(payload)) {
    const groups = payload.filter((item): item is WhapiGroup => Boolean(item && typeof item === 'object' && 'id' in item));
    return {
      groups,
      count: groups.length,
      total: groups.length,
      offset: requestedOffset,
    };
  }

  if (payload && typeof payload === 'object') {
    const raw = payload as {
      groups?: unknown;
      count?: unknown;
      total?: unknown;
      offset?: unknown;
      id?: unknown;
    };

    if (Array.isArray(raw.groups)) {
      const groups = raw.groups.filter(
        (item): item is WhapiGroup => Boolean(item && typeof item === 'object' && 'id' in item),
      );
      const count = typeof raw.count === 'number' ? raw.count : groups.length;
      const total = typeof raw.total === 'number' ? raw.total : Math.max(count, groups.length);
      const offset = typeof raw.offset === 'number' ? raw.offset : requestedOffset;
      return { groups, count, total, offset };
    }

    if (typeof raw.id === 'string') {
      return {
        groups: [raw as unknown as WhapiGroup],
        count: 1,
        total: 1,
        offset: requestedOffset,
      };
    }
  }

  return {
    groups: [],
    count: 0,
    total: 0,
    offset: requestedOffset,
  };
}

export async function getWhatsAppChat(chatId: string): Promise<WhapiChatMetadata> {
  const settings = await getWhatsAppSettings();

  const response = await fetch(`${WHAPI_BASE_URL}/chats/${encodeURIComponent(chatId)}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${settings.token}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
    throw new Error(formatApiError(error));
  }

  return response.json();
}

export interface WhapiContact {
  id: string;
  name: string;
  pushname: string;
  is_business: boolean;
  profile_pic?: string | null;
  profile_pic_full?: string | null;
  status?: string | null;
  saved: boolean;
}

export interface WhapiContactListResponse {
  contacts: WhapiContact[];
  count: number;
  total: number;
  offset: number;
}

export interface WhapiMessageListParams {
  chatId: string;
  count?: number;
  offset?: number;
  timeFrom?: number;
  timeTo?: number;
  normalTypes?: boolean;
  author?: string;
  fromMe?: boolean;
  sort?: 'asc' | 'desc';
}

export interface WhapiMessage {
  id: string;
  type: string;
  subtype?: string;
  chat_id: string;
  chat_name?: string;
  from?: string;
  from_me: boolean;
  from_name?: string;
  source?: string;
  timestamp: number;
  device_id?: number;
  status?: string;
  text?: {
    body: string;
  };
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
  contact?: {
    name: string;
    vcard: string;
  };
  reactions?: Array<{
    id: string;
    emoji: string;
    group_key?: string;
    t?: number;
    unread?: boolean;
    count?: number;
  }>;
  context?: {
    quoted_id?: string;
    quoted_author?: string;
    quoted_type?: string;
  };
}

export interface WhapiMessageListResponse {
  messages: WhapiMessage[];
  count: number;
  total: number;
  offset: number;
  first: number;
  last: number;
}

export async function getWhatsAppChats(count: number = 100, offset: number = 0): Promise<WhapiChatListResponse> {
  const settings = await getWhatsAppSettings();

  const queryParams = new URLSearchParams();
  queryParams.append('count', count.toString());
  queryParams.append('offset', offset.toString());

  const response = await fetch(`${WHAPI_BASE_URL}/chats?${queryParams.toString()}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${settings.token}`,
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
    throw new Error(formatApiError(error));
  }

  return response.json();
}

export async function getWhatsAppNewsletters(
  count: number = 100,
  offset: number = 0,
): Promise<WhapiNewsletterListResponse> {
  const settings = await getWhatsAppSettings();

  const queryParams = new URLSearchParams();
  queryParams.append('count', count.toString());
  queryParams.append('offset', offset.toString());

  const response = await fetch(`${WHAPI_BASE_URL}/newsletters?${queryParams.toString()}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${settings.token}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
    throw new Error(formatApiError(error));
  }

  return response.json();
}

export async function getWhatsAppGroups(
  count: number = 100,
  offset: number = 0,
  resync: boolean = false,
): Promise<WhapiGroupListResponse> {
  const settings = await getWhatsAppSettings();

  const queryParams = new URLSearchParams();
  queryParams.append('count', count.toString());
  queryParams.append('offset', offset.toString());
  queryParams.append('resync', String(resync));

  const response = await fetch(`${WHAPI_BASE_URL}/groups?${queryParams.toString()}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${settings.token}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
    throw new Error(formatApiError(error));
  }

  const payload = await response.json().catch(() => []);
  return normalizeWhapiGroupListPayload(payload, offset);
}

export async function getWhatsAppContacts(count: number = 500, offset: number = 0): Promise<WhapiContactListResponse> {
  const settings = await getWhatsAppSettings();

  const queryParams = new URLSearchParams();
  queryParams.append('count', count.toString());
  queryParams.append('offset', offset.toString());

  const response = await fetch(`${WHAPI_BASE_URL}/contacts?${queryParams.toString()}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${settings.token}`,
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
    throw new Error(formatApiError(error));
  }

  return response.json();
}

export interface WhatsAppMediaResponse {
  url?: string;
  data?: Blob;
  fileName?: string | null;
  mimeType?: string;
  objectUrl?: string;
}

const whatsappMediaCache = new Map<string, WhatsAppMediaResponse>();
const whatsappMediaRequestCache = new Map<string, Promise<WhatsAppMediaResponse>>();

function materializeCachedObjectUrl(cached: WhatsAppMediaResponse): WhatsAppMediaResponse {
  if (cached.objectUrl || !cached.data) {
    return cached;
  }

  const objectUrl = URL.createObjectURL(cached.data);
  const nextCached = { ...cached, objectUrl };
  return nextCached;
}

export async function getWhatsAppMedia(
  mediaId: string,
  options?: {
    preferObjectUrl?: boolean;
    forceRefresh?: boolean;
  },
): Promise<WhatsAppMediaResponse> {
  const cacheKey = mediaId.trim();
  if (!cacheKey) {
    throw new Error('mediaId obrigatorio.');
  }

  const cached = !options?.forceRefresh ? whatsappMediaCache.get(cacheKey) : undefined;
  if (cached) {
    if (options?.preferObjectUrl) {
      const nextCached = materializeCachedObjectUrl(cached);
      if (nextCached !== cached) {
        whatsappMediaCache.set(cacheKey, nextCached);
      }
      return nextCached;
    }

    return cached;
  }

  const pending = !options?.forceRefresh ? whatsappMediaRequestCache.get(cacheKey) : undefined;
  if (pending) {
    const response = await pending;
    if (options?.preferObjectUrl) {
      const nextCached = materializeCachedObjectUrl(response);
      if (nextCached !== response) {
        whatsappMediaCache.set(cacheKey, nextCached);
      }
      return nextCached;
    }

    return response;
  }

  const request = (async (): Promise<WhatsAppMediaResponse> => {
    const { data, error } = await supabase.functions.invoke('whatsapp-media', {
      body: { mediaId: cacheKey },
    });

    if (error) {
      throw error;
    }

    const payload =
      data && typeof data === 'object'
        ? (data as { data?: string; mimeType?: string; fileName?: string | null; url?: string })
        : null;

    if (!payload) {
      throw new Error('Resposta invalida ao carregar midia do WhatsApp.');
    }

    if (payload.url) {
      return {
        url: payload.url,
        fileName: payload.fileName ?? null,
        mimeType: payload.mimeType,
      };
    }

    if (!payload.data) {
      throw new Error('Resposta invalida ao carregar midia do WhatsApp.');
    }

    const binaryString = atob(payload.data);
    const bytes = new Uint8Array(binaryString.length);
    for (let index = 0; index < binaryString.length; index += 1) {
      bytes[index] = binaryString.charCodeAt(index);
    }

    return {
      data: new Blob([bytes], {
        type: payload.mimeType || 'application/octet-stream',
      }),
      fileName: payload.fileName ?? null,
      mimeType: payload.mimeType || 'application/octet-stream',
    };
  })();

  whatsappMediaRequestCache.set(cacheKey, request);

  try {
    const response = await request;
    const nextCached = options?.preferObjectUrl ? materializeCachedObjectUrl(response) : response;
    whatsappMediaCache.set(cacheKey, nextCached);
    return nextCached;
  } finally {
    whatsappMediaRequestCache.delete(cacheKey);
  }
}

export async function reactToMessage(messageId: string, emoji: string) {
  const settings = await getWhatsAppSettings();
  const response = await fetch(`${WHAPI_BASE_URL}/messages/${encodeURIComponent(messageId)}/reaction`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.token}`,
      Accept: 'application/json',
    },
    body: JSON.stringify({ emoji }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
    throw new Error(formatApiError(error));
  }

  return response.json();
}

export async function removeReactionFromMessage(messageId: string) {
  const settings = await getWhatsAppSettings();
  const response = await fetch(`${WHAPI_BASE_URL}/messages/${encodeURIComponent(messageId)}/reaction`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${settings.token}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
    throw new Error(formatApiError(error));
  }

  return response.json();
}

export function buildChatIdFromPhone(phoneNumber: string): string {
  const cleanPhone = phoneNumber.replace(/\D/g, '');

  let formattedPhone = cleanPhone;
  if (!formattedPhone.startsWith('55')) {
    formattedPhone = '55' + formattedPhone;
  }

  return `${formattedPhone}@s.whatsapp.net`;
}

export async function getChatIdByPhone(phoneNumber: string): Promise<string | null> {
  const directChatId = buildChatIdFromPhone(phoneNumber);

  try {
    const testResponse = await getWhatsAppMessageHistory({
      chatId: directChatId,
      count: 1,
      offset: 0,
    });

    if (testResponse.messages.length > 0 || testResponse.total >= 0) {
      return directChatId;
    }
  } catch {
    console.log('Chat ID direto não funcionou, buscando em todos os chats...');
  }

  let offset = 0;
  const limit = 100;
  let hasMore = true;
  const cleanPhone = phoneNumber.replace(/\D/g, '');

  while (hasMore) {
    const response = await getWhatsAppChats(limit, offset);

    const matchingChat = response.chats.find(chat => {
      const chatPhone = chat.id.replace(/\D/g, '');
      return chatPhone.includes(cleanPhone) || cleanPhone.includes(chatPhone);
    });

    if (matchingChat) {
      return matchingChat.id;
    }

    offset += limit;
    hasMore = response.chats.length === limit && offset < response.total;
  }

  return null;
}

async function fetchMessagesBatch(
  settings: WhatsAppSettings,
  chatId: string,
  params: Omit<WhapiMessageListParams, 'chatId'>,
  fromMe: boolean
): Promise<WhapiMessageListResponse> {
  const queryParams = new URLSearchParams();

  if (params.count !== undefined) {
    queryParams.append('count', params.count.toString());
  }

  if (params.offset !== undefined) {
    queryParams.append('offset', params.offset.toString());
  }

  if (params.timeFrom !== undefined) {
    queryParams.append('time_from', params.timeFrom.toString());
  }

  if (params.timeTo !== undefined) {
    queryParams.append('time_to', params.timeTo.toString());
  }

  if (params.normalTypes !== undefined) {
    queryParams.append('normal_types', params.normalTypes.toString());
  }

  if (params.author) {
    queryParams.append('author', params.author);
  }

  queryParams.append('from_me', fromMe.toString());

  if (params.sort) {
    queryParams.append('sort', params.sort);
  }

  const url = `${WHAPI_BASE_URL}/messages/list/${encodeURIComponent(chatId)}?${queryParams.toString()}`;

  console.log(`[WhatsApp API] Buscando mensagens (from_me: ${fromMe})`);
  console.log(`[WhatsApp API] URL: ${url}`);
  console.log(`[WhatsApp API] Chat ID: ${chatId}`);
  console.log(`[WhatsApp API] Parâmetros:`, Object.fromEntries(queryParams));

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${settings.token}`,
      'Accept': 'application/json',
    },
  });

  console.log(`[WhatsApp API] Status da resposta: ${response.status}`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
    console.error(`[WhatsApp API] Erro na requisição:`, error);
    throw new Error(formatApiError(error));
  }

  const data = await response.json();
  console.log(`[WhatsApp API] RESPOSTA COMPLETA DA API (from_me: ${fromMe}):`, data);
  console.log(`[WhatsApp API] Mensagens recebidas (from_me: ${fromMe}):`, data.count, 'mensagens');
  console.log(`[WhatsApp API] Total disponível: ${data.total}`);
  console.log(`[WhatsApp API] Array de mensagens:`, data.messages);
  console.log(`[WhatsApp API] Tipo do array:`, typeof data.messages, Array.isArray(data.messages));
  console.log(`[WhatsApp API] Tamanho do array:`, data.messages?.length);

  return data;
}

export async function getWhatsAppMessageHistory(params: WhapiMessageListParams): Promise<WhapiMessageListResponse> {
  console.log('[WhatsApp API] getWhatsAppMessageHistory chamado com params:', params);

  const settings = await getWhatsAppSettings();
  console.log('[WhatsApp API] Settings carregadas');

  if (params.fromMe !== undefined) {
    console.log('[WhatsApp API] Modo single request (fromMe definido)');
    const queryParams = new URLSearchParams();

    if (params.count !== undefined) {
      queryParams.append('count', params.count.toString());
    }

    if (params.offset !== undefined) {
      queryParams.append('offset', params.offset.toString());
    }

    if (params.timeFrom !== undefined) {
      queryParams.append('time_from', params.timeFrom.toString());
    }

    if (params.timeTo !== undefined) {
      queryParams.append('time_to', params.timeTo.toString());
    }

    if (params.normalTypes !== undefined) {
      queryParams.append('normal_types', params.normalTypes.toString());
    }

    if (params.author) {
      queryParams.append('author', params.author);
    }

    queryParams.append('from_me', params.fromMe.toString());

    if (params.sort) {
      queryParams.append('sort', params.sort);
    }

    const url = `${WHAPI_BASE_URL}/messages/list/${encodeURIComponent(params.chatId)}?${queryParams.toString()}`;
    console.log('[WhatsApp API] URL single request:', url);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${settings.token}`,
        'Accept': 'application/json',
      },
    });

    console.log('[WhatsApp API] Response status:', response.status);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
      console.error('[WhatsApp API] Erro na single request:', error);
      throw new Error(formatApiError(error));
    }

    const result = await response.json();
    console.log('[WhatsApp API] Single request result:', result);
    return result;
  }

  console.log('[WhatsApp API] Modo dual request (from_me não definido)');
  console.log('[WhatsApp API] Fazendo requisições paralelas...');

  const [receivedResponse, sentResponse] = await Promise.all([
    fetchMessagesBatch(settings, params.chatId, params, false),
    fetchMessagesBatch(settings, params.chatId, params, true),
  ]);

  console.log('[WhatsApp API] Recebidas mensagens recebidas:', receivedResponse.count);
  console.log('[WhatsApp API] Recebidas mensagens enviadas:', sentResponse.count);
  console.log('[WhatsApp API] Array receivedResponse.messages:', receivedResponse.messages);
  console.log('[WhatsApp API] Array sentResponse.messages:', sentResponse.messages);
  console.log('[WhatsApp API] Tamanho arrays:', receivedResponse.messages?.length, sentResponse.messages?.length);

  const allMessages = [
    ...(receivedResponse.messages || []),
    ...(sentResponse.messages || [])
  ];

  console.log('[WhatsApp API] Total de mensagens combinadas:', allMessages.length);

  allMessages.sort((a, b) => {
    if (params.sort === 'asc') {
      return a.timestamp - b.timestamp;
    }
    return b.timestamp - a.timestamp;
  });

  const totalMessages = receivedResponse.total + sentResponse.total;

  const result = {
    messages: allMessages,
    count: allMessages.length,
    total: totalMessages,
    offset: params.offset || 0,
    first: allMessages.length > 0 ? allMessages[0].timestamp : 0,
    last: allMessages.length > 0 ? allMessages[allMessages.length - 1].timestamp : 0,
  };

  console.log('[WhatsApp API] Resultado final:', {
    count: result.count,
    total: result.total,
    offset: result.offset,
  });

  return result;
}
