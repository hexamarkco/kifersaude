import type { CommWhatsAppMessage } from './types';

const VIDEO_LIKE_MESSAGE_TYPES = new Set(['video', 'gif', 'short']);
const GALLERY_MESSAGE_TYPES = new Set(['image', 'video', 'gif', 'short']);
const EDITABLE_OUTBOUND_MESSAGE_TYPES = new Set(['text', 'image', 'video', 'gif', 'short', 'document']);

const VISIBLE_SUMMARY_MARKERS = new Set([
  '[imagem]',
  '[video]',
  '[documento]',
  '[audio]',
  '[link]',
  '[localizacao]',
  '[sticker]',
  '[contato]',
  '[enquete]',
  '[quiz]',
  '[pergunta]',
  '[evento]',
  '[produto]',
  '[catalogo]',
  '[convite]',
  '[newsletter]',
  '[convite admin]',
  '[sistema]',
  '[chamada]',
  '[fixada]',
  '[status]',
  '[album]',
  '[resposta]',
  '[lista]',
  '[botoes]',
  '[mensagem interativa]',
]);

const HIDDEN_TECHNICAL_MESSAGE_MARKERS = new Set([
  '[mensagem]',
  '[mensagem sem texto]',
  '[mensagem sem conteudo]',
  '[payload invalido]',
  '[acao]',
  '[action]',
  '[reacao]',
  '[reaction]',
  '[atualizacao de midia]',
  '[media update]',
  '[voto em enquete]',
]);

export type ChatPreviewIconType =
  | 'image'
  | 'video'
  | 'audio'
  | 'document'
  | 'link'
  | 'location'
  | 'sticker'
  | 'contact'
  | 'poll'
  | 'interactive'
  | 'list'
  | 'event'
  | 'product'
  | 'system';

export const getUnknownMessageMarker = (messageType: string) => {
  const normalized = messageType.trim().toLowerCase();
  return normalized ? `[${normalized}]` : '[Mensagem sem conteudo]';
};

export const getMessageSummaryMarker = (messageType: string) => {
  const normalized = messageType.trim().toLowerCase();

  if (normalized === 'text') return '[Mensagem]';
  if (normalized === 'image') return '[Imagem]';
  if (VIDEO_LIKE_MESSAGE_TYPES.has(normalized)) return '[Video]';
  if (normalized === 'audio' || normalized === 'voice') return '[Audio]';
  if (normalized === 'document' || normalized === 'documentwithcaption') return '[Documento]';
  if (normalized === 'link_preview') return '[Link]';
  if (normalized === 'location' || normalized === 'live_location') return '[Localizacao]';
  if (normalized === 'sticker') return '[Sticker]';
  if (normalized === 'contact' || normalized === 'contact_list') return '[Contato]';
  if (normalized === 'poll') return '[Enquete]';
  if (normalized === 'quiz') return '[Quiz]';
  if (normalized === 'question') return '[Pergunta]';
  if (normalized === 'event') return '[Evento]';
  if (normalized === 'product') return '[Produto]';
  if (normalized === 'catalog') return '[Catalogo]';
  if (normalized === 'group_invite') return '[Convite]';
  if (normalized === 'newsletter_invite') return '[Newsletter]';
  if (normalized === 'admin_invite') return '[Convite admin]';
  if (normalized === 'system') return '[Sistema]';
  if (normalized === 'call') return '[Chamada]';
  if (normalized === 'pin') return '[Fixada]';
  if (normalized === 'story') return '[Status]';
  if (normalized === 'album') return '[Album]';
  if (normalized === 'reply') return '[Resposta]';
  if (normalized === 'list') return '[Lista]';
  if (normalized === 'buttons') return '[Botoes]';
  if (normalized === 'interactive' || normalized === 'hsm' || normalized === 'carousel') return '[Mensagem interativa]';
  return getUnknownMessageMarker(normalized);
};

export const normalizeTechnicalMarker = (value?: string | null) => String(value ?? '')
  .trim()
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/\s+/g, ' ');

const isBracketOnlyMarker = (value?: string | null) => /^\[[^\]]+\]$/.test(String(value ?? '').trim());

export const isHiddenTechnicalMessageMarker = (value?: string | null, messageType?: string) => {
  const normalized = normalizeTechnicalMarker(value);
  if (!normalized) return false;
  if (HIDDEN_TECHNICAL_MESSAGE_MARKERS.has(normalized)) return true;

  if (messageType?.trim() && normalized === normalizeTechnicalMarker(getMessageSummaryMarker(messageType))) {
    return !VISIBLE_SUMMARY_MARKERS.has(normalized);
  }

  return isBracketOnlyMarker(value) && !VISIBLE_SUMMARY_MARKERS.has(normalized);
};

export const isMessageSummaryMarker = (value?: string | null, messageType?: string) => {
  const normalized = normalizeTechnicalMarker(value);
  if (!normalized) return false;

  if (VISIBLE_SUMMARY_MARKERS.has(normalized) || HIDDEN_TECHNICAL_MESSAGE_MARKERS.has(normalized)) {
    return true;
  }

  return Boolean(messageType?.trim() && normalized === normalizeTechnicalMarker(getMessageSummaryMarker(messageType)));
};

export const getVisiblePreviewText = (value?: string | null, messageType?: string) => (
  isHiddenTechnicalMessageMarker(value, messageType) ? '' : String(value ?? '').trim()
);

export const getChatPreviewIconType = (value: string | null | undefined): ChatPreviewIconType | null => {
  const normalized = normalizeTechnicalMarker(value);

  if (normalized === '[imagem]' || normalized.startsWith('[imagem] ')) return 'image';
  if (normalized === '[video]' || normalized.startsWith('[video] ')) return 'video';
  if (normalized === '[audio]' || normalized.startsWith('[audio] ')) return 'audio';
  if (normalized === '[documento]' || normalized.startsWith('[documento] ')) return 'document';
  if (normalized === '[link]' || normalized.startsWith('[link] ')) return 'link';
  if (normalized === '[localizacao]' || normalized.startsWith('[localizacao] ')) return 'location';
  if (normalized === '[sticker]' || normalized.startsWith('[sticker] ')) return 'sticker';
  if (normalized === '[contato]' || normalized.startsWith('[contato] ')) return 'contact';
  if (normalized === '[enquete]' || normalized.startsWith('[enquete] ')) return 'poll';
  if (normalized === '[quiz]' || normalized.startsWith('[quiz] ')) return 'poll';
  if (normalized === '[pergunta]' || normalized.startsWith('[pergunta] ')) return 'interactive';
  if (normalized === '[evento]' || normalized.startsWith('[evento] ')) return 'event';
  if (normalized === '[produto]' || normalized.startsWith('[produto] ')) return 'product';
  if (normalized === '[catalogo]' || normalized.startsWith('[catalogo] ')) return 'product';
  if (normalized === '[convite]' || normalized.startsWith('[convite] ')) return 'link';
  if (normalized === '[newsletter]' || normalized.startsWith('[newsletter] ')) return 'link';
  if (normalized === '[convite admin]' || normalized.startsWith('[convite admin] ')) return 'link';
  if (normalized === '[sistema]' || normalized.startsWith('[sistema] ')) return 'system';
  if (normalized === '[chamada]' || normalized.startsWith('[chamada] ')) return 'system';
  if (normalized === '[fixada]' || normalized.startsWith('[fixada] ')) return 'interactive';
  if (normalized === '[status]' || normalized.startsWith('[status] ')) return 'interactive';
  if (normalized === '[album]' || normalized.startsWith('[album] ')) return 'image';
  if (normalized === '[resposta]' || normalized.startsWith('[resposta] ')) return 'interactive';
  if (normalized === '[lista]' || normalized.startsWith('[lista] ')) return 'list';
  if (normalized === '[botoes]' || normalized.startsWith('[botoes] ')) return 'interactive';
  if (normalized === '[mensagem interativa]' || normalized.startsWith('[mensagem interativa] ')) return 'interactive';
  return null;
};

export const isVideoLikeMessageType = (messageType: string) => VIDEO_LIKE_MESSAGE_TYPES.has(messageType.trim().toLowerCase());

export const isGalleryMediaMessage = (message: CommWhatsAppMessage) => GALLERY_MESSAGE_TYPES.has(message.message_type.trim().toLowerCase());

export const getMessageVisibleCaption = (message: CommWhatsAppMessage) => {
  const directCaption = String(message.media_caption ?? '').trim();
  if (directCaption && !isMessageSummaryMarker(directCaption, message.message_type) && !isHiddenTechnicalMessageMarker(directCaption, message.message_type)) {
    return directCaption;
  }

  const fallbackText = String(message.text_content ?? '').trim();
  if (!fallbackText || isMessageSummaryMarker(fallbackText, message.message_type) || isHiddenTechnicalMessageMarker(fallbackText, message.message_type)) {
    return '';
  }

  const marker = getMessageSummaryMarker(message.message_type);
  if (message.message_type.trim().toLowerCase() !== 'text' && marker && fallbackText.startsWith(`${marker} `)) {
    return fallbackText.slice(marker.length).trim();
  }

  return fallbackText;
};

export const getMessageEditableText = (message: CommWhatsAppMessage) => (
  message.message_type.trim().toLowerCase() === 'text'
    ? String(message.text_content ?? '').trim()
    : getMessageVisibleCaption(message)
);

export const normalizeComparableMessageText = (messageType: string, value: unknown) => {
  const text = String(value ?? '').trim();
  if (!text || messageType.trim().toLowerCase() === 'text') return text;

  const marker = getMessageSummaryMarker(messageType);
  if (text === marker) return '';
  if (text.startsWith(`${marker} `)) return text.slice(marker.length).trim();
  return text;
};

export const getMessageSearchPreviewText = (message: CommWhatsAppMessage) => {
  const text = getVisiblePreviewText(getMessageEditableText(message), message.message_type);
  const marker = getVisiblePreviewText(getMessageSummaryMarker(message.message_type), message.message_type);
  return text || marker;
};

export const canEditOutboundMessage = (message: CommWhatsAppMessage) => (
  message.direction === 'outbound'
  && Boolean(message.external_message_id?.trim())
  && message.delivery_status.trim().toLowerCase() !== 'deleted'
  && EDITABLE_OUTBOUND_MESSAGE_TYPES.has(message.message_type.trim().toLowerCase())
);

export const canDeleteOutboundMessage = (message: CommWhatsAppMessage) => (
  message.direction === 'outbound'
  && Boolean(message.external_message_id?.trim())
  && message.delivery_status.trim().toLowerCase() !== 'deleted'
);

export const canReplyOrForwardMessage = (message: CommWhatsAppMessage) => (
  message.direction !== 'system'
  && Boolean(message.external_message_id?.trim())
  && message.delivery_status.trim().toLowerCase() !== 'deleted'
);

export const isMessageStarred = (message: CommWhatsAppMessage) => (
  message.metadata && typeof message.metadata === 'object' && !Array.isArray(message.metadata)
    ? message.metadata.starred === true
    : false
);

export const getQuotePayloadFromMessage = (message: CommWhatsAppMessage) => ({
  quotedMessageId: message.external_message_id?.trim() || '',
  quotedPreviewText: getMessageSearchPreviewText(message),
  quotedType: message.message_type.trim().toLowerCase(),
  quotedAuthorPhone: message.sender_phone?.trim() || '',
});

export const normalizeChatDraftPreview = (value: string) => {
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length <= 100 ? normalized : `${normalized.slice(0, 97).trimEnd()}...`;
};

export const normalizeInboxSearch = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim();
