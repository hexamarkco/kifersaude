import { useCallback, useMemo, useRef, useState } from 'react';

import { whatsappConversationsRepository } from '../data';
import type { CommWhatsAppChat } from '../domain/types';
import { KeyedActionLock } from '../components/keyedActionLock';
import { toast } from '../../../../lib/toast';

type InboxHistoryRecoveryOptions = {
  selectedChat: CommWhatsAppChat | null;
  sendDisabledReason: string | null;
  loadChats: () => Promise<unknown> | void;
  loadMessages: (chat: CommWhatsAppChat, reason: 'initial') => Promise<unknown> | void;
};

export const useInboxHistoryRecovery = ({
  selectedChat,
  sendDisabledReason,
  loadChats,
  loadMessages,
}: InboxHistoryRecoveryOptions) => {
  const [syncingChatId, setSyncingChatId] = useState<string | null>(null);
  const cursorByChatIdRef = useRef<Map<string, { nextOffset: number; timeTo: number }>>(new Map());
  const recoveryLockRef = useRef(new KeyedActionLock());

  const disabledReason = useMemo(() => {
    if (!selectedChat) {
      return 'Selecione uma conversa para recuperar mensagens antigas.';
    }

    if (!selectedChat.external_chat_id?.trim()) {
      return 'Conversa sem identificador externo para consultar na Whapi.';
    }

    if (syncingChatId === selectedChat.id) {
      return 'Recuperando mensagens antigas pela Whapi...';
    }

    return sendDisabledReason;
  }, [selectedChat, sendDisabledReason, syncingChatId]);

  const handleRecoverHistory = useCallback(async () => {
    if (!selectedChat) {
      return;
    }

    if (disabledReason) {
      toast.error(disabledReason);
      return;
    }

    const targetChat = selectedChat;
    if (!recoveryLockRef.current.tryAcquire(targetChat.id)) {
      return;
    }

    setSyncingChatId(targetChat.id);

    try {
      const savedCursor = cursorByChatIdRef.current.get(targetChat.id);
      let timeTo = savedCursor?.timeTo ?? Math.floor(Date.now() / 1000);
      let offset = savedCursor?.nextOffset ?? 0;
      let pages = 0;
      let imported = 0;
      let hasMore = true;

      while (hasMore && pages < 10) {
        const result = await whatsappConversationsRepository.syncHistory(targetChat.external_chat_id, {
          offset,
          count: 100,
          timeTo,
        });
        imported += result.imported;
        hasMore = result.hasMore && result.nextOffset !== null;
        timeTo = result.timeTo ?? timeTo;
        offset = result.nextOffset ?? offset;
        if (hasMore) {
          cursorByChatIdRef.current.set(targetChat.id, { nextOffset: offset, timeTo });
        } else {
          cursorByChatIdRef.current.delete(targetChat.id);
        }
        pages += 1;
      }

      await Promise.all([loadMessages(targetChat, 'initial'), loadChats()]);

      if (imported > 0) {
        toast.success(
          hasMore
            ? `Histórico sincronizado (${imported} mensagens). Ainda há mais mensagens; execute a recuperação novamente para continuar.`
            : `Histórico sincronizado (${imported} mensagens). Use "Carregar mais" para navegar nas mais antigas.`,
        );
      } else {
        toast.info('A Whapi não retornou mensagens adicionais para esta conversa agora.');
      }
    } catch (error) {
      console.error('[WhatsAppInbox] erro ao recuperar historico do chat', error);
      toast.error(error instanceof Error ? error.message : 'Não foi possível recuperar mais mensagens deste chat.');
    } finally {
      recoveryLockRef.current.release(targetChat.id);
      setSyncingChatId((current) => (current === targetChat.id ? null : current));
    }
  }, [disabledReason, loadChats, loadMessages, selectedChat]);

  return {
    syncingChatId,
    disabledReason,
    handleRecoverHistory,
  };
};
