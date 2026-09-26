import { useCallback, useEffect, useRef, useState } from 'react';

import {
  whatsappMessagesRepository,
  type CommWhatsAppMessageSearchResult,
} from '../data';

type UseChatMessageSearchParams = {
  chatId: string | null;
  enabled: boolean;
  query: string;
};

export const useChatMessageSearch = ({ chatId, enabled, query }: UseChatMessageSearchParams) => {
  const [results, setResults] = useState<CommWhatsAppMessageSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const requestIdRef = useRef(0);

  useEffect(() => {
    // Invalida imediatamente uma resposta lenta quando o operador muda o texto.
    const requestId = ++requestIdRef.current;

    if (!enabled || !chatId || !query) {
      setResults([]);
      setSearching(false);
      setError(null);
      return;
    }

    setSearching(true);
    setError(null);

    const timeoutId = window.setTimeout(() => {
      void whatsappMessagesRepository.search({
        search: query,
        chatIds: [chatId],
        archivedFilter: 'all',
        limit: 50,
      }).then((nextResults) => {
        if (requestId !== requestIdRef.current) {
          return;
        }

        const seen = new Set<string>();
        setResults(nextResults.filter((result) => {
          if (seen.has(result.message.id)) {
            return false;
          }

          seen.add(result.message.id);
          return true;
        }));
      }).catch((searchError) => {
        if (requestId !== requestIdRef.current) {
          return;
        }

        console.error('[WhatsAppInbox] erro ao buscar mensagens no chat', searchError);
        setResults([]);
        setError('Não foi possível buscar as mensagens agora. Tente novamente.');
      }).finally(() => {
        if (requestId === requestIdRef.current) {
          setSearching(false);
        }
      });
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [chatId, enabled, query, retryNonce]);

  const retry = useCallback(() => {
    setRetryNonce((current) => current + 1);
  }, []);

  return {
    results,
    searching,
    error,
    retry,
  };
};
