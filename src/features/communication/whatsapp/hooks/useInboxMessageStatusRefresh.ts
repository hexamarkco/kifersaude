import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from 'react';

import { whatsappMessagesRepository } from '../data';
import type { CommWhatsAppChat, CommWhatsAppMessage } from '../domain/types';
import { normalizeDeliveryStatus, resolveDeliveryStatus } from '../messageStatus';

type CurrentValue<Value> = { current: Value };
type MessageLoadReason = 'initial' | 'poll' | 'send';

type InboxMessageStatusRefreshRefs = {
  latestMessagesRef: CurrentValue<CommWhatsAppMessage[]>;
  loadChatsRef: CurrentValue<() => Promise<unknown> | void>;
  loadMessagesRef: CurrentValue<(chat: CommWhatsAppChat | null, reason?: MessageLoadReason) => Promise<unknown> | void>;
};

type InboxMessageStatusRefreshOptions = {
  refs: InboxMessageStatusRefreshRefs;
  pollingEnabled: boolean;
  selectedChatId: string | null;
  selectedChat: CommWhatsAppChat | null;
  visibleMessages: CommWhatsAppMessage[];
  refreshableOutboundStatuses: ReadonlySet<string>;
  setLocalOutgoingMessages: Dispatch<SetStateAction<CommWhatsAppMessage[]>>;
};

const MESSAGE_STATUS_REFRESH_DELAYS_MS = [1000, 3000, 7000, 15000, 30000, 60000, 120000, 300000];

export const useInboxMessageStatusRefresh = ({
  refs,
  pollingEnabled,
  selectedChatId,
  selectedChat,
  visibleMessages,
  refreshableOutboundStatuses,
  setLocalOutgoingMessages,
}: InboxMessageStatusRefreshOptions) => {
  const { latestMessagesRef, loadChatsRef, loadMessagesRef } = refs;
  const timeoutIdsRef = useRef<number[]>([]);
  const generationRef = useRef(0);
  const inFlightGenerationRef = useRef<number | null>(null);
  const lastPendingStatusRefreshKeyRef = useRef('');

  const clearScheduledMessageStatusRefreshes = useCallback(() => {
    generationRef.current += 1;
    inFlightGenerationRef.current = null;
    for (const timeoutId of timeoutIdsRef.current) {
      window.clearTimeout(timeoutId);
    }
    timeoutIdsRef.current = [];
    lastPendingStatusRefreshKeyRef.current = '';
  }, []);

  useEffect(() => () => clearScheduledMessageStatusRefreshes(), [clearScheduledMessageStatusRefreshes]);

  useEffect(() => {
    clearScheduledMessageStatusRefreshes();
  }, [clearScheduledMessageStatusRefreshes, selectedChatId]);

  useEffect(() => {
    if (!pollingEnabled) {
      clearScheduledMessageStatusRefreshes();
    }
  }, [clearScheduledMessageStatusRefreshes, pollingEnabled]);

  const scheduleMessageStatusRefresh = useCallback((params: {
    chat: CommWhatsAppChat;
    externalMessageIds: string[];
  }) => {
    // Realtime is the primary status path; these delayed provider checks only
    // cover missed or late webhooks and stop once every message is resolved.
    const remainingIds = new Set(
      Array.from(new Set(params.externalMessageIds.map((id) => id.trim()).filter(Boolean))).slice(0, 20),
    );
    if (remainingIds.size === 0) {
      return;
    }

    const generation = generationRef.current;

    const dropAlreadyResolvedIds = () => {
      for (const externalMessageId of remainingIds) {
        const known = latestMessagesRef.current.find(
          (message) => String(message.external_message_id ?? '').trim() === externalMessageId,
        );
        if (known && !refreshableOutboundStatuses.has(normalizeDeliveryStatus(known.delivery_status))) {
          remainingIds.delete(externalMessageId);
        }
      }
    };

    for (const delayMs of MESSAGE_STATUS_REFRESH_DELAYS_MS) {
      const timeoutId = window.setTimeout(() => {
        timeoutIdsRef.current = timeoutIdsRef.current.filter((id) => id !== timeoutId);

        if (generation !== generationRef.current) {
          return;
        }

        dropAlreadyResolvedIds();
        if (remainingIds.size === 0) {
          return;
        }

        // Keep retry ticks scheduled, but never overlap provider lookups for
        // the same active generation.
        if (inFlightGenerationRef.current === generation) {
          return;
        }

        const idsToCheck = Array.from(remainingIds);
        inFlightGenerationRef.current = generation;

        void whatsappMessagesRepository.refreshStatuses({
          chatId: params.chat.external_chat_id,
          externalMessageIds: idsToCheck,
          limit: idsToCheck.length,
        }).then((result) => {
          if (generation !== generationRef.current || result.refreshed.length === 0) {
            return;
          }

          const refreshedByExternalId = new Map(result.refreshed.map((item) => [item.external_message_id, item]));
          setLocalOutgoingMessages((current) => current.map((message) => {
            const externalMessageId = String(message.external_message_id ?? '').trim();
            const refreshed = externalMessageId ? refreshedByExternalId.get(externalMessageId) : null;
            if (!refreshed) {
              return message;
            }

            const resolvedStatus = resolveDeliveryStatus(message.delivery_status, refreshed.delivery_status) ?? message.delivery_status;
            if (message.delivery_status === resolvedStatus) {
              return message;
            }

            return {
              ...message,
              delivery_status: resolvedStatus,
              status_updated_at: new Date().toISOString(),
            };
          }));

          for (const item of result.refreshed) {
            if (!refreshableOutboundStatuses.has(normalizeDeliveryStatus(item.delivery_status))) {
              remainingIds.delete(item.external_message_id);
            }
          }

          if (result.updated > 0 || result.refreshed.some((item) => !refreshableOutboundStatuses.has(normalizeDeliveryStatus(item.delivery_status)))) {
            void Promise.all([
              loadMessagesRef.current(params.chat, 'send'),
              loadChatsRef.current(),
            ]).catch((error) => {
              console.error('[WhatsAppInbox] erro ao recarregar apos atualizar status ativo', error);
            });
          }
        }).catch((error) => {
          if (generation === generationRef.current) {
            console.error('[WhatsAppInbox] erro ao atualizar status ativo da mensagem', error);
          }
        }).finally(() => {
          if (inFlightGenerationRef.current === generation) {
            inFlightGenerationRef.current = null;
          }
        });
      }, delayMs);

      timeoutIdsRef.current.push(timeoutId);
    }
  }, [latestMessagesRef, loadChatsRef, loadMessagesRef, refreshableOutboundStatuses, setLocalOutgoingMessages]);

  useEffect(() => {
    if (!pollingEnabled || !selectedChat) {
      return;
    }

    const pendingExternalIds = visibleMessages
      .filter((message) => message.direction === 'outbound')
      .filter((message) => refreshableOutboundStatuses.has(String(message.delivery_status ?? '').trim().toLowerCase()))
      .map((message) => String(message.external_message_id ?? '').trim())
      .filter(Boolean)
      .slice(-10);

    if (pendingExternalIds.length === 0) {
      lastPendingStatusRefreshKeyRef.current = '';
      return;
    }

    const refreshKey = `${selectedChat.id}:${pendingExternalIds.join('|')}`;
    if (lastPendingStatusRefreshKeyRef.current === refreshKey) {
      return;
    }

    lastPendingStatusRefreshKeyRef.current = refreshKey;
    scheduleMessageStatusRefresh({
      chat: selectedChat,
      externalMessageIds: pendingExternalIds,
    });
  }, [lastPendingStatusRefreshKeyRef, pollingEnabled, refreshableOutboundStatuses, scheduleMessageStatusRefresh, selectedChat, visibleMessages]);

  return {
    scheduleMessageStatusRefresh,
    clearScheduledMessageStatusRefreshes,
    lastPendingStatusRefreshKeyRef,
  };
};
