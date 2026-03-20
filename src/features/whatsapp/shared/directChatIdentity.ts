import { extractPhoneFromChatId, getChatIdVariants } from './avatarResolution';
import { normalizePhoneNumber } from './phoneUtils';
import type { WhatsAppChat } from './inboxTypes';
import { getWhatsAppChatKind, normalizeChatId } from '../../../lib/whatsappApiService';

export type DirectChatIdentityTarget = Pick<WhatsAppChat, 'id' | 'is_group' | 'phone_number' | 'lid'>;

export const isDirectChatIdentityTarget = (chat: Pick<DirectChatIdentityTarget, 'id' | 'is_group'>) => {
  if (chat.is_group) return false;
  return getWhatsAppChatKind(chat.id) === 'direct';
};

export const getDirectChatMergePriority = (chatId: string, phoneNumber: string | null) => {
  const normalized = normalizeChatId(chatId).trim().toLowerCase();
  if (!normalized) return -1;

  if (phoneNumber) {
    if (normalized === `${phoneNumber}@s.whatsapp.net`) return 120;
    if (normalized === `${phoneNumber}@c.us`) return 110;
  }

  if (normalized.endsWith('@s.whatsapp.net')) return 90;
  if (normalized.endsWith('@c.us')) return 80;
  if (normalized.endsWith('@lid')) return 20;
  if (!normalized.includes('@')) return 10;
  return 0;
};

export const choosePreferredDirectChatId = (
  primaryChat: Pick<DirectChatIdentityTarget, 'id' | 'phone_number'>,
  secondaryChat: Pick<DirectChatIdentityTarget, 'id' | 'phone_number'>,
) => {
  const preferredPhone =
    normalizePhoneNumber(primaryChat.phone_number || '') ||
    normalizePhoneNumber(secondaryChat.phone_number || '') ||
    extractPhoneFromChatId(primaryChat.id) ||
    extractPhoneFromChatId(secondaryChat.id) ||
    null;

  const primaryScore = getDirectChatMergePriority(primaryChat.id, preferredPhone);
  const secondaryScore = getDirectChatMergePriority(secondaryChat.id, preferredPhone);
  return secondaryScore > primaryScore ? secondaryChat.id : primaryChat.id;
};

export const areEquivalentDirectChats = (
  primaryChat: DirectChatIdentityTarget,
  secondaryChat: DirectChatIdentityTarget,
) => {
  if (!isDirectChatIdentityTarget(primaryChat) || !isDirectChatIdentityTarget(secondaryChat)) {
    return false;
  }

  const secondaryVariants = new Set(getChatIdVariants(secondaryChat));
  return getChatIdVariants(primaryChat).some((variant) => secondaryVariants.has(variant));
};
