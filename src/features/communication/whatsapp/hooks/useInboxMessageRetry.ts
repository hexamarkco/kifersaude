import { useCallback, useRef, type Dispatch, type SetStateAction } from 'react';

import {
  CommWhatsAppAmbiguousSendError,
  CommWhatsAppMediaSendTimeoutError,
  whatsappMediaRepository,
  whatsappMessagesRepository,
} from '../data';
import type { CommWhatsAppChat, CommWhatsAppMessage } from '../domain/types';
import { createClientRequestId } from '../domain/messageRequestId';
import type { LocalOutgoingRetryPayload } from '../domain/outgoingMessageTypes';
import { toast } from '../../../../lib/toast';

type MessageRetryOptions = {
  selectedChat: CommWhatsAppChat | null;
  localOutgoingRetryPayloadRef: { current: Map<string, LocalOutgoingRetryPayload> };
  setRetryingMessageId: Dispatch<SetStateAction<string | null>>;
  refreshableOutboundStatuses: ReadonlySet<string>;
  enqueueChatSend: (chatId: string, task: () => Promise<void>) => Promise<void>;
  patchLocalOutgoingMessage: (messageId: string, patch: Partial<CommWhatsAppMessage>) => void;
  removeLocalOutgoingMessage: (messageId: string) => void;
  loadChats: () => Promise<unknown> | void;
  loadMessages: (chat: CommWhatsAppChat, reason: 'send') => Promise<unknown> | void;
  scheduleMessageStatusRefresh: (params: { chat: CommWhatsAppChat; externalMessageIds: string[] }) => void;
};

export const useInboxMessageRetry = ({
  selectedChat,
  localOutgoingRetryPayloadRef,
  setRetryingMessageId,
  refreshableOutboundStatuses,
  enqueueChatSend,
  patchLocalOutgoingMessage,
  removeLocalOutgoingMessage,
  loadChats,
  loadMessages,
  scheduleMessageStatusRefresh,
}: MessageRetryOptions) => {
  const retryingMessageIdsRef = useRef<Set<string>>(new Set());

  const handleRetryMediaMessage = useCallback(async (message: CommWhatsAppMessage) => {
    if (retryingMessageIdsRef.current.has(message.id)) {
      return;
    }

    const targetChat = selectedChat;
    if (!targetChat || targetChat.id !== message.chat_id) {
      return;
    }

    retryingMessageIdsRef.current.add(message.id);
    setRetryingMessageId(message.id);

    try {
      await enqueueChatSend(targetChat.id, async () => {
        const localRetryPayload = localOutgoingRetryPayloadRef.current.get(message.id);

        if (localRetryPayload) {
          let keepRetryPayload = false;
          patchLocalOutgoingMessage(message.id, {
            delivery_status: 'pending',
            status_updated_at: new Date().toISOString(),
            error_message: null,
          });

          const retryClientRequestId = localRetryPayload.clientRequestId || createClientRequestId();
          if (!localRetryPayload.clientRequestId) {
            localOutgoingRetryPayloadRef.current.set(message.id, {
              ...localRetryPayload,
              clientRequestId: retryClientRequestId,
            });
          }

          if (localRetryPayload.kind === 'text') {
            const sendResult = await whatsappMessagesRepository.sendText(targetChat.external_chat_id, localRetryPayload.text, {
              clientRequestId: retryClientRequestId,
            });
            patchLocalOutgoingMessage(message.id, {
              external_message_id: sendResult.messageId,
              delivery_status: sendResult.status,
              status_updated_at: new Date().toISOString(),
              error_message: null,
            });
            if (sendResult.messageId && refreshableOutboundStatuses.has(sendResult.status.trim().toLowerCase())) {
              scheduleMessageStatusRefresh({ chat: targetChat, externalMessageIds: [sendResult.messageId] });
            }
            keepRetryPayload = !sendResult.messageId && sendResult.status.trim().toLowerCase() === 'sending';
          } else if (localRetryPayload.kind === 'media') {
            const sendResult = await whatsappMediaRepository.send({
              chatId: targetChat.external_chat_id,
              kind: localRetryPayload.mediaKind,
              file: localRetryPayload.file,
              caption: localRetryPayload.caption,
              durationSeconds: localRetryPayload.durationSeconds,
              waveform: localRetryPayload.waveform,
              clientRequestId: retryClientRequestId,
            });
            if (message.media_url && sendResult.messageId) {
              whatsappMediaRepository.rememberLocalPreview(sendResult.messageId, message.media_url);
            }
            patchLocalOutgoingMessage(message.id, {
              external_message_id: sendResult.messageId,
              delivery_status: sendResult.status,
              status_updated_at: new Date().toISOString(),
              error_message: null,
            });
            if (sendResult.messageId && refreshableOutboundStatuses.has(sendResult.status.trim().toLowerCase())) {
              scheduleMessageStatusRefresh({ chat: targetChat, externalMessageIds: [sendResult.messageId] });
            }
            keepRetryPayload = !sendResult.messageId && sendResult.status.trim().toLowerCase() === 'sending';
          } else {
            const sendResult = await whatsappMediaRepository.sendRemote({
              chatId: targetChat.external_chat_id,
              kind: localRetryPayload.mediaKind,
              remoteUrl: localRetryPayload.remoteUrl,
              fileName: localRetryPayload.fileName,
              mimeType: localRetryPayload.mimeType,
              caption: localRetryPayload.caption,
              clientRequestId: retryClientRequestId,
            });
            patchLocalOutgoingMessage(message.id, {
              external_message_id: sendResult.messageId,
              delivery_status: sendResult.status,
              status_updated_at: new Date().toISOString(),
              error_message: null,
            });
            if (sendResult.messageId && refreshableOutboundStatuses.has(sendResult.status.trim().toLowerCase())) {
              scheduleMessageStatusRefresh({ chat: targetChat, externalMessageIds: [sendResult.messageId] });
            }
            keepRetryPayload = !sendResult.messageId && sendResult.status.trim().toLowerCase() === 'sending';
          }

          if (!keepRetryPayload) {
            localOutgoingRetryPayloadRef.current.delete(message.id);
          }
          await Promise.all([loadMessages(targetChat, 'send'), loadChats()]);
          return;
        }

        if (!message.media_id) {
          removeLocalOutgoingMessage(message.id);
          toast.error('Não foi possível reenviar esta mensagem local.');
          return;
        }

        await whatsappMediaRepository.retry(message.id, {
          clientRequestId: createClientRequestId(),
        });
        await Promise.all([loadMessages(targetChat, 'send'), loadChats()]);
      });
    } catch (error) {
      console.error('[WhatsAppInbox] erro ao reenviar mensagem', error);
      const messageText = error instanceof Error ? error.message : 'Não foi possível reenviar a mensagem.';
      if (error instanceof CommWhatsAppMediaSendTimeoutError || error instanceof CommWhatsAppAmbiguousSendError) {
        patchLocalOutgoingMessage(message.id, {
          delivery_status: 'sending',
          status_updated_at: new Date().toISOString(),
          error_message: 'Envio ainda em confirmação. Evite reenviar por enquanto.',
        });
        toast.info('Envio ainda em confirmação. Aguarde antes de reenviar.');
        void Promise.all([loadMessages(targetChat, 'send'), loadChats()]).catch((refreshError) => {
          console.error('[WhatsAppInbox] erro ao atualizar conversa apos timeout de reenvio', refreshError);
        });
        return;
      }

      if (localOutgoingRetryPayloadRef.current.has(message.id)) {
        patchLocalOutgoingMessage(message.id, {
          delivery_status: 'failed',
          status_updated_at: new Date().toISOString(),
          error_message: messageText,
        });
      } else {
        toast.error(messageText);
      }
    } finally {
      retryingMessageIdsRef.current.delete(message.id);
      setRetryingMessageId((current) => (current === message.id ? null : current));
    }
  }, [enqueueChatSend, loadChats, loadMessages, localOutgoingRetryPayloadRef, patchLocalOutgoingMessage, refreshableOutboundStatuses, removeLocalOutgoingMessage, scheduleMessageStatusRefresh, selectedChat, setRetryingMessageId]);

  return { handleRetryMediaMessage };
};
