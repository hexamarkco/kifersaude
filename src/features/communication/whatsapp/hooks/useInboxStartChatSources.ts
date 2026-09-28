import { useCallback, useEffect, useRef, useState } from 'react';

import { toast } from '../../../../lib/toast';
import type { CommWhatsAppLeadSearchResult } from '../data';
import { whatsappContactsRepository } from '../data';
import { mergeSavedContactPages } from '../domain/contactLookup';
import type { CommWhatsAppPhoneContact } from '../domain/types';
import { KeyedActionLock } from '../components/keyedActionLock';

type RefreshStartChatSources = (
  query: string,
  page?: number,
  appendSavedContacts?: boolean,
  forceSavedContactsSync?: boolean,
) => Promise<void>;

export const useInboxStartChatSources = ({ isOpen, query }: { isOpen: boolean; query: string }) => {
  const [savedContacts, setSavedContacts] = useState<CommWhatsAppPhoneContact[]>([]);
  const [savedContactsLoading, setSavedContactsLoading] = useState(false);
  const [savedContactsLoadingMore, setSavedContactsLoadingMore] = useState(false);
  const [savedContactsTotal, setSavedContactsTotal] = useState(0);
  const [savedContactsHasMore, setSavedContactsHasMore] = useState(false);
  const [savedContactsPage, setSavedContactsPage] = useState(1);
  const [crmStartResults, setCrmStartResults] = useState<CommWhatsAppLeadSearchResult[]>([]);
  const [crmStartLoading, setCrmStartLoading] = useState(false);
  const [startChatSourcesError, setStartChatSourcesError] = useState<string | null>(null);
  const latestCrmStartResultsRef = useRef<CommWhatsAppLeadSearchResult[]>([]);
  const requestIdRef = useRef(0);
  const contactsSyncedRef = useRef(false);
  const loadMoreLockRef = useRef(new KeyedActionLock());

  useEffect(() => {
    latestCrmStartResultsRef.current = crmStartResults;
  }, [crmStartResults]);

  useEffect(() => () => {
    requestIdRef.current += 1;
  }, []);

  const refreshStartChatSources = useCallback<RefreshStartChatSources>(async (
    searchQuery,
    page = 1,
    appendSavedContacts = false,
    forceSavedContactsSync = false,
  ) => {
    const requestId = ++requestIdRef.current;
    const normalizedQuery = searchQuery.trim();

    if (appendSavedContacts) {
      setSavedContactsLoadingMore(true);
    } else {
      setSavedContactsLoading(true);
      setCrmStartLoading(true);
    }
    setStartChatSourcesError(null);

    try {
      const contactsPagePromise = whatsappContactsRepository.listSaved({
        query: normalizedQuery,
        page,
        pageSize: 50,
        forceSync: forceSavedContactsSync,
      });
      const leadsPromise = appendSavedContacts
        ? Promise.resolve(latestCrmStartResultsRef.current)
        : whatsappContactsRepository.searchLeads({ query: normalizedQuery, limit: 20 });
      const [contactsPage, leads] = await Promise.all([contactsPagePromise, leadsPromise]);

      if (requestId !== requestIdRef.current) return;

      setSavedContacts((current) => (
        appendSavedContacts
          ? mergeSavedContactPages(current, contactsPage.contacts)
          : contactsPage.contacts
      ));
      setSavedContactsTotal(contactsPage.total);
      setSavedContactsHasMore(contactsPage.hasMore);
      setSavedContactsPage(page);
      setCrmStartResults(leads);
      setStartChatSourcesError(null);
    } catch (error) {
      if (requestId !== requestIdRef.current) return;

      console.error('[WhatsAppInbox] erro ao carregar fontes para novo chat', error);
      const message = error instanceof Error ? error.message : 'Não foi possível carregar os contatos salvos.';
      toast.error(message);
      setStartChatSourcesError(message);
      if (!appendSavedContacts) setCrmStartResults([]);
    } finally {
      if (requestId === requestIdRef.current) {
        if (appendSavedContacts) {
          setSavedContactsLoadingMore(false);
        } else {
          setSavedContactsLoading(false);
          setCrmStartLoading(false);
        }
      }
    }
  }, []);

  useEffect(() => {
    if (!isOpen) {
      contactsSyncedRef.current = false;
      requestIdRef.current += 1;
      setSavedContactsLoading(false);
      setSavedContactsLoadingMore(false);
      setCrmStartLoading(false);
      setStartChatSourcesError(null);
      return undefined;
    }

    const forceSavedContactsSync = !contactsSyncedRef.current;
    contactsSyncedRef.current = true;
    const timeoutId = window.setTimeout(() => {
      void refreshStartChatSources(query, 1, false, forceSavedContactsSync);
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
      requestIdRef.current += 1;
    };
  }, [isOpen, query, refreshStartChatSources]);

  const handleLoadMoreSavedContacts = useCallback(() => {
    if (!savedContactsHasMore || savedContactsLoadingMore || savedContactsLoading) return;
    if (!loadMoreLockRef.current.tryAcquire('saved-contacts')) return;

    void refreshStartChatSources(query, savedContactsPage + 1, true)
      .finally(() => loadMoreLockRef.current.release('saved-contacts'));
  }, [query, refreshStartChatSources, savedContactsHasMore, savedContactsLoading, savedContactsLoadingMore, savedContactsPage]);

  const handleRetryStartChatSources = useCallback(() => {
    void refreshStartChatSources(query, 1, false, false);
  }, [query, refreshStartChatSources]);

  return {
    savedContacts,
    savedContactsLoading,
    savedContactsLoadingMore,
    savedContactsTotal,
    savedContactsHasMore,
    crmStartResults,
    crmStartLoading,
    startChatSourcesError,
    refreshStartChatSources,
    handleLoadMoreSavedContacts,
    handleRetryStartChatSources,
  };
};
