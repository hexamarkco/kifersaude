import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';

import type { CommWhatsAppChat, CommWhatsAppMessage } from '../domain/types';
import { useInboxMessageNavigation } from './useInboxMessageNavigation';
import { useInboxMessageSelection } from './useInboxMessageSelection';
import { useInboxOlderMessages } from './useInboxOlderMessages';

type CurrentValue<Value> = { current: Value };

type CachedMessages = {
  messages: CommWhatsAppMessage[];
  signature: string;
  hasOlderMessages: boolean;
};

type UseInboxMessageThreadControllerOptions = {
  selectedChatId: string | null;
  selectedChat: CommWhatsAppChat | null;
  getSelectedChatSnapshot: (chatId: string | null) => CommWhatsAppChat | null;
  loadMessages: (chat: CommWhatsAppChat | null, reason: 'initial') => Promise<unknown> | void;
  refs: {
    selectedChatIdRef: CurrentValue<string | null>;
    latestMessagesRef: CurrentValue<CommWhatsAppMessage[]>;
    messagesRequestIdRef: CurrentValue<number>;
    messagesSignatureRef: CurrentValue<string>;
    messagesCacheByChatIdRef: CurrentValue<Map<string, CachedMessages>>;
    pendingScrollModeRef: CurrentValue<'bottom' | 'preserve' | 'prepend' | null>;
    pendingScrollTopRef: CurrentValue<number | null>;
    pendingScrollHeightRef: CurrentValue<number | null>;
    isNearBottomRef: CurrentValue<boolean>;
    messagesContainerRef: CurrentValue<HTMLDivElement | null>;
    messageSearchSelectionRequestIdRef: CurrentValue<number>;
    pendingMessageSearchChatIdRef: CurrentValue<string | null>;
    quotedMessageNavigationRequestIdRef: CurrentValue<number>;
    composerTextareaRef: CurrentValue<HTMLTextAreaElement | null>;
    lastSelectedChatPreviewRefreshKeyRef: CurrentValue<string>;
    cancelVoiceRecordingRef: CurrentValue<() => void>;
  };
  state: {
    loadingOlderMessages: boolean;
    hasOlderMessages: boolean;
    setMessages: Dispatch<SetStateAction<CommWhatsAppMessage[]>>;
    setMessageLoadError: Dispatch<SetStateAction<string | null>>;
    setLoadingMessages: Dispatch<SetStateAction<boolean>>;
    setThreadReconcileChatId: Dispatch<SetStateAction<string | null>>;
    setHasOlderMessages: Dispatch<SetStateAction<boolean>>;
    setLoadingOlderMessages: Dispatch<SetStateAction<boolean>>;
    setReplyTargetMessage: Dispatch<SetStateAction<CommWhatsAppMessage | null>>;
    setSelectedChatId: Dispatch<SetStateAction<string | null>>;
    setHighlightedMessageId: Dispatch<SetStateAction<string | null>>;
    setChatMenuPointerAnchor: Dispatch<SetStateAction<{ x: number; y: number } | null>>;
    setOpenChatMenuChatId: Dispatch<SetStateAction<string | null>>;
  };
  buildMessagesSignature: (messages: CommWhatsAppMessage[]) => string;
  upsertChatLocally: (chat: CommWhatsAppChat) => void;
};

export const useInboxMessageThreadController = ({
  selectedChatId,
  selectedChat,
  getSelectedChatSnapshot,
  loadMessages,
  refs,
  state,
  buildMessagesSignature,
  upsertChatLocally,
}: UseInboxMessageThreadControllerOptions) => {
  const [messageLoadRetrying, setMessageLoadRetrying] = useState(false);
  useInboxMessageSelection({
    selectedChatId,
    refs: {
      pendingScrollModeRef: refs.pendingScrollModeRef,
      pendingScrollTopRef: refs.pendingScrollTopRef,
      pendingScrollHeightRef: refs.pendingScrollHeightRef,
      isNearBottomRef: refs.isNearBottomRef,
      messagesSignatureRef: refs.messagesSignatureRef,
      messagesCacheByChatIdRef: refs.messagesCacheByChatIdRef,
      pendingMessageSearchChatIdRef: refs.pendingMessageSearchChatIdRef,
      lastSelectedChatPreviewRefreshKeyRef: refs.lastSelectedChatPreviewRefreshKeyRef,
      cancelVoiceRecordingRef: refs.cancelVoiceRecordingRef,
    },
    getSelectedChatSnapshot,
    loadMessages,
    setMessages: state.setMessages,
    setMessageLoadError: state.setMessageLoadError,
    setLoadingMessages: state.setLoadingMessages,
    setThreadReconcileChatId: state.setThreadReconcileChatId,
    setLoadingOlderMessages: state.setLoadingOlderMessages,
    setHasOlderMessages: state.setHasOlderMessages,
    setReplyTargetMessage: state.setReplyTargetMessage,
  });

  const navigation = useInboxMessageNavigation({
    selectedChat,
    refs: {
      selectedChatIdRef: refs.selectedChatIdRef,
      latestMessagesRef: refs.latestMessagesRef,
      messagesRequestIdRef: refs.messagesRequestIdRef,
      messagesSignatureRef: refs.messagesSignatureRef,
      messagesCacheByChatIdRef: refs.messagesCacheByChatIdRef,
      pendingScrollModeRef: refs.pendingScrollModeRef,
      pendingScrollTopRef: refs.pendingScrollTopRef,
      pendingScrollHeightRef: refs.pendingScrollHeightRef,
      messageSearchSelectionRequestIdRef: refs.messageSearchSelectionRequestIdRef,
      pendingMessageSearchChatIdRef: refs.pendingMessageSearchChatIdRef,
      quotedMessageNavigationRequestIdRef: refs.quotedMessageNavigationRequestIdRef,
      composerTextareaRef: refs.composerTextareaRef,
    },
    setChatMenuPointerAnchor: state.setChatMenuPointerAnchor,
    setOpenChatMenuChatId: state.setOpenChatMenuChatId,
    setMessages: state.setMessages,
    setMessageLoadError: state.setMessageLoadError,
    setLoadingMessages: state.setLoadingMessages,
    setHasOlderMessages: state.setHasOlderMessages,
    setThreadReconcileChatId: state.setThreadReconcileChatId,
    setSelectedChatId: state.setSelectedChatId,
    setHighlightedMessageId: state.setHighlightedMessageId,
    buildMessagesSignature,
    loadMessages,
    upsertChatLocally,
  });

  const { handleLoadOlderMessages } = useInboxOlderMessages({
    selectedChat,
    loadingOlderMessages: state.loadingOlderMessages,
    hasOlderMessages: state.hasOlderMessages,
    refs: {
      latestMessagesRef: refs.latestMessagesRef,
      selectedChatIdRef: refs.selectedChatIdRef,
      messagesSignatureRef: refs.messagesSignatureRef,
      messagesContainerRef: refs.messagesContainerRef,
      pendingScrollModeRef: refs.pendingScrollModeRef,
      pendingScrollTopRef: refs.pendingScrollTopRef,
      pendingScrollHeightRef: refs.pendingScrollHeightRef,
    },
    setLoadingOlderMessages: state.setLoadingOlderMessages,
    setHasOlderMessages: state.setHasOlderMessages,
    setMessages: state.setMessages,
    buildMessagesSignature,
  });

  const handleRetryMessageLoad = useCallback(async () => {
    if (!selectedChat) {
      return;
    }

    setMessageLoadRetrying(true);
    try {
      await loadMessages(getSelectedChatSnapshot(selectedChat.id), 'initial');
    } finally {
      setMessageLoadRetrying(false);
    }
  }, [getSelectedChatSnapshot, loadMessages, selectedChat]);

  return {
    loadMessages,
    messageLoadRetrying,
    handleRetryMessageLoad,
    ...navigation,
    handleLoadOlderMessages,
  };
};
