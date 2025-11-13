import type { ApiRequest, ApiResponse } from '../types';
import { upsertChatRecord, insertWhatsappMessage } from '../../../server/whatsappStorage';

const UNSUPPORTED_MESSAGE_PLACEHOLDER = '[tipo de mensagem não suportado ainda]';

type ZapiPayload = {
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
  [key: string]: any;
};

const ensureJson = (rawBody: unknown): ZapiPayload => {
  if (!rawBody) {
    return {};
  }

  if (typeof rawBody === 'string') {
    try {
      return JSON.parse(rawBody) as ZapiPayload;
    } catch (_error) {
      return {};
    }
  }

  if (typeof rawBody === 'object') {
    return rawBody as ZapiPayload;
  }

  return {};
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

const resolveMessageText = (payload: ZapiPayload): string => {
  const textMessage = payload?.text?.message;
  if (typeof textMessage === 'string' && textMessage.trim().length > 0) {
    return textMessage;
  }

  const hydratedTemplateMessage = payload?.hydratedTemplate?.message;
  if (typeof hydratedTemplateMessage === 'string' && hydratedTemplateMessage.trim().length > 0) {
    return hydratedTemplateMessage;
  }

  return UNSUPPORTED_MESSAGE_PLACEHOLDER;
};

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const payload = ensureJson(req.body);

  if (payload.type !== 'ReceivedCallback') {
    return res.status(200).json({ success: true, ignored: true });
  }

  const phone = typeof payload.phone === 'string' ? payload.phone : undefined;

  if (!phone) {
    return res.status(400).json({ error: 'Campo phone é obrigatório' });
  }

  const messageText = resolveMessageText(payload);
  const momentDate = parseMoment(payload.momment) ?? new Date();
  const isGroup = payload.isGroup === true || phone.endsWith('-group');
  const chatName = payload.chatName ?? payload.senderName ?? phone;
  const senderPhoto = payload.senderPhoto ?? null;

  try {
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

    return res.status(200).json({ success: true, chat, message });
  } catch (error: any) {
    console.error('Erro ao processar webhook da Z-API:', error);
    return res.status(500).json({ error: 'Falha ao processar webhook' });
  }
}
