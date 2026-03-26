const WHAPI_BASE_URL = 'https://gate.whapi.cloud';
const PHONE_CHAT_SUFFIX = '@s.whatsapp.net';
const LEGACY_PHONE_CHAT_SUFFIX = '@c.us';

type AutoContactMediaContent = {
  url: string;
  caption?: string;
  filename?: string;
};

type SendAutoContactWhatsAppMessageParams = {
  token: string;
  chatId: string;
  contentType: 'string' | 'image' | 'video' | 'audio' | 'document';
  content: string | AutoContactMediaContent;
};

const sanitizeWhapiToken = (rawToken: string) => rawToken.replace(/^Bearer\s+/i, '').trim();

const formatApiError = (errorObj: unknown): string => {
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
};

export function normalizeAutoContactChatId(chatIdOrPhone: string): string {
  const trimmed = chatIdOrPhone.trim();
  if (!trimmed) return trimmed;

  if (/@c\.us$/i.test(trimmed)) {
    return trimmed.replace(/@c\.us$/i, PHONE_CHAT_SUFFIX);
  }

  if (/@s\.whatsapp\.net$/i.test(trimmed)) {
    return trimmed.replace(/(@s\.whatsapp\.net)+$/i, PHONE_CHAT_SUFFIX);
  }

  if (trimmed.includes('@')) {
    return trimmed;
  }

  const digits = trimmed.replace(/\D/g, '');
  if (digits.length >= 7 && digits.length <= 15) {
    return `${digits}${PHONE_CHAT_SUFFIX}`;
  }

  return trimmed;
}

const extractDirectPhoneNumber = (chatIdOrPhone: string): string | null => {
  const normalized = normalizeAutoContactChatId(chatIdOrPhone);
  if (!/@s\.whatsapp\.net$/i.test(normalized) && !/@c\.us$/i.test(normalized)) {
    return null;
  }

  const digits = normalized.replace(/@s\.whatsapp\.net$|@c\.us$/i, '').replace(/\D/g, '');
  return digits || null;
};

const buildRecipientCandidates = (chatIdOrPhone: string, validatedRecipient?: string | null): string[] => {
  const normalized = normalizeAutoContactChatId(chatIdOrPhone);
  const candidates = new Set<string>();

  const add = (value: string | null | undefined) => {
    if (!value) return;
    const trimmed = value.trim();
    if (!trimmed) return;
    candidates.add(trimmed);
  };

  add(validatedRecipient ? normalizeAutoContactChatId(validatedRecipient) : null);
  add(normalized);

  const phone = extractDirectPhoneNumber(normalized);
  if (phone) {
    add(`${phone}${PHONE_CHAT_SUFFIX}`);
    add(`${phone}${LEGACY_PHONE_CHAT_SUFFIX}`);
  }

  if (/@s\.whatsapp\.net$/i.test(normalized)) {
    add(normalized.replace(/@s\.whatsapp\.net$/i, LEGACY_PHONE_CHAT_SUFFIX));
  }

  if (/@c\.us$/i.test(normalized)) {
    add(normalized.replace(/@c\.us$/i, PHONE_CHAT_SUFFIX));
  }

  return Array.from(candidates);
};

const validateWhatsAppRecipient = async (chatIdOrPhone: string, token: string): Promise<string | null> => {
  const phone = extractDirectPhoneNumber(chatIdOrPhone) ?? chatIdOrPhone.replace(/\D/g, '');
  if (!phone) {
    return null;
  }

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
    return null;
  }

  const payload = (await response.json().catch(() => ({}))) as {
    contacts?: Array<{
      status?: string;
      wa_id?: string;
    }>;
  };

  const contact = payload.contacts?.[0];
  if (!contact || contact.status !== 'valid' || !contact.wa_id) {
    return null;
  }

  return contact.wa_id;
};

const canRetryWithAlternateRecipient = (status: number, errorMessage: string): boolean => {
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
};

const buildSendRequest = (
  contentType: SendAutoContactWhatsAppMessageParams['contentType'],
  content: SendAutoContactWhatsAppMessageParams['content'],
) => {
  if (contentType === 'string') {
    return {
      endpoint: '/messages/text',
      body: { body: content as string },
    };
  }

  if (typeof content !== 'object' || !content || typeof content.url !== 'string' || !content.url.trim()) {
    throw new Error('Mídia deve conter URL válida para envio automático.');
  }

  const media = content as AutoContactMediaContent;
  const body: Record<string, unknown> = {
    media: media.url,
  };

  if (media.caption) {
    body.caption = media.caption;
  }

  if (contentType === 'document' && media.filename) {
    body.filename = media.filename;
  }

  return {
    endpoint: `/messages/${contentType}`,
    body,
  };
};

export async function sendAutoContactWhatsAppMessage(
  params: SendAutoContactWhatsAppMessageParams,
) {
  const token = sanitizeWhapiToken(params.token);
  if (!token) {
    throw new Error('Token da Whapi Cloud não configurado.');
  }

  const validatedRecipient = await validateWhatsAppRecipient(params.chatId, token).catch(() => null);
  const recipientCandidates = buildRecipientCandidates(params.chatId, validatedRecipient);
  const request = buildSendRequest(params.contentType, params.content);

  let lastErrorMessage = 'Erro desconhecido ao enviar mensagem';

  for (let index = 0; index < recipientCandidates.length; index += 1) {
    const recipient = recipientCandidates[index];
    const response = await fetch(`${WHAPI_BASE_URL}${request.endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        ...request.body,
        to: recipient,
      }),
    });

    if (response.ok) {
      return response.json();
    }

    const error = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
    const errorMessage = formatApiError(error);
    lastErrorMessage = errorMessage;

    if (
      index < recipientCandidates.length - 1
      && canRetryWithAlternateRecipient(response.status, errorMessage)
    ) {
      continue;
    }

    throw new Error(errorMessage);
  }

  throw new Error(lastErrorMessage);
}
