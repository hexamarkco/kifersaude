import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from 'react';

import { whatsappConversationsRepository, type CommWhatsAppOperationalState } from '../data';
import { KeyedActionLock } from '../components/keyedActionLock';

type InboxOperationalStateOptions = {
  setOperationalState: Dispatch<SetStateAction<CommWhatsAppOperationalState | null>>;
  setOperationalStateError: Dispatch<SetStateAction<string | null>>;
  setOperationalStateLoaded: Dispatch<SetStateAction<boolean>>;
};

export const useInboxOperationalState = ({
  setOperationalState,
  setOperationalStateError,
  setOperationalStateLoaded,
}: InboxOperationalStateOptions) => {
  const requestIdRef = useRef(0);
  const loadLockRef = useRef(new KeyedActionLock());

  useEffect(() => () => {
    requestIdRef.current += 1;
  }, []);

  const loadOperationalState = useCallback(async () => {
    if (!loadLockRef.current.tryAcquire('operational-state')) {
      return;
    }

    const requestId = ++requestIdRef.current;

    try {
      const state = await whatsappConversationsRepository.getOperationalState();
      if (requestId !== requestIdRef.current) {
        return;
      }

      setOperationalState((current) => state ?? current);
      setOperationalStateError(null);
      setOperationalStateLoaded(true);
    } catch (error) {
      if (requestId !== requestIdRef.current) {
        return;
      }

      console.error('[WhatsAppInbox] erro ao carregar estado operacional', error);
      setOperationalStateError(
        error instanceof Error ? error.message : 'Não foi possível carregar o estado operacional do WhatsApp.',
      );
      setOperationalStateLoaded(true);
    } finally {
      loadLockRef.current.release('operational-state');
    }
  }, [setOperationalState, setOperationalStateError, setOperationalStateLoaded]);

  return { loadOperationalState };
};
