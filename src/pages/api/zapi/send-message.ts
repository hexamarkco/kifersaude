import type { ApiRequest, ApiResponse } from '../types';
import { upsertChatRecord, insertWhatsappMessage } from '../../../server/whatsappStorage';
import { rememberOutgoingMessagePhone } from '../../../server/zapiMessageRegistry';
import { supabaseAdmin } from '../../../server/lib/supabaseAdmin';
import type { WhatsappChat } from '../../../types/whatsapp';

const globalProcess = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;

const getEnvVar = (key: string): string | undefined => {
  return globalProcess?.env?.[key];
};

type SendMessageBody = {
  phone?: string;
  message?: string;
};

const ensureJson = (rawBody: unknown): SendMessageBody => {
  if (!rawBody) {
    return {};
  }

  if (typeof rawBody === 'string') {
    try {
      return JSON.parse(rawBody) as SendMessageBody;
    } catch (_error) {
      return {};
    }
  }

  if (typeof rawBody === 'object') {
    return rawBody as SendMessageBody;
  }

  return {};
};

// Helper para manter só dígitos
const normalizeDigits = (value: string): string => value.replace(/\D/g, '');

// Busca um chat existente tanto por phone quanto por chat_lid
const findChatByPhoneOrChatLid = async (
  identifier: string | null | undefined,
  chatLid?: string | null,
): Promise<WhatsappChat | null> => {
  if (!supabaseAdmin) return null;
  if (!identifier && !chatLid) return null;

  const normalized = identifier ? normalizeDigits(identifier) : null;
  const lid = chatLid?.trim() || null;

  // 1) Busca pelo phone normalizado
  if (normalized) {
    const { data, error } = await supabaseAdmin
      .from('whatsapp_chats')
      .select('*')
      .eq('phone', normalized)
      .maybeSingle<WhatsappChat>();

    if (!error && data) {
      return data;
    }
  }

  // 2) Busca pelo chat_lid
  if (lid) {
    const { data, error } = await supabaseAdmin
      .from('whatsapp_chats')
      .select('*')
      .eq('chat_lid', lid)
      .maybeSingle<WhatsappChat>();

    if (!error && data) {
      return data;
    }
  }

  return null;
};

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const body = ensureJson(req.body);
  const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
  const message = typeof body.message === 'string' ? body.message.trim() : '';

  if (!phone || !message) {
    return res.status(400).json({ error: 'Os campos phone e message são obrigatórios' });
  }

  const instanceId = getEnvVar('ZAPI_INSTANCE_ID');
  const token = getEnvVar('ZAPI_TOKEN');
  const clientToken = getEnvVar('ZAPI_CLIENT_TOKEN');

  if (!instanceId || !token || !clientToken) {
    return res.status(500).json({ error: 'Credenciais da Z-API não configuradas' });
  }

  const url = `https://api.z-api.io/instances/${instanceId}/token/${token}/send-text`;
  let responseBody: Record<string, any> | null = null;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Client-Token': clientToken,
      },
      body: JSON.stringify({ phone, message }),
    });

    try {
      responseBody = await response.json();
    } catch (_error) {
      responseBody = null;
    }

    console.info('Z-API send-text response:', {
      status: response.status,
      body: responseBody,
    });

    if (!response.ok) {
      return res.status(response.status).json({
        error: 'Falha ao enviar mensagem pela Z-API',
        details: responseBody,
      });
    }

    const now = new Date();
    const zapiStatus = typeof responseBody?.status === 'string' ? responseBody.status : 'SENT';
    const messageId = typeof responseBody?.messageId === 'string' ? responseBody.messageId : null;
    const responsePhone = typeof responseBody?.phone === 'string' ? responseBody.phone : phone;
    const chatName = typeof responseBody?.chatName === 'string' ? responseBody.chatName : undefined;
    const isGroupChat = responsePhone.endsWith('-group');

    // 🔥 NOVA LÓGICA: evitar duplicar chat quando o responsePhone vem em formato estranho (JID/LID)
    const normalizedIdentifier = normalizeDigits(responsePhone);
    const chatLidFromResponse =
      typeof responseBody?.chatLid === 'string' ? responseBody.chatLid.trim() : null;

    // 1) Tenta achar um chat existente por phone OU chat_lid
    const existingChat = await findChatByPhoneOrChatLid(
      normalizedIdentifier || responsePhone,
      chatLidFromResponse,
    );

    // 2) Define o phone real para o chat
    const effectivePhone = existingChat
      ? existingChat.phone // sempre preferir o phone já conhecido do chat
      : normalizedIdentifier;

    if (!effectivePhone) {
      return res.status(500).json({
        error: 'Não foi possível determinar um número de telefone válido após o envio',
      });
    }

    // 3) Faz o upsert do chat usando o phone real e o chat_lid (se existir)
    const chat = await upsertChatRecord({
      phone: effectivePhone,
      chatLid: chatLidFromResponse,
      chatName,
      isGroup: isGroupChat,
      lastMessageAt: now,
      lastMessagePreview: message,
    });

    // 4) Registra a mensagem no histórico
    const insertedMessage = await insertWhatsappMessage({
      chatId: chat.id,
      messageId,
      fromMe: true,
      status: zapiStatus,
      text: message,
      moment: now,
      rawPayload: responseBody,
    });

    // 5) Lembra qual phone foi usado para essa mensagem (para futuros updates de status)
    if (messageId && effectivePhone) {
      rememberOutgoingMessagePhone(messageId, effectivePhone);
    }

    return res.status(200).json({ success: true, message: insertedMessage, chat });
  } catch (error: any) {
    console.error('Erro ao enviar mensagem pela Z-API:', error);
    return res.status(500).json({ error: 'Erro interno ao enviar mensagem' });
  }
}