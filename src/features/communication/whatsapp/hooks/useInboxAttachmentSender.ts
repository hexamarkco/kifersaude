import { useCallback } from 'react';

import {
  CommWhatsAppAmbiguousSendError,
  CommWhatsAppMediaSendTimeoutError,
  whatsappMediaRepository,
} from '../data';
import type { CommWhatsAppChat } from '../domain/types';
import type { PendingAttachment } from '../domain/outgoingMessageTypes';
import { buildMediaSummaryText } from '../domain/inboxPresentation';
import { getQuotePayloadFromMessage } from '../domain/messagePresentation';
import { createClientRequestId } from '../domain/messageRequestId';
import { toast } from '../../../../lib/toast';
import type { MediaUploadProgress } from '../domain/mediaUploadState';
import type { InboxOutgoingMessageRuntime } from './inboxOutgoingMessageRuntime';

type OutgoingQuotePayload = ReturnType<typeof getQuotePayloadFromMessage>;
type CurrentValue<Value> = { current: Value };

type InboxAttachmentSenderOptions = {
  runtime: InboxOutgoingMessageRuntime;
  mediaUploadAbortControllersRef: CurrentValue<Map<string, AbortController>>;
  setMediaUploadProgress: (progress: MediaUploadProgress) => void;
  updateMediaUploadProgress: (chatId: string, attachmentId: string, progress: number | null) => void;
  clearMediaUploadProgress: (chatId: string, attachmentId?: string) => void;
};

export const useInboxAttachmentSender = ({
  runtime,
  mediaUploadAbortControllersRef,
  setMediaUploadProgress,
  updateMediaUploadProgress,
  clearMediaUploadProgress,
}: InboxAttachmentSenderOptions) => {
  const {
    allocateOptimisticMessageTimestamps,
    appendLocalOutgoingMessage,
    applyOptimisticChatSummary,
    buildOptimisticOutgoingMessage,
    enqueueChatSend,
    loadChats,
    loadMessages,
    localOutgoingRetryPayloadRef,
    patchLocalOutgoingMessage,
    refreshableOutboundStatuses,
    scheduleMessageStatusRefresh,
    updateOptimisticChatPreviewStatus,
  } = runtime;

  const sendAttachments = useCallback((
    chat: CommWhatsAppChat,
    attachments: PendingAttachment[],
    captionText: string,
    quotePayload: OutgoingQuotePayload | null,
  ): Promise<void> => {
    const sendChatId = chat.id;
    const optimisticTimestamps = allocateOptimisticMessageTimestamps(sendChatId, attachments.length);
    const attachmentsToSend = attachments.map((attachment, index) => {
      const caption = index === 0 && attachment.kind !== 'voice' ? captionText || undefined : undefined;
      const clientRequestId = createClientRequestId();
      const localPreviewUrl = attachment.previewUrl?.startsWith('blob:')
        ? URL.createObjectURL(attachment.file)
        : attachment.previewUrl ?? null;
      const optimisticMessage = buildOptimisticOutgoingMessage({
        chat,
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
      applyOptimisticChatSummary(chat, optimisticMessage.text_content ?? '', optimisticMessage.message_at);

      return { attachment, caption, optimisticMessage, clientRequestId };
    });

    return enqueueChatSend(sendChatId, async () => {
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
            updateOptimisticChatPreviewStatus(chat.id, queued.optimisticMessage.message_at, 'failed');
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
              chatId: chat.external_chat_id,
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
            updateOptimisticChatPreviewStatus(chat.id, queued.optimisticMessage.message_at, sendResult.status);
            if (sendResult.messageId && refreshableOutboundStatuses.has(sendResult.status.trim().toLowerCase())) {
              scheduleMessageStatusRefresh({ chat, externalMessageIds: [sendResult.messageId] });
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
              updateOptimisticChatPreviewStatus(chat.id, queued.optimisticMessage.message_at, 'sending');
              continue;
            }

            patchLocalOutgoingMessage(queued.optimisticMessage.id, {
              delivery_status: 'failed',
              status_updated_at: new Date().toISOString(),
              error_message: message,
            });
            updateOptimisticChatPreviewStatus(chat.id, queued.optimisticMessage.message_at, 'failed');
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
        void Promise.all([loadMessages(chat, 'send'), loadChats()]).catch((error) => {
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
  }, [allocateOptimisticMessageTimestamps, appendLocalOutgoingMessage, applyOptimisticChatSummary, buildOptimisticOutgoingMessage, clearMediaUploadProgress, enqueueChatSend, loadChats, loadMessages, localOutgoingRetryPayloadRef, mediaUploadAbortControllersRef, patchLocalOutgoingMessage, refreshableOutboundStatuses, scheduleMessageStatusRefresh, setMediaUploadProgress, updateMediaUploadProgress, updateOptimisticChatPreviewStatus]);

  return { sendAttachments };
};
