import { useEffect } from 'react';

import type { CommWhatsAppChat, CommWhatsAppMessage } from '../domain/types';
import { getMessageTimestampMs } from '../domain/messageTimeline';

type CurrentValue<Value> = { current: Value };

type UseInboxSelectedChatPreviewRefreshOptions = {
  selectedChat: CommWhatsAppChat | null;
  loadingOlderMessages: boolean;
  refs: {
    latestMessagesRef: CurrentValue<CommWhatsAppMessage[]>;
    messagesSignatureRef: CurrentValue<string>;
    lastSelectedChatPreviewRefreshKeyRef: CurrentValue<string>;
  };
  getSelectedChatSnapshot: (chatId: string) => CommWhatsAppChat | null;
  loadMessages: (chat: CommWhatsAppChat | null, reason: 'poll') => Promise<unknown>;
};

export const useInboxSelectedChatPreviewRefresh = ({
  selectedChat,
  loadingOlderMessages,
  refs,
  getSelectedChatSnapshot,
  loadMessages,
}: UseInboxSelectedChatPreviewRefreshOptions) => {
  const { latestMessagesRef, messagesSignatureRef, lastSelectedChatPreviewRefreshKeyRef } = refs;

  useEffect(() => {
    if (!selectedChat || loadingOlderMessages) {
      return;
    }

    const previewKey = [
      selectedChat.id,
      selectedChat.last_message_at ?? '',
      selectedChat.last_message_text ?? '',
      selectedChat.last_message_direction ?? '',
    ].join(':');

    if (
      !selectedChat.last_message_at
      || messagesSignatureRef.current === ''
      || previewKey === lastSelectedChatPreviewRefreshKeyRef.current
    ) {
      return;
    }

    const selectedLastMessageAtMs = getMessageTimestampMs(selectedChat.last_message_at);
    const latestRenderedMessageAtMs = latestMessagesRef.current
      .filter((message) => message.chat_id === selectedChat.id)
      .reduce<number | null>((latest, message) => {
        const messageAt = getMessageTimestampMs(message.message_at);
        if (messageAt === null) {
          return latest;
        }
        return latest === null || messageAt > latest ? messageAt : latest;
      }, null);

    if (selectedLastMessageAtMs !== null && latestRenderedMessageAtMs !== null && latestRenderedMessageAtMs >= selectedLastMessageAtMs) {
      lastSelectedChatPreviewRefreshKeyRef.current = previewKey;
      return;
    }

    lastSelectedChatPreviewRefreshKeyRef.current = previewKey;
    void loadMessages(getSelectedChatSnapshot(selectedChat.id), 'poll');
  }, [
    getSelectedChatSnapshot,
    latestMessagesRef,
    lastSelectedChatPreviewRefreshKeyRef,
    loadMessages,
    loadingOlderMessages,
    messagesSignatureRef,
    selectedChat,
  ]);
};
