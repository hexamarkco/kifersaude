import { useCallback, useEffect, useRef, useState } from 'react';

import {
  commWhatsAppService,
  type CommWhatsAppMessageSearchResult,
} from '../../../../lib/commWhatsAppService';
import type { CommWhatsAppChat } from '../../../../lib/supabase';
import {
  applyPendingChatInboxState,
  type PendingChatInboxStatePatch,
} from '../pendingChatInboxState';

type ChatActivityFilter = 'all' | 'unread';

type UseChatSearchParams = {
  activityFilter: ChatActivityFilter;
  leadStatusFilters: string[];
  pendingChatInboxStateRef: { current: Map<string, PendingChatInboxStatePatch> };
  sortChats: (chats: CommWhatsAppChat[]) => CommWhatsAppChat[];
};

export const useChatSearch = ({
  activityFilter,
  leadStatusFilters,
  pendingChatInboxStateRef,
  sortChats,
}: UseChatSearchParams) => {
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearchState] = useState('');
  const [chatSearchResults, setChatSearchResults] = useState<CommWhatsAppChat[]>([]);
  const [messageSearchResults, setMessageSearchResults] = useState<CommWhatsAppMessageSearchResult[]>([]);
  const [searchingChats, setSearchingChats] = useState(false);
  const [searchingMessages, setSearchingMessages] = useState(false);

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
    setSearchingChats(true);

    void commWhatsAppService.listChats({
      search,
      activityFilter,
      leadStatusFilters,
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
    }).finally(() => {
      if (requestId === chatSearchRequestIdRef.current) {
        setSearchingChats(false);
      }
    });
  }, [activityFilter, leadStatusFilters, pendingChatInboxStateRef, search, setSearch, sortChats]);

  useEffect(() => {
    if (!search) {
      setSearch('');
      return;
    }

    const requestId = ++messageSearchRequestIdRef.current;
    setSearchingMessages(true);

    void commWhatsAppService.searchMessages({
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
    }).finally(() => {
      if (requestId === messageSearchRequestIdRef.current) {
        setSearchingMessages(false);
      }
    });
  }, [search, setSearch]);

  return {
    searchDraft,
    search,
    chatSearchResults,
    messageSearchResults,
    searchingChats,
    searchingMessages,
    setSearchDraft,
    setSearch,
  };
};
