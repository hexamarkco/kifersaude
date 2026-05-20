import { useEffect, useState } from 'react';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

import { supabase, type CommWhatsAppMessage } from '../../../../lib/supabase';

export const useCommWhatsAppMessageRealtime = (
  selectedChatId: string | null,
  onMessageChange: (payload: RealtimePostgresChangesPayload<CommWhatsAppMessage>) => void,
) => {
  const [readyChatId, setReadyChatId] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedChatId) {
      setReadyChatId(null);
      return;
    }

    let active = true;
    setReadyChatId(null);

    const readyFallbackTimeoutId = window.setTimeout(() => {
      if (active) {
        setReadyChatId(selectedChatId);
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
        }

        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('[WhatsAppInbox] realtime de mensagens indisponivel; polling permanece ativo.');
          setReadyChatId(selectedChatId);
        }
      });

    return () => {
      active = false;
      window.clearTimeout(readyFallbackTimeoutId);
      void supabase.removeChannel(channel);
    };
  }, [onMessageChange, selectedChatId]);

  return readyChatId;
};
