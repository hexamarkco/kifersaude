import { useCallback, type Dispatch, type SetStateAction } from 'react';

import type { CommWhatsAppChat } from '../domain/types';

type CurrentValue<Value> = { current: Value };

type InboxChatSelectionControllerOptions = {
  search: string;
  refs: {
    selectedChatIdRef: CurrentValue<string | null>;
    chatIdFromUrlRef: CurrentValue<string | null>;
    suppressAutoChatSelectionRef: CurrentValue<boolean>;
  };
  setChatMenuPointerAnchor: Dispatch<SetStateAction<{ x: number; y: number } | null>>;
  setOpenChatMenuChatId: Dispatch<SetStateAction<string | null>>;
  setSelectedChatId: Dispatch<SetStateAction<string | null>>;
  upsertChatLocally: (chat: CommWhatsAppChat) => void;
};

export const useInboxChatSelectionController = ({
  search,
  refs,
  setChatMenuPointerAnchor,
  setOpenChatMenuChatId,
  setSelectedChatId,
  upsertChatLocally,
}: InboxChatSelectionControllerOptions) => {
  const handleSelectSidebarChat = useCallback((chat: CommWhatsAppChat) => {
    setChatMenuPointerAnchor(null);
    setOpenChatMenuChatId(null);
    if (search) {
      upsertChatLocally(chat);
    }
    setSelectedChatId(chat.id);
  }, [search, setChatMenuPointerAnchor, setOpenChatMenuChatId, setSelectedChatId, upsertChatLocally]);

  const handleBackToChatList = useCallback(() => {
    refs.suppressAutoChatSelectionRef.current = true;
    refs.selectedChatIdRef.current = null;
    refs.chatIdFromUrlRef.current = null;
    setSelectedChatId(null);
  }, [refs, setSelectedChatId]);

  return { handleSelectSidebarChat, handleBackToChatList };
};
