export type MediaUploadProgress = {
  chatId: string;
  attachmentId: string;
  currentIndex: number;
  total: number;
  progress: number | null;
  fileName: string;
};

export type MediaUploadProgressByChatId = Readonly<Record<string, MediaUploadProgress>>;

export const setMediaUploadProgressForChat = (
  current: MediaUploadProgressByChatId,
  progress: MediaUploadProgress,
): MediaUploadProgressByChatId => ({
  ...current,
  [progress.chatId]: progress,
});

export const updateMediaUploadProgressForChat = (
  current: MediaUploadProgressByChatId,
  chatId: string,
  attachmentId: string,
  progress: number | null,
): MediaUploadProgressByChatId => {
  const currentProgress = current[chatId];
  if (!currentProgress || currentProgress.attachmentId !== attachmentId) {
    return current;
  }

  return {
    ...current,
    [chatId]: {
      ...currentProgress,
      progress,
    },
  };
};

export const clearMediaUploadProgressForChat = (
  current: MediaUploadProgressByChatId,
  chatId: string,
  attachmentId?: string,
): MediaUploadProgressByChatId => {
  const currentProgress = current[chatId];
  if (!currentProgress || (attachmentId && currentProgress.attachmentId !== attachmentId)) {
    return current;
  }

  const next = { ...current };
  delete next[chatId];
  return next;
};
