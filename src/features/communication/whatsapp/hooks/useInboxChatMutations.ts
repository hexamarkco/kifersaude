import { useCallback, useRef, type Dispatch, type SetStateAction } from 'react';

import { toast } from '../../../../lib/toast';
import { whatsappConversationsRepository } from '../data';
import type { CommWhatsAppChat } from '../domain/types';
import { sortChatsByInboxOrder } from '../domain/chatPresentation';
import {
  buildPendingChatInboxStatePatch,
  clearPendingChatReadFields,
  mergePendingChatInboxState,
  stripPendingChatInboxMetadata,
  type PendingChatInboxStatePatch,
} from '../pendingChatInboxState';
import { KeyedActionLock } from '../components/keyedActionLock';
import type { InboxChatLoadOptions } from './useInboxChatLoader';

type CurrentValue<T> = { current: T };

export type InboxChatStateOptions = {
  isArchived?: boolean | null;
  isMuted?: boolean | null;
  isPinned?: boolean | null;
  markAsUnread?: boolean | null;
};

type InboxChatMutationsOptions = {
  assumingControlChatId: string | null;
  deletingChatId: string | null;
  refs: {
    pendingChatInboxStateRef: CurrentValue<Map<string, PendingChatInboxStatePatch>>;
    manualUnreadSkipReadChatIdRef: CurrentValue<string | null>;
    chatReadMutationVersionByChatIdRef: CurrentValue<Map<string, number>>;
    archivedSectionOpenRef: CurrentValue<boolean>;
    latestChatsRef: CurrentValue<CommWhatsAppChat[]>;
    selectedChatIdRef: CurrentValue<string | null>;
    chatsSignatureRef: CurrentValue<string>;
  };
  setUpdatingChatStateId: Dispatch<SetStateAction<string | null>>;
  setAssumingControlChatId: Dispatch<SetStateAction<string | null>>;
  setDeletingChatId: Dispatch<SetStateAction<string | null>>;
  setArchivedSectionOpen: Dispatch<SetStateAction<boolean>>;
  setSelectedChatId: Dispatch<SetStateAction<string | null>>;
  setChats: Dispatch<SetStateAction<CommWhatsAppChat[]>>;
  upsertChatLocally: (chat: CommWhatsAppChat) => void;
  loadChats: (options?: InboxChatLoadOptions) => Promise<unknown> | void;
  refreshArchivedChatsCount: () => Promise<unknown>;
  buildChatsSignature: (chats: CommWhatsAppChat[]) => string;
};

export const useInboxChatMutations = ({
  assumingControlChatId,
  deletingChatId,
  refs,
  setUpdatingChatStateId,
  setAssumingControlChatId,
  setDeletingChatId,
  setArchivedSectionOpen,
  setSelectedChatId,
  setChats,
  upsertChatLocally,
  loadChats,
  refreshArchivedChatsCount,
  buildChatsSignature,
}: InboxChatMutationsOptions) => {
  const chatInboxActionLockRef = useRef(new KeyedActionLock());
  const autonomousAttendanceLockRef = useRef(new KeyedActionLock());

  const {
    pendingChatInboxStateRef,
    manualUnreadSkipReadChatIdRef,
    chatReadMutationVersionByChatIdRef,
    archivedSectionOpenRef,
    latestChatsRef,
    selectedChatIdRef,
    chatsSignatureRef,
  } = refs;

  const handleUpdateChatInboxState = useCallback(async (
    chat: CommWhatsAppChat,
    options: InboxChatStateOptions,
  ) => {
    if (!chatInboxActionLockRef.current.tryAcquire(chat.id)) {
      return;
    }

    setUpdatingChatStateId(chat.id);
    let hasFieldsToApply = false;

    try {
      if (typeof options.markAsUnread === 'boolean') {
        const readMutationVersion = (chatReadMutationVersionByChatIdRef.current.get(chat.id) ?? 0) + 1;
        chatReadMutationVersionByChatIdRef.current.set(chat.id, readMutationVersion);
        clearPendingChatReadFields(pendingChatInboxStateRef.current, chat.id);
      }

      const fieldsOnlyPatch = stripPendingChatInboxMetadata(buildPendingChatInboxStatePatch(chat, options));
      const pendingPatch = buildPendingChatInboxStatePatch(chat, options);
      hasFieldsToApply = Object.keys(fieldsOnlyPatch).length > 0;
      if (hasFieldsToApply) {
        mergePendingChatInboxState(pendingChatInboxStateRef.current, chat.id, pendingPatch);
        upsertChatLocally({ ...chat, ...fieldsOnlyPatch });
      }

      if (options.markAsUnread === true && selectedChatIdRef.current === chat.id) {
        manualUnreadSkipReadChatIdRef.current = chat.id;
      }

      // Desarquivar o chat aberto em Arquivadas troca de seção sem trocar a seleção;
      // arquivar o chat ativo seleciona outra conversa visível.
      const shouldMoveSelectedUnarchivedChatToActive = (
        options.isArchived === false
        && selectedChatIdRef.current === chat.id
        && archivedSectionOpenRef.current
      );
      const shouldRotateSelection = (
        typeof options.isArchived === 'boolean'
        && selectedChatIdRef.current === chat.id
        && !shouldMoveSelectedUnarchivedChatToActive
        && options.isArchived !== archivedSectionOpenRef.current
      );

      if (shouldMoveSelectedUnarchivedChatToActive) {
        setArchivedSectionOpen(false);
        void loadChats({ sections: ['active'] });
      } else if (shouldRotateSelection) {
        const nextChat = latestChatsRef.current.find((candidate) => (
          candidate.id !== chat.id
          && Boolean(candidate.is_archived) === archivedSectionOpenRef.current
        )) ?? null;
        setSelectedChatId(nextChat?.id ?? null);
      }

      const updatedChat = await whatsappConversationsRepository.updateInboxState(chat.id, options);
      // Conserva o patch otimista quando a resposta do servidor não confirma o arquivamento.
      const archiveConfirmed = typeof options.isArchived !== 'boolean' || updatedChat.is_archived === options.isArchived;
      const muteConfirmed = typeof options.isMuted !== 'boolean' || updatedChat.is_muted === options.isMuted;
      const pinConfirmed = typeof options.isPinned !== 'boolean' || updatedChat.is_pinned === options.isPinned;

      if (archiveConfirmed && muteConfirmed && pinConfirmed && typeof options.isArchived !== 'boolean') {
        pendingChatInboxStateRef.current.delete(chat.id);
      }
      upsertChatLocally(updatedChat);

      if (typeof options.isArchived === 'boolean') {
        void refreshArchivedChatsCount();
        if (archiveConfirmed) {
          toast.success(options.isArchived ? 'Conversa arquivada.' : 'Conversa removida dos arquivados.');
        } else {
          toast.warning('Conversa atualizada, mas o servidor reverteu o arquivamento. Verifique se há mensagens novas chegando.');
        }
      } else if (typeof options.isMuted === 'boolean') {
        toast.success(options.isMuted ? 'Conversa silenciada.' : 'Conversa com notificação restaurada.');
      } else if (typeof options.isPinned === 'boolean') {
        toast.success(options.isPinned ? 'Conversa fixada.' : 'Conversa desafixada.');
      } else if (typeof options.markAsUnread === 'boolean') {
        toast.success(options.markAsUnread ? 'Conversa marcada como não lida.' : 'Conversa marcada como lida.');
      }
    } catch (error) {
      pendingChatInboxStateRef.current.delete(chat.id);
      if (hasFieldsToApply) {
        upsertChatLocally(chat);
      }
      console.error('[WhatsAppInbox] erro ao atualizar estado do chat', error);
      if (options.markAsUnread === true && manualUnreadSkipReadChatIdRef.current === chat.id) {
        manualUnreadSkipReadChatIdRef.current = null;
      }
      toast.error(error instanceof Error ? error.message : 'Não foi possível atualizar esta conversa.');
    } finally {
      chatInboxActionLockRef.current.release(chat.id);
      setUpdatingChatStateId((current) => (current === chat.id ? null : current));
    }
  }, [
    archivedSectionOpenRef,
    chatReadMutationVersionByChatIdRef,
    latestChatsRef,
    loadChats,
    manualUnreadSkipReadChatIdRef,
    pendingChatInboxStateRef,
    refreshArchivedChatsCount,
    selectedChatIdRef,
    setArchivedSectionOpen,
    setSelectedChatId,
    setUpdatingChatStateId,
    upsertChatLocally,
  ]);

  const setAutonomousAttendance = useCallback(async (chat: CommWhatsAppChat, active: boolean) => {
    if (assumingControlChatId || !autonomousAttendanceLockRef.current.tryAcquire(chat.id)) {
      return;
    }

    setAssumingControlChatId(chat.id);
    try {
      const updatedChat = await whatsappConversationsRepository.setAutonomousAttendanceStatus(chat.id, active ? 'active' : 'inactive');
      upsertChatLocally(updatedChat);
      toast.success(active
        ? 'Atendimento autônomo ativado nesta conversa.'
        : 'Atendimento autônomo desativado nesta conversa.');
    } catch (error) {
      console.error(`[WhatsAppInbox] erro ao ${active ? 'ativar' : 'desativar'} atendimento autonomo`, error);
      toast.error(error instanceof Error
        ? error.message
        : `Não foi possível ${active ? 'ativar' : 'desativar'} o atendimento autônomo desta conversa.`);
    } finally {
      autonomousAttendanceLockRef.current.release(chat.id);
      setAssumingControlChatId((current) => (current === chat.id ? null : current));
    }
  }, [assumingControlChatId, setAssumingControlChatId, upsertChatLocally]);

  const handleDeactivateAutonomousAttendance = useCallback(
    (chat: CommWhatsAppChat) => setAutonomousAttendance(chat, false),
    [setAutonomousAttendance],
  );
  const handleActivateAutonomousAttendance = useCallback(
    (chat: CommWhatsAppChat) => setAutonomousAttendance(chat, true),
    [setAutonomousAttendance],
  );

  const handleDeleteChat = useCallback(async (chat: CommWhatsAppChat) => {
    if (deletingChatId || !chatInboxActionLockRef.current.tryAcquire(chat.id)) {
      return;
    }

    setDeletingChatId(chat.id);
    try {
      await whatsappConversationsRepository.delete(chat.id);

      setChats((current) => {
        const next = current.filter((candidate) => candidate.id !== chat.id);
        chatsSignatureRef.current = buildChatsSignature(next);
        return next;
      });

      if (selectedChatIdRef.current === chat.id) {
        const nextChat = sortChatsByInboxOrder(latestChatsRef.current.filter((candidate) => (
          candidate.id !== chat.id
          && Boolean(candidate.is_archived) === archivedSectionOpenRef.current
        )))[0] ?? null;
        setSelectedChatId(nextChat?.id ?? null);
      }

      toast.success('Conversa excluida da Inbox.');
    } catch (error) {
      console.error('[WhatsAppInbox] erro ao excluir conversa', error);
      toast.error(error instanceof Error ? error.message : 'Não foi possível excluir esta conversa.');
    } finally {
      chatInboxActionLockRef.current.release(chat.id);
      setDeletingChatId((current) => (current === chat.id ? null : current));
    }
  }, [
    archivedSectionOpenRef,
    buildChatsSignature,
    chatsSignatureRef,
    deletingChatId,
    latestChatsRef,
    selectedChatIdRef,
    setChats,
    setDeletingChatId,
    setSelectedChatId,
  ]);

  return {
    handleUpdateChatInboxState,
    handleActivateAutonomousAttendance,
    handleDeactivateAutonomousAttendance,
    handleDeleteChat,
  };
};
