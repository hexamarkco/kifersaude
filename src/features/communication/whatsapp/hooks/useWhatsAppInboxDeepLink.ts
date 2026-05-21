import { useEffect, useRef, type MutableRefObject } from 'react';
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
  const selectedChatIdRef = useRef(selectedChatId);
  const lastProcessedUrlChatIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    selectedChatIdRef.current = selectedChatId;
  }, [selectedChatId]);

  useEffect(() => {
    chatIdFromUrlRef.current = searchParams.get('chatId');
  }, [chatIdFromUrlRef, searchParams]);

  useEffect(() => {
    const requestedChatId = searchParams.get('chatId');
    chatIdFromUrlRef.current = requestedChatId;

    if (lastProcessedUrlChatIdRef.current === requestedChatId) {
      return;
    }

    lastProcessedUrlChatIdRef.current = requestedChatId;

    if (!requestedChatId || selectedChatIdRef.current === requestedChatId) {
      return;
    }

    const targetChat = latestChatsRef.current.find((chat) => chat.id === requestedChatId) ?? null;
    if (targetChat) {
      setArchivedSectionOpen(Boolean(targetChat.is_archived));
      setSelectedChatId(targetChat.id);
      return;
    }

    void loadChats({ sections: ['active', 'archived'] });
  }, [chatIdFromUrlRef, latestChatsRef, loadChats, searchParams, setArchivedSectionOpen, setSelectedChatId]);

  useEffect(() => {
    const currentUrlChatId = searchParams.get('chatId');

    if (selectedChatId) {
      chatIdFromUrlRef.current = selectedChatId;

      if (currentUrlChatId === selectedChatId) {
        return;
      }

      const nextParams = new URLSearchParams(searchParams);
      nextParams.set('chatId', selectedChatId);
      setSearchParams(nextParams, { replace: true });
      return;
    }

    if (!currentUrlChatId) {
      chatIdFromUrlRef.current = null;
      return;
    }

    chatIdFromUrlRef.current = null;

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('chatId');
    setSearchParams(nextParams, { replace: true });
  }, [chatIdFromUrlRef, searchParams, selectedChatId, setSearchParams]);
};
