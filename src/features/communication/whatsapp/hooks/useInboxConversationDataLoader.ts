import { useInboxChatLoader } from './useInboxChatLoader';
import { useInboxMessageLoader, type InboxMessageLoadReason } from './useInboxMessageLoader';
import type { CommWhatsAppChat } from '../domain/types';

type CurrentValue<Value> = { current: Value };

type InboxConversationDataLoaderOptions = {
  chatLoader: Parameters<typeof useInboxChatLoader>[0];
  messageLoader: Parameters<typeof useInboxMessageLoader>[0];
  refs: {
    loadChatsRef: CurrentValue<() => Promise<unknown> | void>;
    loadMessagesRef: CurrentValue<(chat: CommWhatsAppChat | null, reason?: InboxMessageLoadReason) => Promise<unknown> | void>;
  };
};

export const useInboxConversationDataLoader = ({ chatLoader, messageLoader, refs }: InboxConversationDataLoaderOptions) => {
  const chats = useInboxChatLoader(chatLoader);
  refs.loadChatsRef.current = chats.loadChats;

  const messages = useInboxMessageLoader(messageLoader);
  refs.loadMessagesRef.current = messages.loadMessages;

  return { ...chats, ...messages };
};
