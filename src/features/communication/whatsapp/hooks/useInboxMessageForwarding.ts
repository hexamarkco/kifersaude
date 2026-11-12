import { useCallback, useRef, useState, type Dispatch, type SetStateAction } from 'react';

import { whatsappMessagesRepository } from '../data';
import { canReplyOrForwardMessage } from '../domain/messagePresentation';
import { compareMessageChronology } from '../domain/messageTimeline';
import type { CommWhatsAppChat, CommWhatsAppMessage } from '../domain/types';
import { toast } from '../../../../lib/toast';

type InboxMessageForwardingOptions = {
  selectedChatId: string | null;
  selectedChatIdRef: { current: string | null };
  latestChatsRef: { current: CommWhatsAppChat[] };
  loadChats: () => Promise<unknown> | void;
  loadMessages: (chat: CommWhatsAppChat, reason: 'send') => Promise<unknown> | void;
  closeMessageActionMenu: () => void;
  setForwardSearch: Dispatch<SetStateAction<string>>;
};

export const useInboxMessageForwarding = ({
  selectedChatId,
  selectedChatIdRef,
  latestChatsRef,
  loadChats,
  loadMessages,
  closeMessageActionMenu,
  setForwardSearch,
}: InboxMessageForwardingOptions) => {
  const [selection, setSelection] = useState<{
    chatId: string;
    messages: CommWhatsAppMessage[];
    choosingTargets: boolean;
  } | null>(null);
  const [forwardingTargetIds, setForwardingTargetIds] = useState<string[]>([]);
  const [forwardingInProgress, setForwardingInProgress] = useState(false);
  const sendingRef = useRef(false);

  // A selection belongs to one conversation and must not return when navigating back.
  if (selection && selection.chatId !== selectedChatId) {
    setSelection(null);
    setForwardingTargetIds([]);
  }

  const forwardingMessages = selection?.messages ?? [];
  const selectingMessagesToForward = Boolean(selection && !selection.choosingTargets);
  const forwardDialogOpen = Boolean(selection?.choosingTargets);

  const handleOpenForwardMessageModal = useCallback((message: CommWhatsAppMessage) => {
    if (sendingRef.current || message.chat_id !== selectedChatId) return;
    if (!canReplyOrForwardMessage(message)) {
      toast.error('Esta mensagem não pode ser encaminhada no momento.');
      return;
    }

    setSelection({ chatId: message.chat_id, messages: [message], choosingTargets: false });
    setForwardSearch('');
    setForwardingTargetIds([]);
    closeMessageActionMenu();
  }, [closeMessageActionMenu, selectedChatId, setForwardSearch]);

  const handleCloseForwardMessageModal = useCallback(() => {
    if (sendingRef.current) return;
    setSelection(null);
    setForwardSearch('');
    setForwardingTargetIds([]);
    setForwardingInProgress(false);
  }, [setForwardSearch]);

  const handleToggleForwardMessage = useCallback((message: CommWhatsAppMessage) => {
    if (sendingRef.current || !canReplyOrForwardMessage(message)) return;
    setSelection((current) => {
      if (!current || current.choosingTargets || current.chatId !== message.chat_id) return current;
      const messages = current.messages.some((item) => item.id === message.id)
        ? current.messages.filter((item) => item.id !== message.id)
        : [...current.messages, message].sort(compareMessageChronology);
      return { ...current, messages };
    });
  }, []);

  const handleChooseForwardTargets = useCallback(() => {
    if (sendingRef.current) return;
    setSelection((current) => current && current.messages.length > 0
      ? { ...current, choosingTargets: true }
      : current);
  }, []);

  const handleBackToForwardSelection = useCallback(() => {
    if (sendingRef.current) return;
    setSelection((current) => current ? { ...current, choosingTargets: false } : null);
  }, []);

  const handleToggleForwardTarget = useCallback((chatId: string) => {
    if (sendingRef.current) return;
    setForwardingTargetIds((current) => (
      current.includes(chatId) ? current.filter((id) => id !== chatId) : [...current, chatId]
    ));
  }, []);

  const handleForwardToSelectedChats = useCallback(async () => {
    if (!selection?.choosingTargets || selection.messages.length === 0 || sendingRef.current) {
      return;
    }
    const forwardingMessages = selection.messages;

    if (forwardingTargetIds.length === 0) {
      toast.error('Selecione pelo menos uma conversa para encaminhar.');
      return;
    }

    const targetChats = latestChatsRef.current.filter((chat) => forwardingTargetIds.includes(chat.id) && chat.external_chat_id?.trim());
    if (targetChats.length !== forwardingTargetIds.length) {
      toast.error('Uma conversa de destino não está mais disponível. Selecione os destinos novamente.');
      return;
    }
    if (targetChats.length > 20) {
      toast.error('Selecione no máximo 20 conversas por encaminhamento.');
      return;
    }

    sendingRef.current = true;
    setForwardingInProgress(true);
    const completedMessageIds = new Set<string>();

    try {
      // Keep each recipient's messages in conversation order.
      for (const message of forwardingMessages) {
        const forwarded = await whatsappMessagesRepository.forwardToChats(
          message.id,
          targetChats.map((chat) => chat.external_chat_id),
        );
        if (forwarded.length !== targetChats.length) {
          throw new Error('O encaminhamento não foi confirmado para todas as conversas.');
        }
        completedMessageIds.add(message.id);
      }

      const messageLabel = forwardingMessages.length === 1 ? 'Mensagem encaminhada' : `${forwardingMessages.length} mensagens encaminhadas`;
      toast.success(`${messageLabel} para ${targetChats.length} ${targetChats.length === 1 ? 'conversa' : 'conversas'}.`);
      setSelection((current) => current === selection ? null : current);
      setForwardSearch('');
      setForwardingTargetIds([]);
    } catch (error) {
      console.error('[WhatsAppInbox] erro ao encaminhar mensagens', error);
      // Do not resend messages already confirmed before a later failure.
      setSelection((current) => current === selection
        ? { ...current, messages: current.messages.filter((message) => !completedMessageIds.has(message.id)) }
        : current);
      const detail = error instanceof Error ? error.message : 'Não foi possível concluir o encaminhamento.';
      const progress = completedMessageIds.size > 0 ? `${completedMessageIds.size} de ${forwardingMessages.length} mensagens já foram encaminhadas. ` : '';
      toast.error(`${progress}${detail} Confira as conversas de destino antes de tentar novamente, pois parte do envio pode ter chegado.`);
    } finally {
      sendingRef.current = false;
      setForwardingInProgress(false);
    }

    try {
      const affectedChatIds = targetChats.map((chat) => chat.id);
      const reloads: Array<Promise<unknown>> = [Promise.resolve(loadChats())];
      if (selectedChatIdRef.current && affectedChatIds.includes(selectedChatIdRef.current)) {
        const selectedChatSnapshot = latestChatsRef.current.find((chat) => chat.id === selectedChatIdRef.current) ?? null;
        if (selectedChatSnapshot) {
          reloads.push(Promise.resolve(loadMessages(selectedChatSnapshot, 'send')));
        }
      }

      await Promise.all(reloads);
    } catch (error) {
      console.error('[WhatsAppInbox] erro ao atualizar conversas após encaminhamento', error);
      toast.error('Não foi possível atualizar o histórico. Reabra as conversas para conferir as mensagens encaminhadas.');
    }
  }, [selection, forwardingTargetIds, latestChatsRef, loadChats, loadMessages, selectedChatIdRef, setForwardSearch]);

  return {
    forwardingMessages,
    selectingMessagesToForward,
    forwardDialogOpen,
    forwardingTargetIds,
    forwardingInProgress,
    handleOpenForwardMessageModal,
    handleCloseForwardMessageModal,
    handleToggleForwardMessage,
    handleChooseForwardTargets,
    handleBackToForwardSelection,
    handleToggleForwardTarget,
    handleForwardToSelectedChats,
  };
};
