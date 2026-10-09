import { useCallback, type Dispatch, type SetStateAction } from 'react';

import type { CommWhatsAppChat } from '../domain/types';

type CurrentValue<Value> = { current: Value };

type InboxChatSelectionControllerOptions = {
  search: string;
  refs: {
    latestChatsRef: CurrentValue<CommWhatsAppChat[]>;
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
    // In-flight refreshes must observe this click before React's effects run.
    refs.selectedChatIdRef.current = chat.id;
    refs.chatIdFromUrlRef.current = chat.id;
    refs.suppressAutoChatSelectionRef.current = false;
    setChatMenuPointerAnchor(null);
    setOpenChatMenuChatId(null);
    if (search) {
      if (!refs.latestChatsRef.current.some((cached) => cached.id === chat.id)) {
        refs.latestChatsRef.current = [...refs.latestChatsRef.current, chat];
      }
      upsertChatLocally(chat);
    }
    setSelectedChatId(chat.id);
  }, [refs, search, setChatMenuPointerAnchor, setOpenChatMenuChatId, setSelectedChatId, upsertChatLocally]);

  const handleBackToChatList = useCallback(() => {
    refs.suppressAutoChatSelectionRef.current = true;
    refs.selectedChatIdRef.current = null;
    refs.chatIdFromUrlRef.current = null;
    setSelectedChatId(null);
  }, [refs, setSelectedChatId]);

  return { handleSelectSidebarChat, handleBackToChatList };
};
