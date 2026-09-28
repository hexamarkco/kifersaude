import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';

import { whatsappMessagesRepository } from '../data';
import { canReplyOrForwardMessage } from '../domain/messagePresentation';
import type { CommWhatsAppChat, CommWhatsAppMessage } from '../domain/types';
import { toast } from '../../../../lib/toast';

type InboxMessageForwardingOptions = {
  forwardTargetChats: CommWhatsAppChat[];
  selectedChatIdRef: { current: string | null };
  latestChatsRef: { current: CommWhatsAppChat[] };
  loadChats: () => Promise<unknown> | void;
  loadMessages: (chat: CommWhatsAppChat, reason: 'send') => Promise<unknown> | void;
  closeMessageActionMenu: () => void;
  setForwardSearch: Dispatch<SetStateAction<string>>;
};

export const useInboxMessageForwarding = ({
  forwardTargetChats,
  selectedChatIdRef,
  latestChatsRef,
  loadChats,
  loadMessages,
  closeMessageActionMenu,
  setForwardSearch,
}: InboxMessageForwardingOptions) => {
  const [forwardingMessage, setForwardingMessage] = useState<CommWhatsAppMessage | null>(null);
  const [forwardingTargetIds, setForwardingTargetIds] = useState<string[]>([]);
  const [forwardingInProgress, setForwardingInProgress] = useState(false);

  const handleOpenForwardMessageModal = useCallback((message: CommWhatsAppMessage) => {
    if (!canReplyOrForwardMessage(message)) {
      toast.error('Esta mensagem não pode ser encaminhada no momento.');
      return;
    }

    setForwardingMessage(message);
    setForwardSearch('');
    setForwardingTargetIds([]);
    closeMessageActionMenu();
  }, [closeMessageActionMenu, setForwardSearch]);

  const handleCloseForwardMessageModal = useCallback(() => {
    setForwardingMessage(null);
    setForwardSearch('');
    setForwardingTargetIds([]);
    setForwardingInProgress(false);
  }, [setForwardSearch]);

  const handleToggleForwardTarget = useCallback((chatId: string) => {
    setForwardingTargetIds((current) => (
      current.includes(chatId) ? current.filter((id) => id !== chatId) : [...current, chatId]
    ));
  }, []);

  const handleForwardToSelectedChats = useCallback(async () => {
    if (!forwardingMessage || forwardingInProgress) {
      return;
    }

    if (forwardingTargetIds.length === 0) {
      toast.error('Selecione pelo menos uma conversa para encaminhar.');
      return;
    }

    setForwardingInProgress(true);

    try {
      const targetChats = forwardTargetChats.filter((chat) => forwardingTargetIds.includes(chat.id));
      const forwardedCount = await whatsappMessagesRepository.forwardToChats(
        forwardingMessage.id,
        targetChats.map((chat) => chat.external_chat_id),
      );

      const affectedChatIds = targetChats.map((chat) => chat.id);
      const reloads: Array<Promise<unknown>> = [Promise.resolve(loadChats())];
      if (selectedChatIdRef.current && affectedChatIds.includes(selectedChatIdRef.current)) {
        const selectedChatSnapshot = latestChatsRef.current.find((chat) => chat.id === selectedChatIdRef.current) ?? null;
        if (selectedChatSnapshot) {
          reloads.push(Promise.resolve(loadMessages(selectedChatSnapshot, 'send')));
        }
      }

      await Promise.all(reloads);

      if (forwardedCount.length > 0) {
        toast.success(`Mensagem encaminhada para ${forwardedCount.length} ${forwardedCount.length === 1 ? 'conversa' : 'conversas'}.`);
      }
      handleCloseForwardMessageModal();
    } catch (error) {
      console.error('[WhatsAppInbox] erro ao encaminhar mensagem', error);
      toast.error(error instanceof Error ? error.message : 'Não foi possível encaminhar a mensagem.');
      setForwardingInProgress(false);
    }
  }, [forwardTargetChats, forwardingInProgress, forwardingMessage, forwardingTargetIds, handleCloseForwardMessageModal, latestChatsRef, loadChats, loadMessages, selectedChatIdRef]);

  return {
    forwardingMessage,
    forwardingTargetIds,
    forwardingInProgress,
    handleOpenForwardMessageModal,
    handleCloseForwardMessageModal,
    handleToggleForwardTarget,
    handleForwardToSelectedChats,
  };
};
