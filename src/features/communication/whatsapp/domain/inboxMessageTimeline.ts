import type { CommWhatsAppMessage } from './types';
import {
  getMessageReactions,
  hasMessageQuote,
  isMessageForwarded,
} from './messageMetadata';
import {
  getMessageVisibleCaption,
  isGalleryMediaMessage,
} from './messagePresentation';
import {
  formatMessageDaySeparatorLabel,
  getMessageDayKey,
  getMessageTimestampMs,
} from './messageTimeline';

const GALLERY_GROUP_MAX_GAP_MS = 2 * 60 * 1000;

export type InboxMessageTimelineItem =
  | { type: 'day'; key: string; label: string }
  | { type: 'message'; key: string; message: CommWhatsAppMessage }
  | { type: 'media-group'; key: string; messages: CommWhatsAppMessage[] };

const canGroupMediaMessages = (current: CommWhatsAppMessage, next: CommWhatsAppMessage) => {
  if (!isGalleryMediaMessage(current) || !isGalleryMediaMessage(next)) {
    return false;
  }

  if (current.direction !== next.direction || current.direction === 'system') {
    return false;
  }

  if (current.delivery_status === 'deleted' || next.delivery_status === 'deleted') {
    return false;
  }

  if (getMessageVisibleCaption(current) || getMessageVisibleCaption(next)) {
    return false;
  }

  if (hasMessageQuote(current) || hasMessageQuote(next)) {
    return false;
  }

  // Keep forwarded media separate so its label only describes that message.
  if (isMessageForwarded(current) || isMessageForwarded(next)) return false;

  if (getMessageReactions(current).length > 0 || getMessageReactions(next).length > 0) {
    return false;
  }

  const currentTimestamp = getMessageTimestampMs(current.message_at);
  const nextTimestamp = getMessageTimestampMs(next.message_at);
  if (currentTimestamp === null || nextTimestamp === null || nextTimestamp < currentTimestamp) {
    return false;
  }

  return nextTimestamp - currentTimestamp <= GALLERY_GROUP_MAX_GAP_MS;
};

export const buildInboxMessageTimeline = (visibleMessages: CommWhatsAppMessage[]): InboxMessageTimelineItem[] => {
  const items: InboxMessageTimelineItem[] = [];
  let previousDayKey = '';

  for (let index = 0; index < visibleMessages.length; index += 1) {
    const message = visibleMessages[index];
    if (!message) {
      continue;
    }

    const dayKey = getMessageDayKey(message.message_at);
    if (dayKey && dayKey !== previousDayKey) {
      items.push({
        type: 'day',
        key: `day:${dayKey}`,
        label: formatMessageDaySeparatorLabel(message.message_at),
      });
      previousDayKey = dayKey;
    }

    if (isGalleryMediaMessage(message) && !getMessageVisibleCaption(message)) {
      const groupedMessages = [message];

      while (
        index + 1 < visibleMessages.length
        && visibleMessages[index + 1]
        && canGroupMediaMessages(groupedMessages[groupedMessages.length - 1], visibleMessages[index + 1])
      ) {
        groupedMessages.push(visibleMessages[index + 1] as CommWhatsAppMessage);
        index += 1;
      }

      if (groupedMessages.length > 1) {
        items.push({
          type: 'media-group',
          key: `media-group:${groupedMessages.map((item) => item.id).join(':')}`,
          messages: groupedMessages,
        });
        continue;
      }
    }

    items.push({
      type: 'message',
      key: `message:${message.id}`,
      message,
    });
  }

  return items;
};
