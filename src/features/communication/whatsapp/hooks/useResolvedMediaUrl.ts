import { useCallback, useEffect, useState } from 'react';

import { whatsappMediaRepository } from '../data';
import type { CommWhatsAppMessage } from '../domain/types';

export function useResolvedMediaUrl(message: CommWhatsAppMessage) {
  const buildMediaRequestKey = (retry: number) => [
    message.external_message_id ?? '',
    message.media_id ?? '',
    message.media_url ?? '',
    retry,
  ].join('\u001f');
  const [mediaUrl, setMediaUrl] = useState<string | null>(whatsappMediaRepository.getRememberedLocalPreview(message.external_message_id) ?? (!message.media_id ? message.media_url ?? null : null));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const mediaRequestKey = buildMediaRequestKey(retryNonce);
  const [resolvedMediaRequestKey, setResolvedMediaRequestKey] = useState(mediaRequestKey);

  useEffect(() => {
    let active = true;
    let retainedLocalPreview = false;
    let retainedMediaObjectUrl = false;

    setResolvedMediaRequestKey(mediaRequestKey);
    setMediaUrl(null);
    setLoading(false);
    setError(null);

    const rememberedPreview = whatsappMediaRepository.retainLocalPreview(message.external_message_id);
    if (rememberedPreview) {
      retainedLocalPreview = true;
      setMediaUrl(rememberedPreview);
      setLoading(false);
      setError(null);

      if (!message.media_id || (message.external_message_id && message.media_id === message.external_message_id)) {
        return () => {
          active = false;
          if (retainedLocalPreview) {
            whatsappMediaRepository.releaseLocalPreview(message.external_message_id);
          }
        };
      }
    }

    if (message.media_id && message.external_message_id && message.media_id === message.external_message_id) {
      setMediaUrl(null);
      setLoading(false);
      setError(null);
      return () => {
        active = false;
        if (retainedLocalPreview) {
          whatsappMediaRepository.releaseLocalPreview(message.external_message_id);
        }
      };
    }

    if (!message.media_id) {
      setMediaUrl(message.media_url?.trim() || null);
      setLoading(false);
      setError(null);
      return () => {
        active = false;
        if (retainedLocalPreview) {
          whatsappMediaRepository.releaseLocalPreview(message.external_message_id);
        }
      };
    }

    setLoading(true);
    setError(null);

    retainedMediaObjectUrl = true;
    void whatsappMediaRepository
      .resolveObjectUrl({ mediaId: message.media_id, mediaUrl: message.media_url, forceRefresh: retryNonce > 0 })
      .then((resolved) => {
        if (!active) return;
        setMediaUrl(resolved);
        if (resolved && retainedLocalPreview) {
          whatsappMediaRepository.releaseLocalPreview(message.external_message_id);
          retainedLocalPreview = false;
        }
      })
      .catch((resolveError) => {
        if (!active) return;
        const resolvedMessage = resolveError instanceof Error ? resolveError.message : 'Não foi possível carregar a mídia.';
        setError(resolvedMessage.includes('specified media not found') ? 'Arquivo indisponível no momento.' : resolvedMessage);
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
      if (retainedLocalPreview) {
        whatsappMediaRepository.releaseLocalPreview(message.external_message_id);
      }
      if (retainedMediaObjectUrl) {
        whatsappMediaRepository.releaseObjectUrl(message.media_id);
      }
    };
  }, [mediaRequestKey, message.external_message_id, message.media_id, message.media_url, retryNonce]);

  const retry = useCallback(() => {
    setError(null);
    setRetryNonce((current) => current + 1);
  }, []);

  const isCurrentMediaRequest = resolvedMediaRequestKey === mediaRequestKey;

  return {
    mediaUrl: isCurrentMediaRequest ? mediaUrl : null,
    loading: isCurrentMediaRequest ? loading : true,
    error: isCurrentMediaRequest ? error : null,
    retry,
  };
}
