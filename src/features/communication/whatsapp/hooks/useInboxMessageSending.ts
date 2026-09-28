import { useCallback } from 'react';

import {
  CommWhatsAppAmbiguousSendError,
  CommWhatsAppMediaSendTimeoutError,
  whatsappMediaRepository,
  whatsappMessagesRepository,
  type CommWhatsAppMediaSendKind,
} from '../data';
import type { CommWhatsAppChat, CommWhatsAppMessage } from '../domain/types';
import {
  QUEUED_TEXT_SEND_INTERRUPTED_MESSAGE,
  shouldContinueQueuedTextSendAfterFailure,
} from '../domain/messageSendQueue';
import { buildComposerQueueSnapshotKey, buildMediaSummaryText } from '../domain/inboxPresentation';
import { getQuotePayloadFromMessage } from '../domain/messagePresentation';
import { createClientRequestId } from '../domain/messageRequestId';
import type { LocalOutgoingRetryPayload, PendingAttachment } from '../domain/outgoingMessageTypes';
import { splitWhatsAppMessageSegments } from '../../../../lib/whatsAppMessageSegments';
import { toast } from '../../../../lib/toast';
import type { ComposerSendLock } from '../components/composerSendLock';
import type { MediaUploadProgress } from '../domain/mediaUploadState';

type OutgoingQuotePayload = ReturnType<typeof getQuotePayloadFromMessage>;

type OptimisticOutgoingMessageInput = {
  chat: CommWhatsAppChat;
  messageType: CommWhatsAppMediaSendKind | 'text' | 'document';
  textContent: string;
  clientRequestId?: string;
  messageAt?: string;
  mediaUrl?: string | null;
  mediaMimeType?: string | null;
  mediaFileName?: string | null;
  mediaSizeBytes?: number | null;
  mediaDurationSeconds?: number | null;
  mediaCaption?: string | null;
  metadata?: Record<string, unknown>;
};

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
  const sendTextSegments = useCallback((
    chat: CommWhatsAppChat,
    textSegments: string[],
    quotePayload: OutgoingQuotePayload | null = null,
    onSent?: () => void | Promise<void>,
  ): Promise<void> => {
    if (textSegments.length === 0) {
      return Promise.resolve();
    }

    const optimisticTimestamps = allocateOptimisticMessageTimestamps(chat.id, textSegments.length);
    const queuedMessages = textSegments.map((segment, index) => {
      const clientRequestId = createClientRequestId();
      const optimisticMessage = buildOptimisticOutgoingMessage({
        chat,
        messageType: 'text',
        textContent: segment,
        clientRequestId,
        messageAt: optimisticTimestamps[index],
        metadata: quotePayload && index === 0
          ? {
              quote: {
                external_message_id: quotePayload.quotedMessageId,
                author_phone: quotePayload.quotedAuthorPhone || null,
                quoted_type: quotePayload.quotedType || null,
                preview_text: quotePayload.quotedPreviewText || null,
              },
            }
          : undefined,
      });

      appendLocalOutgoingMessage(optimisticMessage, {
        kind: 'text',
        text: segment,
        clientRequestId,
      });
      applyOptimisticChatSummary(chat, segment, optimisticMessage.message_at);

      return { segment, optimisticMessage, clientRequestId };
    });

    return enqueueChatSend(chat.id, async () => {
      let hadSuccessfulSend = false;
      let stopAfterDefinitiveFailure = false;

      for (const queued of queuedMessages) {
        if (stopAfterDefinitiveFailure) {
          patchLocalOutgoingMessage(queued.optimisticMessage.id, {
            delivery_status: 'failed',
            status_updated_at: new Date().toISOString(),
            error_message: QUEUED_TEXT_SEND_INTERRUPTED_MESSAGE,
          });
          updateOptimisticChatPreviewStatus(chat.id, queued.optimisticMessage.message_at, 'failed');
          continue;
        }

        try {
          const sendResult = await whatsappMessagesRepository.sendText(chat.external_chat_id, queued.segment, {
            clientRequestId: queued.clientRequestId,
            ...(quotePayload && queued === queuedMessages[0] ? quotePayload : {}),
          });
          hadSuccessfulSend = true;
          patchLocalOutgoingMessage(queued.optimisticMessage.id, {
            external_message_id: sendResult.messageId,
            delivery_status: sendResult.status,
            status_updated_at: new Date().toISOString(),
            error_message: null,
          });
          updateOptimisticChatPreviewStatus(chat.id, queued.optimisticMessage.message_at, sendResult.status);
          if (sendResult.messageId && refreshableOutboundStatuses.has(sendResult.status.trim().toLowerCase())) {
            scheduleMessageStatusRefresh({ chat, externalMessageIds: [sendResult.messageId] });
          }
          localOutgoingRetryPayloadRef.current.delete(queued.optimisticMessage.id);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Não foi possível enviar a mensagem.';
          // Sem confirmação de falha, a mensagem anterior pode ter sido entregue.
          // Mantê-la como "sending" evita oferecer um reenvio que gere duplicidade.
          const status = error instanceof CommWhatsAppAmbiguousSendError ? 'sending' : 'failed';
          patchLocalOutgoingMessage(queued.optimisticMessage.id, {
            delivery_status: status,
            status_updated_at: new Date().toISOString(),
            error_message: message,
          });
          updateOptimisticChatPreviewStatus(chat.id, queued.optimisticMessage.message_at, status);
          stopAfterDefinitiveFailure = !shouldContinueQueuedTextSendAfterFailure(
            error instanceof CommWhatsAppAmbiguousSendError,
          );
        }
      }

      if (hadSuccessfulSend) {
        void Promise.resolve(onSent?.()).catch((error) => {
          console.error('[WhatsAppInbox] erro ao atualizar auditoria do follow-up enviado', error);
        });
        void Promise.all([loadMessages(chat, 'send'), loadChats()]).catch((error) => {
          console.error('[WhatsAppInbox] erro ao atualizar conversa apos envio de texto', error);
          toast.warning('Mensagem enviada, mas houve um erro ao atualizar a lista. Atualize a página se necessário.');
        });
      }
    });
  }, [allocateOptimisticMessageTimestamps, appendLocalOutgoingMessage, applyOptimisticChatSummary, buildOptimisticOutgoingMessage, enqueueChatSend, loadChats, loadMessages, localOutgoingRetryPayloadRef, patchLocalOutgoingMessage, refreshableOutboundStatuses, scheduleMessageStatusRefresh, updateOptimisticChatPreviewStatus]);

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
      const replyTargetSnapshot = replyTargetMessage;
      const quotePayload = replyTargetSnapshot ? getQuotePayloadFromMessage(replyTargetSnapshot) : null;
      let queuedSend: Promise<void>;
      if (attachmentsSnapshot.length > 0) {
        const sendChatId = selectedChat.id;
        const optimisticTimestamps = allocateOptimisticMessageTimestamps(sendChatId, attachmentsSnapshot.length);
        const attachmentsToSend = attachmentsSnapshot.map((attachment, index) => {
          const caption = index === 0 && attachment.kind !== 'voice' ? text || undefined : undefined;
          const clientRequestId = createClientRequestId();
          const localPreviewUrl = attachment.previewUrl?.startsWith('blob:')
            ? URL.createObjectURL(attachment.file)
            : attachment.previewUrl ?? null;
          const optimisticMessage = buildOptimisticOutgoingMessage({
            chat: selectedChat,
            messageType: attachment.kind,
            textContent: buildMediaSummaryText(attachment.kind),
            clientRequestId,
            messageAt: optimisticTimestamps[index],
            mediaUrl: localPreviewUrl,
            mediaMimeType: attachment.file.type || null,
            mediaFileName: attachment.file.name,
            mediaSizeBytes: attachment.file.size,
            mediaDurationSeconds: attachment.durationSeconds ?? null,
            mediaCaption: attachment.kind === 'voice' ? null : caption ?? null,
            metadata: quotePayload && index === 0
              ? {
                  quote: {
                    external_message_id: quotePayload.quotedMessageId,
                    author_phone: quotePayload.quotedAuthorPhone || null,
                    quoted_type: quotePayload.quotedType || null,
                    preview_text: quotePayload.quotedPreviewText || null,
                  },
                }
              : undefined,
          });

          appendLocalOutgoingMessage(optimisticMessage, {
            kind: 'media',
            mediaKind: attachment.kind,
            file: attachment.file,
            caption,
            durationSeconds: attachment.durationSeconds,
            waveform: attachment.waveformPayload || undefined,
            fileName: attachment.file.name,
            previewUrl: localPreviewUrl,
            clientRequestId,
          });
          applyOptimisticChatSummary(selectedChat, optimisticMessage.text_content ?? '', optimisticMessage.message_at);

          return { attachment, caption, optimisticMessage, clientRequestId };
        });

        queuedSend = enqueueChatSend(sendChatId, async () => {
          let shouldStopQueue = false;
          let hadSuccessfulSend = false;
          let firstErrorMessage = '';
          let hadAmbiguousSend = false;
          let activeAbortController: AbortController | null = null;

          try {
            for (let index = 0; index < attachmentsToSend.length; index += 1) {
              const queued = attachmentsToSend[index];

              if (shouldStopQueue) {
                patchLocalOutgoingMessage(queued.optimisticMessage.id, {
                  delivery_status: 'failed',
                  status_updated_at: new Date().toISOString(),
                  error_message: 'Envio interrompido antes deste item. Toque em reenviar para tentar novamente.',
                });
                updateOptimisticChatPreviewStatus(selectedChat.id, queued.optimisticMessage.message_at, 'failed');
                continue;
              }

              const abortController = new AbortController();
              activeAbortController = abortController;
              setMediaUploadProgress({
                chatId: sendChatId,
                attachmentId: queued.optimisticMessage.id,
                currentIndex: index + 1,
                total: attachmentsToSend.length,
                progress: 0,
                fileName: queued.attachment.file.name,
              });
              mediaUploadAbortControllersRef.current.set(sendChatId, abortController);

              try {
                const sendResult = await whatsappMediaRepository.send({
                  chatId: selectedChat.external_chat_id,
                  kind: queued.attachment.kind,
                  file: queued.attachment.file,
                  caption: queued.caption,
                  durationSeconds: queued.attachment.durationSeconds,
                  waveform: queued.attachment.kind === 'voice' ? queued.attachment.waveformPayload || undefined : undefined,
                  clientRequestId: queued.clientRequestId,
                  ...(quotePayload && index === 0 ? quotePayload : {}),
                  onUploadProgress: (progress) => {
                    updateMediaUploadProgress(sendChatId, queued.optimisticMessage.id, progress);
                  },
                  signal: abortController.signal,
                });

                if (queued.optimisticMessage.media_url && sendResult.messageId) {
                  whatsappMediaRepository.rememberLocalPreview(sendResult.messageId, queued.optimisticMessage.media_url);
                }

                hadSuccessfulSend = true;
                patchLocalOutgoingMessage(queued.optimisticMessage.id, {
                  external_message_id: sendResult.messageId,
                  delivery_status: sendResult.status,
                  status_updated_at: new Date().toISOString(),
                  error_message: null,
                });
                updateOptimisticChatPreviewStatus(selectedChat.id, queued.optimisticMessage.message_at, sendResult.status);
                if (sendResult.messageId && refreshableOutboundStatuses.has(sendResult.status.trim().toLowerCase())) {
                  scheduleMessageStatusRefresh({ chat: selectedChat, externalMessageIds: [sendResult.messageId] });
                }
                if (sendResult.messageId || sendResult.status.trim().toLowerCase() !== 'sending') {
                  localOutgoingRetryPayloadRef.current.delete(queued.optimisticMessage.id);
                }
              } catch (error) {
                const message = error instanceof Error ? error.message : 'Não foi possível enviar a mídia.';
                firstErrorMessage = firstErrorMessage || message;
                if (error instanceof CommWhatsAppMediaSendTimeoutError || error instanceof CommWhatsAppAmbiguousSendError) {
                  hadAmbiguousSend = true;
                  patchLocalOutgoingMessage(queued.optimisticMessage.id, {
                    delivery_status: 'sending',
                    status_updated_at: new Date().toISOString(),
                    error_message: 'Envio ainda em confirmação. Evite reenviar por enquanto.',
                  });
                  updateOptimisticChatPreviewStatus(selectedChat.id, queued.optimisticMessage.message_at, 'sending');
                  continue;
                }

                patchLocalOutgoingMessage(queued.optimisticMessage.id, {
                  delivery_status: 'failed',
                  status_updated_at: new Date().toISOString(),
                  error_message: message,
                });
                updateOptimisticChatPreviewStatus(selectedChat.id, queued.optimisticMessage.message_at, 'failed');
                shouldStopQueue = true;
              }
            }
          } finally {
            clearMediaUploadProgress(sendChatId);
            if (activeAbortController && mediaUploadAbortControllersRef.current.get(sendChatId) === activeAbortController) {
              mediaUploadAbortControllersRef.current.delete(sendChatId);
            }
          }

          if (hadSuccessfulSend || hadAmbiguousSend) {
            void Promise.all([loadMessages(selectedChat, 'send'), loadChats()]).catch((error) => {
              console.error('[WhatsAppInbox] erro ao atualizar conversa apos envio de midia', error);
            });
          }

          if (hadAmbiguousSend) {
            toast.info('Um ou mais arquivos ainda estão confirmando envio. Aguarde antes de reenviar.');
          } else if (firstErrorMessage) {
            if (firstErrorMessage === 'Envio de mídia cancelado.') {
              toast.info('Upload interrompido. As mensagens que falharam permaneceram no chat para reenvio.');
            } else {
              toast.error(firstErrorMessage);
            }
          }
        });
      } else {
        queuedSend = sendTextSegments(selectedChat, textSegments, quotePayload);
      }

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
  }, [allocateOptimisticMessageTimestamps, appendLocalOutgoingMessage, applyOptimisticChatSummary, buildOptimisticOutgoingMessage, clearMediaUploadProgress, composerSendLock, enqueueChatSend, localOutgoingRetryPayloadRef, loadChats, loadMessages, mediaUploadAbortControllersRef, messageDraft, patchLocalOutgoingMessage, pendingAttachments, refreshableOutboundStatuses, replyTargetMessage, resetComposerAfterQueue, resolveComposerVariables, scheduleMessageStatusRefresh, selectedChat, sendDisabledReason, sendTextSegments, setMediaUploadProgress, setReplyTargetMessage, updateMediaUploadProgress, updateOptimisticChatPreviewStatus]);

  const handleSendDrawerMedia = useCallback(async (item: {
    sendKind: 'image' | 'video';
    sendUrl: string;
    title: string;
    mimeType: string;
    previewUrl?: string;
  }) => {
    if (!selectedChat) {
      return;
    }

    if (mediaDrawerSendDisabledReason) {
      toast.error(mediaDrawerSendDisabledReason);
      throw new Error(mediaDrawerSendDisabledReason);
    }

    const clientRequestId = createClientRequestId();
    const [messageAt] = allocateOptimisticMessageTimestamps(selectedChat.id, 1);
    const optimisticMessage = buildOptimisticOutgoingMessage({
      chat: selectedChat,
      messageType: item.sendKind,
      textContent: buildMediaSummaryText(item.sendKind),
      clientRequestId,
      messageAt,
      mediaUrl: item.previewUrl ?? item.sendUrl,
      mediaMimeType: item.mimeType,
      mediaFileName: item.title,
      metadata: {
        local_media_source: 'drawer',
      },
    });

    appendLocalOutgoingMessage(optimisticMessage, {
      kind: 'remote_media',
      mediaKind: item.sendKind,
      remoteUrl: item.sendUrl,
      mimeType: item.mimeType,
      fileName: item.title,
      previewUrl: item.previewUrl ?? item.sendUrl,
      clientRequestId,
    });
    applyOptimisticChatSummary(selectedChat, optimisticMessage.text_content ?? '', optimisticMessage.message_at);

    const sendChatId = selectedChat.id;
    return enqueueChatSend(sendChatId, async () => {
      setSendingDrawerMediaByChatId((current) => ({ ...current, [sendChatId]: true }));

      try {
        const sendResult = await whatsappMediaRepository.sendRemote({
          chatId: selectedChat.external_chat_id,
          kind: item.sendKind,
          remoteUrl: item.sendUrl,
          fileName: item.title,
          mimeType: item.mimeType,
          clientRequestId,
        });

        patchLocalOutgoingMessage(optimisticMessage.id, {
          external_message_id: sendResult.messageId,
          delivery_status: sendResult.status,
          status_updated_at: new Date().toISOString(),
          error_message: null,
        });
        updateOptimisticChatPreviewStatus(selectedChat.id, optimisticMessage.message_at, sendResult.status);
        if (sendResult.messageId && refreshableOutboundStatuses.has(sendResult.status.trim().toLowerCase())) {
          scheduleMessageStatusRefresh({ chat: selectedChat, externalMessageIds: [sendResult.messageId] });
        }
        localOutgoingRetryPayloadRef.current.delete(optimisticMessage.id);

        void Promise.all([loadMessages(selectedChat, 'send'), loadChats()]).catch((error) => {
          console.error('[WhatsAppInbox] erro ao atualizar conversa apos midia da gaveta', error);
        });
      } catch (error) {
        console.error('[WhatsAppInbox] erro ao enviar mídia da gaveta', error);
        const message = error instanceof Error ? error.message : 'Não foi possível enviar a mídia agora.';
        patchLocalOutgoingMessage(optimisticMessage.id, {
          delivery_status: 'failed',
          status_updated_at: new Date().toISOString(),
          error_message: message,
        });
        updateOptimisticChatPreviewStatus(selectedChat.id, optimisticMessage.message_at, 'failed');
        throw error instanceof Error ? error : new Error(message);
      } finally {
        setSendingDrawerMediaByChatId((current) => {
          if (!current[sendChatId]) {
            return current;
          }

          const next = { ...current };
          delete next[sendChatId];
          return next;
        });
      }
    });
  }, [allocateOptimisticMessageTimestamps, appendLocalOutgoingMessage, applyOptimisticChatSummary, buildOptimisticOutgoingMessage, enqueueChatSend, loadChats, loadMessages, localOutgoingRetryPayloadRef, mediaDrawerSendDisabledReason, patchLocalOutgoingMessage, refreshableOutboundStatuses, scheduleMessageStatusRefresh, selectedChat, setSendingDrawerMediaByChatId, updateOptimisticChatPreviewStatus]);

  return { sendTextSegments, handleSendMessage, handleSendDrawerMedia };
};
