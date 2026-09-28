import { useCallback, useEffect, useRef, useState } from 'react';

import {
  clearMediaUploadProgressForChat,
  setMediaUploadProgressForChat,
  updateMediaUploadProgressForChat,
  type MediaUploadProgress,
} from '../domain/mediaUploadState';

type CurrentValue<Value> = { current: Value };

type UseInboxMediaUploadControllerOptions = {
  selectedChatId: string | null;
  selectedChatIdRef: CurrentValue<string | null>;
};

export const useInboxMediaUploadController = ({
  selectedChatId,
  selectedChatIdRef,
}: UseInboxMediaUploadControllerOptions) => {
  const [mediaUploadProgressByChatId, setMediaUploadProgressByChatId] = useState<Record<string, MediaUploadProgress>>({});
  const mediaUploadAbortControllersRef = useRef(new Map<string, AbortController>());

  const clearMediaUploadProgress = useCallback((chatId: string, attachmentId?: string) => {
    setMediaUploadProgressByChatId((current) => clearMediaUploadProgressForChat(current, chatId, attachmentId));
  }, []);

  const setMediaUploadProgress = useCallback((progress: MediaUploadProgress) => {
    setMediaUploadProgressByChatId((current) => setMediaUploadProgressForChat(current, progress));
  }, []);

  const updateMediaUploadProgress = useCallback((chatId: string, attachmentId: string, progress: number | null) => {
    setMediaUploadProgressByChatId((current) => updateMediaUploadProgressForChat(current, chatId, attachmentId, progress));
  }, []);

  const cancelSelectedMediaUpload = useCallback(() => {
    const activeChatId = selectedChatIdRef.current;
    if (activeChatId) {
      mediaUploadAbortControllersRef.current.get(activeChatId)?.abort();
    }
  }, [mediaUploadAbortControllersRef, selectedChatIdRef]);

  useEffect(() => () => {
    for (const controller of mediaUploadAbortControllersRef.current.values()) {
      controller.abort();
    }
    mediaUploadAbortControllersRef.current.clear();
  }, []);

  return {
    mediaUploadProgress: selectedChatId ? mediaUploadProgressByChatId[selectedChatId] ?? null : null,
    mediaUploadAbortControllersRef,
    clearMediaUploadProgress,
    setMediaUploadProgress,
    updateMediaUploadProgress,
    cancelSelectedMediaUpload,
  };
};
