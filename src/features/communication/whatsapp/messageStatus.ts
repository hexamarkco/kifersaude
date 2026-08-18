import type { CommWhatsAppMessage } from '../../../lib/supabase';

// Mesma ordem de public.comm_whatsapp_status_rank (ver migration
// 20260911385000_fix_comm_whatsapp_status_preview_unread_consistency.sql).
// As duas precisam concordar: o servidor usa esse rank para decidir se um
// status recebido por webhook pode substituir o atual (guarda monotonica em
// comm_whatsapp_should_apply_status); o cliente usa a mesma logica para
// mesclar o estado otimista com o que chega do servidor. Se divergirem, um
// status mais antigo pode "voltar no tempo" na tela mesmo que o banco já
// tenha rejeitado essa mesma regressão.
const STATUS_RANKS: Record<string, number> = {
  pending: 0,
  queued: 0,
  sending: 0,
  sent: 1,
  received: 1,
  failed: 2,
  error: 2,
  delivered: 3,
  read: 4,
  seen: 4,
  viewed: 4,
  played: 5,
  deleted: 6,
};

const NON_TERMINAL_STATUSES = new Set(['', 'pending', 'queued', 'sending']);
const SUCCESS_STATUSES = new Set(['sent', 'received', 'delivered', 'read', 'seen', 'viewed', 'played']);

export const normalizeDeliveryStatus = (value?: string | null) => String(value ?? '').trim().toLowerCase();

const statusRank = (value?: string | null) => STATUS_RANKS[normalizeDeliveryStatus(value)] ?? 0;

export const resolveDeliveryStatus = (previous?: string | null, incoming?: string | null) => {
  const previousStatus = normalizeDeliveryStatus(previous);
  const incomingStatus = normalizeDeliveryStatus(incoming);

  if (!incomingStatus) {
    return previous ?? incoming ?? null;
  }

  if (!previousStatus) {
    return incoming;
  }

  if (incomingStatus === 'failed' || incomingStatus === 'error') {
    return NON_TERMINAL_STATUSES.has(previousStatus) ? incoming : previous;
  }

  if (statusRank(incomingStatus) < statusRank(previousStatus)) {
    return previous;
  }

  return incoming;
};

const readMetadata = (message?: CommWhatsAppMessage | null): Record<string, unknown> => (
  message?.metadata && typeof message.metadata === 'object' && !Array.isArray(message.metadata)
    ? message.metadata
    : {}
);

export const getMessageClientRequestId = (message?: CommWhatsAppMessage | null) => {
  const metadata = readMetadata(message);
  return String(metadata.client_request_id ?? metadata.clientRequestId ?? '').trim();
};

export const getMessageDisplayMetadataSignature = (message?: CommWhatsAppMessage | null) => {
  const metadata = readMetadata(message);
  return JSON.stringify({
    quote: metadata.quote ?? null,
    contact_card: metadata.contact_card ?? null,
    link_preview: metadata.link_preview ?? null,
    reactions: Array.isArray(metadata.reactions) ? metadata.reactions : [],
    edited: metadata.edited === true,
    edited_at: metadata.edited_at ?? null,
    original_text_content: metadata.original_text_content ?? null,
    deleted: metadata.deleted === true,
    deleted_at: metadata.deleted_at ?? null,
    whapi_patch: metadata.whapi_patch ?? null,
  });
};

export const getMessageIdentityKey = (message: CommWhatsAppMessage) => {
  const clientRequestId = getMessageClientRequestId(message);
  if (clientRequestId) {
    return `client:${message.channel_id}:${message.chat_id}:${clientRequestId}`;
  }

  const externalMessageId = String(message.external_message_id ?? '').trim();
  if (externalMessageId) {
    return `external:${message.channel_id}:${externalMessageId}`;
  }

  return `id:${message.id}`;
};

export const messagesReferToSameDelivery = (left: CommWhatsAppMessage, right: CommWhatsAppMessage) => (
  getMessageIdentityKey(left) === getMessageIdentityKey(right)
);

const pickStatusUpdatedAt = (left?: string | null, right?: string | null) => {
  const leftTime = left ? new Date(left).getTime() : Number.NaN;
  const rightTime = right ? new Date(right).getTime() : Number.NaN;

  if (Number.isNaN(leftTime)) return right ?? left ?? null;
  if (Number.isNaN(rightTime)) return left ?? right ?? null;
  return rightTime >= leftTime ? right : left;
};

const isLocalOutgoing = (message: CommWhatsAppMessage) => readMetadata(message).local_outgoing === true || message.source === 'local';

export const mergeCommWhatsAppMessage = (
  previous: CommWhatsAppMessage,
  incoming: CommWhatsAppMessage,
): CommWhatsAppMessage => {
  const resolvedStatus = resolveDeliveryStatus(previous.delivery_status, incoming.delivery_status) ?? incoming.delivery_status ?? previous.delivery_status;
  const incomingIsServerMessage = !isLocalOutgoing(incoming);
  const base = incomingIsServerMessage ? incoming : previous;
  const overlay = incomingIsServerMessage ? previous : incoming;
  const mergedMetadata = {
    ...readMetadata(previous),
    ...readMetadata(incoming),
  };
  const mediaUrl = incoming.media_url || previous.media_url || null;
  const statusUpdatedAt = pickStatusUpdatedAt(previous.status_updated_at, incoming.status_updated_at);
  const normalizedStatus = normalizeDeliveryStatus(resolvedStatus);

  return {
    ...overlay,
    ...base,
    external_message_id: incoming.external_message_id ?? previous.external_message_id ?? null,
    delivery_status: resolvedStatus,
    status_updated_at: statusUpdatedAt,
    error_message: SUCCESS_STATUSES.has(normalizedStatus) ? null : (incoming.error_message ?? previous.error_message ?? null),
    media_url: mediaUrl,
    metadata: mergedMetadata,
  };
};

export const mergeCommWhatsAppMessages = (existing: CommWhatsAppMessage[], incoming: CommWhatsAppMessage[]) => {
  const map = new Map<string, CommWhatsAppMessage>();

  for (const message of existing) {
    map.set(getMessageIdentityKey(message), message);
  }

  for (const message of incoming) {
    let key = getMessageIdentityKey(message);
    let previous = map.get(key);

    if (!previous) {
      for (const [, value] of map) {
        if (value.id === message.id) {
          previous = value;
          key = getMessageIdentityKey(value);
          break;
        }
      }
    }

    map.set(key, previous ? mergeCommWhatsAppMessage(previous, message) : message);
  }

  return Array.from(map.values());
};
