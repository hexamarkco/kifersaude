import { useCallback, useRef } from 'react';

import { whatsappConversationsRepository } from '../data';
import type { CommWhatsAppChat, CommWhatsAppMessage } from '../domain/types';
import { compareMessageChronology, getMessageTimestampMs } from '../domain/messageTimeline';
import {
  clearPendingChatReadState,
  mergePendingChatInboxState,
  type PendingChatInboxStatePatch,
} from '../pendingChatInboxState';
import { toast } from '../../../../lib/toast';

const CHAT_READ_RETRY_COOLDOWN_MS = 30_000;

type CurrentValue<Value> = { current: Value };
type ReadSource = 'auto' | 'scroll';

type UseInboxMarkChatReadOptions = {
  refs: {
    selectedChatIdRef: CurrentValue<string | null>;
    latestChatsRef: CurrentValue<CommWhatsAppChat[]>;
    latestMessagesRef: CurrentValue<CommWhatsAppMessage[]>;
    isNearBottomRef: CurrentValue<boolean>;
    pendingChatInboxStateRef: CurrentValue<Map<string, PendingChatInboxStatePatch>>;
    manualUnreadSkipReadChatIdRef: CurrentValue<string | null>;
    chatReadMutationVersionByChatIdRef: CurrentValue<Map<string, number>>;
  };
  upsertChatLocally: (chat: CommWhatsAppChat) => void;
  loadChats: () => Promise<unknown>;
};

export const useInboxMarkChatRead = ({ refs, upsertChatLocally, loadChats }: UseInboxMarkChatReadOptions) => {
  const pendingChatReadKeysRef = useRef<Set<string>>(new Set());
  const attemptedChatReadAtByKeyRef = useRef<Map<string, number>>(new Map());

  const markSelectedChatReadIfEligible = useCallback((source: ReadSource) => {
    const currentChat = refs.selectedChatIdRef.current
      ? refs.latestChatsRef.current.find((chat) => chat.id === refs.selectedChatIdRef.current) ?? null
      : null;

    if (!currentChat || !refs.isNearBottomRef.current) {
      console.debug('[WhatsAppInbox][mark-read] skip:not-ready-or-not-bottom', {
        source,
        selectedChatId: refs.selectedChatIdRef.current,
        hasCurrentChat: Boolean(currentChat),
        isNearBottom: refs.isNearBottomRef.current,
      });
      return;
    }

    const skipManualUnreadRead = refs.manualUnreadSkipReadChatIdRef.current === currentChat.id
      && currentChat.manual_unread
      && currentChat.unread_count <= 0;

    if (source !== 'scroll' && skipManualUnreadRead) {
      console.debug('[WhatsAppInbox][mark-read] skip:manual-unread-protection', {
        source,
        chatId: currentChat.id,
        unreadCount: currentChat.unread_count,
        manualUnread: currentChat.manual_unread,
      });
      return;
    }

    // Manual unread is an explicit reminder; selecting/opening the chat should
    // not clear it until the user reaches the end of the message timeline.
    if (source !== 'scroll' && currentChat.manual_unread && currentChat.unread_count <= 0) {
      console.debug('[WhatsAppInbox][mark-read] skip:manual-unread-await-scroll', {
        source,
        chatId: currentChat.id,
        unreadCount: currentChat.unread_count,
        manualUnread: currentChat.manual_unread,
      });
      return;
    }

    if (currentChat.unread_count <= 0 && !currentChat.manual_unread) {
      console.debug('[WhatsAppInbox][mark-read] skip:already-read', {
        source,
        chatId: currentChat.id,
        unreadCount: currentChat.unread_count,
        manualUnread: currentChat.manual_unread,
        lastReadAt: currentChat.last_read_at,
        lastMessageAt: currentChat.last_message_at,
      });
      return;
    }

    const renderedMessagesForChat = refs.latestMessagesRef.current
      .filter((message) => message.chat_id === currentChat.id)
      .sort(compareMessageChronology);
    const latestRenderedMessage = renderedMessagesForChat[renderedMessagesForChat.length - 1];
    const latestRenderedMessageAtMs = getMessageTimestampMs(latestRenderedMessage?.message_at);
    const selectedChatLastMessageAtMs = getMessageTimestampMs(currentChat.last_message_at);

    if (selectedChatLastMessageAtMs !== null && (latestRenderedMessageAtMs === null || latestRenderedMessageAtMs < selectedChatLastMessageAtMs)) {
      console.debug('[WhatsAppInbox][mark-read] skip:last-message-not-rendered', {
        source,
        chatId: currentChat.id,
        selectedChatLastMessageAt: currentChat.last_message_at,
        selectedChatLastMessageAtMs,
        latestRenderedMessageAt: latestRenderedMessage?.message_at ?? null,
        latestRenderedMessageAtMs,
        renderedMessagesForChat: renderedMessagesForChat.length,
      });
      return;
    }

    const readAt = selectedChatLastMessageAtMs !== null && (latestRenderedMessageAtMs === null || selectedChatLastMessageAtMs >= latestRenderedMessageAtMs)
      ? currentChat.last_message_at
      : latestRenderedMessage?.message_at ?? new Date().toISOString();
    const readPatch: PendingChatInboxStatePatch = {
      unread_count: 0,
      manual_unread: false,
      manual_unread_at: null,
      last_read_at: readAt,
    };
    const readKey = `${currentChat.id}:${readAt ?? ''}`;
    const lastAttemptAt = attemptedChatReadAtByKeyRef.current.get(readKey) ?? 0;
    const retryCooldownActive = Date.now() - lastAttemptAt < CHAT_READ_RETRY_COOLDOWN_MS;

    if (pendingChatReadKeysRef.current.has(readKey) || retryCooldownActive) {
      console.debug('[WhatsAppInbox][mark-read] skip:in-flight-or-cooldown', {
        source,
        chatId: currentChat.id,
        readAt,
        readKey,
        inFlight: pendingChatReadKeysRef.current.has(readKey),
        retryCooldownActive,
        msSinceLastAttempt: lastAttemptAt > 0 ? Date.now() - lastAttemptAt : null,
      });
      return;
    }

    const readMutationVersion = (refs.chatReadMutationVersionByChatIdRef.current.get(currentChat.id) ?? 0) + 1;
    refs.chatReadMutationVersionByChatIdRef.current.set(currentChat.id, readMutationVersion);
    pendingChatReadKeysRef.current.add(readKey);
    attemptedChatReadAtByKeyRef.current.set(readKey, Date.now());

    console.debug('[WhatsAppInbox][mark-read] request:start', {
      source,
      chatId: currentChat.id,
      readAt,
      readKey,
      unreadCountBefore: currentChat.unread_count,
      manualUnreadBefore: currentChat.manual_unread,
      lastReadAtBefore: currentChat.last_read_at,
      lastMessageAt: currentChat.last_message_at,
      latestRenderedMessageAt: latestRenderedMessage?.message_at ?? null,
      isNearBottom: refs.isNearBottomRef.current,
    });

    mergePendingChatInboxState(refs.pendingChatInboxStateRef.current, currentChat.id, readPatch);
    upsertChatLocally({ ...currentChat, ...readPatch });

    if (refs.manualUnreadSkipReadChatIdRef.current === currentChat.id) {
      refs.manualUnreadSkipReadChatIdRef.current = null;
    }

    void whatsappConversationsRepository.markRead(currentChat.id, {
      messageAt: readAt,
    }).then((result) => {
      if (refs.chatReadMutationVersionByChatIdRef.current.get(currentChat.id) !== readMutationVersion) {
        return;
      }

      const latestChat = refs.latestChatsRef.current.find((chat) => chat.id === currentChat.id) ?? currentChat;

      console.debug('[WhatsAppInbox][mark-read] request:success', {
        source,
        chatId: currentChat.id,
        readAt,
        result,
        latestChatBeforePatch: {
          unreadCount: latestChat.unread_count,
          manualUnread: latestChat.manual_unread,
          manualUnreadAt: latestChat.manual_unread_at,
          lastReadAt: latestChat.last_read_at,
          lastMessageAt: latestChat.last_message_at,
        },
      });

      const confirmedPatch: PendingChatInboxStatePatch = {
        unread_count: result.unreadCount,
        manual_unread: result.unreadCount > 0 ? latestChat.manual_unread : false,
        manual_unread_at: result.unreadCount > 0 ? latestChat.manual_unread_at : null,
        last_read_at: result.lastReadAt ?? readAt,
      };

      clearPendingChatReadState(refs.pendingChatInboxStateRef.current, currentChat.id);

      upsertChatLocally({
        ...latestChat,
        ...confirmedPatch,
      });

      console.debug('[WhatsAppInbox][mark-read] local:patched-from-confirmation', {
        source,
        chatId: currentChat.id,
        readAt,
        confirmedPatch,
      });

      if (result.unreadCount > 0) {
        console.warn('[WhatsAppInbox] leitura confirmada com nao lidas remanescentes', {
          chatId: currentChat.id,
          readAt,
          result,
        });
      } else {
        attemptedChatReadAtByKeyRef.current.delete(readKey);
      }
      refs.chatReadMutationVersionByChatIdRef.current.delete(currentChat.id);
    }).catch((error) => {
      if (refs.chatReadMutationVersionByChatIdRef.current.get(currentChat.id) !== readMutationVersion) {
        return;
      }

      clearPendingChatReadState(refs.pendingChatInboxStateRef.current, currentChat.id);
      refs.chatReadMutationVersionByChatIdRef.current.delete(currentChat.id);
      console.error('[WhatsAppInbox][mark-read] request:error', {
        source,
        chatId: currentChat.id,
        readAt,
        readKey,
        error,
      });
      toast.error(error instanceof Error ? error.message : 'Não foi possível marcar a conversa como lida.');
      void loadChats().catch((loadError) => {
        console.error('[WhatsAppInbox][mark-read] reload-after-error:error', loadError);
      });
    }).finally(() => {
      pendingChatReadKeysRef.current.delete(readKey);
      console.debug('[WhatsAppInbox][mark-read] request:finished', {
        source,
        chatId: currentChat.id,
        readAt,
        readKey,
      });
    });
  }, [
    loadChats,
    refs.isNearBottomRef,
    refs.latestChatsRef,
    refs.latestMessagesRef,
    refs.manualUnreadSkipReadChatIdRef,
    refs.chatReadMutationVersionByChatIdRef,
    refs.pendingChatInboxStateRef,
    refs.selectedChatIdRef,
    upsertChatLocally,
  ]);

  const clearManualUnreadSkipReadForOtherChats = useCallback((selectedChatId: string | null) => {
    if (refs.manualUnreadSkipReadChatIdRef.current && refs.manualUnreadSkipReadChatIdRef.current !== selectedChatId) {
      refs.manualUnreadSkipReadChatIdRef.current = null;
    }
  }, [refs.manualUnreadSkipReadChatIdRef]);

  return {
    markSelectedChatReadIfEligible,
    clearManualUnreadSkipReadForOtherChats,
  };
};
