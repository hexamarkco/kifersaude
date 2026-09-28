import { useCallback, useEffect, useRef, useState } from 'react';

import { whatsappContactsRepository } from '../data';
import type { CommWhatsAppLeadSearchResult } from '../data';
import type { CommWhatsAppChat } from '../domain/types';

type SearchableChat = Pick<CommWhatsAppChat, 'lead_id' | 'phone_number'>;

export const useInboxLeadSearch = ({
  isOpen,
  query,
  selectedChat,
}: {
  isOpen: boolean;
  query: string;
  selectedChat: SearchableChat | null;
}) => {
  const [results, setResults] = useState<CommWhatsAppLeadSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const searchLeads = useCallback(async (searchQuery: string, phoneNumber?: string | null) => {
    const requestId = ++requestIdRef.current;
    const normalizedQuery = searchQuery.trim();
    const normalizedPhone = phoneNumber?.trim() || null;

    setLoading(true);
    setError(null);
    try {
      const nextResults = await whatsappContactsRepository.searchLeads({
        query: normalizedQuery,
        phoneNumbers: normalizedPhone ? [normalizedPhone] : undefined,
        limit: 20,
      });

      if (requestId !== requestIdRef.current) return;
      setResults(nextResults);
    } catch (searchError) {
      if (requestId !== requestIdRef.current) return;

      console.error('[WhatsAppInbox] erro ao buscar leads para o drawer', searchError);
      setResults([]);
      setError(searchError instanceof Error ? searchError.message : 'Não foi possível buscar leads agora.');
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen || !selectedChat || selectedChat.lead_id) {
      requestIdRef.current += 1;
      setLoading(false);
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      void searchLeads(query, selectedChat.phone_number);
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
      requestIdRef.current += 1;
    };
  }, [isOpen, query, searchLeads, selectedChat]);

  return { results, loading, error, refreshDrawerSearch: searchLeads };
};
