import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from 'react';

import { isSupabaseConnectivityError } from '../../../../infrastructure/supabase';
import { toast } from '../../../../lib/toast';
import { getSavedContactNameForPhone } from '../domain/contactLookup';
import { sortChatsByInboxOrder, preserveUsefulChatPreview, stabilizeChatIdentityForLocalMerge } from '../domain/chatPresentation';
import type { ChatActivityFilter } from '../domain/chatFilters';
import type { CommWhatsAppChat } from '../domain/types';
import { applyPendingChatInboxState, type PendingChatInboxStatePatch } from '../pendingChatInboxState';
import { whatsappConversationsRepository } from '../data/conversationsRepository';
import { KeyedActionLock } from '../components/keyedActionLock';
import type { InboxChatLoadOptions } from './inboxChatLoaderTypes';

type CurrentValue<Value> = { current: Value };

type InboxArchivedChatSectionsOptions = {
  filters: {
    activityFilter: ChatActivityFilter;
    leadStatusFilters: string[];
    leadResponsavelFilters: string[];
    matchesActiveFilters: (chat: CommWhatsAppChat) => boolean;
  };
  pagination: {
    pageSize: number;
    loading: boolean;
    loadingMore: boolean;
    hasMore: boolean;
    page: number;
  };
  refs: {
    chatsRequestIdRef: CurrentValue<number>;
    chatsSignatureRef: CurrentValue<string>;
    chatIdFromUrlRef: CurrentValue<string | null>;
    latestChatsRef: CurrentValue<CommWhatsAppChat[]>;
    pendingChatInboxStateRef: CurrentValue<Map<string, PendingChatInboxStatePatch>>;
    savedContactNameByPhoneRef: CurrentValue<Map<string, string>>;
    savedContactNameOverrideByPhoneRef: CurrentValue<Map<string, string>>;
    selectedChatIdRef: CurrentValue<string | null>;
  };
  state: {
    setArchivedChatsLoading: Dispatch<SetStateAction<boolean>>;
    setArchivedChatsLoadingMore: Dispatch<SetStateAction<boolean>>;
    setArchivedChatsHasMore: Dispatch<SetStateAction<boolean>>;
    setArchivedChatsPage: Dispatch<SetStateAction<number>>;
    setArchivedSectionOpen: Dispatch<SetStateAction<boolean>>;
    setChats: Dispatch<SetStateAction<CommWhatsAppChat[]>>;
    setSelectedChatId: Dispatch<SetStateAction<string | null>>;
  };
  chatCollection: {
    applyFrontendSavedContactNames: (chats: CommWhatsAppChat[]) => CommWhatsAppChat[];
    applyPrefetchedLeadNames: (chats: CommWhatsAppChat[]) => CommWhatsAppChat[];
    buildChatsSignature: (chats: CommWhatsAppChat[]) => string;
  };
  loadChats: (options?: InboxChatLoadOptions) => Promise<void>;
  refreshArchivedChatsCount: () => Promise<unknown>;
};

export const useInboxArchivedChatSections = ({
  filters,
  pagination,
  refs,
  state,
  chatCollection,
  loadChats,
  refreshArchivedChatsCount,
}: InboxArchivedChatSectionsOptions) => {
  const { activityFilter, leadStatusFilters, leadResponsavelFilters, matchesActiveFilters } = filters;
  const { pageSize, loading, loadingMore, hasMore, page: archivedPage } = pagination;
  const {
    chatsRequestIdRef,
    chatsSignatureRef,
    chatIdFromUrlRef,
    latestChatsRef,
    pendingChatInboxStateRef,
    savedContactNameByPhoneRef,
    savedContactNameOverrideByPhoneRef,
    selectedChatIdRef,
  } = refs;
  const {
    setArchivedChatsLoading,
    setArchivedChatsLoadingMore,
    setArchivedChatsHasMore,
    setArchivedChatsPage,
    setArchivedSectionOpen,
    setChats,
    setSelectedChatId,
  } = state;
  const {
    applyFrontendSavedContactNames,
    applyPrefetchedLeadNames,
    buildChatsSignature,
  } = chatCollection;
  const archivedChatsLoadMoreLockRef = useRef(new KeyedActionLock());
  const archivedSectionLoadRequestIdRef = useRef(0);

  useEffect(() => () => {
    archivedSectionLoadRequestIdRef.current += 1;
  }, []);

  const handleLoadMoreArchivedChats = useCallback(async () => {
    if (loading || loadingMore || !hasMore) {
      return;
    }
    if (!archivedChatsLoadMoreLockRef.current.tryAcquire('archived')) {
      return;
    }

    setArchivedChatsLoadingMore(true);
    const nextPageIndex = archivedPage;
    const chatsRequestId = chatsRequestIdRef.current;

    try {
      const page = await whatsappConversationsRepository.list({
        activityFilter,
        leadStatusFilters,
        leadResponsavelFilters,
        archivedFilter: 'archived',
        limit: pageSize,
        offset: nextPageIndex * pageSize,
      });

      if (chatsRequestId !== chatsRequestIdRef.current) {
        return;
      }

      setArchivedChatsHasMore(page.length >= pageSize);
      setArchivedChatsPage(nextPageIndex + 1);

      setChats((current) => {
        const previousChatsById = new Map(current.map((chat) => [chat.id, chat] as const));
        const transformed = applyPendingChatInboxState(
          applyFrontendSavedContactNames(
            applyPrefetchedLeadNames(page.map((chat) => {
              const previousChat = previousChatsById.get(chat.id) ?? null;
              const canonicalSavedContactName = getSavedContactNameForPhone(
                chat.phone_digits || chat.phone_number,
                savedContactNameOverrideByPhoneRef.current,
                savedContactNameByPhoneRef.current,
              );
              return preserveUsefulChatPreview(
                stabilizeChatIdentityForLocalMerge(chat, previousChat, canonicalSavedContactName),
                previousChat,
              );
            })),
          ),
          pendingChatInboxStateRef.current,
        );

        const nextById = new Map<string, CommWhatsAppChat>();
        for (const chat of current) {
          nextById.set(chat.id, chat);
        }
        for (const chat of transformed) {
          nextById.set(chat.id, chat);
        }

        const sorted = sortChatsByInboxOrder(Array.from(nextById.values()));
        chatsSignatureRef.current = buildChatsSignature(sorted);
        return sorted;
      });
    } catch (error) {
      if (chatsRequestId !== chatsRequestIdRef.current) {
        return;
      }

      console.error('[WhatsAppInbox] erro ao carregar mais arquivados', error);
      if (!isSupabaseConnectivityError(error)) {
        toast.error(error instanceof Error ? error.message : 'Não foi possível carregar mais conversas arquivadas.');
      }
    } finally {
      archivedChatsLoadMoreLockRef.current.release('archived');
      if (chatsRequestId === chatsRequestIdRef.current) {
        setArchivedChatsLoadingMore(false);
      }
    }
  }, [
    activityFilter,
    archivedPage,
    applyFrontendSavedContactNames,
    applyPrefetchedLeadNames,
    buildChatsSignature,
    chatsRequestIdRef,
    chatsSignatureRef,
    hasMore,
    leadResponsavelFilters,
    leadStatusFilters,
    loading,
    loadingMore,
    pageSize,
    pendingChatInboxStateRef,
    savedContactNameByPhoneRef,
    savedContactNameOverrideByPhoneRef,
    setArchivedChatsHasMore,
    setArchivedChatsLoadingMore,
    setArchivedChatsPage,
    setChats,
  ]);

  const handleSwitchArchivedSection = useCallback((nextArchivedSectionOpen: boolean) => {
    setArchivedSectionOpen(nextArchivedSectionOpen);

    const currentSelectedChat = selectedChatIdRef.current
      ? latestChatsRef.current.find((chat) => chat.id === selectedChatIdRef.current) ?? null
      : null;

    if (currentSelectedChat && Boolean(currentSelectedChat.is_archived) !== nextArchivedSectionOpen) {
      const nextChat = sortChatsByInboxOrder(latestChatsRef.current.filter((candidate) => (
        candidate.id !== currentSelectedChat.id
        && Boolean(candidate.is_archived) === nextArchivedSectionOpen
        && matchesActiveFilters(candidate)
      )))[0] ?? null;
      chatIdFromUrlRef.current = nextChat?.id ?? null;
      setSelectedChatId(nextChat?.id ?? null);
    }

    if (nextArchivedSectionOpen) {
      const loadRequestId = ++archivedSectionLoadRequestIdRef.current;
      setArchivedChatsLoading(true);
      setArchivedChatsLoadingMore(false);
      void loadChats({ sections: ['archived', 'active'], partialArchived: true, preferredSection: 'archived' })
        .catch(() => undefined)
        .finally(() => {
          if (loadRequestId === archivedSectionLoadRequestIdRef.current) {
            setArchivedChatsLoading(false);
          }
        });
      void refreshArchivedChatsCount();
    } else {
      archivedSectionLoadRequestIdRef.current += 1;
      setArchivedChatsLoading(false);
      void loadChats({ sections: ['active'], preferredSection: 'active' });
    }
  }, [
    chatIdFromUrlRef,
    latestChatsRef,
    loadChats,
    matchesActiveFilters,
    refreshArchivedChatsCount,
    selectedChatIdRef,
    setArchivedChatsLoading,
    setArchivedChatsLoadingMore,
    setArchivedSectionOpen,
    setSelectedChatId,
  ]);

  return { handleLoadMoreArchivedChats, handleSwitchArchivedSection };
};
