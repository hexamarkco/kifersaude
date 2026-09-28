import { useCallback, useEffect, useRef, useState } from 'react';

import { whatsappConversationsRepository } from '../data';
import { isSupabaseConnectivityError } from '../../../../infrastructure/supabase';
import { KeyedActionLock } from '../components/keyedActionLock';

export const useInboxArchivedChatCount = () => {
  const [archivedChatsCount, setArchivedChatsCount] = useState<number | null>(null);
  const requestIdRef = useRef(0);
  const loadLockRef = useRef(new KeyedActionLock());

  useEffect(() => () => {
    requestIdRef.current += 1;
  }, []);

  const refreshArchivedChatsCount = useCallback(async () => {
    if (!loadLockRef.current.tryAcquire('archived-count')) {
      return;
    }

    const requestId = ++requestIdRef.current;

    try {
      const count = await whatsappConversationsRepository.getArchivedCount();
      if (requestId !== requestIdRef.current) {
        return;
      }
      setArchivedChatsCount(count);
    } catch (error) {
      if (requestId !== requestIdRef.current) {
        return;
      }
      if (!isSupabaseConnectivityError(error)) {
        console.warn('[WhatsAppInbox] erro ao carregar contagem de arquivados', error);
      }
    } finally {
      loadLockRef.current.release('archived-count');
    }
  }, []);

  return { archivedChatsCount, refreshArchivedChatsCount };
};
