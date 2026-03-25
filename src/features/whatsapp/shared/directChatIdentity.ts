import { extractPhoneFromChatId, getChatIdVariants } from './avatarResolution';
import { normalizePhoneNumber } from './phoneUtils';
import type { WhatsAppChat } from './inboxTypes';
import {
  choosePreferredDirectChatIdForPhone,
  getDirectChatMergePriority,
  getWhatsAppChatKindFromId,
} from '../../../lib/whatsappChatIdentity';

export { getDirectChatMergePriority };

export type DirectChatIdentityTarget = Pick<WhatsAppChat, 'id' | 'is_group' | 'phone_number' | 'lid'>;

export const isDirectChatIdentityTarget = (chat: Pick<DirectChatIdentityTarget, 'id' | 'is_group'>) => {
  if (chat.is_group) return false;
  return getWhatsAppChatKindFromId(chat.id) === 'direct';
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
  if (secondaryScore === primaryScore) {
    return choosePreferredDirectChatIdForPhone(primaryChat.id, secondaryChat.id, preferredPhone);
  }

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
