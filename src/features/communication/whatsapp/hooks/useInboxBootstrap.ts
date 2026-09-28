import { useEffect, type Dispatch, type SetStateAction } from 'react';

type InboxBootstrapOptions = {
  loadChats: () => Promise<unknown> | void;
  loadOperationalState: () => Promise<unknown> | void;
  refreshArchivedChatsCount: () => Promise<unknown> | void;
  setLoading: Dispatch<SetStateAction<boolean>>;
};

export const useInboxBootstrap = ({
  loadChats,
  loadOperationalState,
  refreshArchivedChatsCount,
  setLoading,
}: InboxBootstrapOptions) => {
  useEffect(() => {
    let active = true;

    const bootstrap = async () => {
      setLoading(true);
      // Load the visible section too: with Archived open, an active-only fetch
      // would leave the previous filtered list visible until the next switch.
      await Promise.all([loadChats(), loadOperationalState(), refreshArchivedChatsCount()]);
      if (active) {
        setLoading(false);
      }
    };

    void bootstrap();

    return () => {
      active = false;
    };
  }, [loadChats, loadOperationalState, refreshArchivedChatsCount, setLoading]);
};
