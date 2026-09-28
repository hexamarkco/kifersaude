import { useCallback, type Dispatch, type SetStateAction } from 'react';

import { whatsappMessagesRepository, type CommWhatsAppMessageSearchResult } from '../data';
import type { CommWhatsAppChat, CommWhatsAppMessage } from '../domain/types';
import { findMessageByIdOrExternalId, mergeMessages } from '../domain/messageTimeline';
import { toast } from '../../../../lib/toast';

type CurrentValue<T> = { current: T };

type CachedMessages = {
  messages: CommWhatsAppMessage[];
  signature: string;
  hasOlderMessages: boolean;
};

type InboxMessageNavigationOptions = {
  selectedChat: CommWhatsAppChat | null;
  refs: {
    selectedChatIdRef: CurrentValue<string | null>;
    latestMessagesRef: CurrentValue<CommWhatsAppMessage[]>;
    messagesRequestIdRef: CurrentValue<number>;
    messagesSignatureRef: CurrentValue<string>;
    messagesCacheByChatIdRef: CurrentValue<Map<string, CachedMessages>>;
    pendingScrollModeRef: CurrentValue<'bottom' | 'preserve' | 'prepend' | null>;
    pendingScrollTopRef: CurrentValue<number | null>;
    pendingScrollHeightRef: CurrentValue<number | null>;
    messageSearchSelectionRequestIdRef: CurrentValue<number>;
    pendingMessageSearchChatIdRef: CurrentValue<string | null>;
    quotedMessageNavigationRequestIdRef: CurrentValue<number>;
    composerTextareaRef: CurrentValue<HTMLTextAreaElement | null>;
  };
  setChatMenuPointerAnchor: Dispatch<SetStateAction<{ x: number; y: number } | null>>;
  setOpenChatMenuChatId: Dispatch<SetStateAction<string | null>>;
  setMessages: Dispatch<SetStateAction<CommWhatsAppMessage[]>>;
  setMessageLoadError: Dispatch<SetStateAction<string | null>>;
  setLoadingMessages: Dispatch<SetStateAction<boolean>>;
  setHasOlderMessages: Dispatch<SetStateAction<boolean>>;
  setThreadReconcileChatId: Dispatch<SetStateAction<string | null>>;
  setSelectedChatId: Dispatch<SetStateAction<string | null>>;
  setHighlightedMessageId: Dispatch<SetStateAction<string | null>>;
  buildMessagesSignature: (messages: CommWhatsAppMessage[]) => string;
  loadMessages: (chat: CommWhatsAppChat | null, reason: 'initial') => Promise<unknown> | void;
  upsertChatLocally: (chat: CommWhatsAppChat) => void;
};

export const useInboxMessageNavigation = ({
  selectedChat,
  refs,
  setChatMenuPointerAnchor,
  setOpenChatMenuChatId,
  setMessages,
  setMessageLoadError,
  setLoadingMessages,
  setHasOlderMessages,
  setThreadReconcileChatId,
  setSelectedChatId,
  setHighlightedMessageId,
  buildMessagesSignature,
  loadMessages,
  upsertChatLocally,
}: InboxMessageNavigationOptions) => {
  const {
    selectedChatIdRef,
    latestMessagesRef,
    messagesRequestIdRef,
    messagesSignatureRef,
    messagesCacheByChatIdRef,
    pendingScrollModeRef,
    pendingScrollTopRef,
    pendingScrollHeightRef,
    messageSearchSelectionRequestIdRef,
    pendingMessageSearchChatIdRef,
    quotedMessageNavigationRequestIdRef,
    composerTextareaRef,
  } = refs;

  const handleSelectMessageSearchResult = useCallback((result: CommWhatsAppMessageSearchResult) => {
    const targetChat = result.chat;
    const targetMessageId = result.message.id;
    const requestId = ++messageSearchSelectionRequestIdRef.current;
    const isChangingChat = selectedChatIdRef.current !== targetChat.id;

    setChatMenuPointerAnchor(null);
    setOpenChatMenuChatId(null);
    upsertChatLocally(targetChat);

    if (isChangingChat) {
      pendingMessageSearchChatIdRef.current = targetChat.id;
      selectedChatIdRef.current = targetChat.id;
      messagesRequestIdRef.current += 1;
      messagesSignatureRef.current = '';
      latestMessagesRef.current = [];
      setMessages([]);
      setMessageLoadError(null);
      setHasOlderMessages(false);
      setThreadReconcileChatId(null);
      setSelectedChatId(targetChat.id);
    }

    if (findMessageByIdOrExternalId(latestMessagesRef.current, targetMessageId, targetChat.id)) {
      setHighlightedMessageId(targetMessageId);
      return;
    }

    setLoadingMessages(true);

    let fallbackLoadStarted = false;
    void whatsappMessagesRepository.listContext(targetChat.id, targetMessageId).then((contextMessages) => {
      if (requestId !== messageSearchSelectionRequestIdRef.current || selectedChatIdRef.current !== targetChat.id) {
        return;
      }

      const nextMessages = contextMessages.length > 0
        ? mergeMessages(contextMessages, [result.message])
        : [result.message];

      messagesSignatureRef.current = buildMessagesSignature(nextMessages);
      pendingScrollModeRef.current = null;
      pendingScrollTopRef.current = null;
      pendingScrollHeightRef.current = null;
      pendingMessageSearchChatIdRef.current = null;
      setHasOlderMessages(nextMessages.length > 0);
      setMessages(nextMessages);
      setHighlightedMessageId(targetMessageId);
    }).catch((error) => {
      if (requestId !== messageSearchSelectionRequestIdRef.current || selectedChatIdRef.current !== targetChat.id) {
        return;
      }

      pendingMessageSearchChatIdRef.current = null;
      console.error('[WhatsAppInbox] erro ao carregar contexto da mensagem buscada', error);
      toast.error(error instanceof Error ? error.message : 'Não foi possível abrir a mensagem encontrada.');
      fallbackLoadStarted = true;
      return loadMessages(targetChat, 'initial');
    }).finally(() => {
      if (!fallbackLoadStarted && requestId === messageSearchSelectionRequestIdRef.current && selectedChatIdRef.current === targetChat.id) {
        setLoadingMessages(false);
      }
    });
  }, [
    buildMessagesSignature,
    loadMessages,
    latestMessagesRef,
    messageSearchSelectionRequestIdRef,
    messagesRequestIdRef,
    messagesSignatureRef,
    pendingMessageSearchChatIdRef,
    pendingScrollHeightRef,
    pendingScrollModeRef,
    pendingScrollTopRef,
    selectedChatIdRef,
    setChatMenuPointerAnchor,
    setHasOlderMessages,
    setHighlightedMessageId,
    setLoadingMessages,
    setMessageLoadError,
    setMessages,
    setOpenChatMenuChatId,
    setSelectedChatId,
    setThreadReconcileChatId,
    upsertChatLocally,
  ]);

  const handleOpenQuotedMessage = useCallback(async (quotedExternalMessageId: string) => {
    const targetMessage = findMessageByIdOrExternalId(latestMessagesRef.current, quotedExternalMessageId);
    if (targetMessage) {
      setHighlightedMessageId(targetMessage.id);
      return;
    }

    const targetChat = selectedChat;
    if (!targetChat) {
      return;
    }

    const requestId = ++quotedMessageNavigationRequestIdRef.current;
    setLoadingMessages(true);

    try {
      const allMessages = await whatsappMessagesRepository.listAll(targetChat.id);
      if (requestId !== quotedMessageNavigationRequestIdRef.current || selectedChatIdRef.current !== targetChat.id) {
        return;
      }

      const loadedTargetMessage = findMessageByIdOrExternalId(allMessages, quotedExternalMessageId);
      if (!loadedTargetMessage) {
        toast.info('Não foi possível localizar a mensagem original nesta conversa.');
        return;
      }

      const nextSignature = buildMessagesSignature(allMessages);
      messagesSignatureRef.current = nextSignature;
      pendingScrollModeRef.current = null;
      pendingScrollTopRef.current = null;
      pendingScrollHeightRef.current = null;
      setHasOlderMessages(false);
      setMessages(allMessages);
      messagesCacheByChatIdRef.current.set(targetChat.id, {
        messages: allMessages,
        signature: nextSignature,
        hasOlderMessages: false,
      });
      setHighlightedMessageId(loadedTargetMessage.id);
    } catch (error) {
      if (requestId === quotedMessageNavigationRequestIdRef.current && selectedChatIdRef.current === targetChat.id) {
        toast.error(error instanceof Error ? error.message : 'Não foi possível localizar a mensagem original.');
      }
    } finally {
      if (requestId === quotedMessageNavigationRequestIdRef.current && selectedChatIdRef.current === targetChat.id) {
        setLoadingMessages(false);
      }
    }
  }, [
    buildMessagesSignature,
    latestMessagesRef,
    messagesCacheByChatIdRef,
    messagesSignatureRef,
    pendingScrollHeightRef,
    pendingScrollModeRef,
    pendingScrollTopRef,
    quotedMessageNavigationRequestIdRef,
    selectedChat,
    selectedChatIdRef,
    setHasOlderMessages,
    setHighlightedMessageId,
    setLoadingMessages,
    setMessages,
  ]);

  const handleSelectChatMessageSearchResult = useCallback((result: CommWhatsAppMessageSearchResult) => {
    handleSelectMessageSearchResult(result);
    window.setTimeout(() => composerTextareaRef.current?.focus(), 0);
  }, [composerTextareaRef, handleSelectMessageSearchResult]);

  return { handleSelectMessageSearchResult, handleOpenQuotedMessage, handleSelectChatMessageSearchResult };
};
