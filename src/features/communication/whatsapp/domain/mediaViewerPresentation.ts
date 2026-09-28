import type { CommWhatsAppMessage } from './types';
import { isVideoLikeMessageType } from './messagePresentation';

export const isChatMediaViewerMessage = (message: CommWhatsAppMessage) => {
  const kind = message.message_type.trim().toLowerCase();
  return (kind === 'image' || isVideoLikeMessageType(kind)) && message.delivery_status.trim().toLowerCase() !== 'deleted';
};
