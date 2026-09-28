import { useCallback, type ChangeEvent, type Dispatch, type SetStateAction } from 'react';

import { getActiveQuickReplyMatch } from '../domain/quickReplies';
import type { WhatsAppTextFormat } from '../components/WhatsAppFormattedText';

type ComposerSelection = { start: number; end: number };
type QuickReplyInsertion = { text: string };

export const useInboxComposerTextActions = ({
  textareaRef,
  messageDraft,
  setMessageDraft,
  composerSelection,
  setComposerSelection,
  setComposerFocused,
  activeQuickReplyMatch,
  setDismissedQuickReplyKey,
  setQuickReplyActiveIndex,
  resizeComposerTextarea,
}: {
  textareaRef: { current: HTMLTextAreaElement | null };
  messageDraft: string;
  setMessageDraft: Dispatch<SetStateAction<string>>;
  composerSelection: ComposerSelection;
  setComposerSelection: Dispatch<SetStateAction<ComposerSelection>>;
  setComposerFocused: Dispatch<SetStateAction<boolean>>;
  activeQuickReplyMatch: ReturnType<typeof getActiveQuickReplyMatch>;
  setDismissedQuickReplyKey: Dispatch<SetStateAction<string | null>>;
  setQuickReplyActiveIndex: Dispatch<SetStateAction<number>>;
  resizeComposerTextarea: (target?: HTMLTextAreaElement | null) => void;
}) => {
  const getCurrentSelection = useCallback((fallback: ComposerSelection) => {
    const textarea = textareaRef.current;
    return textarea
      ? {
          start: textarea.selectionStart ?? fallback.start,
          end: textarea.selectionEnd ?? fallback.end,
        }
      : fallback;
  }, [textareaRef]);

  const restoreCursor = useCallback((cursor: number) => {
    requestAnimationFrame(() => {
      const target = textareaRef.current;
      if (!target) {
        return;
      }

      target.focus();
      target.setSelectionRange(cursor, cursor);
    });
  }, [textareaRef]);

  const syncComposerSelection = useCallback((target: HTMLTextAreaElement | null) => {
    if (!target) {
      return;
    }

    const nextSelection = {
      start: target.selectionStart ?? target.value.length,
      end: target.selectionEnd ?? target.value.length,
    };

    setComposerSelection((current) => {
      if (current.start === nextSelection.start && current.end === nextSelection.end) {
        return current;
      }

      return nextSelection;
    });
  }, [setComposerSelection]);

  const handleComposerChange = useCallback((event: ChangeEvent<HTMLTextAreaElement>) => {
    setMessageDraft(event.target.value);
    syncComposerSelection(event.target);
    resizeComposerTextarea(event.target);
  }, [resizeComposerTextarea, setMessageDraft, syncComposerSelection]);

  const handleInsertQuickReply = useCallback((option: QuickReplyInsertion) => {
    const nextSelection = getCurrentSelection(composerSelection);
    const match = getActiveQuickReplyMatch(messageDraft, nextSelection) ?? activeQuickReplyMatch;

    if (!match) {
      return;
    }

    const nextValue = `${messageDraft.slice(0, match.start)}${option.text}${messageDraft.slice(match.end)}`;
    const nextCursor = match.start + option.text.length;

    setMessageDraft(nextValue);
    setComposerSelection({ start: nextCursor, end: nextCursor });
    setDismissedQuickReplyKey(null);
    setQuickReplyActiveIndex(0);
    restoreCursor(nextCursor);
  }, [activeQuickReplyMatch, composerSelection, getCurrentSelection, messageDraft, restoreCursor, setComposerSelection, setDismissedQuickReplyKey, setMessageDraft, setQuickReplyActiveIndex]);

  const handleInsertEmoji = useCallback((emoji: string) => {
    const nextSelection = getCurrentSelection(composerSelection);
    const nextValue = `${messageDraft.slice(0, nextSelection.start)}${emoji}${messageDraft.slice(nextSelection.end)}`;
    const nextCursor = nextSelection.start + emoji.length;

    setMessageDraft(nextValue);
    setComposerSelection({ start: nextCursor, end: nextCursor });
    setComposerFocused(true);
    restoreCursor(nextCursor);
  }, [composerSelection, getCurrentSelection, messageDraft, restoreCursor, setComposerFocused, setComposerSelection, setMessageDraft]);

  const handleApplyComposerTextFormat = useCallback((format: WhatsAppTextFormat) => {
    const nextSelection = getCurrentSelection(composerSelection);
    const marker = format === 'strike' ? '~' : format === 'italic' ? '_' : '*';
    const selectedText = messageDraft.slice(nextSelection.start, nextSelection.end);
    const hasSelection = nextSelection.end > nextSelection.start;
    const insertion = hasSelection ? `${marker}${selectedText}${marker}` : `${marker}${marker}`;
    const nextValue = `${messageDraft.slice(0, nextSelection.start)}${insertion}${messageDraft.slice(nextSelection.end)}`;
    const nextCursor = hasSelection
      ? nextSelection.end + marker.length * 2
      : nextSelection.start + marker.length;

    setMessageDraft(nextValue);
    setComposerSelection({ start: nextCursor, end: nextCursor });
    setComposerFocused(true);
    restoreCursor(nextCursor);
  }, [composerSelection, getCurrentSelection, messageDraft, restoreCursor, setComposerFocused, setComposerSelection, setMessageDraft]);

  return {
    syncComposerSelection,
    handleComposerChange,
    handleInsertQuickReply,
    handleInsertEmoji,
    handleApplyComposerTextFormat,
  };
};
