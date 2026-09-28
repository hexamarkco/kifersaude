import { useCallback, useRef, type Dispatch, type SetStateAction } from 'react';

import {
  whatsappConversationsRepository,
  whatsappMediaRepository,
  whatsappMessagesRepository,
  type CommWhatsAppLeadPanel,
} from '../data';
import type { CommWhatsAppChat, CommWhatsAppMessage } from '../domain/types';
import { messagesReferToSameOutgoing } from '../domain/messageMetadata';
import { mergeMessages } from '../domain/messageTimeline';
import type { LocalOutgoingRetryPayload } from '../domain/outgoingMessageTypes';
import { KeyedPromiseQueue } from '../components/keyedPromiseQueue';
import { toast } from '../../../../lib/toast';

export type InboxMessageLoadReason = 'initial' | 'poll' | 'send';

type CurrentValue<T> = { current: T };

type CachedMessages = {
  messages: CommWhatsAppMessage[];
  signature: string;
  hasOlderMessages: boolean;
};

type InboxMessageLoaderOptions = {
  selectedChatIdRef: CurrentValue<string | null>;
  messagesRequestIdRef: CurrentValue<number>;
  latestMessagesRef: CurrentValue<CommWhatsAppMessage[]>;
  messagesSignatureRef: CurrentValue<string>;
  messagesCacheByChatIdRef: CurrentValue<Map<string, CachedMessages>>;
  pendingScrollModeRef: CurrentValue<'bottom' | 'preserve' | 'prepend' | null>;
  pendingScrollTopRef: CurrentValue<number | null>;
  pendingScrollHeightRef: CurrentValue<number | null>;
  isNearBottomRef: CurrentValue<boolean>;
  messagesContainerRef: CurrentValue<HTMLDivElement | null>;
  localOutgoingRetryPayloadRef: CurrentValue<Map<string, LocalOutgoingRetryPayload>>;
  localOutgoingMediaPreviewUrlsRef: CurrentValue<Map<string, string>>;
  setMessages: Dispatch<SetStateAction<CommWhatsAppMessage[]>>;
  setMessageLoadError: Dispatch<SetStateAction<string | null>>;
  setLoadingMessages: Dispatch<SetStateAction<boolean>>;
  setThreadReconcileChatId: Dispatch<SetStateAction<string | null>>;
  setHasOlderMessages: Dispatch<SetStateAction<boolean>>;
  setLocalOutgoingMessages: Dispatch<SetStateAction<CommWhatsAppMessage[]>>;
  setLeadPanel: Dispatch<SetStateAction<CommWhatsAppLeadPanel | null>>;
  applyOutgoingOrderToServerMessage: (message: CommWhatsAppMessage) => CommWhatsAppMessage;
  buildMessagesSignature: (messages: CommWhatsAppMessage[]) => string;
  rememberOutgoingMessageOrder: (message: CommWhatsAppMessage) => void;
  upsertChatLocally: (chat: CommWhatsAppChat) => void;
};

const MESSAGE_PAGE_SIZE = 50;
const MESSAGES_CACHE_MAX_CHATS = 20;

export const useInboxMessageLoader = ({
  selectedChatIdRef,
  messagesRequestIdRef,
  latestMessagesRef,
  messagesSignatureRef,
  messagesCacheByChatIdRef,
  pendingScrollModeRef,
  pendingScrollTopRef,
  pendingScrollHeightRef,
  isNearBottomRef,
  messagesContainerRef,
  localOutgoingRetryPayloadRef,
  localOutgoingMediaPreviewUrlsRef,
  setMessages,
  setMessageLoadError,
  setLoadingMessages,
  setThreadReconcileChatId,
  setHasOlderMessages,
  setLocalOutgoingMessages,
  setLeadPanel,
  applyOutgoingOrderToServerMessage,
  buildMessagesSignature,
  rememberOutgoingMessageOrder,
  upsertChatLocally,
}: InboxMessageLoaderOptions) => {
  const pollingMessagesChatIdRef = useRef<string | null>(null);
  const messageLoadQueueRef = useRef(new KeyedPromiseQueue());

  const loadMessages = useCallback(async (
    chat: CommWhatsAppChat | null,
    reason: InboxMessageLoadReason = 'poll',
  ) => {
    const targetChatId = chat?.id ?? selectedChatIdRef.current;
    if (!targetChatId) {
      setMessages([]);
      setMessageLoadError(null);
      return;
    }

    if (reason === 'poll' && pollingMessagesChatIdRef.current === targetChatId) {
      return;
    }

    if (reason === 'poll') {
      pollingMessagesChatIdRef.current = targetChatId;
    }

    const runLoad = async () => {
      const requestId = ++messagesRequestIdRef.current;
      const shouldShowBlockingLoader = reason === 'initial' && messagesSignatureRef.current === '';

      if (reason === 'initial') {
        setMessageLoadError(null);
      }

      if (shouldShowBlockingLoader) {
        setLoadingMessages(true);
      }

      try {
        let data: CommWhatsAppMessage[];
        let hasMore: boolean;
        let threadChat: CommWhatsAppChat | null = null;
        let threadLead: CommWhatsAppLeadPanel | null = null;

        if (reason === 'initial') {
          const thread = await whatsappConversationsRepository.getThread(targetChatId, {
            limit: MESSAGE_PAGE_SIZE,
          });

          data = thread.messages;
          hasMore = thread.hasMore;
          threadChat = thread.chat;
          threadLead = thread.lead;

          if (data.length === 0 && Boolean(thread.chat.last_message_at || thread.chat.last_message_text?.trim())) {
            setThreadReconcileChatId(targetChatId);
            console.warn('[WhatsAppInbox] thread retornou vazio apesar de preview', {
              chatId: targetChatId,
            });
          }
        } else {
          const page = await whatsappMessagesRepository.listPage(targetChatId, {
            limit: MESSAGE_PAGE_SIZE,
          });

          data = page.messages;
          hasMore = page.hasMore;
        }

        if (requestId !== messagesRequestIdRef.current || selectedChatIdRef.current !== targetChatId) {
          return;
        }

        setMessageLoadError(null);

        if (threadChat) {
          upsertChatLocally(threadChat);
        }

        if (threadLead) {
          setLeadPanel(threadLead);
        }

        const stillEmptyDespitePreview = reason === 'initial'
          && data.length === 0
          && Boolean(threadChat?.last_message_at || threadChat?.last_message_text?.trim());
        setThreadReconcileChatId(stillEmptyDespitePreview ? targetChatId : null);

        const orderedData = data.map(applyOutgoingOrderToServerMessage);
        const nextMessages = reason === 'initial'
          ? orderedData
          : mergeMessages(latestMessagesRef.current, orderedData);
        const nextSignature = buildMessagesSignature(nextMessages);
        setLocalOutgoingMessages((current) => {
          const nextLocalMessages: CommWhatsAppMessage[] = [];

          for (const message of current) {
            if (message.chat_id !== targetChatId) {
              nextLocalMessages.push(message);
              continue;
            }

            const externalId = String(message.external_message_id ?? '').trim();
            const syncedServerMessage = nextMessages.find((serverMessage) => (
              messagesReferToSameOutgoing(message, serverMessage)
            )) ?? null;
            const alreadySynced = Boolean(syncedServerMessage);

            if (alreadySynced) {
              rememberOutgoingMessageOrder(message);
              localOutgoingRetryPayloadRef.current.delete(message.id);
              const previewUrl = localOutgoingMediaPreviewUrlsRef.current.get(message.id);
              const syncedExternalMessageId = String(syncedServerMessage?.external_message_id ?? externalId).trim();
              if (previewUrl && syncedExternalMessageId) {
                whatsappMediaRepository.rememberLocalPreview(syncedExternalMessageId, previewUrl);
              }
              localOutgoingMediaPreviewUrlsRef.current.delete(message.id);
              continue;
            }

            nextLocalMessages.push(message);
          }

          return nextLocalMessages;
        });

        if (nextSignature === messagesSignatureRef.current) {
          if (reason === 'initial') {
            setHasOlderMessages(hasMore);
          }
          return;
        }

        messagesSignatureRef.current = nextSignature;
        if (reason === 'initial') {
          setHasOlderMessages(hasMore);
        }

        if (reason === 'initial' || reason === 'send' || isNearBottomRef.current) {
          pendingScrollModeRef.current = 'bottom';
          pendingScrollTopRef.current = null;
          pendingScrollHeightRef.current = null;
        } else {
          pendingScrollModeRef.current = 'preserve';
          pendingScrollTopRef.current = messagesContainerRef.current?.scrollTop ?? 0;
          pendingScrollHeightRef.current = null;
        }

        setMessages(nextMessages);

        const cache = messagesCacheByChatIdRef.current;
        cache.delete(targetChatId);
        cache.set(targetChatId, { messages: nextMessages, signature: nextSignature, hasOlderMessages: hasMore });
        if (cache.size > MESSAGES_CACHE_MAX_CHATS) {
          const oldestKey = cache.keys().next().value;
          if (oldestKey !== undefined) {
            cache.delete(oldestKey);
          }
        }
      } catch (error) {
        if (requestId !== messagesRequestIdRef.current || selectedChatIdRef.current !== targetChatId) {
          return;
        }

        console.error('[WhatsAppInbox] erro ao carregar mensagens', error);
        setMessageLoadError('Não foi possível carregar as mensagens desta conversa.');
        if (reason !== 'initial') {
          toast.error(error instanceof Error ? error.message : 'Não foi possível carregar as mensagens da conversa.');
        }
      } finally {
        if (
          shouldShowBlockingLoader
          && requestId === messagesRequestIdRef.current
          && selectedChatIdRef.current === targetChatId
        ) {
          setLoadingMessages(false);
        }

        if (reason === 'poll' && pollingMessagesChatIdRef.current === targetChatId) {
          pollingMessagesChatIdRef.current = null;
        }
      }
    };

    return messageLoadQueueRef.current.enqueue(targetChatId, runLoad);
  }, [
    applyOutgoingOrderToServerMessage,
    buildMessagesSignature,
    isNearBottomRef,
    latestMessagesRef,
    localOutgoingMediaPreviewUrlsRef,
    localOutgoingRetryPayloadRef,
    messagesCacheByChatIdRef,
    messagesContainerRef,
    messagesRequestIdRef,
    messagesSignatureRef,
    pendingScrollHeightRef,
    pendingScrollModeRef,
    pendingScrollTopRef,
    rememberOutgoingMessageOrder,
    selectedChatIdRef,
    setHasOlderMessages,
    setLeadPanel,
    setLoadingMessages,
    setLocalOutgoingMessages,
    setMessageLoadError,
    setMessages,
    setThreadReconcileChatId,
    upsertChatLocally,
  ]);

  return { loadMessages };
};
