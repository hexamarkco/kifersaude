import { useCallback, useMemo, useState } from 'react';

export type ComposerSelection = { start: number; end: number };

const EMPTY_COMPOSER_SELECTION: ComposerSelection = { start: 0, end: 0 };

export const useComposerDraft = (selectedChatId: string | null) => {
  const [composerDraftsByChatId, setComposerDraftsByChatId] = useState<Record<string, string>>({});
  const [composerSelectionsByChatId, setComposerSelectionsByChatId] = useState<Record<string, ComposerSelection>>({});
  const [composerFocused, setComposerFocused] = useState(false);

  const messageDraft = selectedChatId ? composerDraftsByChatId[selectedChatId] ?? '' : '';

  const composerSelection = useMemo(
    () => (selectedChatId
      ? composerSelectionsByChatId[selectedChatId] ?? { start: messageDraft.length, end: messageDraft.length }
      : EMPTY_COMPOSER_SELECTION),
    [composerSelectionsByChatId, messageDraft.length, selectedChatId],
  );

  const setMessageDraft = useCallback((value: string | ((current: string) => string)) => {
    if (!selectedChatId) {
      return;
    }

    setComposerDraftsByChatId((current) => {
      const currentValue = current[selectedChatId] ?? '';
      const nextValue = typeof value === 'function' ? value(currentValue) : value;

      if (!nextValue) {
        if (!(selectedChatId in current)) {
          return current;
        }

        const next = { ...current };
        delete next[selectedChatId];
        return next;
      }

      if (currentValue === nextValue) {
        return current;
      }

      return {
        ...current,
        [selectedChatId]: nextValue,
      };
    });
  }, [selectedChatId]);

  const setComposerSelection = useCallback((value: ComposerSelection | ((current: ComposerSelection) => ComposerSelection)) => {
    if (!selectedChatId) {
      return;
    }

    setComposerSelectionsByChatId((current) => {
      const currentValue = current[selectedChatId] ?? { start: messageDraft.length, end: messageDraft.length };
      const nextValue = typeof value === 'function' ? value(currentValue) : value;

      if (nextValue.start === 0 && nextValue.end === 0 && !(selectedChatId in current)) {
        return current;
      }

      if (nextValue.start === currentValue.start && nextValue.end === currentValue.end) {
        return current;
      }

      return {
        ...current,
        [selectedChatId]: nextValue,
      };
    });
  }, [messageDraft.length, selectedChatId]);

  const resetComposerDraft = useCallback(() => {
    if (selectedChatId) {
      setComposerDraftsByChatId((current) => {
        if (!(selectedChatId in current)) {
          return current;
        }
        const next = { ...current };
        delete next[selectedChatId];
        return next;
      });
      setComposerSelectionsByChatId((current) => {
        if (!(selectedChatId in current)) {
          return current;
        }
        const next = { ...current };
        delete next[selectedChatId];
        return next;
      });
    }
  }, [selectedChatId]);

  const getDraftForChat = useCallback((chatId: string) => composerDraftsByChatId[chatId] ?? '', [composerDraftsByChatId]);

  const textareaProps = useMemo(() => ({
    value: messageDraft,
    onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => setMessageDraft(e.target.value),
    onFocus: () => setComposerFocused(true),
    onBlur: () => setComposerFocused(false),
  }), [messageDraft, setMessageDraft]);

  return {
    messageDraft,
    composerSelection,
    composerFocused,
    setMessageDraft,
    setComposerSelection,
    setComposerFocused,
    resetComposerDraft,
    getDraftForChat,
    textareaProps,
    composerDraftsByChatId,
  };
};
