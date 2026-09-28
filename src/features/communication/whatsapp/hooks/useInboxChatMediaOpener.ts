import { useCallback } from 'react';

import { whatsappMediaRepository } from '../data';
import type { CommWhatsAppMessage } from '../domain/types';
import { toast } from '../../../../lib/toast';

export const useInboxChatMediaOpener = () => {
  const handleOpenChatFile = useCallback(async (message: CommWhatsAppMessage) => {
    const mediaId = message.media_id?.trim() || null;
    try {
      const url = await whatsappMediaRepository.resolveObjectUrl({
        mediaId: message.media_id,
        mediaUrl: message.media_url,
      });
      if (!url) {
        if (mediaId) {
          whatsappMediaRepository.releaseObjectUrl(mediaId);
        }
        toast.error('Arquivo indisponível no momento.');
        return;
      }
      window.open(url, '_blank', 'noopener,noreferrer');

      // Give the new tab time to start loading before releasing the temporary URL.
      if (mediaId) {
        window.setTimeout(() => whatsappMediaRepository.releaseObjectUrl(mediaId), 60_000);
      }
    } catch (error) {
      if (mediaId) {
        whatsappMediaRepository.releaseObjectUrl(mediaId);
      }
      console.error('[WhatsAppInbox] erro ao abrir arquivo do chat', error);
      toast.error('Não foi possível abrir este arquivo.');
    }
  }, []);

  return { handleOpenChatFile };
};
