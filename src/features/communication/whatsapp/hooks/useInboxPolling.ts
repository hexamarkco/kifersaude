import { useEffect } from 'react';

import type { CommWhatsAppChat } from '../domain/types';
import {
  computeChatPollIntervalMs,
  computeMessagePollIntervalMs,
  computeOperationalStatePollIntervalMs,
  INBOX_POLLING_INTERVALS,
} from '../pollingIntervals';

type CurrentValue<T> = { readonly current: T };

type UseInboxPollingOptions = {
  pollingEnabled: boolean;
  selectedChatId: string | null;
  loadingOlderMessages: boolean;
  chatPollBackoffRef: CurrentValue<number>;
  chatPollIdleCyclesRef: CurrentValue<number>;
  isChannelConnectedRef: CurrentValue<boolean>;
  isMessageRealtimeHealthyRef: CurrentValue<boolean>;
  loadChats: () => Promise<unknown>;
  refreshArchivedChatsCount: () => Promise<unknown>;
  loadOperationalState: () => Promise<unknown>;
  getSelectedChatSnapshot: (chatId: string) => CommWhatsAppChat | null;
  loadMessages: (chat: CommWhatsAppChat | null, reason: 'poll') => Promise<unknown>;
};

export const useInboxPolling = ({
  pollingEnabled,
  selectedChatId,
  loadingOlderMessages,
  chatPollBackoffRef,
  chatPollIdleCyclesRef,
  isChannelConnectedRef,
  isMessageRealtimeHealthyRef,
  loadChats,
  refreshArchivedChatsCount,
  loadOperationalState,
  getSelectedChatSnapshot,
  loadMessages,
}: UseInboxPollingOptions) => {
  useEffect(() => {
    if (!pollingEnabled) return undefined;

    let timeoutId: number;

    const scheduleNext = () => {
      const backoffLevel = chatPollBackoffRef.current;
      const delay = backoffLevel > 0
        ? Math.min(INBOX_POLLING_INTERVALS.chats * (2 ** backoffLevel), INBOX_POLLING_INTERVALS.maxChatBackoff)
        : computeChatPollIntervalMs(
            chatPollIdleCyclesRef.current,
            INBOX_POLLING_INTERVALS.chats,
            INBOX_POLLING_INTERVALS.maxChatIdle,
          );

      timeoutId = window.setTimeout(() => {
        void loadChats();
        scheduleNext();
      }, delay);
    };

    scheduleNext();
    return () => window.clearTimeout(timeoutId);
  }, [chatPollBackoffRef, chatPollIdleCyclesRef, loadChats, pollingEnabled]);

  useEffect(() => {
    if (!pollingEnabled) return undefined;

    let timeoutId: number;
    const scheduleNext = () => {
      timeoutId = window.setTimeout(() => {
        void refreshArchivedChatsCount();
        scheduleNext();
      }, INBOX_POLLING_INTERVALS.archivedChatCount);
    };

    scheduleNext();
    return () => window.clearTimeout(timeoutId);
  }, [pollingEnabled, refreshArchivedChatsCount]);

  useEffect(() => {
    if (!pollingEnabled) return undefined;

    let timeoutId: number;
    const scheduleNext = () => {
      const delay = computeOperationalStatePollIntervalMs(
        isChannelConnectedRef.current,
        INBOX_POLLING_INTERVALS.operationalState,
        INBOX_POLLING_INTERVALS.operationalStateDegraded,
      );

      timeoutId = window.setTimeout(() => {
        void loadOperationalState();
        scheduleNext();
      }, delay);
    };

    scheduleNext();
    return () => window.clearTimeout(timeoutId);
  }, [isChannelConnectedRef, loadOperationalState, pollingEnabled]);

  useEffect(() => {
    if (!pollingEnabled || !selectedChatId) return undefined;

    let timeoutId: number;

    // O carregamento de mensagens serializa requisições do mesmo chat; polling
    // continua ativo enquanto a página antiga carrega, mas não inicia consulta.
    const scheduleNext = () => {
      const delay = computeMessagePollIntervalMs(
        isMessageRealtimeHealthyRef.current,
        INBOX_POLLING_INTERVALS.messages,
        INBOX_POLLING_INTERVALS.messageSafetyNet,
      );

      timeoutId = window.setTimeout(() => {
        if (!loadingOlderMessages) {
          void loadMessages(getSelectedChatSnapshot(selectedChatId), 'poll');
        }
        scheduleNext();
      }, delay);
    };

    scheduleNext();
    return () => window.clearTimeout(timeoutId);
  }, [
    getSelectedChatSnapshot,
    isMessageRealtimeHealthyRef,
    loadMessages,
    loadingOlderMessages,
    pollingEnabled,
    selectedChatId,
  ]);
};
