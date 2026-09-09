import { resolveDeliveryStatus } from '../messageStatus';
import { getMessageTimestampMs } from './messageTimeline';
import { formatCommWhatsAppPhoneLabel } from './phonePresentation';
import { getVisiblePreviewText, normalizeInboxSearch } from './messagePresentation';
import type { CommWhatsAppChat } from './types';

export const resolveStableDeliveryStatus = (incoming?: string | null, previous?: string | null) => (
  resolveDeliveryStatus(previous, incoming)
);

export const preserveUsefulChatPreview = (
  incoming: CommWhatsAppChat,
  previous?: CommWhatsAppChat | null,
): CommWhatsAppChat => {
  if (!previous) return incoming;

  const incomingPreview = getVisiblePreviewText(incoming.last_message_text);
  const previousPreview = getVisiblePreviewText(previous.last_message_text);
  const incomingAt = getMessageTimestampMs(incoming.last_message_at);
  const previousAt = getMessageTimestampMs(previous.last_message_at);
  const incomingIsOlder = incomingAt !== null && previousAt !== null && incomingAt < previousAt;
  const incomingIsNotNewer = incomingAt === null || previousAt === null || incomingAt <= previousAt;
  const stableDeliveryStatus = incomingIsNotNewer
    ? resolveStableDeliveryStatus(incoming.last_message_delivery_status, previous.last_message_delivery_status)
    : incoming.last_message_delivery_status;

  if (incomingIsOlder && previousPreview) {
    return {
      ...incoming,
      last_message_text: previous.last_message_text,
      last_message_direction: previous.last_message_direction || incoming.last_message_direction,
      last_message_delivery_status: stableDeliveryStatus ?? previous.last_message_delivery_status,
      last_message_at: previous.last_message_at,
    };
  }

  if (incomingPreview || !previousPreview) {
    return { ...incoming, last_message_delivery_status: stableDeliveryStatus };
  }

  if (!incomingIsNotNewer && String(incoming.last_message_text ?? '').trim()) return incoming;

  return {
    ...incoming,
    last_message_text: previous.last_message_text,
    last_message_direction: incoming.last_message_direction || previous.last_message_direction,
    last_message_delivery_status: stableDeliveryStatus ?? previous.last_message_delivery_status,
    last_message_at: incoming.last_message_at ?? previous.last_message_at,
  };
};

export const compareChatsByInboxOrder = (a: CommWhatsAppChat, b: CommWhatsAppChat) => {
  if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;

  if (a.is_pinned && b.is_pinned) {
    const aPinnedAt = a.pinned_at ? new Date(a.pinned_at).getTime() : 0;
    const bPinnedAt = b.pinned_at ? new Date(b.pinned_at).getTime() : 0;
    if (aPinnedAt !== bPinnedAt) return bPinnedAt - aPinnedAt;
  }

  return (getMessageTimestampMs(b.last_message_at) ?? 0) - (getMessageTimestampMs(a.last_message_at) ?? 0);
};

export const sortChatsByInboxOrder = (items: CommWhatsAppChat[]) => [...items].sort(compareChatsByInboxOrder);

export const getValidWhatsAppDisplayName = (value: unknown) => {
  const normalized = String(value ?? '').trim();
  if (!normalized) return '';
  if (/@(?:lid|s\.whatsapp\.net|c\.us|g\.us)$/i.test(normalized)) return '';

  const withoutPhoneSymbols = normalized.replace(/[\s()+-]/g, '');
  if (/^\+?\d+$/.test(withoutPhoneSymbols)) return '';
  return /[\p{L}\p{N}]/u.test(normalized) ? normalized : '';
};

export const getSafeChatDisplayName = (
  chat: CommWhatsAppChat | null,
  connectedUserName?: string | null,
  leadName?: string | null,
) => {
  if (!chat) return 'Conversa';

  const savedContactName = getValidWhatsAppDisplayName(chat.saved_contact_name);
  const resolvedLeadName = getValidWhatsAppDisplayName(leadName) || getValidWhatsAppDisplayName(chat.lead_name);
  const pushName = getValidWhatsAppDisplayName(chat.push_name);
  const displayName = getValidWhatsAppDisplayName(chat.display_name);
  const ownName = String(connectedUserName ?? '').trim().toLowerCase();
  const isOwnNameLeak = !chat.saved_contact_name
    && !chat.lead_id
    && Boolean(displayName)
    && Boolean(ownName)
    && displayName.toLowerCase() === ownName;

  return savedContactName
    || resolvedLeadName
    || pushName
    || (!isOwnNameLeak ? displayName : '')
    || formatCommWhatsAppPhoneLabel(chat.phone_number)
    || 'Contato privado';
};

export const stabilizeChatIdentityForLocalMerge = (
  incoming: CommWhatsAppChat,
  previous?: CommWhatsAppChat | null,
): CommWhatsAppChat => {
  const savedContactName = getValidWhatsAppDisplayName(incoming.saved_contact_name)
    || getValidWhatsAppDisplayName(previous?.saved_contact_name);
  const leadName = getValidWhatsAppDisplayName(incoming.lead_name)
    || getValidWhatsAppDisplayName(previous?.lead_name);
  const leadStatus = String(incoming.lead_status ?? '').trim() || String(previous?.lead_status ?? '').trim() || null;
  const canReusePreviousLeadLink = Boolean(incoming.lead_id && previous?.lead_id === incoming.lead_id);
  const leadLinkSource = incoming.lead_link_source ?? (canReusePreviousLeadLink ? previous?.lead_link_source ?? null : null);
  const leadLinkedAt = incoming.lead_linked_at ?? (canReusePreviousLeadLink ? previous?.lead_linked_at ?? null : null);
  const leadLinkedBy = incoming.lead_linked_by ?? (canReusePreviousLeadLink ? previous?.lead_linked_by ?? null : null);
  const pushName = getValidWhatsAppDisplayName(incoming.push_name) || getValidWhatsAppDisplayName(previous?.push_name);
  const displayName = getValidWhatsAppDisplayName(incoming.display_name);
  const resolvedDisplayName = savedContactName || leadName || pushName || displayName;

  return {
    ...incoming,
    saved_contact_name: savedContactName || null,
    lead_name: leadName || null,
    lead_status: leadStatus,
    lead_link_source: leadLinkSource,
    lead_linked_at: leadLinkedAt,
    lead_linked_by: leadLinkedBy,
    push_name: pushName || null,
    display_name: resolvedDisplayName || formatCommWhatsAppPhoneLabel(incoming.phone_number),
  };
};

const getChatSearchCandidates = (chat: CommWhatsAppChat, connectedUserName?: string | null) => {
  const values = [
    getSafeChatDisplayName(chat, connectedUserName),
    chat.saved_contact_name,
    chat.lead_name,
    chat.display_name,
    chat.push_name,
  ];

  const uniqueValues = new Set<string>();
  values.forEach((value) => {
    const normalized = normalizeInboxSearch(String(value ?? ''));
    if (normalized) uniqueValues.add(normalized);
  });
  return Array.from(uniqueValues);
};

export const getChatSearchRank = (chat: CommWhatsAppChat, query: string, connectedUserName?: string | null) => {
  const normalizedQuery = normalizeInboxSearch(query);
  const digitQuery = query.replace(/\D/g, '');
  if (!normalizedQuery && !digitQuery) return 0;

  const nameCandidates = getChatSearchCandidates(chat, connectedUserName);
  const phoneLabel = normalizeInboxSearch(formatCommWhatsAppPhoneLabel(chat.phone_number));
  const phoneDigits = String(chat.phone_digits || chat.phone_number || '').replace(/\D/g, '');

  if (normalizedQuery) {
    if (nameCandidates.some((candidate) => candidate.startsWith(normalizedQuery))) return 0;
    if (nameCandidates.some((candidate) => candidate.split(/\s+/).some((part) => part.startsWith(normalizedQuery)))) return 1;
    if (nameCandidates.some((candidate) => candidate.includes(normalizedQuery))) return 2;
    if (phoneLabel.includes(normalizedQuery)) return 5;
  }

  if (digitQuery) {
    if (phoneDigits.startsWith(digitQuery)) return 3;
    if (phoneDigits.includes(digitQuery)) return 4;
  }

  return null;
};

export const rankChatsBySearch = (
  items: CommWhatsAppChat[],
  query: string,
  connectedUserName?: string | null,
) => items
  .map((chat) => ({ chat, rank: getChatSearchRank(chat, query, connectedUserName) }))
  .filter((item): item is { chat: CommWhatsAppChat; rank: number } => item.rank !== null)
  .sort((a, b) => a.rank !== b.rank ? a.rank - b.rank : compareChatsByInboxOrder(a.chat, b.chat))
  .map((item) => item.chat);

export const mergeUniqueChats = (...collections: CommWhatsAppChat[][]) => {
  const chatsById = new Map<string, CommWhatsAppChat>();
  collections.forEach((items) => {
    items.forEach((chat) => {
      if (!chatsById.has(chat.id)) chatsById.set(chat.id, chat);
    });
  });
  return Array.from(chatsById.values());
};
