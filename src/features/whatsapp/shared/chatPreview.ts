import type { WhatsAppChat } from './inboxTypes';

export type ChatPreviewDirection = WhatsAppChat['last_message_direction'];
export type ChatPreviewSource = 'chat-row' | 'message-event' | 'message-history' | 'local-message';

type ChatPreviewState = Pick<WhatsAppChat, 'last_message' | 'last_message_at' | 'last_message_direction'>;

export type ChatPreviewCandidate = {
  preview?: string | null;
  timestamp?: string | null;
  direction?: ChatPreviewDirection;
};

const parsePreviewTimestamp = (value: string | null | undefined) => {
  if (!value) return 0;

  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

const isMessageBackedPreviewSource = (source: ChatPreviewSource) => source !== 'chat-row';

export const sanitizeTechnicalCiphertextPreview = (value: string | null | undefined) => {
  const normalized = (value || '').trim().toLowerCase();
  if (!normalized) return '';

  if (normalized === '[mensagem criptografada]') return '';
  if (normalized === '[ação: label_change]' || normalized === '[acao: label_change]') return '';
  if (normalized.includes('aguardando esta mensagem')) return '';
  if (normalized.includes('waiting for this message')) return '';

  return value?.trim() || '';
};

export const shouldApplyIncomingChatPreview = (
  currentChat: ChatPreviewState | null | undefined,
  incoming: ChatPreviewCandidate,
  source: ChatPreviewSource = 'chat-row',
) => {
  const sanitizedIncomingPreview = sanitizeTechnicalCiphertextPreview(incoming.preview) || null;
  if (!sanitizedIncomingPreview) return false;

  const normalizedCurrentPreview = sanitizeTechnicalCiphertextPreview(currentChat?.last_message) || null;
  if (!normalizedCurrentPreview) return true;

  const currentTime = parsePreviewTimestamp(currentChat?.last_message_at);
  const incomingTime = parsePreviewTimestamp(incoming.timestamp);

  if (incomingTime > currentTime) return true;
  if (incomingTime < currentTime) return false;

  if (isMessageBackedPreviewSource(source)) {
    if (normalizedCurrentPreview !== sanitizedIncomingPreview) {
      return true;
    }

    const currentDirection = currentChat?.last_message_direction ?? null;
    const incomingDirection = incoming.direction ?? null;
    if (incomingDirection && currentDirection !== incomingDirection) {
      return true;
    }

    return true;
  }

  if (normalizedCurrentPreview !== sanitizedIncomingPreview) {
    return false;
  }

  const currentDirection = currentChat?.last_message_direction ?? null;
  const incomingDirection = incoming.direction ?? null;
  if (!currentDirection && incomingDirection) {
    return true;
  }

  return currentDirection === incomingDirection || incomingDirection === null;
};

export const mergeChatPreview = (
  currentChat: ChatPreviewState | null | undefined,
  incoming: ChatPreviewCandidate,
  source: ChatPreviewSource = 'chat-row',
): ChatPreviewState => {
  const sanitizedIncomingPreview = sanitizeTechnicalCiphertextPreview(incoming.preview) || null;
  const shouldUseIncomingPreview = shouldApplyIncomingChatPreview(currentChat, incoming, source);
  const incomingTimestamp = incoming.timestamp ?? null;
  const currentTimestamp = currentChat?.last_message_at ?? null;
  const incomingDirection = incoming.direction ?? null;
  const currentDirection = currentChat?.last_message_direction ?? null;

  return {
    last_message: shouldUseIncomingPreview
      ? sanitizedIncomingPreview ?? currentChat?.last_message ?? null
      : currentChat?.last_message ?? sanitizedIncomingPreview ?? null,
    last_message_direction: shouldUseIncomingPreview
      ? incomingDirection ?? currentDirection
      : currentDirection ?? incomingDirection,
    last_message_at: shouldUseIncomingPreview
      ? incomingTimestamp ?? currentTimestamp
      : currentTimestamp ?? incomingTimestamp,
  };
};
