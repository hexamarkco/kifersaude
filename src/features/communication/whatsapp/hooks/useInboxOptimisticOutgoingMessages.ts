import { useCallback, useEffect, useRef, useState } from 'react';

import { whatsappMediaRepository, type CommWhatsAppMediaSendKind } from '../data';
import type { CommWhatsAppChat, CommWhatsAppMessage } from '../domain/types';
import {
  getMessageClientOrderAt,
  getMessageClientRequestId,
  getMessageMetadataRecord,
  messagesReferToSameOutgoing,
} from '../domain/messageMetadata';
import { mergeMessages } from '../domain/messageTimeline';
import type { LocalOutgoingRetryPayload } from '../domain/outgoingMessageTypes';
import { mergeCommWhatsAppMessage } from '../messageStatus';

type CurrentValue<Value> = { current: Value };

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

type InboxOptimisticOutgoingMessagesOptions = {
  selectedChatIdRef: CurrentValue<string | null>;
  pendingScrollModeRef: CurrentValue<'bottom' | 'preserve' | 'prepend' | null>;
  pendingScrollTopRef: CurrentValue<number | null>;
  pendingScrollHeightRef: CurrentValue<number | null>;
};

const createLocalOutgoingMessageId = () => `local-message-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const useInboxOptimisticOutgoingMessages = ({
  selectedChatIdRef,
  pendingScrollModeRef,
  pendingScrollTopRef,
  pendingScrollHeightRef,
}: InboxOptimisticOutgoingMessagesOptions) => {
  const [localOutgoingMessages, setLocalOutgoingMessages] = useState<CommWhatsAppMessage[]>([]);
  const localOutgoingMessagesRef = useRef<CommWhatsAppMessage[]>([]);
  const localOutgoingRetryPayloadRef = useRef(new Map<string, LocalOutgoingRetryPayload>());
  const localOutgoingMediaPreviewUrlsRef = useRef(new Map<string, string>());
  const outgoingMessageOrderAtByExternalIdRef = useRef(new Map<string, string>());
  const outgoingMessageOrderAtByClientRequestIdRef = useRef(new Map<string, string>());

  useEffect(() => {
    localOutgoingMessagesRef.current = localOutgoingMessages;
  }, [localOutgoingMessages]);

  const rememberOutgoingMessageOrder = useCallback((message: CommWhatsAppMessage) => {
    const orderAt = getMessageClientOrderAt(message) || message.message_at;
    if (!orderAt) {
      return;
    }

    const externalMessageId = String(message.external_message_id ?? '').trim();
    if (externalMessageId) {
      outgoingMessageOrderAtByExternalIdRef.current.set(externalMessageId, orderAt);
    }

    const clientRequestId = getMessageClientRequestId(message);
    if (clientRequestId) {
      outgoingMessageOrderAtByClientRequestIdRef.current.set(clientRequestId, orderAt);
    }
  }, []);

  const applyOutgoingOrderToServerMessage = useCallback((message: CommWhatsAppMessage) => {
    if (message.direction !== 'outbound') {
      return message;
    }

    if (getMessageClientOrderAt(message)) {
      return message;
    }

    const externalMessageId = String(message.external_message_id ?? '').trim();
    const clientRequestId = getMessageClientRequestId(message);
    const orderAt = (externalMessageId ? outgoingMessageOrderAtByExternalIdRef.current.get(externalMessageId) : null)
      ?? (clientRequestId ? outgoingMessageOrderAtByClientRequestIdRef.current.get(clientRequestId) : null)
      ?? null;

    if (!orderAt) {
      return message;
    }

    return {
      ...message,
      metadata: {
        ...getMessageMetadataRecord(message),
        client_order_at: orderAt,
      },
    };
  }, []);

  const patchLocalOutgoingMessage = useCallback((messageId: string, patch: Partial<CommWhatsAppMessage>) => {
    setLocalOutgoingMessages((current) => current.map((message) => {
      if (message.id !== messageId) {
        return message;
      }

      const patchMessage = {
        ...message,
        ...patch,
        metadata: {
          ...message.metadata,
          ...(patch.metadata ?? {}),
        },
      };
      const nextMessage = mergeCommWhatsAppMessage(message, patchMessage);
      rememberOutgoingMessageOrder(nextMessage);
      return nextMessage;
    }));
  }, [rememberOutgoingMessageOrder]);

  const removeLocalOutgoingMessage = useCallback((messageId: string) => {
    setLocalOutgoingMessages((current) => {
      const removedMessage = current.find((message) => message.id === messageId) ?? null;
      const previewUrl = localOutgoingMediaPreviewUrlsRef.current.get(messageId);
      const externalMessageId = String(removedMessage?.external_message_id ?? '').trim();

      if (previewUrl?.startsWith('blob:') && !externalMessageId) {
        URL.revokeObjectURL(previewUrl);
      }

      localOutgoingMediaPreviewUrlsRef.current.delete(messageId);
      return current.filter((message) => message.id !== messageId);
    });
    localOutgoingRetryPayloadRef.current.delete(messageId);
  }, []);

  const appendLocalOutgoingMessage = useCallback((message: CommWhatsAppMessage, retryPayload?: LocalOutgoingRetryPayload) => {
    rememberOutgoingMessageOrder(message);
    if (selectedChatIdRef.current === message.chat_id) {
      pendingScrollModeRef.current = 'bottom';
      pendingScrollTopRef.current = null;
      pendingScrollHeightRef.current = null;
    }

    setLocalOutgoingMessages((current) => mergeMessages(current, [message]));
    if (retryPayload) {
      localOutgoingRetryPayloadRef.current.set(message.id, retryPayload);
    }

    if (message.media_url?.startsWith('blob:')) {
      localOutgoingMediaPreviewUrlsRef.current.set(message.id, message.media_url);
    }
  }, [pendingScrollHeightRef, pendingScrollModeRef, pendingScrollTopRef, rememberOutgoingMessageOrder, selectedChatIdRef]);

  const buildOptimisticOutgoingMessage = useCallback((params: OptimisticOutgoingMessageInput): CommWhatsAppMessage => {
    const nowIso = params.messageAt ?? new Date().toISOString();

    return {
      id: createLocalOutgoingMessageId(),
      chat_id: params.chat.id,
      channel_id: params.chat.channel_id,
      external_message_id: null,
      direction: 'outbound',
      message_type: params.messageType,
      delivery_status: 'pending',
      text_content: params.textContent,
      message_at: nowIso,
      created_by: null,
      source: 'local',
      sender_name: null,
      sender_phone: null,
      status_updated_at: nowIso,
      error_message: null,
      media_id: null,
      media_url: params.mediaUrl ?? null,
      media_mime_type: params.mediaMimeType ?? null,
      media_file_name: params.mediaFileName ?? null,
      media_size_bytes: params.mediaSizeBytes ?? null,
      media_duration_seconds: params.mediaDurationSeconds ?? null,
      media_caption: params.mediaCaption ?? null,
      transcription_text: null,
      transcription_status: null,
      transcription_provider: null,
      transcription_model: null,
      transcription_error: null,
      transcription_updated_at: null,
      metadata: {
        local_outgoing: true,
        client_order_at: nowIso,
        ...(params.clientRequestId ? { client_request_id: params.clientRequestId } : {}),
        ...params.metadata,
      },
      created_at: nowIso,
    };
  }, []);

  const reconcileLocalOutgoingMessages = useCallback((chatId: string, serverMessages: CommWhatsAppMessage[]) => {
    if (serverMessages.length === 0) {
      return;
    }

    setLocalOutgoingMessages((current) => {
      let changed = false;
      const nextLocalMessages = current.filter((message) => {
        if (message.chat_id !== chatId) {
          return true;
        }

        const syncedServerMessage = serverMessages.find((serverMessage) => (
          messagesReferToSameOutgoing(message, serverMessage)
        )) ?? null;
        if (!syncedServerMessage) {
          return true;
        }

        changed = true;
        rememberOutgoingMessageOrder(message);
        localOutgoingRetryPayloadRef.current.delete(message.id);
        const previewUrl = localOutgoingMediaPreviewUrlsRef.current.get(message.id);
        const externalMessageId = String(syncedServerMessage.external_message_id ?? message.external_message_id ?? '').trim();
        if (previewUrl && externalMessageId) {
          whatsappMediaRepository.rememberLocalPreview(externalMessageId, previewUrl);
        }
        localOutgoingMediaPreviewUrlsRef.current.delete(message.id);
        return false;
      });

      return changed ? nextLocalMessages : current;
    });
  }, [rememberOutgoingMessageOrder]);

  const clearLocalOutgoingResources = useCallback(() => {
    for (const [messageId, previewUrl] of localOutgoingMediaPreviewUrlsRef.current.entries()) {
      const message = localOutgoingMessagesRef.current.find((item) => item.id === messageId);
      const externalMessageId = String(message?.external_message_id ?? '').trim();

      if (externalMessageId) {
        // A mensagem já recebeu ID do WhatsApp; o cache compartilhado assume
        // a prévia por alguns segundos para não quebrar uma confirmação tardia.
        whatsappMediaRepository.rememberLocalPreview(externalMessageId, previewUrl);
      } else if (previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    }

    localOutgoingMediaPreviewUrlsRef.current.clear();
    localOutgoingRetryPayloadRef.current.clear();
    localOutgoingMessagesRef.current = [];
  }, []);

  useEffect(() => () => clearLocalOutgoingResources(), [clearLocalOutgoingResources]);

  return {
    localOutgoingMessages,
    setLocalOutgoingMessages,
    localOutgoingMessagesRef,
    localOutgoingRetryPayloadRef,
    localOutgoingMediaPreviewUrlsRef,
    rememberOutgoingMessageOrder,
    applyOutgoingOrderToServerMessage,
    patchLocalOutgoingMessage,
    removeLocalOutgoingMessage,
    appendLocalOutgoingMessage,
    buildOptimisticOutgoingMessage,
    reconcileLocalOutgoingMessages,
  };
};
