import { useCallback, type Dispatch, type SetStateAction } from 'react';

import { whatsappConversationsRepository } from '../data';
import type { CommWhatsAppChat } from '../domain/types';
import { resolveStableDeliveryStatus } from '../domain/chatPresentation';
import { mergePendingChatInboxState, type PendingChatInboxStatePatch } from '../pendingChatInboxState';

type CurrentValue<Value> = { current: Value };

type UseInboxOptimisticChatStateOptions = {
  refs: {
    pendingChatInboxStateRef: CurrentValue<Map<string, PendingChatInboxStatePatch>>;
    chatReadMutationVersionByChatIdRef: CurrentValue<Map<string, number>>;
    chatsSignatureRef: CurrentValue<string>;
  };
  setChats: Dispatch<SetStateAction<CommWhatsAppChat[]>>;
  upsertChatLocally: (chat: CommWhatsAppChat) => void;
  buildChatsSignature: (chats: CommWhatsAppChat[]) => string;
};

export const useInboxOptimisticChatState = ({ refs, setChats, upsertChatLocally, buildChatsSignature }: UseInboxOptimisticChatStateOptions) => {
  const applyOptimisticChatSummary = useCallback((chat: CommWhatsAppChat, summaryText: string, messageAt: string) => {
    const readMutationVersion = (refs.chatReadMutationVersionByChatIdRef.current.get(chat.id) ?? 0) + 1;
    refs.chatReadMutationVersionByChatIdRef.current.set(chat.id, readMutationVersion);
    const readPatch: PendingChatInboxStatePatch = {
      unread_count: 0,
      manual_unread: false,
      manual_unread_at: null,
      last_read_at: messageAt,
    };

    mergePendingChatInboxState(refs.pendingChatInboxStateRef.current, chat.id, {
      ...readPatch,
      is_archived: chat.is_archived,
      archived_at: chat.archived_at,
      last_message_text: summaryText,
      last_message_direction: 'outbound',
      last_message_at: messageAt,
      last_message_delivery_status: 'pending',
    });

    upsertChatLocally({
      ...chat,
      ...readPatch,
      is_archived: chat.is_archived,
      archived_at: chat.archived_at,
      last_message_text: summaryText,
      last_message_direction: 'outbound',
      last_message_at: messageAt,
      last_message_delivery_status: 'pending',
      updated_at: messageAt,
    });

    void whatsappConversationsRepository.markRead(chat.id, { messageAt }).then(() => {
      if (refs.chatReadMutationVersionByChatIdRef.current.get(chat.id) !== readMutationVersion) {
        return;
      }
      refs.chatReadMutationVersionByChatIdRef.current.delete(chat.id);
    }).catch((error) => {
      if (refs.chatReadMutationVersionByChatIdRef.current.get(chat.id) !== readMutationVersion) {
        return;
      }
      refs.chatReadMutationVersionByChatIdRef.current.delete(chat.id);
      console.error('[WhatsAppInbox] erro ao avancar leitura apos envio', error);
    });
  }, [refs.chatReadMutationVersionByChatIdRef, refs.pendingChatInboxStateRef, upsertChatLocally]);

  const updateOptimisticChatPreviewStatus = useCallback((chatId: string, messageAt: string, deliveryStatus: string) => {
    const pendingState = refs.pendingChatInboxStateRef.current.get(chatId);
    if (pendingState?.last_message_at === messageAt) {
      refs.pendingChatInboxStateRef.current.set(chatId, {
        ...pendingState,
        last_message_delivery_status: resolveStableDeliveryStatus(deliveryStatus, pendingState.last_message_delivery_status),
      });
    }

    setChats((current) => {
      const next = current.map((chat) => (
        chat.id === chatId && chat.last_message_at === messageAt
          ? { ...chat, last_message_delivery_status: resolveStableDeliveryStatus(deliveryStatus, chat.last_message_delivery_status) }
          : chat
      ));
      refs.chatsSignatureRef.current = buildChatsSignature(next);
      return next;
    });
  }, [buildChatsSignature, refs.chatsSignatureRef, refs.pendingChatInboxStateRef, setChats]);

  return { applyOptimisticChatSummary, updateOptimisticChatPreviewStatus };
};
