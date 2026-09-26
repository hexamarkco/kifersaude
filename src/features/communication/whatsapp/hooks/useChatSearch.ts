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

type ChatActivityFilter = 'all' | 'unread';

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
      if (requestId === chatSearchRequestIdRef.current) {
        setSearchingChats(false);
      }
    });
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
    if (!search) {
      setSearch('');
      return;
    }

    const requestId = ++messageSearchRequestIdRef.current;
    setMessageSearchResults([]);
    setMessageSearchError(null);
    setSearchingMessages(true);

    void whatsappMessagesRepository.search({
      search,
      archivedFilter: 'all',
      limit: 30,
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
      if (requestId === messageSearchRequestIdRef.current) {
        setSearchingMessages(false);
      }
    });
  }, [search, searchRetryNonce, setSearch]);

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
