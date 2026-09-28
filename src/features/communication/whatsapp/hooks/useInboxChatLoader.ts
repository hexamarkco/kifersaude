import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from 'react';

import { isSupabaseConnectivityError } from '../../../../infrastructure/supabase';
import { toast } from '../../../../lib/toast';
import { getSavedContactNameForPhone } from '../domain/contactLookup';
import {
  preserveChatsFromPartialLoad,
  selectInitialChatId,
  shouldPreserveSelectedChatAfterLoad,
  type ChatSection,
} from '../domain/chatLoadState';
import { sortChatsByInboxOrder, preserveUsefulChatPreview, stabilizeChatIdentityForLocalMerge } from '../domain/chatPresentation';
import type { ChatActivityFilter } from '../domain/chatFilters';
import type { CommWhatsAppChat } from '../domain/types';
import { applyPendingChatInboxState, type PendingChatInboxStatePatch } from '../pendingChatInboxState';
import { loadInboxChatSection } from '../data/inboxChatLoader';
import { whatsappConversationsRepository } from '../data/conversationsRepository';
import { KeyedActionLock } from '../components/keyedActionLock';

type CurrentValue<T> = { current: T };

export type InboxChatLoadOptions = {
  sections?: ChatSection[];
  partialArchived?: boolean;
  preferredSection?: ChatSection;
};

type InboxChatLoaderOptions = {
  chatActivityFilter: ChatActivityFilter;
  leadStatusFilters: string[];
  leadResponsavelFilters: string[];
  pageSize: number;
  archivedChatsLoading: boolean;
  archivedChatsLoadingMore: boolean;
  archivedChatsHasMore: boolean;
  archivedChatsPage: number;
  refs: {
    archivedSectionOpenRef: CurrentValue<boolean>;
    archivedChatsPageRef: CurrentValue<number>;
    chatsRequestIdRef: CurrentValue<number>;
    chatsLoadPromiseRef: CurrentValue<Promise<void> | null>;
    chatsLoadKeyRef: CurrentValue<string | null>;
    latestChatsRef: CurrentValue<CommWhatsAppChat[]>;
    selectedChatIdRef: CurrentValue<string | null>;
    chatIdFromUrlRef: CurrentValue<string | null>;
    suppressAutoChatSelectionRef: CurrentValue<boolean>;
    pendingChatInboxStateRef: CurrentValue<Map<string, PendingChatInboxStatePatch>>;
    savedContactNameByPhoneRef: CurrentValue<Map<string, string>>;
    savedContactNameOverrideByPhoneRef: CurrentValue<Map<string, string>>;
    chatsSignatureRef: CurrentValue<string>;
    chatPollIdleCyclesRef: CurrentValue<number>;
    chatPollBackoffRef: CurrentValue<number>;
    latestChatsLoadedAtRef: CurrentValue<number>;
  };
  setArchivedChatsLoadingMore: Dispatch<SetStateAction<boolean>>;
  setArchivedChatsLoading: Dispatch<SetStateAction<boolean>>;
  setArchivedChatsHasMore: Dispatch<SetStateAction<boolean>>;
  setArchivedChatsPage: Dispatch<SetStateAction<number>>;
  setChatLoadError: Dispatch<SetStateAction<boolean>>;
  setChatRefreshError: Dispatch<SetStateAction<string | null>>;
  setChats: Dispatch<SetStateAction<CommWhatsAppChat[]>>;
  setArchivedSectionOpen: Dispatch<SetStateAction<boolean>>;
  setSelectedChatId: Dispatch<SetStateAction<string | null>>;
  applyFrontendSavedContactNames: (chats: CommWhatsAppChat[]) => CommWhatsAppChat[];
  applyPrefetchedLeadNames: (chats: CommWhatsAppChat[]) => CommWhatsAppChat[];
  buildChatsSignature: (chats: CommWhatsAppChat[]) => string;
  chatMatchesActiveFilters: (chat: CommWhatsAppChat) => boolean;
  refreshArchivedChatsCount: () => Promise<unknown>;
};

const waitForChatListRetry = (delayMs: number) => new Promise((resolve) => window.setTimeout(resolve, delayMs));

export const useInboxChatLoader = ({
  chatActivityFilter,
  leadStatusFilters,
  leadResponsavelFilters,
  pageSize,
  archivedChatsLoading,
  archivedChatsLoadingMore,
  archivedChatsHasMore,
  archivedChatsPage,
  refs,
  setArchivedChatsLoadingMore,
  setArchivedChatsHasMore,
  setArchivedChatsPage,
  setChatLoadError,
  setChatRefreshError,
  setChats,
  setArchivedSectionOpen,
  setSelectedChatId,
  setArchivedChatsLoading,
  applyFrontendSavedContactNames,
  applyPrefetchedLeadNames,
  buildChatsSignature,
  chatMatchesActiveFilters,
  refreshArchivedChatsCount,
}: InboxChatLoaderOptions) => {
  const {
    archivedSectionOpenRef,
    archivedChatsPageRef,
    chatsRequestIdRef,
    chatsLoadPromiseRef,
    chatsLoadKeyRef,
    latestChatsRef,
    selectedChatIdRef,
    chatIdFromUrlRef,
    suppressAutoChatSelectionRef,
    pendingChatInboxStateRef,
    savedContactNameByPhoneRef,
    savedContactNameOverrideByPhoneRef,
    chatsSignatureRef,
    chatPollIdleCyclesRef,
    chatPollBackoffRef,
    latestChatsLoadedAtRef,
  } = refs;
  const archivedChatsLoadMoreLockRef = useRef(new KeyedActionLock());
  const archivedSectionLoadRequestIdRef = useRef(0);

  useEffect(() => () => {
    archivedSectionLoadRequestIdRef.current += 1;
  }, []);

  const loadChats = useCallback(async (loadOptions: InboxChatLoadOptions = {}) => {
    // Polling refreshes only the visible section; the other section stays cached.
    const requestedSections = loadOptions.sections
      ?? (archivedSectionOpenRef.current ? ['archived'] : ['active']);
    const preferredSection = loadOptions.preferredSection
      ?? (requestedSections.length === 1
        ? requestedSections[0]
        : archivedSectionOpenRef.current ? 'archived' : 'active');
    // Archived lists are paged incrementally unless the caller explicitly asks for all sections.
    const partialArchived = loadOptions.partialArchived ?? !loadOptions.sections;

    const loadKey = JSON.stringify({
      activity: chatActivityFilter,
      statuses: leadStatusFilters.map((status) => status.trim()).filter(Boolean).sort(),
      responsaveis: leadResponsavelFilters.map((id) => id.trim()).filter(Boolean).sort(),
      sections: [...requestedSections].sort(),
      partialArchived,
      preferredSection,
    });

    if (chatsLoadPromiseRef.current && chatsLoadKeyRef.current === loadKey) {
      return chatsLoadPromiseRef.current;
    }

    chatsLoadKeyRef.current = loadKey;
    const requestId = ++chatsRequestIdRef.current;
    setArchivedChatsLoadingMore(false);
    let didApplyChatLoad = false;
    const loadPromise = (async () => {
      try {
        const hasLoadFilters = chatActivityFilter !== 'all'
          || leadStatusFilters.length > 0
          || leadResponsavelFilters.length > 0;
        const fetchedSectionResults = await Promise.allSettled(
          requestedSections.map(async (section) => {
            const result = await loadInboxChatSection({
              section,
              listPage: (params) => whatsappConversationsRepository.list(params),
              activityFilter: chatActivityFilter,
              leadStatusFilters,
              leadResponsavelFilters,
              hasLoadFilters,
              partialArchived,
              archivedPage: archivedChatsPageRef.current,
              pageSize,
              isRequestCurrent: () => requestId === chatsRequestIdRef.current,
              waitBeforeRetry: waitForChatListRetry,
            });

            if (partialArchived && section === 'archived' && requestId === chatsRequestIdRef.current) {
              setArchivedChatsHasMore(result.hasMore);
              setArchivedChatsPage(result.pagesFetched);
            }

            return { section, data: result.chats };
          }),
        );

        if (requestId !== chatsRequestIdRef.current) {
          return;
        }

        const fetchedSections: Array<{ section: ChatSection; data: CommWhatsAppChat[] }> = [];
        const failedSections: ChatSection[] = [];
        let firstSectionError: unknown = null;
        fetchedSectionResults.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            fetchedSections.push(result.value);
            return;
          }

          const failedSection = requestedSections[index];
          if (failedSection) {
            failedSections.push(failedSection);
          }
          firstSectionError ??= result.reason;
        });

        if (fetchedSections.length === 0) {
          throw firstSectionError ?? new Error('Não foi possível carregar as conversas.');
        }

        const fetchedSectionSet = new Set(fetchedSections.map(({ section }) => section));
        const fetchedChatIds = new Set<string>();
        const fetchedFlat: CommWhatsAppChat[] = [];
        for (const bucket of fetchedSections) {
          for (const chat of bucket.data) {
            fetchedFlat.push(chat);
            fetchedChatIds.add(chat.id);
          }
        }

        const previousChats = latestChatsRef.current;
        const previousChatsById = new Map(previousChats.map((chat) => [chat.id, chat] as const));
        const unexpectedlyEmptySections = new Set(
          fetchedSections
            .filter(({ section, data }) => {
              if (data.length > 0 || hasLoadFilters) {
                return false;
              }

              return previousChats.some((chat) => (
                !chat.deleted_at
                && (chat.is_archived ? 'archived' : 'active') === section
              ));
            })
            .map(({ section }) => section),
        );

        if (unexpectedlyEmptySections.size > 0) {
          console.debug('[WhatsAppInbox] refetch de chats retornou secao vazia; preservando lista atual', {
            sections: Array.from(unexpectedlyEmptySections),
            requestedSections,
            previousChatsLen: previousChats.length,
          });
        }

        const preservedFromOtherSections = preserveChatsFromPartialLoad({
          previousChats,
          refreshedChatIds: fetchedChatIds,
          loadedSections: fetchedSectionSet,
          unexpectedlyEmptySections,
        });
        const mergedData = [...fetchedFlat, ...preservedFromOtherSections];
        const refreshedChats = applyPendingChatInboxState(
          applyFrontendSavedContactNames(
            applyPrefetchedLeadNames(mergedData.map((chat) => {
              const previousChat = previousChatsById.get(chat.id) ?? null;
              // Cached contact names can confirm a change; a stale provider name cannot.
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
        const currentSelectedChatId = selectedChatIdRef.current;
        const preservedSelectedChat = currentSelectedChatId
          ? previousChats.find((chat) => chat.id === currentSelectedChatId) ?? null
          : null;
        const shouldPreserveSelectedChat = shouldPreserveSelectedChatAfterLoad({
          selectedChat: preservedSelectedChat,
          refreshedChatIds: new Set(refreshedChats.map((chat) => chat.id)),
          loadedSections: Array.from(fetchedSectionSet),
          unexpectedlyEmptySections,
        });
        const hydratedData = sortChatsByInboxOrder(
          shouldPreserveSelectedChat && preservedSelectedChat
            ? [...refreshedChats, preservedSelectedChat]
            : refreshedChats,
        );

        const nextSignature = buildChatsSignature(hydratedData);
        setChatLoadError(false);
        setChatRefreshError(
          failedSections.length > 0
            ? `Não foi possível atualizar ${failedSections.map((section) => section === 'active' ? 'as conversas ativas' : 'as conversas arquivadas').join(' e ')}. A lista disponível continua visível.`
            : null,
        );

        if (nextSignature !== chatsSignatureRef.current) {
          chatPollIdleCyclesRef.current = 0;
          chatsSignatureRef.current = nextSignature;
          setChats(hydratedData);
        } else {
          chatPollIdleCyclesRef.current += 1;
        }

        const requestedChatId = chatIdFromUrlRef.current;
        const requestedChat = requestedChatId
          ? hydratedData.find((chat) => chat.id === requestedChatId) ?? null
          : null;
        if (requestedChat) {
          setArchivedSectionOpen(Boolean(requestedChat.is_archived));
        }

        setSelectedChatId((current) => {
          if (requestedChat) {
            return requestedChat.id;
          }

          // Returning to the mobile list is explicit; realtime must not reopen a thread.
          if (suppressAutoChatSelectionRef.current) {
            return null;
          }

          const isMobileInboxLayout = typeof window !== 'undefined'
            && window.matchMedia('(max-width: 1023px)').matches;
          if (!current && isMobileInboxLayout && !requestedChatId) {
            return null;
          }

          if (requestedChatId && current === requestedChatId) {
            return current;
          }

          if (current && hydratedData.some((chat) => chat.id === current)) {
            return current;
          }

          return selectInitialChatId(hydratedData, preferredSection);
        });
        chatPollBackoffRef.current = 0;
        didApplyChatLoad = true;
      } catch (error) {
        if (requestId !== chatsRequestIdRef.current) {
          return;
        }

        console.error('[WhatsAppInbox] erro ao carregar chats', error);
        if (latestChatsRef.current.length === 0) {
          setChatLoadError(true);
          setChatRefreshError(null);
        } else {
          setChatRefreshError(
            isSupabaseConnectivityError(error)
              ? 'Não foi possível atualizar as conversas. A lista exibida pode estar desatualizada.'
              : 'A atualização das conversas falhou. A lista exibida pode estar desatualizada.',
          );
        }

        if (isSupabaseConnectivityError(error)) {
          chatPollBackoffRef.current = Math.min(chatPollBackoffRef.current + 1, 10);
          return;
        }

        toast.error(error instanceof Error ? error.message : 'Não foi possível carregar as conversas do WhatsApp.');
      }
    })().finally(() => {
      if (didApplyChatLoad && requestId === chatsRequestIdRef.current) {
        latestChatsLoadedAtRef.current = Date.now();
      }
      if (chatsLoadPromiseRef.current === loadPromise) {
        chatsLoadPromiseRef.current = null;
        chatsLoadKeyRef.current = null;
      }
    });

    chatsLoadPromiseRef.current = loadPromise;
    return loadPromise;
  }, [
    applyFrontendSavedContactNames,
    applyPrefetchedLeadNames,
    archivedChatsPageRef,
    archivedSectionOpenRef,
    buildChatsSignature,
    chatActivityFilter,
    chatIdFromUrlRef,
    chatPollBackoffRef,
    chatPollIdleCyclesRef,
    chatsLoadKeyRef,
    chatsLoadPromiseRef,
    chatsRequestIdRef,
    chatsSignatureRef,
    latestChatsLoadedAtRef,
    latestChatsRef,
    leadResponsavelFilters,
    leadStatusFilters,
    pageSize,
    pendingChatInboxStateRef,
    savedContactNameByPhoneRef,
    savedContactNameOverrideByPhoneRef,
    selectedChatIdRef,
    setArchivedChatsHasMore,
    setArchivedChatsLoadingMore,
    setArchivedChatsPage,
    setArchivedSectionOpen,
    setChatLoadError,
    setChatRefreshError,
    setChats,
    setSelectedChatId,
    suppressAutoChatSelectionRef,
  ]);

  const handleLoadMoreArchivedChats = useCallback(async () => {
    if (archivedChatsLoading || archivedChatsLoadingMore || !archivedChatsHasMore) {
      return;
    }
    if (!archivedChatsLoadMoreLockRef.current.tryAcquire('archived')) {
      return;
    }

    setArchivedChatsLoadingMore(true);
    const nextPageIndex = archivedChatsPage;
    const chatsRequestId = chatsRequestIdRef.current;

    try {
      const page = await whatsappConversationsRepository.list({
        activityFilter: chatActivityFilter,
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
    applyFrontendSavedContactNames,
    applyPrefetchedLeadNames,
    archivedChatsHasMore,
    archivedChatsLoading,
    archivedChatsLoadingMore,
    archivedChatsPage,
    buildChatsSignature,
    chatActivityFilter,
    chatsRequestIdRef,
    chatsSignatureRef,
    leadResponsavelFilters,
    leadStatusFilters,
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
        && chatMatchesActiveFilters(candidate)
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
    chatMatchesActiveFilters,
    chatIdFromUrlRef,
    latestChatsRef,
    loadChats,
    refreshArchivedChatsCount,
    selectedChatIdRef,
    setArchivedChatsLoading,
    setArchivedChatsLoadingMore,
    setArchivedSectionOpen,
    setSelectedChatId,
  ]);

  return { loadChats, handleLoadMoreArchivedChats, handleSwitchArchivedSection };
};
