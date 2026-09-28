import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type ClipboardEvent, type DragEvent } from 'react';

import { createPendingAttachmentFromFile, normalizePastedImageFile } from '../domain/inboxPresentation';
import type { PendingAttachment } from '../domain/outgoingMessageTypes';
import type { CommWhatsAppChat } from '../domain/types';
import { useVoiceRecording } from './useVoiceRecording';

const MEDIA_ATTACHMENT_ACCEPT = 'image/*,.jpg,.jpeg,.png,.gif,.webp,.bmp,.svg,.heic,.heif,video/*,.mp4,.mov,.avi,.mkv,.webm';
const DOCUMENT_ATTACHMENT_ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv';
const AUDIO_ATTACHMENT_ACCEPT = 'audio/*,.mp3,.wav,.ogg,.m4a,.aac';
const DEFAULT_ATTACHMENT_ACCEPT = `${MEDIA_ATTACHMENT_ACCEPT},${DOCUMENT_ATTACHMENT_ACCEPT},${AUDIO_ATTACHMENT_ACCEPT}`;

type AttachmentMenuAction = 'document' | 'media' | 'audio' | 'contact';

type UseInboxComposerAttachmentsOptions = {
  selectedChatId: string | null;
  selectedChat: Pick<CommWhatsAppChat, 'id'> | null;
  generatingFollowUp: boolean;
  sendDisabledReason: string | null;
  clearMediaUploadProgress: (chatId: string) => void;
};

export const useInboxComposerAttachments = ({
  selectedChatId,
  selectedChat,
  generatingFollowUp,
  sendDisabledReason,
  clearMediaUploadProgress,
}: UseInboxComposerAttachmentsOptions) => {
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [removedAttachmentForUndo, setRemovedAttachmentForUndo] = useState<PendingAttachment | null>(null);
  const [attachmentInputAccept, setAttachmentInputAccept] = useState(DEFAULT_ATTACHMENT_ACCEPT);
  const [attachmentMenuOpen, setAttachmentMenuOpen] = useState(false);
  const [isDraggingFilesOverThread, setIsDraggingFilesOverThread] = useState(false);
  const [selectedMediaComposerAttachmentId, setSelectedMediaComposerAttachmentId] = useState<string | null>(null);
  const [selectedDocumentComposerAttachmentId, setSelectedDocumentComposerAttachmentId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const removedAttachmentUndoTimeoutRef = useRef<number | null>(null);
  const threadDragCounterRef = useRef(0);
  const attachmentPreviewUrlsRef = useRef<Map<string, string>>(new Map());

  const voiceRecording = useVoiceRecording({
    sendDisabledReason,
    onAttachmentChange: setPendingAttachments,
  });
  const voiceRecordingState = voiceRecording.voiceRecordingState;
  const handleClearVoiceAttachment = voiceRecording.handleClearVoiceAttachment;

  const voiceAttachment = useMemo(
    () => pendingAttachments.find((attachment) => attachment.kind === 'voice') ?? null,
    [pendingAttachments],
  );
  const nonVoiceAttachments = useMemo(
    () => pendingAttachments.filter((attachment) => attachment.kind !== 'voice'),
    [pendingAttachments],
  );
  const visualComposerAttachments = useMemo(
    () => nonVoiceAttachments.filter((attachment) => attachment.kind === 'image' || attachment.kind === 'video'),
    [nonVoiceAttachments],
  );
  const documentComposerAttachments = useMemo(
    () => nonVoiceAttachments.filter((attachment) => attachment.kind !== 'image' && attachment.kind !== 'video'),
    [nonVoiceAttachments],
  );
  const selectedMediaComposerAttachment = useMemo(
    () => visualComposerAttachments.find((attachment) => attachment.id === selectedMediaComposerAttachmentId)
      ?? visualComposerAttachments[0]
      ?? null,
    [selectedMediaComposerAttachmentId, visualComposerAttachments],
  );
  const selectedDocumentComposerAttachment = useMemo(
    () => documentComposerAttachments.find((attachment) => attachment.id === selectedDocumentComposerAttachmentId)
      ?? documentComposerAttachments[0]
      ?? null,
    [documentComposerAttachments, selectedDocumentComposerAttachmentId],
  );

  useEffect(() => {
    if (visualComposerAttachments.length === 0) {
      if (selectedMediaComposerAttachmentId !== null) {
        setSelectedMediaComposerAttachmentId(null);
      }
      return;
    }

    if (!selectedMediaComposerAttachmentId || !visualComposerAttachments.some((attachment) => attachment.id === selectedMediaComposerAttachmentId)) {
      setSelectedMediaComposerAttachmentId(visualComposerAttachments[0].id);
    }
  }, [selectedMediaComposerAttachmentId, visualComposerAttachments]);

  useEffect(() => {
    if (documentComposerAttachments.length === 0) {
      if (selectedDocumentComposerAttachmentId !== null) {
        setSelectedDocumentComposerAttachmentId(null);
      }
      return;
    }

    if (!selectedDocumentComposerAttachmentId || !documentComposerAttachments.some((attachment) => attachment.id === selectedDocumentComposerAttachmentId)) {
      setSelectedDocumentComposerAttachmentId(documentComposerAttachments[0].id);
    }
  }, [documentComposerAttachments, selectedDocumentComposerAttachmentId]);

  useEffect(() => {
    const nextPreviewUrls = new Map<string, string>();

    for (const attachment of pendingAttachments) {
      if (attachment.previewUrl?.startsWith('blob:')) {
        nextPreviewUrls.set(attachment.id, attachment.previewUrl);
      }
    }

    for (const [attachmentId, previewUrl] of attachmentPreviewUrlsRef.current.entries()) {
      if (!nextPreviewUrls.has(attachmentId) && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    }

    attachmentPreviewUrlsRef.current = nextPreviewUrls;
  }, [pendingAttachments]);

  const resetAttachments = useCallback(() => {
    setPendingAttachments([]);
    setRemovedAttachmentForUndo(null);
    setIsDraggingFilesOverThread(false);
    threadDragCounterRef.current = 0;
    if (removedAttachmentUndoTimeoutRef.current !== null) {
      window.clearTimeout(removedAttachmentUndoTimeoutRef.current);
      removedAttachmentUndoTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    resetAttachments();
  }, [resetAttachments, selectedChatId]);

  useEffect(() => () => {
    if (removedAttachmentUndoTimeoutRef.current !== null) {
      window.clearTimeout(removedAttachmentUndoTimeoutRef.current);
    }
    for (const previewUrl of attachmentPreviewUrlsRef.current.values()) {
      if (previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    }
    attachmentPreviewUrlsRef.current.clear();
  }, []);

  const clearPendingAttachments = useCallback(() => {
    setPendingAttachments([]);
  }, []);

  const handleAttachmentMenuAction = useCallback((action: AttachmentMenuAction) => {
    if (voiceRecordingState !== 'idle') {
      return;
    }

    if (action === 'contact') {
      setAttachmentMenuOpen(false);
      return;
    }

    const nextAccept = action === 'document'
      ? DOCUMENT_ATTACHMENT_ACCEPT
      : action === 'audio'
        ? AUDIO_ATTACHMENT_ACCEPT
        : MEDIA_ATTACHMENT_ACCEPT;

    setAttachmentInputAccept(nextAccept);
    setAttachmentMenuOpen(false);
    if (fileInputRef.current) {
      fileInputRef.current.accept = nextAccept;
    }
    fileInputRef.current?.click();
  }, [voiceRecordingState]);

  const handleAttachmentInputChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    if (voiceRecordingState !== 'idle') {
      event.target.value = '';
      return;
    }

    const nextFiles = Array.from(event.target.files ?? []);
    if (nextFiles.length === 0) {
      event.target.value = '';
      return;
    }

    const nextAttachments = nextFiles.map(createPendingAttachmentFromFile);
    setPendingAttachments((current) => [
      ...current.filter((attachment) => attachment.kind === 'voice'),
      ...nextAttachments,
    ]);
    event.target.value = '';
  }, [voiceRecordingState]);

  const handleComposerPaste = useCallback((event: ClipboardEvent<HTMLTextAreaElement>) => {
    if (voiceRecordingState !== 'idle' || generatingFollowUp) {
      return;
    }

    const clipboardItems = Array.from(event.clipboardData.items ?? []);
    const imageFilesFromItems = clipboardItems
      .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
      .map((item) => item.getAsFile())
      .filter((file): file is File => Boolean(file));
    const imageFiles = imageFilesFromItems.length > 0
      ? imageFilesFromItems
      : Array.from(event.clipboardData.files ?? []).filter((file) => file.type.startsWith('image/'));

    if (imageFiles.length === 0) {
      return;
    }

    event.preventDefault();
    const pastedAttachments = imageFiles
      .map(normalizePastedImageFile)
      .map(createPendingAttachmentFromFile);
    setPendingAttachments((current) => [
      ...current.filter((attachment) => attachment.kind === 'voice'),
      ...pastedAttachments,
    ]);
  }, [generatingFollowUp, voiceRecordingState]);

  const handleClearAttachment = useCallback((attachmentId?: string) => {
    const removedAttachment = attachmentId
      ? pendingAttachments.find((attachment) => attachment.id === attachmentId) ?? null
      : null;

    if (!attachmentId || removedAttachment?.kind === 'voice') {
      handleClearVoiceAttachment();
    }
    setPendingAttachments((current) => (
      attachmentId
        ? current.filter((attachment) => attachment.id !== attachmentId)
        : []
    ));

    if (selectedChat) {
      clearMediaUploadProgress(selectedChat.id);
    }

    if (removedAttachment && removedAttachment.kind !== 'voice') {
      if (removedAttachmentUndoTimeoutRef.current !== null) {
        window.clearTimeout(removedAttachmentUndoTimeoutRef.current);
      }
      setRemovedAttachmentForUndo(removedAttachment);
      removedAttachmentUndoTimeoutRef.current = window.setTimeout(() => {
        setRemovedAttachmentForUndo(null);
        removedAttachmentUndoTimeoutRef.current = null;
      }, 6000);
    }
  }, [clearMediaUploadProgress, handleClearVoiceAttachment, pendingAttachments, selectedChat]);

  const handleUndoRemoveAttachment = useCallback(() => {
    if (!removedAttachmentForUndo) {
      return;
    }

    if (removedAttachmentUndoTimeoutRef.current !== null) {
      window.clearTimeout(removedAttachmentUndoTimeoutRef.current);
      removedAttachmentUndoTimeoutRef.current = null;
    }

    const restoredAttachment = createPendingAttachmentFromFile(removedAttachmentForUndo.file);
    setPendingAttachments((current) => [...current, restoredAttachment]);
    setRemovedAttachmentForUndo(null);
  }, [removedAttachmentForUndo]);

  const handleThreadDragEnter = useCallback((event: DragEvent<HTMLDivElement>) => {
    if (!selectedChat || voiceRecordingState !== 'idle' || !Array.from(event.dataTransfer.types).includes('Files')) {
      return;
    }
    event.preventDefault();
    threadDragCounterRef.current += 1;
    setIsDraggingFilesOverThread(true);
  }, [selectedChat, voiceRecordingState]);

  const handleThreadDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    if (!selectedChat || voiceRecordingState !== 'idle' || !Array.from(event.dataTransfer.types).includes('Files')) {
      return;
    }
    event.preventDefault();
  }, [selectedChat, voiceRecordingState]);

  const handleThreadDragLeave = useCallback((event: DragEvent<HTMLDivElement>) => {
    if (!Array.from(event.dataTransfer.types).includes('Files')) {
      return;
    }
    event.preventDefault();
    threadDragCounterRef.current = Math.max(0, threadDragCounterRef.current - 1);
    if (threadDragCounterRef.current === 0) {
      setIsDraggingFilesOverThread(false);
    }
  }, []);

  const handleThreadDrop = useCallback((event: DragEvent<HTMLDivElement>) => {
    if (!Array.from(event.dataTransfer.types).includes('Files')) {
      return;
    }
    event.preventDefault();
    threadDragCounterRef.current = 0;
    setIsDraggingFilesOverThread(false);

    if (!selectedChat || voiceRecordingState !== 'idle') {
      return;
    }

    const droppedFiles = Array.from(event.dataTransfer.files ?? []);
    if (droppedFiles.length === 0) {
      return;
    }

    const nextAttachments = droppedFiles.map(createPendingAttachmentFromFile);
    setPendingAttachments((current) => [
      ...current.filter((attachment) => attachment.kind === 'voice'),
      ...nextAttachments,
    ]);
  }, [selectedChat, voiceRecordingState]);

  return {
    pendingAttachments,
    setPendingAttachments,
    clearPendingAttachments,
    removedAttachmentForUndo,
    attachmentInputAccept,
    attachmentMenuOpen,
    setAttachmentMenuOpen,
    isDraggingFilesOverThread,
    setSelectedMediaComposerAttachmentId,
    setSelectedDocumentComposerAttachmentId,
    fileInputRef,
    voiceAttachment,
    nonVoiceAttachments,
    visualComposerAttachments,
    documentComposerAttachments,
    selectedMediaComposerAttachment,
    selectedDocumentComposerAttachment,
    isVoiceComposerMode: voiceRecordingState === 'recording' || voiceAttachment !== null,
    handleAttachmentMenuAction,
    handleAttachmentInputChange,
    handleComposerPaste,
    handleClearAttachment,
    handleUndoRemoveAttachment,
    handleThreadDragEnter,
    handleThreadDragOver,
    handleThreadDragLeave,
    handleThreadDrop,
    ...voiceRecording,
  };
};
