import type { WhatsAppChat } from './inboxTypes';

const getChatTimeValue = (chat: Pick<WhatsAppChat, 'last_message_at' | 'created_at'>) => {
  const primary = chat.last_message_at ? new Date(chat.last_message_at).getTime() : Number.NaN;
  if (!Number.isNaN(primary)) return primary;
  const fallback = new Date(chat.created_at).getTime();
  return Number.isNaN(fallback) ? 0 : fallback;
};

export const getPinnedSortValue = (chat: Pick<WhatsAppChat, 'pinned'>) => {
  const pinnedValue = typeof chat.pinned === 'number' ? chat.pinned : 0;
  return pinnedValue > 0 ? pinnedValue : 0;
};

export const sortChatsByLatest = (
  left: Pick<WhatsAppChat, 'last_message_at' | 'created_at' | 'pinned'>,
  right: Pick<WhatsAppChat, 'last_message_at' | 'created_at' | 'pinned'>,
) => {
  const pinnedDelta = getPinnedSortValue(right) - getPinnedSortValue(left);
  if (pinnedDelta !== 0) return pinnedDelta;
  return getChatTimeValue(right) - getChatTimeValue(left);
};
