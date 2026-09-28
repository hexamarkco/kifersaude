import { useEffect, useMemo, type Dispatch, type SetStateAction } from 'react';

import { buildInboxMessageTimeline } from '../domain/inboxMessageTimeline';
import { isChatMediaViewerMessage } from '../domain/mediaViewerPresentation';
import { getMessageSearchPreviewText } from '../domain/messagePresentation';
import { dedupeObviousDuplicateMessages, mergeMessages } from '../domain/messageTimeline';
import { shouldHideTechnicalMessage } from '../domain/messageVisibility';
import type { CommWhatsAppMessage } from '../domain/types';

type InboxMessageThreadViewModelOptions = {
  messages: CommWhatsAppMessage[];
  localOutgoingMessages: CommWhatsAppMessage[];
  selectedChatId: string | null;
  applyOutgoingOrderToServerMessage: (message: CommWhatsAppMessage) => CommWhatsAppMessage;
  lightboxMessageId: string | null;
  setLightboxMessageId: Dispatch<SetStateAction<string | null>>;
  openReactionPickerMessageId: string | null;
  openMessageActionMenuMessageId: string | null;
  messageDetailsMessageId: string | null;
};

export const useInboxMessageThreadViewModel = ({
  messages,
  localOutgoingMessages,
  selectedChatId,
  applyOutgoingOrderToServerMessage,
  lightboxMessageId,
  setLightboxMessageId,
  openReactionPickerMessageId,
  openMessageActionMenuMessageId,
  messageDetailsMessageId,
}: InboxMessageThreadViewModelOptions) => {
  const visibleMessages = useMemo(() => {
    const filteredMessages = messages
      .filter((message) => !shouldHideTechnicalMessage(message))
      .map(applyOutgoingOrderToServerMessage);

    if (!selectedChatId) {
      return filteredMessages;
    }

    const localForChat = localOutgoingMessages.filter((message) => message.chat_id === selectedChatId);
    if (localForChat.length === 0) {
      return dedupeObviousDuplicateMessages(filteredMessages);
    }

    return dedupeObviousDuplicateMessages(mergeMessages(filteredMessages, localForChat));
  }, [applyOutgoingOrderToServerMessage, localOutgoingMessages, messages, selectedChatId]);

  const mediaViewerMessages = useMemo(
    () => visibleMessages.filter(isChatMediaViewerMessage),
    [visibleMessages],
  );
  const lastUsefulVisibleMessage = useMemo(() => {
    for (let index = visibleMessages.length - 1; index >= 0; index -= 1) {
      const message = visibleMessages[index];
      if (message && message.direction !== 'system' && getMessageSearchPreviewText(message).trim()) {
        return message;
      }
    }

    return null;
  }, [visibleMessages]);
  const messageTimelineItems = useMemo(
    () => buildInboxMessageTimeline(visibleMessages),
    [visibleMessages],
  );

  useEffect(() => {
    if (lightboxMessageId && !mediaViewerMessages.some((message) => message.id === lightboxMessageId)) {
      setLightboxMessageId(null);
    }
  }, [lightboxMessageId, mediaViewerMessages, setLightboxMessageId]);

  const openReactionPickerMessage = useMemo(
    () => visibleMessages.find((message) => message.id === openReactionPickerMessageId) ?? null,
    [openReactionPickerMessageId, visibleMessages],
  );
  const openMessageActionMenuMessage = useMemo(
    () => visibleMessages.find((message) => message.id === openMessageActionMenuMessageId) ?? null,
    [openMessageActionMenuMessageId, visibleMessages],
  );
  const messageDetailsMessage = useMemo(
    () => visibleMessages.find((message) => message.id === messageDetailsMessageId) ?? null,
    [messageDetailsMessageId, visibleMessages],
  );

  return {
    visibleMessages,
    mediaViewerMessages,
    lastUsefulVisibleMessage,
    messageTimelineItems,
    openReactionPickerMessage,
    openMessageActionMenuMessage,
    messageDetailsMessage,
  };
};
