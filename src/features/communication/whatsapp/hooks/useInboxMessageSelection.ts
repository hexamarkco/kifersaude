import { useEffect, type Dispatch, type SetStateAction } from 'react';

import { shouldShowBlockingMessageLoader } from '../domain/messageLoadState';
import type { CommWhatsAppChat, CommWhatsAppMessage } from '../domain/types';

type CurrentValue<Value> = { current: Value };

type CachedMessages = {
  messages: CommWhatsAppMessage[];
  signature: string;
  hasOlderMessages: boolean;
};

type InboxMessageSelectionRefs = {
  pendingScrollModeRef: CurrentValue<'bottom' | 'preserve' | 'prepend' | null>;
  pendingScrollTopRef: CurrentValue<number | null>;
  pendingScrollHeightRef: CurrentValue<number | null>;
  isNearBottomRef: CurrentValue<boolean>;
  messagesSignatureRef: CurrentValue<string>;
  messagesCacheByChatIdRef: CurrentValue<Map<string, CachedMessages>>;
  pendingMessageSearchChatIdRef: CurrentValue<string | null>;
  lastSelectedChatPreviewRefreshKeyRef: CurrentValue<string>;
  cancelVoiceRecordingRef: CurrentValue<() => void>;
};

type InboxMessageSelectionOptions = {
  selectedChatId: string | null;
  refs: InboxMessageSelectionRefs;
  getSelectedChatSnapshot: (chatId: string | null) => CommWhatsAppChat | null;
  loadMessages: (chat: CommWhatsAppChat | null, reason: 'initial') => Promise<unknown> | void;
  setMessages: Dispatch<SetStateAction<CommWhatsAppMessage[]>>;
  setMessageLoadError: Dispatch<SetStateAction<string | null>>;
  setLoadingMessages: Dispatch<SetStateAction<boolean>>;
  setThreadReconcileChatId: Dispatch<SetStateAction<string | null>>;
  setLoadingOlderMessages: Dispatch<SetStateAction<boolean>>;
  setHasOlderMessages: Dispatch<SetStateAction<boolean>>;
  setReplyTargetMessage: Dispatch<SetStateAction<CommWhatsAppMessage | null>>;
};

export const useInboxMessageSelection = ({
  selectedChatId,
  refs,
  getSelectedChatSnapshot,
  loadMessages,
  setMessages,
  setMessageLoadError,
  setLoadingMessages,
  setThreadReconcileChatId,
  setLoadingOlderMessages,
  setHasOlderMessages,
  setReplyTargetMessage,
}: InboxMessageSelectionOptions) => {
  const {
    pendingScrollModeRef,
    pendingScrollTopRef,
    pendingScrollHeightRef,
    isNearBottomRef,
    messagesSignatureRef,
    messagesCacheByChatIdRef,
    pendingMessageSearchChatIdRef,
    lastSelectedChatPreviewRefreshKeyRef,
    cancelVoiceRecordingRef,
  } = refs;

  useEffect(() => {
    if (!selectedChatId) {
      setMessages([]);
      setMessageLoadError(null);
      setLoadingMessages(false);
      setThreadReconcileChatId(null);
      lastSelectedChatPreviewRefreshKeyRef.current = '';
      setLoadingOlderMessages(false);
      setHasOlderMessages(false);
      setReplyTargetMessage(null);
      cancelVoiceRecordingRef.current();
      messagesSignatureRef.current = '';
      pendingMessageSearchChatIdRef.current = null;
      return;
    }

    pendingScrollModeRef.current = 'bottom';
    pendingScrollTopRef.current = null;
    pendingScrollHeightRef.current = null;
    isNearBottomRef.current = true;
    setReplyTargetMessage(null);
    cancelVoiceRecordingRef.current();
    setLoadingOlderMessages(false);
    setThreadReconcileChatId(null);
    setMessageLoadError(null);
    lastSelectedChatPreviewRefreshKeyRef.current = '';

    // Reuse the cached page immediately while the background refresh runs.
    const cached = messagesCacheByChatIdRef.current.get(selectedChatId);
    setLoadingMessages(shouldShowBlockingMessageLoader(Boolean(cached)));
    if (cached) {
      messagesSignatureRef.current = cached.signature;
      setHasOlderMessages(cached.hasOlderMessages);
      setMessages(cached.messages);
    } else {
      messagesSignatureRef.current = '';
      setHasOlderMessages(false);
      setMessages([]);
    }

    if (pendingMessageSearchChatIdRef.current === selectedChatId) {
      return;
    }

    void loadMessages(getSelectedChatSnapshot(selectedChatId), 'initial');
  }, [
    cancelVoiceRecordingRef,
    getSelectedChatSnapshot,
    isNearBottomRef,
    lastSelectedChatPreviewRefreshKeyRef,
    loadMessages,
    messagesCacheByChatIdRef,
    messagesSignatureRef,
    pendingMessageSearchChatIdRef,
    pendingScrollHeightRef,
    pendingScrollModeRef,
    pendingScrollTopRef,
    selectedChatId,
    setHasOlderMessages,
    setLoadingMessages,
    setLoadingOlderMessages,
    setMessageLoadError,
    setMessages,
    setReplyTargetMessage,
    setThreadReconcileChatId,
  ]);
};
