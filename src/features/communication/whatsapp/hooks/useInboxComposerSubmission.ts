import { useCallback, useEffect, type Dispatch, type KeyboardEvent, type SetStateAction } from 'react';

import type { PendingAttachment } from '../domain/outgoingMessageTypes';
import type { VoiceRecordingState } from './useVoiceRecording';
import type { InboxQuickReplyOption } from './useInboxQuickReplyComposer';

type CurrentValue<Value> = { current: Value };

type InboxComposerSubmissionOptions = {
  generatingFollowUp: boolean;
  voiceRecordingState: VoiceRecordingState;
  voiceAttachment: PendingAttachment | null;
  hasSendPayload: boolean;
  quickReplyMenuOpen: boolean;
  quickReplyMenuHasResults: boolean;
  filteredQuickReplyOptions: InboxQuickReplyOption[];
  quickReplyActiveIndex: number;
  activeQuickReplyKey: string | null;
  replySuggestionText: string;
  replySuggestionLoading: boolean;
  autoSendVoiceRef: CurrentValue<boolean>;
  setQuickReplyActiveIndex: Dispatch<SetStateAction<number>>;
  setDismissedQuickReplyKey: Dispatch<SetStateAction<string | null>>;
  handleInsertQuickReply: (option: InboxQuickReplyOption) => void;
  handleApplyReplySuggestion: () => void;
  handleSendMessage: () => unknown;
  handleStartVoiceRecording: () => unknown;
  handleStopVoiceRecording: (autoSend?: boolean) => void;
};

export const useInboxComposerSubmission = ({
  generatingFollowUp,
  voiceRecordingState,
  voiceAttachment,
  hasSendPayload,
  quickReplyMenuOpen,
  quickReplyMenuHasResults,
  filteredQuickReplyOptions,
  quickReplyActiveIndex,
  activeQuickReplyKey,
  replySuggestionText,
  replySuggestionLoading,
  autoSendVoiceRef,
  setQuickReplyActiveIndex,
  setDismissedQuickReplyKey,
  handleInsertQuickReply,
  handleApplyReplySuggestion,
  handleSendMessage,
  handleStartVoiceRecording,
  handleStopVoiceRecording,
}: InboxComposerSubmissionOptions) => {
  const handleSendCurrentVoiceRecording = useCallback(() => {
    if (voiceRecordingState === 'recording') {
      handleStopVoiceRecording(true);
      return;
    }

    if (voiceAttachment) {
      void handleSendMessage();
    }
  }, [handleSendMessage, handleStopVoiceRecording, voiceAttachment, voiceRecordingState]);

  const handleComposerSubmit = useCallback(() => {
    if (generatingFollowUp) {
      return;
    }

    if (voiceRecordingState === 'recording') {
      handleStopVoiceRecording();
      return;
    }

    if (hasSendPayload) {
      void handleSendMessage();
      return;
    }

    void handleStartVoiceRecording();
  }, [generatingFollowUp, handleSendMessage, handleStartVoiceRecording, handleStopVoiceRecording, hasSendPayload, voiceRecordingState]);

  const handleComposerKeyDown = useCallback((event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (quickReplyMenuOpen && quickReplyMenuHasResults) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setQuickReplyActiveIndex((current) => (current + 1) % filteredQuickReplyOptions.length);
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setQuickReplyActiveIndex((current) => (current === 0 ? filteredQuickReplyOptions.length - 1 : current - 1));
        return;
      }

      if (event.key === 'Enter' || event.key === 'Tab') {
        const selectedQuickReply = filteredQuickReplyOptions[quickReplyActiveIndex];
        if (selectedQuickReply) {
          event.preventDefault();
          handleInsertQuickReply(selectedQuickReply);
          return;
        }
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        setDismissedQuickReplyKey(activeQuickReplyKey);
        setQuickReplyActiveIndex(0);
        return;
      }
    }

    if (event.key === 'Tab' && replySuggestionText.trim() && !replySuggestionLoading) {
      event.preventDefault();
      handleApplyReplySuggestion();
      return;
    }

    if (event.key !== 'Enter' || event.shiftKey) {
      return;
    }

    if (!hasSendPayload || voiceAttachment || voiceRecordingState === 'recording') {
      return;
    }

    event.preventDefault();
    void handleSendMessage();
  }, [
    activeQuickReplyKey,
    filteredQuickReplyOptions,
    handleApplyReplySuggestion,
    handleInsertQuickReply,
    handleSendMessage,
    hasSendPayload,
    quickReplyActiveIndex,
    quickReplyMenuHasResults,
    quickReplyMenuOpen,
    replySuggestionLoading,
    replySuggestionText,
    setDismissedQuickReplyKey,
    setQuickReplyActiveIndex,
    voiceAttachment,
    voiceRecordingState,
  ]);

  useEffect(() => {
    if (!voiceAttachment) {
      autoSendVoiceRef.current = false;
      return;
    }

    if (!autoSendVoiceRef.current) {
      return;
    }

    autoSendVoiceRef.current = false;
    void handleSendMessage();
  }, [autoSendVoiceRef, handleSendMessage, voiceAttachment]);

  return { handleSendCurrentVoiceRecording, handleComposerSubmit, handleComposerKeyDown };
};
