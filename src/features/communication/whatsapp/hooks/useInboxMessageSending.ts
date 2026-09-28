import { useCallback } from 'react';

import type { CommWhatsAppChat, CommWhatsAppMessage } from '../domain/types';
import { getQuotePayloadFromMessage } from '../domain/messagePresentation';
import { splitWhatsAppMessageSegments } from '../../../../lib/whatsAppMessageSegments';
import { toast } from '../../../../lib/toast';
import type { ComposerSendLock } from '../components/composerSendLock';
import type { MediaUploadProgress } from '../domain/mediaUploadState';
import type { LocalOutgoingRetryPayload, PendingAttachment } from '../domain/outgoingMessageTypes';
import { buildComposerQueueSnapshotKey } from '../domain/inboxPresentation';
import {
  type InboxOutgoingMessageRuntime,
  type OptimisticOutgoingMessageInput,
} from './inboxOutgoingMessageRuntime';
import { useInboxAttachmentSender } from './useInboxAttachmentSender';
import { useInboxDrawerMediaSender } from './useInboxDrawerMediaSender';
import { useInboxTextMessageSender } from './useInboxTextMessageSender';

type MessageSendingOptions = {
  selectedChat: CommWhatsAppChat | null;
  mediaDrawerSendDisabledReason: string | null;
  messageDraft: string;
  pendingAttachments: PendingAttachment[];
  replyTargetMessage: CommWhatsAppMessage | null;
  sendDisabledReason: string | null;
  composerSendLock: ComposerSendLock;
  mediaUploadAbortControllersRef: { current: Map<string, AbortController> };
  localOutgoingRetryPayloadRef: { current: Map<string, LocalOutgoingRetryPayload> };
  refreshableOutboundStatuses: ReadonlySet<string>;
  resolveComposerVariables: (value: string) => string;
  resetComposerAfterQueue: () => void;
  setReplyTargetMessage: (message: CommWhatsAppMessage | null) => void;
  setSendingDrawerMediaByChatId: (updater: (current: Record<string, boolean>) => Record<string, boolean>) => void;
  enqueueChatSend: (chatId: string, task: () => Promise<void>) => Promise<void>;
  allocateOptimisticMessageTimestamps: (chatId: string, count: number) => string[];
  appendLocalOutgoingMessage: (message: CommWhatsAppMessage, retryPayload?: LocalOutgoingRetryPayload) => void;
  applyOptimisticChatSummary: (chat: CommWhatsAppChat, summaryText: string, messageAt: string) => void;
  buildOptimisticOutgoingMessage: (params: OptimisticOutgoingMessageInput) => CommWhatsAppMessage;
  patchLocalOutgoingMessage: (messageId: string, patch: Partial<CommWhatsAppMessage>) => void;
  updateOptimisticChatPreviewStatus: (chatId: string, messageAt: string, deliveryStatus: string) => void;
  setMediaUploadProgress: (progress: MediaUploadProgress) => void;
  updateMediaUploadProgress: (chatId: string, attachmentId: string, progress: number | null) => void;
  clearMediaUploadProgress: (chatId: string, attachmentId?: string) => void;
  loadChats: () => Promise<unknown> | void;
  loadMessages: (chat: CommWhatsAppChat, reason: 'send') => Promise<unknown> | void;
  scheduleMessageStatusRefresh: (params: { chat: CommWhatsAppChat; externalMessageIds: string[] }) => void;
};

export const useInboxMessageSending = ({
  selectedChat,
  mediaDrawerSendDisabledReason,
  messageDraft,
  pendingAttachments,
  replyTargetMessage,
  sendDisabledReason,
  composerSendLock,
  mediaUploadAbortControllersRef,
  localOutgoingRetryPayloadRef,
  refreshableOutboundStatuses,
  resolveComposerVariables,
  resetComposerAfterQueue,
  setReplyTargetMessage,
  setSendingDrawerMediaByChatId,
  enqueueChatSend,
  allocateOptimisticMessageTimestamps,
  appendLocalOutgoingMessage,
  applyOptimisticChatSummary,
  buildOptimisticOutgoingMessage,
  patchLocalOutgoingMessage,
  updateOptimisticChatPreviewStatus,
  setMediaUploadProgress,
  updateMediaUploadProgress,
  clearMediaUploadProgress,
  loadChats,
  loadMessages,
  scheduleMessageStatusRefresh,
}: MessageSendingOptions) => {
  const runtime: InboxOutgoingMessageRuntime = {
    enqueueChatSend,
    allocateOptimisticMessageTimestamps,
    appendLocalOutgoingMessage,
    applyOptimisticChatSummary,
    buildOptimisticOutgoingMessage,
    patchLocalOutgoingMessage,
    updateOptimisticChatPreviewStatus,
    loadChats,
    loadMessages,
    scheduleMessageStatusRefresh,
    localOutgoingRetryPayloadRef,
    refreshableOutboundStatuses,
  };

  const { sendTextSegments, handleSelectInteractiveReply } = useInboxTextMessageSender({
    selectedChat,
    sendDisabledReason,
    runtime,
  });
  const { sendAttachments } = useInboxAttachmentSender({
    runtime,
    mediaUploadAbortControllersRef,
    setMediaUploadProgress,
    updateMediaUploadProgress,
    clearMediaUploadProgress,
  });
  const { handleSendDrawerMedia } = useInboxDrawerMediaSender({
    selectedChat,
    disabledReason: mediaDrawerSendDisabledReason,
    runtime,
    setSendingByChatId: setSendingDrawerMediaByChatId,
  });

  const handleSendMessage = useCallback(() => {
    if (!selectedChat) return;

    const resolvedMessageDraft = resolveComposerVariables(messageDraft);
    const text = resolvedMessageDraft.trim();
    const textSegments = splitWhatsAppMessageSegments(resolvedMessageDraft);
    const attachmentsSnapshot = [...pendingAttachments];
    if (!text && attachmentsSnapshot.length === 0) return;

    if (sendDisabledReason) {
      toast.error(sendDisabledReason);
      return;
    }

    const snapshotKey = buildComposerQueueSnapshotKey(selectedChat.id, messageDraft, attachmentsSnapshot);
    if (!composerSendLock.tryAcquire(snapshotKey)) {
      return;
    }

    resetComposerAfterQueue();

    try {
      const quotePayload = replyTargetMessage ? getQuotePayloadFromMessage(replyTargetMessage) : null;
      const queuedSend = attachmentsSnapshot.length > 0
        ? sendAttachments(selectedChat, attachmentsSnapshot, text, quotePayload)
        : sendTextSegments(selectedChat, textSegments, quotePayload);

      void queuedSend.then(
        () => composerSendLock.release(snapshotKey),
        () => composerSendLock.release(snapshotKey),
      );
      setReplyTargetMessage(null);
    } catch (error) {
      composerSendLock.release(snapshotKey);
      console.error('[WhatsAppInbox] erro ao enviar mensagem', error);
      const message = error instanceof Error ? error.message : 'Não foi possível enviar a mensagem.';
      toast.error(message);
    }
  }, [composerSendLock, messageDraft, pendingAttachments, replyTargetMessage, resetComposerAfterQueue, resolveComposerVariables, selectedChat, sendAttachments, sendDisabledReason, sendTextSegments, setReplyTargetMessage]);

  return { sendTextSegments, handleSendMessage, handleSendDrawerMedia, handleSelectInteractiveReply };
};
