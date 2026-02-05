import { supabase } from './supabase';

interface WhatsAppSettings {
  token: string;
  enabled?: boolean;
}

const WHAPI_BASE_URL = 'https://gate.whapi.cloud';

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

function formatApiError(errorObj: any): string {
  if (typeof errorObj === 'string') {
    return errorObj;
  }

  if (errorObj?.error) {
    if (typeof errorObj.error === 'string') {
      return errorObj.error;
    }
    if (errorObj.error.message) {
      return errorObj.error.message;
    }
  }

  if (errorObj?.message) {
    return errorObj.message;
  }

  if (errorObj?.details) {
    if (typeof errorObj.details === 'string') {
      return errorObj.details;
    }
    if (Array.isArray(errorObj.details)) {
      return errorObj.details.join(', ');
    }
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

  const rawSettings = data.settings as any;
  const token = sanitizeWhapiToken(rawSettings.apiKey || rawSettings.token || '');

  if (!token) {
    throw new Error('Token da Whapi Cloud não configurado. Verifique as configurações em Automação do WhatsApp.');
  }

  return {
    token,
    enabled: rawSettings.enabled,
  };
}

export function normalizeChatId(chatIdOrPhone: string): string {
  if (!chatIdOrPhone) return chatIdOrPhone;

  const trimmed = chatIdOrPhone.trim();

  const normalizedSuffix = trimmed
    .replace(/@c\.us$/i, '@s.whatsapp.net')
    .replace(/(@s\.whatsapp\.net)+$/i, '@s.whatsapp.net');

  if (normalizedSuffix.endsWith('@s.whatsapp.net')) {
    return normalizedSuffix;
  }

  return buildChatIdFromPhone(normalizedSuffix);
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
  autoplay?: boolean;
}

export interface SendMessageParams {
  chatId: string;
  contentType: 'string' | 'image' | 'video' | 'gif' | 'short' | 'audio' | 'voice' | 'document' | 'Location' | 'Contact';
  content: string | MediaContent | {
    latitude?: number;
    longitude?: number;
    description?: string;
    contactId?: string;
  };
  quotedMessageId?: string;
  editMessageId?: string;
}

export async function sendWhatsAppMessage(params: SendMessageParams) {
  const settings = await getWhatsAppSettings();

  const normalizedChatId = normalizeChatId(params.chatId);

  let endpoint = '';
  const body: Record<string, unknown> = {
    to: await validateWhatsAppRecipient(normalizedChatId, settings.token),
  };

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
      body.media = `data:${media.mimetype};base64,${media.data}`;
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
  } else {
    throw new Error('Tipo de conteúdo não suportado');
  }

  console.info('[WhatsAppAPI] Enviando requisição para Whapi Cloud', {
    endpoint: `${WHAPI_BASE_URL}${endpoint}`,
    body,
  });

  const response = await fetch(`${WHAPI_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${settings.token}`,
      'Accept': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
    throw new Error(formatApiError(error));
  }

  return response.json();
}

export async function sendTypingState(chatId: string) {
  const settings = await getWhatsAppSettings();

  const response = await fetch(`${WHAPI_BASE_URL}/chats/${chatId}/typing`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${settings.token}`,
      'Accept': 'application/json',
    },
    body: JSON.stringify({ typing: true }),
  });

  if (!response.ok) {
    console.error('Erro ao enviar estado de digitação');
  }

  return response.ok;
}

export async function sendRecordingState(chatId: string) {
  const settings = await getWhatsAppSettings();

  const response = await fetch(`${WHAPI_BASE_URL}/chats/${chatId}/recording`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${settings.token}`,
      'Accept': 'application/json',
    },
    body: JSON.stringify({ recording: true }),
  });

  if (!response.ok) {
    console.error('Erro ao enviar estado de gravação');
  }

  return response.ok;
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
  } catch (err) {
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
