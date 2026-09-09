import {
  getMessageContactCardInfo,
  getMessageLinkPreview,
  hasMessageQuote,
} from './messageMetadata';
import {
  getMessageVisibleCaption,
  isHiddenTechnicalMessageMarker,
  normalizeTechnicalMarker,
} from './messagePresentation';
import type { CommWhatsAppMessage } from './types';

const REDUNDANT_ACTION_MESSAGE_MARKERS = new Set([
  '[acao]',
  '[reacao]',
  '[mensagem apagada]',
  '[atualizacao de midia]',
  '[voto em enquete]',
]);

export const shouldHideTechnicalMessage = (message: CommWhatsAppMessage) => {
  const messageType = message.message_type.trim().toLowerCase();
  const textContent = String(message.text_content ?? '').trim();

  if (messageType === 'action') {
    const normalizedText = normalizeTechnicalMarker(textContent);
    return !normalizedText
      || REDUNDANT_ACTION_MESSAGE_MARKERS.has(normalizedText)
      || isHiddenTechnicalMessageMarker(textContent, message.message_type);
  }

  if (!isHiddenTechnicalMessageMarker(textContent, message.message_type)) return false;

  const hasRenderableMedia = Boolean(message.media_id || message.media_url);
  const hasVisibleCaption = Boolean(getMessageVisibleCaption(message));
  const hasStructuredPreview = Boolean(
    getMessageLinkPreview(message)
    || getMessageContactCardInfo(message)
    || hasMessageQuote(message),
  );

  return !hasRenderableMedia && !hasVisibleCaption && !hasStructuredPreview;
};
