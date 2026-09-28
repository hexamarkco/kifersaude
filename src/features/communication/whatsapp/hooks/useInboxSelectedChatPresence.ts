import { useEffect, type Dispatch, type SetStateAction } from 'react';

import { commWhatsAppService } from '../data';
import type { CommWhatsAppChat } from '../domain/types';
import { applyChatPresenceUpdate } from '../domain/chatPresentation';
import { isSupabaseConnectivityError } from '../../../../infrastructure/supabase';

type InboxSelectedChatPresenceOptions = {
  selectedChatId: string | null;
  setChats: Dispatch<SetStateAction<CommWhatsAppChat[]>>;
};

export const useInboxSelectedChatPresence = ({ selectedChatId, setChats }: InboxSelectedChatPresenceOptions) => {
  useEffect(() => {
    if (!selectedChatId) {
      return undefined;
    }

    let active = true;

    void commWhatsAppService.ensureChatPresence(selectedChatId)
      .then((result) => {
        if (!active) {
          return;
        }

        setChats((current) => applyChatPresenceUpdate(current, {
          chatId: selectedChatId,
          status: result.presence?.status ?? null,
          lastSeenAt: result.presence?.last_seen_at ?? null,
          updatedAt: result.presence?.observed_at ?? null,
        }));
      })
      .catch((error) => {
        if (!active || isSupabaseConnectivityError(error)) {
          return;
        }
        console.warn('[WhatsAppInbox] nao foi possivel ativar presenca da conversa', error);
      });

    return () => {
      active = false;
    };
  }, [selectedChatId, setChats]);
};
