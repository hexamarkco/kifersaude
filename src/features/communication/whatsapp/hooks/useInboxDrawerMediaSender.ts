import { useCallback } from 'react';

import { whatsappMediaRepository } from '../data';
import type { CommWhatsAppChat } from '../domain/types';
import { buildMediaSummaryText } from '../domain/inboxPresentation';
import { createClientRequestId } from '../domain/messageRequestId';
import { toast } from '../../../../lib/toast';
import type { InboxOutgoingMessageRuntime } from './inboxOutgoingMessageRuntime';

type InboxDrawerMediaItem = {
  sendKind: 'image' | 'video';
  sendUrl: string;
  title: string;
  mimeType: string;
  previewUrl?: string;
};

type InboxDrawerMediaSenderOptions = {
  selectedChat: CommWhatsAppChat | null;
  disabledReason: string | null;
  runtime: InboxOutgoingMessageRuntime;
  setSendingByChatId: (updater: (current: Record<string, boolean>) => Record<string, boolean>) => void;
};

export const useInboxDrawerMediaSender = ({
  selectedChat,
  disabledReason,
  runtime,
  setSendingByChatId,
}: InboxDrawerMediaSenderOptions) => {
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

  const handleSendDrawerMedia = useCallback(async (item: InboxDrawerMediaItem) => {
    if (!selectedChat) {
      return;
    }

    if (disabledReason) {
      toast.error(disabledReason);
      throw new Error(disabledReason);
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
      setSendingByChatId((current) => ({ ...current, [sendChatId]: true }));

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
        setSendingByChatId((current) => {
          if (!current[sendChatId]) {
            return current;
          }

          const next = { ...current };
          delete next[sendChatId];
          return next;
        });
      }
    });
  }, [allocateOptimisticMessageTimestamps, appendLocalOutgoingMessage, applyOptimisticChatSummary, buildOptimisticOutgoingMessage, disabledReason, enqueueChatSend, loadChats, loadMessages, localOutgoingRetryPayloadRef, patchLocalOutgoingMessage, refreshableOutboundStatuses, scheduleMessageStatusRefresh, selectedChat, setSendingByChatId, updateOptimisticChatPreviewStatus]);

  return { handleSendDrawerMedia };
};
