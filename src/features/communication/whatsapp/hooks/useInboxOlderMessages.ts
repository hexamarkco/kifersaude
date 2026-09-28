import { useCallback, useRef, type Dispatch, type SetStateAction } from 'react';

import { whatsappMessagesRepository } from '../data';
import { INBOX_MESSAGE_PAGE_SIZE } from '../domain/messagePagination';
import type { CommWhatsAppChat, CommWhatsAppMessage } from '../domain/types';
import { mergeMessages } from '../domain/messageTimeline';
import { KeyedActionLock } from '../components/keyedActionLock';
import { toast } from '../../../../lib/toast';

type CurrentValue<Value> = { current: Value };

type InboxOlderMessagesRefs = {
  latestMessagesRef: CurrentValue<CommWhatsAppMessage[]>;
  selectedChatIdRef: CurrentValue<string | null>;
  messagesSignatureRef: CurrentValue<string>;
  messagesContainerRef: CurrentValue<HTMLDivElement | null>;
  pendingScrollModeRef: CurrentValue<'bottom' | 'preserve' | 'prepend' | null>;
  pendingScrollTopRef: CurrentValue<number | null>;
  pendingScrollHeightRef: CurrentValue<number | null>;
};

type InboxOlderMessagesOptions = {
  selectedChat: CommWhatsAppChat | null;
  loadingOlderMessages: boolean;
  hasOlderMessages: boolean;
  refs: InboxOlderMessagesRefs;
  setLoadingOlderMessages: Dispatch<SetStateAction<boolean>>;
  setHasOlderMessages: Dispatch<SetStateAction<boolean>>;
  setMessages: Dispatch<SetStateAction<CommWhatsAppMessage[]>>;
  buildMessagesSignature: (messages: CommWhatsAppMessage[]) => string;
};

export const useInboxOlderMessages = ({
  selectedChat,
  loadingOlderMessages,
  hasOlderMessages,
  refs,
  setLoadingOlderMessages,
  setHasOlderMessages,
  setMessages,
  buildMessagesSignature,
}: InboxOlderMessagesOptions) => {
  const loadLockRef = useRef(new KeyedActionLock());
  const requestIdRef = useRef(0);
  const {
    latestMessagesRef,
    selectedChatIdRef,
    messagesSignatureRef,
    messagesContainerRef,
    pendingScrollModeRef,
    pendingScrollTopRef,
    pendingScrollHeightRef,
  } = refs;

  const handleLoadOlderMessages = useCallback(async () => {
    if (!selectedChat || loadingOlderMessages || !hasOlderMessages || latestMessagesRef.current.length === 0) {
      return;
    }

    const targetChatId = selectedChat.id;
    if (!loadLockRef.current.tryAcquire(targetChatId)) {
      return;
    }

    const requestId = ++requestIdRef.current;
    const oldestMessage = latestMessagesRef.current[0];
    const container = messagesContainerRef.current;

    setLoadingOlderMessages(true);

    try {
      const page = await whatsappMessagesRepository.listPage(targetChatId, {
        limit: INBOX_MESSAGE_PAGE_SIZE,
        before: {
          messageAt: oldestMessage.message_at,
          id: oldestMessage.id,
        },
      });

      if (requestId !== requestIdRef.current || selectedChatIdRef.current !== targetChatId) {
        return;
      }

      const nextMessages = mergeMessages(page.messages, latestMessagesRef.current);
      const nextSignature = buildMessagesSignature(nextMessages);

      setHasOlderMessages(page.hasMore);

      if (nextSignature === messagesSignatureRef.current) {
        return;
      }

      messagesSignatureRef.current = nextSignature;
      pendingScrollModeRef.current = 'prepend';
      pendingScrollTopRef.current = container?.scrollTop ?? 0;
      pendingScrollHeightRef.current = container?.scrollHeight ?? 0;
      setMessages(nextMessages);
    } catch (error) {
      if (requestId !== requestIdRef.current || selectedChatIdRef.current !== targetChatId) {
        return;
      }

      console.error('[WhatsAppInbox] erro ao carregar mensagens antigas', error);
      toast.error(error instanceof Error ? error.message : 'Não foi possível carregar mensagens mais antigas.');
    } finally {
      loadLockRef.current.release(targetChatId);
      if (requestId === requestIdRef.current && selectedChatIdRef.current === targetChatId) {
        setLoadingOlderMessages(false);
      }
    }
  }, [
    buildMessagesSignature,
    hasOlderMessages,
    latestMessagesRef,
    loadingOlderMessages,
    messagesContainerRef,
    messagesSignatureRef,
    pendingScrollHeightRef,
    pendingScrollModeRef,
    pendingScrollTopRef,
    selectedChat,
    selectedChatIdRef,
    setHasOlderMessages,
    setLoadingOlderMessages,
    setMessages,
  ]);

  return { handleLoadOlderMessages };
};
