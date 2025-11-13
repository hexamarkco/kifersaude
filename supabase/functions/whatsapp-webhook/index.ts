import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey, X-API-Key',
};

type WhatsappChat = {
  id: string;
  phone: string;
  chat_name: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  is_group: boolean;
  sender_photo: string | null;
};

type WhatsappMessage = {
  id: string;
  chat_id: string;
  message_id: string | null;
  from_me: boolean;
  status: string | null;
  text: string | null;
  moment: string | null;
  raw_payload: Record<string, any> | null;
};

type ZapiWebhookPayload = {
  type?: string;
  phone?: string;
  fromMe?: boolean;
  momment?: number | string;
  status?: string;
  chatName?: string;
  senderName?: string;
  senderPhoto?: string;
  messageId?: string;
  text?: { message?: string } | null;
  hydratedTemplate?: { message?: string } | null;
  isGroup?: boolean;
  [key: string]: unknown;
};

type SendMessageBody = {
  phone?: string;
  message?: string;
};

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Variáveis de ambiente SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configuradas.');
}

const supabaseAdmin = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null;

const toIsoStringOrNull = (value: Date | string | number | null | undefined): string | null => {
  if (value === null || value === undefined) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }

  const asNumber = typeof value === 'string' ? Number(value) : value;
  if (typeof asNumber === 'number' && Number.isFinite(asNumber)) {
    return new Date(asNumber).toISOString();
  }

  if (typeof value === 'string') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  return null;
};

const parseMoment = (value: number | string | undefined): Date | null => {
  if (value === undefined || value === null) {
    return null;
  }

  const numericValue = typeof value === 'string' ? Number(value) : value;

  if (typeof numericValue !== 'number' || !Number.isFinite(numericValue)) {
    return null;
  }

  return new Date(numericValue);
};

const resolveMessageText = (payload: ZapiWebhookPayload): string => {
  const textMessage = payload?.text?.message;
  if (typeof textMessage === 'string' && textMessage.trim().length > 0) {
    return textMessage;
  }

  const hydratedTemplateMessage = payload?.hydratedTemplate?.message;
  if (typeof hydratedTemplateMessage === 'string' && hydratedTemplateMessage.trim().length > 0) {
    return hydratedTemplateMessage;
  }

  return '[tipo de mensagem não suportado ainda]';
};

const ensureJsonBody = async <T = unknown>(req: Request): Promise<T | null> => {
  try {
    return (await req.json()) as T;
  } catch (_error) {
    return null;
  }
};

const respondJson = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const upsertChatRecord = async (input: {
  phone: string;
  chatName?: string | null;
  isGroup?: boolean;
  senderPhoto?: string | null;
  lastMessageAt?: Date | string | number | null;
  lastMessagePreview?: string | null;
}): Promise<WhatsappChat> => {
  if (!supabaseAdmin) {
    throw new Error('Supabase client não configurado');
  }

  const {
    phone,
    chatName,
    isGroup,
    senderPhoto,
    lastMessageAt,
    lastMessagePreview,
  } = input;

  if (!phone) {
    throw new Error('Phone number is required to upsert a WhatsApp chat');
  }

  const { data: existingChat, error: fetchError } = await supabaseAdmin
    .from('whatsapp_chats')
    .select('*')
    .eq('phone', phone)
    .maybeSingle<WhatsappChat>();

  if (fetchError) {
    throw fetchError;
  }

  const normalizedLastMessageAt = toIsoStringOrNull(lastMessageAt);
  const updatePayload: Record<string, unknown> = {
    last_message_at: normalizedLastMessageAt,
    last_message_preview: lastMessagePreview ?? null,
  };

  if (typeof isGroup === 'boolean') {
    updatePayload.is_group = isGroup;
  }

  if (chatName !== undefined) {
    updatePayload.chat_name = chatName;
  }

  if (senderPhoto !== undefined) {
    updatePayload.sender_photo = senderPhoto;
  }

  if (existingChat) {
    const { error: updateError } = await supabaseAdmin
      .from('whatsapp_chats')
      .update(updatePayload)
      .eq('id', existingChat.id);

    if (updateError) {
      throw updateError;
    }

    return {
      ...existingChat,
      chat_name: updatePayload.chat_name ?? (existingChat.chat_name ?? null),
      sender_photo: updatePayload.sender_photo ?? (existingChat.sender_photo ?? null),
      is_group:
        typeof updatePayload.is_group === 'boolean' ? Boolean(updatePayload.is_group) : existingChat.is_group,
      last_message_at: normalizedLastMessageAt,
      last_message_preview:
        typeof updatePayload.last_message_preview === 'string'
          ? (updatePayload.last_message_preview as string)
          : existingChat.last_message_preview,
    };
  }

  const { data: insertedChat, error: insertError } = await supabaseAdmin
    .from('whatsapp_chats')
    .insert({
      phone,
      chat_name: chatName ?? null,
      last_message_at: normalizedLastMessageAt,
      last_message_preview: lastMessagePreview ?? null,
      is_group: Boolean(isGroup),
      sender_photo: senderPhoto ?? null,
    })
    .select('*')
    .single<WhatsappChat>();

  if (insertError) {
    throw insertError;
  }

  if (!insertedChat) {
    throw new Error('Failed to insert WhatsApp chat');
  }

  return insertedChat;
};

const normalizeMessageStatus = (
  status: string | null | undefined,
  fromMe: boolean,
): string | null => {
  if (!status) {
    return null;
  }

  if (fromMe && status.toUpperCase() === 'RECEIVED') {
    return 'SENT';
  }

  return status;
};

const insertWhatsappMessage = async (input: {
  chatId: string;
  messageId?: string | null;
  fromMe: boolean;
  status?: string | null;
  text?: string | null;
  moment?: Date | string | number | null;
  rawPayload?: Record<string, any> | null;
}): Promise<WhatsappMessage> => {
  if (!supabaseAdmin) {
    throw new Error('Supabase client não configurado');
  }

  const { chatId, messageId, fromMe, status, text, moment, rawPayload } = input;

  if (!chatId) {
    throw new Error('chatId is required to insert a WhatsApp message');
  }

  const normalizedMoment = toIsoStringOrNull(moment);
  const normalizedStatus = normalizeMessageStatus(status, fromMe);

  const { data: insertedMessage, error: insertError } = await supabaseAdmin
    .from('whatsapp_messages')
    .insert({
      chat_id: chatId,
      message_id: messageId ?? null,
      from_me: fromMe,
      status: normalizedStatus,
      text: text ?? null,
      moment: normalizedMoment,
      raw_payload: rawPayload ?? null,
    })
    .select('*')
    .single<WhatsappMessage>();

  if (insertError) {
    throw insertError;
  }

  if (!insertedMessage) {
    throw new Error('Failed to insert WhatsApp message');
  }

  return insertedMessage;
};

const handleOnMessageReceived = async (req: Request) => {
  if (req.method !== 'POST') {
    return respondJson(405, { success: false, error: 'Método não permitido' });
  }

  const payload = (await ensureJsonBody<ZapiWebhookPayload>(req)) ?? {};

  try {
    console.log('whatsapp-webhook on-message-received payload:', JSON.stringify(payload));
  } catch (_error) {
    console.error('Não foi possível registrar o payload do webhook recebido.');
  }

  if (payload.type !== 'ReceivedCallback') {
    return respondJson(200, { success: true, ignored: true });
  }

  const phone = typeof payload.phone === 'string' ? payload.phone : undefined;

  if (!phone) {
    return respondJson(400, { success: false, error: 'Campo phone é obrigatório' });
  }

  try {
    const messageText = resolveMessageText(payload);
    const momentDate = parseMoment(payload.momment) ?? new Date();
    const isGroup = payload.isGroup === true || phone.endsWith('-group');
    const chatName = payload.chatName ?? payload.senderName ?? phone;
    const senderPhoto = payload.senderPhoto ?? null;

    const chat = await upsertChatRecord({
      phone,
      chatName,
      isGroup,
      senderPhoto,
      lastMessageAt: momentDate,
      lastMessagePreview: messageText,
    });

    const message = await insertWhatsappMessage({
      chatId: chat.id,
      messageId: typeof payload.messageId === 'string' ? payload.messageId : null,
      fromMe: payload.fromMe === true,
      status: typeof payload.status === 'string' ? payload.status : null,
      text: messageText,
      moment: momentDate,
      rawPayload: payload as Record<string, any>,
    });

    return respondJson(200, { success: true, chat, message });
  } catch (error) {
    console.error('Erro ao processar webhook da Z-API:', error);
    return respondJson(500, { success: false, error: 'Falha ao processar webhook' });
  }
};

const handleOnMessageSend = async (req: Request) => {
  if (req.method !== 'POST') {
    return respondJson(405, { success: false, error: 'Método não permitido' });
  }

  const payload = await ensureJsonBody<Record<string, unknown>>(req);

  try {
    console.log('whatsapp-webhook on-message-send payload:', JSON.stringify(payload));
  } catch (_error) {
    console.error('Não foi possível registrar o payload do webhook de envio.');
  }

  return respondJson(200, { success: true, acknowledged: true });
};

const handleSendMessage = async (req: Request) => {
  if (req.method !== 'POST') {
    return respondJson(405, { success: false, error: 'Método não permitido' });
  }

  const body = (await ensureJsonBody<SendMessageBody>(req)) ?? {};
  const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
  const message = typeof body.message === 'string' ? body.message.trim() : '';

  if (!phone || !message) {
    return respondJson(400, { success: false, error: 'Os campos phone e message são obrigatórios' });
  }

  const instanceId = Deno.env.get('ZAPI_INSTANCE_ID');
  const token = Deno.env.get('ZAPI_TOKEN');
  const clientToken = Deno.env.get('ZAPI_CLIENT_TOKEN');

  if (!instanceId || !token || !clientToken) {
    return respondJson(500, { success: false, error: 'Credenciais da Z-API não configuradas' });
  }

  const url = `https://api.z-api.io/instances/${instanceId}/token/${token}/send-text`;

  let responseBody: Record<string, unknown> | null = null;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Client-Token': clientToken },
      body: JSON.stringify({ phone, message }),
    });

    try {
      responseBody = await response.json();
    } catch (_error) {
      responseBody = null;
    }

    if (!response.ok) {
      return respondJson(response.status, {
        success: false,
        error: 'Falha ao enviar mensagem pela Z-API',
        details: responseBody,
      });
    }

    const now = new Date();
    const zapiStatus = typeof responseBody?.status === 'string' ? (responseBody.status as string) : 'SENT';
    const messageId = typeof responseBody?.messageId === 'string' ? (responseBody.messageId as string) : null;
    const chatName = typeof responseBody?.chatName === 'string' ? (responseBody.chatName as string) : undefined;
    const senderPhoto =
      typeof responseBody?.senderPhoto === 'string' ? (responseBody.senderPhoto as string) : undefined;

    const chat = await upsertChatRecord({
      phone,
      chatName,
      senderPhoto,
      isGroup: phone.endsWith('-group'),
      lastMessageAt: now,
      lastMessagePreview: message,
    });

    const insertedMessage = await insertWhatsappMessage({
      chatId: chat.id,
      messageId,
      fromMe: true,
      status: zapiStatus,
      text: message,
      moment: now,
      rawPayload: responseBody,
    });

    return respondJson(200, { success: true, message: insertedMessage, chat });
  } catch (error) {
    console.error('Erro ao enviar mensagem pela Z-API:', error);
    return respondJson(500, { success: false, error: 'Erro interno ao enviar mensagem' });
  }
};

const handleHealthcheck = async (req: Request) => {
  if (req.method !== 'GET') {
    return respondJson(405, { success: false, error: 'Método não permitido' });
  }

  return respondJson(200, {
    success: true,
    service: 'whatsapp-webhook',
    timestamp: new Date().toISOString(),
  });
};

const handleListChats = async (req: Request) => {
  if (req.method !== 'GET') {
    return respondJson(405, { success: false, error: 'Método não permitido' });
  }

  if (!supabaseAdmin) {
    return respondJson(500, { success: false, error: 'Supabase client não configurado' });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('whatsapp_chats')
      .select('*')
      .order('last_message_at', { ascending: false });

    if (error) {
      throw error;
    }

    return respondJson(200, { chats: data ?? [] });
  } catch (error) {
    console.error('Erro ao listar chats do WhatsApp:', error);
    return respondJson(500, { success: false, error: 'Falha ao carregar chats' });
  }
};

const handleListChatMessages = async (req: Request, chatId: string) => {
  if (req.method !== 'GET') {
    return respondJson(405, { success: false, error: 'Método não permitido' });
  }

  if (!supabaseAdmin) {
    return respondJson(500, { success: false, error: 'Supabase client não configurado' });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('whatsapp_messages')
      .select('*')
      .eq('chat_id', chatId)
      .order('moment', { ascending: true });

    if (error) {
      throw error;
    }

    return respondJson(200, { messages: data ?? [] });
  } catch (error) {
    console.error('Erro ao listar mensagens do WhatsApp:', error);
    return respondJson(500, { success: false, error: 'Falha ao carregar mensagens' });
  }
};

const resolveSubPath = (pathname: string): string => {
  const segments = pathname.split('/').filter(Boolean);
  const functionIndex = segments.indexOf('whatsapp-webhook');
  if (functionIndex === -1) {
    return '/';
  }

  const subSegments = segments.slice(functionIndex + 1);
  return `/${subSegments.join('/')}`;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (!supabaseAdmin) {
    return respondJson(500, { success: false, error: 'Supabase client não configurado' });
  }

  const { pathname } = new URL(req.url);
  const subPath = resolveSubPath(pathname);

  const chatMessagesMatch = subPath.match(/^\/chats\/([^/]+)\/messages$/);

  if (subPath === '/chats') {
    return handleListChats(req);
  }

  if (chatMessagesMatch) {
    const chatId = decodeURIComponent(chatMessagesMatch[1]);
    return handleListChatMessages(req, chatId);
  }

  switch (subPath) {
    case '/on-message-received':
      return handleOnMessageReceived(req);
    case '/on-message-send':
      return handleOnMessageSend(req);
    case '/send-message':
      return handleSendMessage(req);
    case '/health':
      return handleHealthcheck(req);
    case '/':
    case '':
      return respondJson(200, { success: true, service: 'whatsapp-webhook' });
    default:
      return respondJson(404, { success: false, error: 'Endpoint não encontrado' });
  }
});
