import { useCallback } from 'react';

import { CommWhatsAppAmbiguousSendError, whatsappMessagesRepository } from '../data';
import type { CommWhatsAppChat, CommWhatsAppMessage } from '../domain/types';
import {
  QUEUED_TEXT_SEND_INTERRUPTED_MESSAGE,
  shouldContinueQueuedTextSendAfterFailure,
} from '../domain/messageSendQueue';
import { getQuotePayloadFromMessage } from '../domain/messagePresentation';
import { createClientRequestId } from '../domain/messageRequestId';
import { toast } from '../../../../lib/toast';
import type { InboxOutgoingMessageRuntime } from './inboxOutgoingMessageRuntime';

type OutgoingQuotePayload = ReturnType<typeof getQuotePayloadFromMessage>;

type InboxTextMessageSenderOptions = {
  selectedChat: CommWhatsAppChat | null;
  sendDisabledReason: string | null;
  runtime: InboxOutgoingMessageRuntime;
};

export const useInboxTextMessageSender = ({
  selectedChat,
  sendDisabledReason,
  runtime,
}: InboxTextMessageSenderOptions) => {
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

  const handleSelectInteractiveReply = useCallback((
    message: CommWhatsAppMessage,
    option: { id: string | null; title: string | null },
  ) => {
    if (!selectedChat || message.direction !== 'inbound') {
      return;
    }

    const replyText = (option.title || option.id || '').trim();
    if (!replyText) {
      return;
    }

    if (sendDisabledReason) {
      toast.error(sendDisabledReason);
      return;
    }

    // A Whapi expoe a leitura e o envio de mensagens interativas, mas nao um
    // endpoint para sintetizar o evento nativo de "button reply" recebido de
    // uma mensagem de terceiros. Enviamos o titulo escolhido como texto, citado
    // na mensagem original — formato que os bots de atendimento usam como
    // fallback e que deixa a escolha visivel no historico.
    void sendTextSegments(selectedChat, [replyText], getQuotePayloadFromMessage(message));
  }, [selectedChat, sendDisabledReason, sendTextSegments]);

  return { sendTextSegments, handleSelectInteractiveReply };
};
