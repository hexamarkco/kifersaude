import { useCallback, useEffect, useRef, useState } from 'react';

import {
  whatsappConversationsRepository,
  whatsappMessagesRepository,
  type CommWhatsAppMessageSearchResult,
} from '../data';
import type { CommWhatsAppChat } from '../domain/types';
import {
  applyPendingChatInboxState,
  type PendingChatInboxStatePatch,
} from '../pendingChatInboxState';
import { canSearchWhatsAppMessages } from '../domain/messageSearch';
import { normalizeInboxSearchText } from '../domain/messagePresentation';

type ChatActivityFilter = 'all' | 'unread';
const SEARCH_TIMEOUT_MS = 10_000;

type UseChatSearchParams = {
  activityFilter: ChatActivityFilter;
  leadStatusFilters: string[];
  leadResponsavelFilters: string[];
  pendingChatInboxStateRef: { current: Map<string, PendingChatInboxStatePatch> };
  sortChats: (chats: CommWhatsAppChat[]) => CommWhatsAppChat[];
};

export const useChatSearch = ({
  activityFilter,
  leadStatusFilters,
  leadResponsavelFilters,
  pendingChatInboxStateRef,
  sortChats,
}: UseChatSearchParams) => {
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearchState] = useState('');
  const [chatSearchResults, setChatSearchResults] = useState<CommWhatsAppChat[]>([]);
  const [messageSearchResults, setMessageSearchResults] = useState<CommWhatsAppMessageSearchResult[]>([]);
  const [searchingChats, setSearchingChats] = useState(false);
  const [searchingMessages, setSearchingMessages] = useState(false);
  const [chatSearchError, setChatSearchError] = useState<string | null>(null);
  const [messageSearchError, setMessageSearchError] = useState<string | null>(null);
  const [searchRetryNonce, setSearchRetryNonce] = useState(0);

  const chatSearchRequestIdRef = useRef(0);
  const messageSearchRequestIdRef = useRef(0);

  const setSearch = useCallback((nextSearch: string) => {
    nextSearch = normalizeInboxSearchText(nextSearch);
    if (!nextSearch) {
      chatSearchRequestIdRef.current += 1;
      messageSearchRequestIdRef.current += 1;
      setChatSearchResults([]);
      setMessageSearchResults([]);
      setSearchingChats(false);
      setSearchingMessages(false);
      setChatSearchError(null);
      setMessageSearchError(null);
    }

    setSearchState(nextSearch);
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setSearch(searchDraft.trim());
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [searchDraft, setSearch]);

  useEffect(() => {
    if (!search) {
      setSearch('');
      return;
    }

    const requestId = ++chatSearchRequestIdRef.current;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      chatSearchRequestIdRef.current += 1;
      controller.abort();
      setSearchingChats(false);
      setChatSearchError('A busca de conversas demorou demais. Tente novamente.');
    }, SEARCH_TIMEOUT_MS);
    setChatSearchResults([]);
    setChatSearchError(null);
    setSearchingChats(true);

    void whatsappConversationsRepository.list({
      search,
      activityFilter,
      leadStatusFilters,
      leadResponsavelFilters,
      archivedFilter: 'all',
      limit: 500,
      signal: controller.signal,
    }).then((results) => {
      if (requestId !== chatSearchRequestIdRef.current) {
        return;
      }

      const hydratedResults = sortChats(applyPendingChatInboxState(results, pendingChatInboxStateRef.current));
      setChatSearchResults(hydratedResults);
    }).catch((error) => {
      if (requestId !== chatSearchRequestIdRef.current) {
        return;
      }

      console.error('[WhatsAppInbox] erro ao buscar conversas', error);
      setChatSearchResults([]);
      setChatSearchError('Não foi possível buscar as conversas agora. Tente novamente.');
    }).finally(() => {
      window.clearTimeout(timeoutId);
      if (requestId === chatSearchRequestIdRef.current) {
        setSearchingChats(false);
      }
    });

    return () => {
      chatSearchRequestIdRef.current += 1;
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [
    activityFilter,
    leadStatusFilters,
    leadResponsavelFilters,
    pendingChatInboxStateRef,
    search,
    searchRetryNonce,
    setSearch,
    sortChats,
  ]);

  useEffect(() => {
    if (!canSearchWhatsAppMessages(search)) {
      messageSearchRequestIdRef.current += 1;
      setMessageSearchResults([]);
      setSearchingMessages(false);
      setMessageSearchError(null);
      return;
    }

    const requestId = ++messageSearchRequestIdRef.current;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      messageSearchRequestIdRef.current += 1;
      controller.abort();
      setSearchingMessages(false);
      setMessageSearchError('A busca de mensagens demorou demais. Tente novamente.');
    }, SEARCH_TIMEOUT_MS);
    setMessageSearchResults([]);
    setMessageSearchError(null);
    setSearchingMessages(true);

    void whatsappMessagesRepository.search({
      search,
      archivedFilter: 'all',
      limit: 30,
      signal: controller.signal,
    }).then((results) => {
      if (requestId !== messageSearchRequestIdRef.current) {
        return;
      }

      const seen = new Set<string>();
      setMessageSearchResults(results.filter((result) => {
        if (seen.has(result.message.id)) {
          return false;
        }

        seen.add(result.message.id);
        return true;
      }));
    }).catch((error) => {
      if (requestId !== messageSearchRequestIdRef.current) {
        return;
      }

      console.error('[WhatsAppInbox] erro ao buscar mensagens', error);
      setMessageSearchResults([]);
      setMessageSearchError('Não foi possível buscar as mensagens agora. Tente novamente.');
    }).finally(() => {
      window.clearTimeout(timeoutId);
      if (requestId === messageSearchRequestIdRef.current) {
        setSearchingMessages(false);
      }
    });

    return () => {
      messageSearchRequestIdRef.current += 1;
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [search, searchRetryNonce]);

  const retrySearch = useCallback(() => {
    setSearchRetryNonce((current) => current + 1);
  }, []);

  return {
    searchDraft,
    search,
    chatSearchResults,
    messageSearchResults,
    searchingChats,
    searchingMessages,
    chatSearchError,
    messageSearchError,
    setSearchDraft,
    setSearch,
    retrySearch,
  };
};
