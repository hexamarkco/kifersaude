export type InboxExportConversation<TChat, TMessage> = {
  chat: TChat;
  messages: TMessage[];
};

export type InboxExportProgress = {
  chatsExported: number;
  messagesExported: number;
};

type LoadInboxConversationsParams<TChat, TMessage> = {
  chats: TChat[];
  loadMessages: (chat: TChat) => Promise<TMessage[]>;
  concurrency?: number;
  onProgress?: (progress: InboxExportProgress) => void;
};

/**
 * Loads export messages with a small concurrency limit while keeping the
 * returned conversations in the same order as the chat list.
 */
export const loadInboxConversations = async <TChat, TMessage>({
  chats,
  loadMessages,
  concurrency = 4,
  onProgress,
}: LoadInboxConversationsParams<TChat, TMessage>): Promise<{
  conversations: Array<InboxExportConversation<TChat, TMessage>>;
  messagesExported: number;
}> => {
  if (chats.length === 0) {
    return { conversations: [], messagesExported: 0 };
  }

  const requestedConcurrency = Number.isFinite(concurrency) ? Math.floor(concurrency) : 4;
  const safeConcurrency = Math.min(Math.max(requestedConcurrency, 1), chats.length);
  const conversations = new Array<InboxExportConversation<TChat, TMessage>>(chats.length);
  let nextIndex = 0;
  let chatsExported = 0;
  let messagesExported = 0;
  let hasError = false;
  let firstError: unknown = null;

  const worker = async () => {
    while (!hasError) {
      const index = nextIndex;
      nextIndex += 1;

      if (index >= chats.length) {
        return;
      }

      try {
        const chat = chats[index];
        const messages = await loadMessages(chat);
        conversations[index] = { chat, messages };
        chatsExported += 1;
        messagesExported += messages.length;
        onProgress?.({ chatsExported, messagesExported });
      } catch (error) {
        hasError = true;
        firstError = error;
        return;
      }
    }
  };

  await Promise.all(Array.from({ length: safeConcurrency }, () => worker()));

  if (hasError) {
    throw firstError;
  }

  return { conversations, messagesExported };
};
