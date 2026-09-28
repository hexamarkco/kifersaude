import { useCallback, useEffect, useRef, useState } from 'react';

import { useChatMessageSearch } from './useChatMessageSearch';

type InboxChatMessageSearchOptions = {
  chatId: string | null;
  selectedChatId: string | null;
  selectedChatIdRef: { current: string | null };
};

export const useInboxChatMessageSearch = ({
  chatId,
  selectedChatId,
  selectedChatIdRef,
}: InboxChatMessageSearchOptions) => {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);
  const query = draft.trim();
  const search = useChatMessageSearch({ chatId, enabled: open, query });

  const toggle = useCallback(() => {
    setOpen((current) => {
      const nextOpen = !current;
      if (nextOpen) {
        window.setTimeout(() => inputRef.current?.focus(), 0);
      }
      return nextOpen;
    });
  }, []);

  const close = useCallback(() => {
    setDraft('');
    setOpen(false);
  }, []);

  useEffect(() => {
    setDraft('');
    setOpen(false);
  }, [selectedChatId]);

  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (!selectedChatIdRef.current || (!event.ctrlKey && !event.metaKey) || event.key.toLowerCase() !== 'f') {
        return;
      }

      const target = event.target as HTMLElement | null;
      const editableTarget = target?.closest('input, textarea, [contenteditable="true"]');
      if (editableTarget && editableTarget !== inputRef.current) {
        return;
      }

      event.preventDefault();
      setOpen(true);
      window.setTimeout(() => inputRef.current?.focus(), 0);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedChatIdRef]);

  return {
    open,
    draft,
    query,
    inputRef,
    results: search.results,
    searching: search.searching,
    error: search.error,
    setDraft,
    retry: search.retry,
    toggle,
    close,
  };
};
