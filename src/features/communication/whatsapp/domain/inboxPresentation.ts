import type { CommWhatsAppMediaSendKind } from '../data';
import type { CommWhatsAppChat, CommWhatsAppMessage } from './types';
import { getMessageMetadataRecord } from './messageMetadata';
import { getMessageVisibleCaption, isGalleryMediaMessage } from './messagePresentation';
import { isPdfDocumentMessage } from './messageMediaPresentation';
import type { MediaUploadProgress } from './mediaUploadState';

export type InboxPendingAttachment = {
  id: string;
  file: File;
  kind: CommWhatsAppMediaSendKind;
  durationSeconds?: number;
  previewUrl?: string | null;
  waveform?: number[];
  waveformPayload?: string | null;
};

export const buildMediaSummaryText = (kind: CommWhatsAppMediaSendKind | 'document') => {
  if (kind === 'image') return '[Imagem]';
  if (kind === 'video') return '[Video]';
  if (kind === 'audio' || kind === 'voice') return '[Audio]';
  return '[Documento]';
};

export const buildComposerQueueSnapshotKey = (
  chatId: string,
  text: string,
  attachments: Array<Pick<InboxPendingAttachment, 'id' | 'file' | 'kind'>>,
) => {
  const attachmentKey = attachments
    .map((attachment) => `${attachment.id}:${attachment.file.name}:${attachment.file.size}:${attachment.kind}`)
    .join('|');

  return `${chatId}:${text}:${attachmentKey}`;
};

export const formatConnectionStatusLabel = (value?: string | null, fallback = 'Indisponível') => {
  const normalized = String(value ?? '').trim().toUpperCase();

  if (!normalized) {
    return fallback;
  }

  switch (normalized) {
    case 'AUTH':
      return 'Conectado';
    case 'QR':
      return 'Aguardando QR';
    case 'LAUNCH':
      return 'Conectando';
    case 'INIT':
      return 'Inicializando';
    case 'STOP':
      return 'Parado';
    case 'DISCONNECTED':
      return 'Desconectado';
    default:
      return normalized;
  }
};

export const getMessageBubbleClasses = (direction: CommWhatsAppMessage['direction']) => {
  if (direction === 'outbound') {
    return 'message-bubble message-bubble-outbound ml-auto';
  }

  if (direction === 'system') {
    return 'message-bubble message-bubble-system mx-auto';
  }

  return 'message-bubble message-bubble-inbound mr-auto';
};

export const getMessageRowClasses = (direction: CommWhatsAppMessage['direction']) => {
  if (direction === 'outbound') {
    return 'message-bubble-row-outbound justify-end';
  }

  if (direction === 'system') {
    return 'message-bubble-row-system justify-center';
  }

  return 'message-bubble-row-inbound justify-start';
};

const isWhapiGroupChatId = (value: unknown) => String(value ?? '').trim().toLowerCase().endsWith('@g.us');

export const isGroupChatMessage = (chat: CommWhatsAppChat, message: CommWhatsAppMessage) => (
  message.direction !== 'system'
  && (
    isWhapiGroupChatId(chat.external_chat_id)
    || isWhapiGroupChatId(getMessageMetadataRecord(message).chat_id)
  )
);

export const isVisualMediaMessage = (message: CommWhatsAppMessage) => {
  const kind = message.message_type.trim().toLowerCase();
  return isGalleryMediaMessage(message) || kind === 'sticker' || isPdfDocumentMessage(message);
};

export const isAudioMessage = (message: CommWhatsAppMessage) => {
  const kind = message.message_type.trim().toLowerCase();
  return kind === 'audio' || kind === 'voice';
};

export const isBubblelessMediaMessage = (message: CommWhatsAppMessage) => (
  isVisualMediaMessage(message) || isAudioMessage(message)
);

export const isMediaMessage = (message: CommWhatsAppMessage) => {
  const kind = message.message_type.trim().toLowerCase();
  return isBubblelessMediaMessage(message) || kind === 'document';
};

export const isMediaSendingMessage = (
  message: CommWhatsAppMessage,
  mediaUploadProgress: MediaUploadProgress | null,
  retrying = false,
) => (
  message.direction === 'outbound'
  && isMediaMessage(message)
  && (
    ['pending', 'queued', 'sending'].includes(message.delivery_status.trim().toLowerCase())
    || (mediaUploadProgress?.chatId === message.chat_id && mediaUploadProgress.attachmentId === message.id)
    || retrying
  )
);

export const hasVisualMediaCaption = (message: CommWhatsAppMessage) => (
  isVisualMediaMessage(message) && Boolean(getMessageVisibleCaption(message))
);

const createPendingAttachmentId = () => `attachment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const inferAttachmentKind = (file: File): CommWhatsAppMediaSendKind => {
  if (file.type.startsWith('image/')) {
    return 'image';
  }

  if (file.type.startsWith('video/')) {
    return 'video';
  }

  if (file.type.startsWith('audio/')) {
    return 'audio';
  }

  return 'document';
};

export const createPendingAttachmentFromFile = (file: File): InboxPendingAttachment => {
  const kind = inferAttachmentKind(file);
  return {
    id: createPendingAttachmentId(),
    file,
    kind,
    previewUrl: kind === 'image' || kind === 'video' ? URL.createObjectURL(file) : null,
  };
};

export const normalizePastedImageFile = (file: File, index: number) => {
  if (file.name.trim()) {
    return file;
  }

  const extension = file.type.split('/')[1]?.split(';')[0] || 'png';
  return new File([file], `imagem-colada-${Date.now()}-${index + 1}.${extension}`, { type: file.type || 'image/png' });
};
