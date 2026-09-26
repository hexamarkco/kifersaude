import { commWhatsAppService } from './commWhatsAppService';

/** Media listing, upload/download and session-local optimistic previews. */
export const whatsappMediaRepository = {
  rememberLocalPreview: commWhatsAppService.rememberLocalMediaPreview,
  getRememberedLocalPreview: commWhatsAppService.getRememberedLocalMediaPreview,
  retainLocalPreview: commWhatsAppService.retainLocalMediaPreview,
  releaseLocalPreview: commWhatsAppService.releaseLocalMediaPreview,
  listPage: commWhatsAppService.listChatMediaPage,
  retry: commWhatsAppService.retryMediaMessage,
  send: commWhatsAppService.sendMediaMessage,
  sendRemote: commWhatsAppService.sendRemoteMediaMessage,
  resolveObjectUrl: commWhatsAppService.resolveMediaObjectUrl,
  releaseObjectUrl: commWhatsAppService.releaseMediaObjectUrl,
};
