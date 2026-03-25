import { supabase } from '../../../lib/supabase';
import {
  extractDirectLid,
  extractDirectPhoneNumber,
  getWhatsAppChatIdType,
  getWhatsAppChatKindFromId,
  normalizeWhatsAppChatId,
} from '../../../lib/whatsappChatIdentity';
import type { OutboundRetryPayload, SentMessagePayload } from '../composer/types';

export const extractResponseMessageId = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
};

export const createFallbackOutboundMessageId = () => `local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export const buildOutboundSentMessagePayload = (params: {
  id: string;
  localRef?: string | null;
  chatId: string;
  body: string | null;
  type: string | null;
  hasMedia: boolean;
  sentAt: string;
  payload?: Record<string, unknown> | null;
  ackStatus?: number | null;
  sendState?: 'pending' | 'failed' | null;
  errorMessage?: string | null;
  retryPayload?: OutboundRetryPayload | null;
}): SentMessagePayload => ({
  id: params.id,
  local_ref: params.localRef ?? null,
  chat_id: params.chatId,
  body: params.body,
  type: params.type,
  has_media: params.hasMedia,
  timestamp: params.sentAt,
  direction: 'outbound',
  created_at: params.sentAt,
  ack_status: params.ackStatus ?? null,
  send_state: params.sendState ?? null,
  error_message: params.errorMessage ?? null,
  retry_payload: params.retryPayload ?? null,
  payload: params.payload ?? null,
});

async function resolvePersistedOutboundChatId(rawChatId: string): Promise<string> {
  const normalizedChatId = normalizeWhatsAppChatId(rawChatId);
  if (getWhatsAppChatIdType(normalizedChatId) !== 'lid') {
    return normalizedChatId;
  }

  const { data, error } = await supabase
    .from('whatsapp_chats')
    .select('id')
    .eq('lid', normalizedChatId)
    .order('updated_at', { ascending: false })
    .limit(5);

  if (error || !data?.length) {
    return normalizedChatId;
  }

  const preferred = data.find((row) => getWhatsAppChatIdType(row.id) === 'phone') ?? data[0];
  return preferred?.id ? normalizeWhatsAppChatId(preferred.id) : normalizedChatId;
}

export async function ensureOutboundChatExists(normalizedChatId: string, sentAt: string, lastMessage?: string | null) {
  const chatKind = getWhatsAppChatKindFromId(normalizedChatId);
  const isGroup = chatKind === 'group';
  const normalizedPreview = typeof lastMessage === 'string' && lastMessage.trim() ? lastMessage.trim() : null;

  const { error } = await supabase.from('whatsapp_chats').upsert(
    {
      id: normalizedChatId,
      is_group: isGroup,
      phone_number: chatKind === 'direct' ? extractDirectPhoneNumber(normalizedChatId) : null,
      lid: chatKind === 'direct' ? extractDirectLid(normalizedChatId) : null,
      last_message: normalizedPreview,
      last_message_direction: normalizedPreview ? 'outbound' : null,
      last_message_at: sentAt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' },
  );

  if (error) {
    console.warn('Erro ao garantir chat antes de salvar mensagem:', error);
  }
}

export async function persistOutboundMessage(params: {
  response: unknown;
  chatId: string;
  type: string;
  body: string;
  hasMedia: boolean;
  sentAt: string;
  payloadOverride?: Record<string, unknown> | null;
}): Promise<{
  normalizedChatId: string;
  messageId: string;
  persistedMessageId: string | null;
  storedPayload: Record<string, unknown> | null;
}> {
  const { response, chatId: rawChatId, type, body, hasMedia, sentAt, payloadOverride } = params;
  const normalizedChatId = await resolvePersistedOutboundChatId(rawChatId);
  await ensureOutboundChatExists(normalizedChatId, sentAt, body);

  const responsePayload = response && typeof response === 'object'
    ? (response as Record<string, unknown>)
    : null;

  const nestedMessageId =
    responsePayload?.message && typeof responsePayload.message === 'object'
      ? extractResponseMessageId((responsePayload.message as Record<string, unknown>).id)
      : null;

  const firstArrayMessageId =
    Array.isArray(responsePayload?.messages) &&
    responsePayload.messages.length > 0 &&
    responsePayload.messages[0] &&
    typeof responsePayload.messages[0] === 'object'
      ? extractResponseMessageId((responsePayload.messages[0] as Record<string, unknown>).id)
      : null;

  const persistedMessageId =
    extractResponseMessageId(responsePayload?.id) || nestedMessageId || firstArrayMessageId;
  const messageId = persistedMessageId || createFallbackOutboundMessageId();
  const storedPayload = payloadOverride ?? responsePayload;

  if (persistedMessageId) {
    const { error: insertError } = await supabase.from('whatsapp_messages').upsert({
      id: persistedMessageId,
      chat_id: normalizedChatId,
      from_number: null,
      to_number: normalizedChatId,
      type,
      body,
      has_media: hasMedia,
      timestamp: sentAt,
      direction: 'outbound',
      payload: storedPayload,
    });

    if (insertError) {
      console.warn('Erro ao salvar mensagem outbound no banco:', insertError);
    }
  } else {
    console.warn('Resposta sem ID da mensagem; salvando apenas no estado local até sincronizar.', response);
  }

  return { normalizedChatId, messageId, persistedMessageId, storedPayload };
}
