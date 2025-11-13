import type { ApiRequest, ApiResponse } from '../types';
import { upsertChatRecord, insertWhatsappMessage } from '../../../server/whatsappStorage';

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

  if (!instanceId || !token) {
    return res.status(500).json({ error: 'Credenciais da Z-API não configuradas' });
  }

  const url = `https://api.z-api.io/instances/${instanceId}/token/${token}/send-text`;
  let responseBody: Record<string, any> | null = null;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ phone, message }),
    });

    try {
      responseBody = await response.json();
    } catch (_error) {
      responseBody = null;
    }

    if (!response.ok) {
      return res.status(response.status).json({
        error: 'Falha ao enviar mensagem pela Z-API',
        details: responseBody,
      });
    }

    const now = new Date();
    const zapiStatus = typeof responseBody?.status === 'string' ? responseBody.status : 'SENT';
    const messageId = typeof responseBody?.messageId === 'string' ? responseBody.messageId : null;
    const chatName = typeof responseBody?.chatName === 'string' ? responseBody.chatName : undefined;
    const senderPhoto = typeof responseBody?.senderPhoto === 'string' ? responseBody.senderPhoto : undefined;

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

    return res.status(200).json({ success: true, message: insertedMessage, chat });
  } catch (error: any) {
    console.error('Erro ao enviar mensagem pela Z-API:', error);
    return res.status(500).json({ error: 'Erro interno ao enviar mensagem' });
  }
}
