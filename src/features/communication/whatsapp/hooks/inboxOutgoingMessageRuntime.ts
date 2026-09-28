import type { CommWhatsAppMediaSendKind } from '../data';
import type { CommWhatsAppChat, CommWhatsAppMessage } from '../domain/types';
import type { LocalOutgoingRetryPayload } from '../domain/outgoingMessageTypes';

export type OptimisticOutgoingMessageInput = {
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

export type InboxOutgoingMessageRuntime = {
  enqueueChatSend: (chatId: string, task: () => Promise<void>) => Promise<void>;
  allocateOptimisticMessageTimestamps: (chatId: string, count: number) => string[];
  appendLocalOutgoingMessage: (message: CommWhatsAppMessage, retryPayload?: LocalOutgoingRetryPayload) => void;
  applyOptimisticChatSummary: (chat: CommWhatsAppChat, summaryText: string, messageAt: string) => void;
  buildOptimisticOutgoingMessage: (params: OptimisticOutgoingMessageInput) => CommWhatsAppMessage;
  patchLocalOutgoingMessage: (messageId: string, patch: Partial<CommWhatsAppMessage>) => void;
  updateOptimisticChatPreviewStatus: (chatId: string, messageAt: string, deliveryStatus: string) => void;
  loadChats: () => Promise<unknown> | void;
  loadMessages: (chat: CommWhatsAppChat, reason: 'send') => Promise<unknown> | void;
  scheduleMessageStatusRefresh: (params: { chat: CommWhatsAppChat; externalMessageIds: string[] }) => void;
  localOutgoingRetryPayloadRef: { current: Map<string, LocalOutgoingRetryPayload> };
  refreshableOutboundStatuses: ReadonlySet<string>;
};
