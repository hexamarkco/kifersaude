import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { useEffect, useRef } from 'react';

import { subscribeToInboxChats, subscribeToInboxPresences } from '../data';
import type { CommWhatsAppPresence, CommWhatsAppChat } from '../domain/types';

export const useInboxChannelSubscriptions = ({
  channelId,
  onChatChange,
  onPresenceChange,
}: {
  channelId: string | null;
  onChatChange: (payload: RealtimePostgresChangesPayload<CommWhatsAppChat>) => void;
  onPresenceChange: (payload: RealtimePostgresChangesPayload<CommWhatsAppPresence>) => void;
}) => {
  const onChatChangeRef = useRef(onChatChange);
  onChatChangeRef.current = onChatChange;

  useEffect(() => {
    if (!channelId) return undefined;

    const unsubscribe = subscribeToInboxChats(
      channelId,
      (payload) => onChatChangeRef.current(payload),
      (status) => {
        if (status === 'unavailable') {
          console.warn('[WhatsAppInbox] realtime de chats indisponivel; polling permanece ativo.');
        }
      },
    );

    return unsubscribe;
  }, [channelId]);

  useEffect(() => {
    if (!channelId) return undefined;

    const unsubscribe = subscribeToInboxPresences(
      channelId,
      onPresenceChange,
      (status) => {
        if (status === 'unavailable') {
          console.warn('[WhatsAppInbox] realtime de presencas indisponivel; polling permanece ativo.');
        }
      },
    );

    return unsubscribe;
  }, [channelId, onPresenceChange]);
};
