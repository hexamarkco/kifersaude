import { useEffect, useState } from 'react';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

import { supabase, type CommWhatsAppMessage } from '../../../../lib/supabase';

export type CommWhatsAppMessageRealtimeState = {
  readyChatId: string | null;
  /** true somente quando o canal confirmou SUBSCRIBED — falso no fallback de 900ms e em erro/timeout. */
  isRealtimeHealthy: boolean;
};

export const useCommWhatsAppMessageRealtime = (
  selectedChatId: string | null,
  onMessageChange: (payload: RealtimePostgresChangesPayload<CommWhatsAppMessage>) => void,
): CommWhatsAppMessageRealtimeState => {
  const [readyChatId, setReadyChatId] = useState<string | null>(null);
  const [isRealtimeHealthy, setIsRealtimeHealthy] = useState(false);

  useEffect(() => {
    if (!selectedChatId) {
      setReadyChatId(null);
      setIsRealtimeHealthy(false);
      return;
    }

    let active = true;
    setReadyChatId(null);
    setIsRealtimeHealthy(false);

    const readyFallbackTimeoutId = window.setTimeout(() => {
      if (active) {
        setReadyChatId(selectedChatId);
        setIsRealtimeHealthy(false);
      }
    }, 900);

    const channel = supabase
      .channel(`comm-whatsapp-messages-${selectedChatId}-${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'comm_whatsapp_messages',
          filter: `chat_id=eq.${selectedChatId}`,
        },
        onMessageChange,
      )
      .subscribe((status) => {
        if (!active) {
          return;
        }

        if (status === 'SUBSCRIBED') {
          window.clearTimeout(readyFallbackTimeoutId);
          setReadyChatId(selectedChatId);
          setIsRealtimeHealthy(true);
        }

        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          console.warn('[WhatsAppInbox] realtime de mensagens indisponivel; polling permanece ativo.');
          setReadyChatId(selectedChatId);
          setIsRealtimeHealthy(false);
        }
      });

    return () => {
      active = false;
      window.clearTimeout(readyFallbackTimeoutId);
      void supabase.removeChannel(channel);
    };
  }, [onMessageChange, selectedChatId]);

  return { readyChatId, isRealtimeHealthy };
};
