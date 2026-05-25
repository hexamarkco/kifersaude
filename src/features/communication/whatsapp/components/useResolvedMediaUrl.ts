import { useState, useEffect } from 'react';
import { commWhatsAppService } from '../../../../lib/commWhatsAppService';
import type { CommWhatsAppMessage } from '../../../../lib/supabase';

export function useResolvedMediaUrl(message: CommWhatsAppMessage) {
  const [mediaUrl, setMediaUrl] = useState<string | null>(
    commWhatsAppService.getRememberedLocalMediaPreview(message.external_message_id)
    ?? (!message.media_id ? message.media_url ?? null : null)
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const rememberedPreview = commWhatsAppService.getRememberedLocalMediaPreview(message.external_message_id);
    if (rememberedPreview) {
      setMediaUrl(rememberedPreview);
      setLoading(false);
      setError(null);
      if (!message.media_id || (message.external_message_id && message.media_id === message.external_message_id)) return () => { active = false; };
    }

    if (message.media_id && message.external_message_id && message.media_id === message.external_message_id) {
      setMediaUrl(null);
      setLoading(false);
      setError(null);
      return () => { active = false; };
    }

    if (!message.media_id) {
      setMediaUrl(message.media_url?.trim() || null);
      setLoading(false);
      setError(null);
      return () => { active = false; };
    }

    setLoading(true);
    setError(null);

    void commWhatsAppService.resolveMediaObjectUrl({ mediaId: message.media_id, mediaUrl: message.media_url })
      .then((resolved) => { if (active) setMediaUrl(resolved); })
      .catch((resolveError) => {
        if (!active) return;
        const resolvedMessage = resolveError instanceof Error ? resolveError.message : 'Não foi possível carregar a mídia.';
        setError(resolvedMessage.includes('specified media not found') ? 'Arquivo indisponível no momento.' : resolvedMessage);
      })
      .finally(() => { if (active) setLoading(false); });

    return () => { active = false; };
  }, [message.external_message_id, message.media_id, message.media_url]);

  return { mediaUrl, loading, error };
}
