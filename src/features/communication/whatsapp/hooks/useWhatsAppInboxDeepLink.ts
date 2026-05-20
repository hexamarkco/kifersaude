import { useEffect, type MutableRefObject } from 'react';
import type { SetURLSearchParams } from 'react-router-dom';

import type { CommWhatsAppChat } from '../../../../lib/supabase';

type LoadChats = (options?: { sections?: Array<'active' | 'archived'> }) => Promise<void>;

export const useWhatsAppInboxDeepLink = ({
  searchParams,
  setSearchParams,
  selectedChatId,
  chatIdFromUrlRef,
  latestChatsRef,
  setArchivedSectionOpen,
  setSelectedChatId,
  loadChats,
}: {
  searchParams: URLSearchParams;
  setSearchParams: SetURLSearchParams;
  selectedChatId: string | null;
  chatIdFromUrlRef: MutableRefObject<string | null>;
  latestChatsRef: MutableRefObject<CommWhatsAppChat[]>;
  setArchivedSectionOpen: (value: boolean) => void;
  setSelectedChatId: (value: string | null) => void;
  loadChats: LoadChats;
}) => {
  useEffect(() => {
    chatIdFromUrlRef.current = searchParams.get('chatId');
  }, [chatIdFromUrlRef, searchParams]);

  useEffect(() => {
    const requestedChatId = searchParams.get('chatId');
    chatIdFromUrlRef.current = requestedChatId;

    if (!requestedChatId || selectedChatId === requestedChatId) {
      return;
    }

    const targetChat = latestChatsRef.current.find((chat) => chat.id === requestedChatId) ?? null;
    if (targetChat) {
      setArchivedSectionOpen(Boolean(targetChat.is_archived));
      setSelectedChatId(targetChat.id);
      return;
    }

    void loadChats({ sections: ['active', 'archived'] });
  }, [chatIdFromUrlRef, latestChatsRef, loadChats, searchParams, selectedChatId, setArchivedSectionOpen, setSelectedChatId]);

  useEffect(() => {
    const currentUrlChatId = searchParams.get('chatId');

    if (selectedChatId) {
      if (currentUrlChatId === selectedChatId) {
        return;
      }

      const nextParams = new URLSearchParams(searchParams);
      nextParams.set('chatId', selectedChatId);
      setSearchParams(nextParams, { replace: true });
      return;
    }

    if (!currentUrlChatId) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('chatId');
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, selectedChatId, setSearchParams]);
};
