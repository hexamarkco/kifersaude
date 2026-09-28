import { useCallback, type Dispatch, type SetStateAction } from 'react';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

import {
  applyChatPresenceUpdate,
  preserveUsefulChatPreview,
  sortChatsByInboxOrder,
  stabilizeChatIdentityForLocalMerge,
} from '../domain/chatPresentation';
import { selectReplacementChatId } from '../domain/chatLoadState';
import { mergeMessages } from '../domain/messageTimeline';
import { getSavedContactNameForPhone } from '../domain/contactLookup';
import type { CommWhatsAppChat, CommWhatsAppMessage, CommWhatsAppPresence } from '../domain/types';
import {
  applyPendingChatInboxState,
  type PendingChatInboxStatePatch,
} from '../pendingChatInboxState';

type CurrentValue<T> = { current: T };
type ScrollMode = 'bottom' | 'preserve' | 'prepend' | null;

type InboxRealtimeUpdatesOptions = {
  refs: {
    chatPollBackoffRef: CurrentValue<number>;
    chatPollIdleCyclesRef: CurrentValue<number>;
    selectedChatIdRef: CurrentValue<string | null>;
    archivedSectionOpenRef: CurrentValue<boolean>;
    latestChatsRef: CurrentValue<CommWhatsAppChat[]>;
    chatIdFromUrlRef: CurrentValue<string | null>;
    savedContactNameOverrideByPhoneRef: CurrentValue<Map<string, string>>;
    savedContactNameByPhoneRef: CurrentValue<Map<string, string>>;
    pendingChatInboxStateRef: CurrentValue<Map<string, PendingChatInboxStatePatch>>;
    chatsSignatureRef: CurrentValue<string>;
    messagesSignatureRef: CurrentValue<string>;
    isNearBottomRef: CurrentValue<boolean>;
    pendingScrollModeRef: CurrentValue<ScrollMode>;
    pendingScrollTopRef: CurrentValue<number | null>;
    pendingScrollHeightRef: CurrentValue<number | null>;
    messagesContainerRef: CurrentValue<HTMLDivElement | null>;
    loadChatsRef: CurrentValue<() => Promise<unknown> | void>;
  };
  setSelectedChatId: Dispatch<SetStateAction<string | null>>;
  setChats: Dispatch<SetStateAction<CommWhatsAppChat[]>>;
  setMessages: Dispatch<SetStateAction<CommWhatsAppMessage[]>>;
  buildChatsSignature: (chats: CommWhatsAppChat[]) => string;
  buildMessagesSignature: (messages: CommWhatsAppMessage[]) => string;
  chatMatchesActiveFilters: (chat: CommWhatsAppChat) => boolean;
  applyFrontendSavedContactNames: (chats: CommWhatsAppChat[]) => CommWhatsAppChat[];
  applyPrefetchedLeadNames: (chats: CommWhatsAppChat[]) => CommWhatsAppChat[];
  applyOutgoingOrderToServerMessage: (message: CommWhatsAppMessage) => CommWhatsAppMessage;
  reconcileLocalOutgoingMessages: (chatId: string, serverMessages: CommWhatsAppMessage[]) => void;
};

export const useInboxRealtimeUpdates = ({
  refs,
  setSelectedChatId,
  setChats,
  setMessages,
  buildChatsSignature,
  buildMessagesSignature,
  chatMatchesActiveFilters,
  applyFrontendSavedContactNames,
  applyPrefetchedLeadNames,
  applyOutgoingOrderToServerMessage,
  reconcileLocalOutgoingMessages,
}: InboxRealtimeUpdatesOptions) => {
  const {
    chatPollBackoffRef,
    chatPollIdleCyclesRef,
    selectedChatIdRef,
    archivedSectionOpenRef,
    latestChatsRef,
    chatIdFromUrlRef,
    savedContactNameOverrideByPhoneRef,
    savedContactNameByPhoneRef,
    pendingChatInboxStateRef,
    chatsSignatureRef,
    messagesSignatureRef,
    isNearBottomRef,
    pendingScrollModeRef,
    pendingScrollTopRef,
    pendingScrollHeightRef,
    messagesContainerRef,
    loadChatsRef,
  } = refs;

  const applyRealtimeChatChange = useCallback((payload: RealtimePostgresChangesPayload<CommWhatsAppChat>) => {
    const incomingChat = payload.new as CommWhatsAppChat | null;
    const previousChat = payload.old as Partial<CommWhatsAppChat> | null;
    const changedChatId = incomingChat?.id ?? previousChat?.id ?? null;

    if (!changedChatId) {
      return;
    }

    chatPollBackoffRef.current = 0;
    chatPollIdleCyclesRef.current = 0;

    if (incomingChat?.merged_into_chat_id && selectedChatIdRef.current === incomingChat.id) {
      setSelectedChatId(incomingChat.merged_into_chat_id);
      void loadChatsRef.current();
    }

    const selectedChatWasRemoved = selectedChatIdRef.current === changedChatId
      && !incomingChat?.merged_into_chat_id
      && (payload.eventType === 'DELETE' || Boolean(incomingChat?.deleted_at));
    if (selectedChatWasRemoved) {
      const selectedChatBeforeRemoval = latestChatsRef.current.find((chat) => chat.id === changedChatId);
      const preferredSection = (selectedChatBeforeRemoval?.is_archived ?? archivedSectionOpenRef.current)
        ? 'archived'
        : 'active';
      const replacementChatId = selectReplacementChatId({
        chats: latestChatsRef.current.filter((chat) => (
          chatMatchesActiveFilters(chat)
          && Boolean(chat.is_archived) === (preferredSection === 'archived')
        )),
        removedChatId: changedChatId,
        preferredSection,
      });
      chatIdFromUrlRef.current = replacementChatId;
      setSelectedChatId(replacementChatId);
    }

    setChats((current) => {
      let next = current.filter((chat) => chat.id !== changedChatId);

      if (payload.eventType !== 'DELETE' && incomingChat && !incomingChat.deleted_at && !incomingChat.merged_into_chat_id) {
        const existingChat = current.find((chat) => chat.id === incomingChat.id) ?? null;
        const canonicalSavedContactName = getSavedContactNameForPhone(
          incomingChat.phone_digits || incomingChat.phone_number,
          savedContactNameOverrideByPhoneRef.current,
          savedContactNameByPhoneRef.current,
        );
        const hydratedChat = applyPendingChatInboxState(
          applyFrontendSavedContactNames(applyPrefetchedLeadNames([preserveUsefulChatPreview(
            stabilizeChatIdentityForLocalMerge(incomingChat, existingChat, canonicalSavedContactName),
            existingChat,
          )])),
          pendingChatInboxStateRef.current,
        )[0];
        const shouldKeepSelectedChat = selectedChatIdRef.current === hydratedChat.id;

        if (chatMatchesActiveFilters(hydratedChat) || shouldKeepSelectedChat) {
          next = [...next, hydratedChat];
        }
      }

      next = sortChatsByInboxOrder(next);
      const nextSignature = buildChatsSignature(next);
      if (nextSignature === chatsSignatureRef.current) {
        return current;
      }

      chatsSignatureRef.current = nextSignature;
      return next;
    });
  }, [
    applyFrontendSavedContactNames,
    applyPrefetchedLeadNames,
    buildChatsSignature,
    chatMatchesActiveFilters,
    chatIdFromUrlRef,
    chatPollBackoffRef,
    chatPollIdleCyclesRef,
    chatsSignatureRef,
    latestChatsRef,
    loadChatsRef,
    pendingChatInboxStateRef,
    savedContactNameByPhoneRef,
    savedContactNameOverrideByPhoneRef,
    archivedSectionOpenRef,
    selectedChatIdRef,
    setChats,
    setSelectedChatId,
  ]);

  const applyRealtimePresenceChange = useCallback((payload: RealtimePostgresChangesPayload<CommWhatsAppPresence>) => {
    const incomingPresence = payload.new as Partial<CommWhatsAppPresence> | null;
    const previousPresence = payload.old as Partial<CommWhatsAppPresence> | null;
    const targetChatId = incomingPresence?.chat_id ?? previousPresence?.chat_id ?? null;
    if (!targetChatId) return;

    setChats((current) => {
      const next = applyChatPresenceUpdate(current, {
        chatId: targetChatId,
        status: payload.eventType === 'DELETE' ? null : incomingPresence?.status ?? null,
        lastSeenAt: payload.eventType === 'DELETE' ? null : incomingPresence?.last_seen_at ?? null,
        updatedAt: payload.eventType === 'DELETE' ? null : incomingPresence?.observed_at ?? null,
      });

      if (next !== current) {
        chatsSignatureRef.current = buildChatsSignature(next);
      }

      return next;
    });
  }, [buildChatsSignature, chatsSignatureRef, setChats]);

  const applyRealtimeMessageChange = useCallback((payload: RealtimePostgresChangesPayload<CommWhatsAppMessage>) => {
    const incomingMessage = payload.new as CommWhatsAppMessage | null;
    const previousMessage = payload.old as Partial<CommWhatsAppMessage> | null;
    const targetChatId = incomingMessage?.chat_id ?? previousMessage?.chat_id ?? null;
    const orderedIncomingMessage = incomingMessage ? applyOutgoingOrderToServerMessage(incomingMessage) : null;

    if (!targetChatId || selectedChatIdRef.current !== targetChatId) {
      return;
    }

    setMessages((current) => {
      const nextMessages = payload.eventType === 'DELETE'
        ? current.filter((message) => message.id !== previousMessage?.id)
        : orderedIncomingMessage
          ? mergeMessages(current, [orderedIncomingMessage])
          : current;
      const nextSignature = buildMessagesSignature(nextMessages);

      if (nextSignature === messagesSignatureRef.current) {
        return current;
      }

      messagesSignatureRef.current = nextSignature;

      if (payload.eventType === 'INSERT') {
        if (isNearBottomRef.current) {
          pendingScrollModeRef.current = 'bottom';
          pendingScrollTopRef.current = null;
          pendingScrollHeightRef.current = null;
        } else {
          pendingScrollModeRef.current = 'preserve';
          pendingScrollTopRef.current = messagesContainerRef.current?.scrollTop ?? 0;
          pendingScrollHeightRef.current = null;
        }
      } else if (payload.eventType === 'UPDATE' && isNearBottomRef.current) {
        pendingScrollModeRef.current = 'bottom';
        pendingScrollTopRef.current = null;
        pendingScrollHeightRef.current = null;
      } else {
        pendingScrollModeRef.current = null;
      }

      return nextMessages;
    });

    if (orderedIncomingMessage) {
      reconcileLocalOutgoingMessages(targetChatId, [orderedIncomingMessage]);
    }
  }, [
    applyOutgoingOrderToServerMessage,
    buildMessagesSignature,
    isNearBottomRef,
    messagesContainerRef,
    messagesSignatureRef,
    pendingScrollHeightRef,
    pendingScrollModeRef,
    pendingScrollTopRef,
    reconcileLocalOutgoingMessages,
    selectedChatIdRef,
    setMessages,
  ]);

  return { applyRealtimeChatChange, applyRealtimePresenceChange, applyRealtimeMessageChange };
};
