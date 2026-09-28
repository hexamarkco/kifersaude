import { useCallback, type Dispatch, type SetStateAction } from 'react';

import {
  clearInboxLeadAgenda,
  whatsappContactsRepository,
  type CommWhatsAppLeadContractSummary,
  type CommWhatsAppLeadPanel,
  type InboxAgendaSummaryReminder,
} from '../data';
import type { CommWhatsAppChat } from '../domain/types';
import { normalizeLeadStatusLabel, shouldPromptFirstReminderAfterQuote } from '../../../../lib/leadReminderUtils';
import { toast } from '../../../../lib/toast';
import type { Lead } from '../../../leads';

type LeadMutationLock = {
  tryAcquire: (key: string) => boolean;
  release: (key: string) => void;
};

type LeadMutationOptions = {
  selectedChat: CommWhatsAppChat | null;
  selectedChatIdRef: { current: string | null };
  leadPanel: CommWhatsAppLeadPanel | null;
  leadContracts: CommWhatsAppLeadContractSummary[];
  createLeadChatId: string | null;
  leadMutationLockRef: { current: LeadMutationLock };
  leadMutationRequestIdRef: { current: number };
  setLeadMutationLoadingChatId: Dispatch<SetStateAction<string | null>>;
  setLinkLoadingLeadId: Dispatch<SetStateAction<string | null>>;
  closeCreateLeadDraft: () => void;
  setSelectedChatId: (chatId: string) => void;
  setLeadPanel: (lead: CommWhatsAppLeadPanel | null) => void;
  setLeadContracts: (contracts: CommWhatsAppLeadContractSummary[]) => void;
  setLeadContractsError: (message: string | null) => void;
  setLeadSearchQuery: (query: string) => void;
  setStatusReminderLead: (lead: Pick<Lead, 'id' | 'nome_completo' | 'telefone' | 'responsavel'>) => void;
  setStatusReminderPromptMessage: (message: string) => void;
  setChatAgendaSummary: (summary: { pendingCount: number; nextReminder: InboxAgendaSummaryReminder | null }) => void;
  upsertChatLocally: (chat: CommWhatsAppChat) => void;
  loadLeadPanel: (chat: CommWhatsAppChat) => Promise<unknown> | void;
  loadChats: () => Promise<unknown> | void;
  loadChatAgendaSummary: (leadId: string, contractIds: string[]) => Promise<unknown> | void;
  isChatSendActive: (chatId: string) => boolean;
};

export const useInboxLeadMutations = ({
  selectedChat,
  selectedChatIdRef,
  leadPanel,
  leadContracts,
  createLeadChatId,
  leadMutationLockRef,
  leadMutationRequestIdRef,
  setLeadMutationLoadingChatId,
  setLinkLoadingLeadId,
  closeCreateLeadDraft,
  setSelectedChatId,
  setLeadPanel,
  setLeadContracts,
  setLeadContractsError,
  setLeadSearchQuery,
  setStatusReminderLead,
  setStatusReminderPromptMessage,
  setChatAgendaSummary,
  upsertChatLocally,
  loadLeadPanel,
  loadChats,
  loadChatAgendaSummary,
  isChatSendActive,
}: LeadMutationOptions) => {
  const handleCreateLeadFromChatSaved = useCallback(async (lead: Lead) => {
    const targetChatId = createLeadChatId;

    if (!targetChatId || !leadMutationLockRef.current.tryAcquire(targetChatId)) {
      return;
    }

    closeCreateLeadDraft();
    setLeadMutationLoadingChatId(targetChatId);
    const requestId = ++leadMutationRequestIdRef.current;

    try {
      const updatedChat = await whatsappContactsRepository.linkLead(targetChatId, lead.id);
      upsertChatLocally(updatedChat);

      const isCurrentTarget = requestId === leadMutationRequestIdRef.current
        && selectedChatIdRef.current === targetChatId;
      if (isCurrentTarget) {
        setSelectedChatId(updatedChat.id);
        await loadLeadPanel(updatedChat);
      }
      await loadChats();

      if (requestId !== leadMutationRequestIdRef.current || selectedChatIdRef.current !== targetChatId) {
        return;
      }
      toast.success('Lead criado e vinculado a conversa.');
    } catch (error) {
      if (requestId !== leadMutationRequestIdRef.current || selectedChatIdRef.current !== targetChatId) {
        return;
      }
      console.error('[WhatsAppInbox] erro ao vincular lead criado no chat', error);
      toast.error('Lead criado, mas não foi possível vinculá-lo ao chat.');
    } finally {
      leadMutationLockRef.current.release(targetChatId);
      setLeadMutationLoadingChatId((current) => (current === targetChatId ? null : current));
    }
  }, [closeCreateLeadDraft, createLeadChatId, leadMutationLockRef, leadMutationRequestIdRef, loadChats, loadLeadPanel, selectedChatIdRef, setLeadMutationLoadingChatId, setSelectedChatId, upsertChatLocally]);

  const handleLinkLead = useCallback(async (leadId: string) => {
    if (!selectedChat || selectedChat.is_group) {
      return;
    }

    const targetChatId = selectedChat.id;
    if (!leadMutationLockRef.current.tryAcquire(targetChatId)) {
      return;
    }

    const requestId = ++leadMutationRequestIdRef.current;
    setLeadMutationLoadingChatId(targetChatId);
    setLinkLoadingLeadId(leadId);
    try {
      const updatedChat = await whatsappContactsRepository.linkLead(targetChatId, leadId);
      upsertChatLocally(updatedChat);
      if (requestId === leadMutationRequestIdRef.current && selectedChatIdRef.current === targetChatId) {
        setSelectedChatId(updatedChat.id);
        await loadLeadPanel(updatedChat);
      }
      await loadChats();

      if (requestId !== leadMutationRequestIdRef.current || selectedChatIdRef.current !== targetChatId) {
        return;
      }
      toast.success('Lead vinculado a conversa.');
    } catch (error) {
      if (requestId !== leadMutationRequestIdRef.current || selectedChatIdRef.current !== targetChatId) {
        return;
      }
      console.error('[WhatsAppInbox] erro ao vincular lead', error);
      toast.error(error instanceof Error ? error.message : 'Não foi possível vincular o lead ao chat.');
    } finally {
      if (requestId === leadMutationRequestIdRef.current) {
        setLinkLoadingLeadId((current) => (current === leadId ? null : current));
      }
      leadMutationLockRef.current.release(targetChatId);
      setLeadMutationLoadingChatId((current) => (current === targetChatId ? null : current));
    }
  }, [leadMutationLockRef, leadMutationRequestIdRef, loadChats, loadLeadPanel, selectedChat, selectedChatIdRef, setLeadMutationLoadingChatId, setLinkLoadingLeadId, setSelectedChatId, upsertChatLocally]);

  const handleUnlinkLead = useCallback(async () => {
    if (!selectedChat || selectedChat.is_group) {
      return;
    }

    const targetChatId = selectedChat.id;
    if (!leadMutationLockRef.current.tryAcquire(targetChatId)) {
      return;
    }

    const requestId = ++leadMutationRequestIdRef.current;
    setLeadMutationLoadingChatId(targetChatId);

    try {
      const updatedChat = await whatsappContactsRepository.unlinkLead(targetChatId);
      upsertChatLocally(updatedChat);

      if (requestId !== leadMutationRequestIdRef.current || selectedChatIdRef.current !== targetChatId) {
        return;
      }
      setLeadPanel(null);
      setLeadContracts([]);
      setLeadContractsError(null);
      setLeadSearchQuery('');
      toast.success('Lead desvinculado da conversa.');
    } catch (error) {
      if (requestId !== leadMutationRequestIdRef.current || selectedChatIdRef.current !== targetChatId) {
        return;
      }
      console.error('[WhatsAppInbox] erro ao desvincular lead', error);
      toast.error(error instanceof Error ? error.message : 'Não foi possível desvincular o lead do chat.');
    } finally {
      leadMutationLockRef.current.release(targetChatId);
      setLeadMutationLoadingChatId((current) => (current === targetChatId ? null : current));
    }
  }, [leadMutationLockRef, leadMutationRequestIdRef, selectedChat, selectedChatIdRef, setLeadContracts, setLeadContractsError, setLeadMutationLoadingChatId, setLeadPanel, setLeadSearchQuery, upsertChatLocally]);

  const handleLeadStatusChange = useCallback(async (_leadId: string, newStatus: string) => {
    if (!selectedChat || selectedChat.is_group || !leadPanel) {
      return;
    }

    const normalizedStatus = normalizeLeadStatusLabel(newStatus);
    const targetChatId = selectedChat.id;
    if (!leadMutationLockRef.current.tryAcquire(targetChatId)) {
      return;
    }

    const requestId = ++leadMutationRequestIdRef.current;
    setLeadMutationLoadingChatId(targetChatId);
    const deferChatListRefresh = isChatSendActive(targetChatId);
    const statusReminderLeadSnapshot = {
      id: leadPanel.id,
      nome_completo: leadPanel.nome_completo,
      telefone: leadPanel.telefone,
      responsavel: leadPanel.responsavel_value ?? leadPanel.responsavel_label ?? '',
    } satisfies Pick<Lead, 'id' | 'nome_completo' | 'telefone' | 'responsavel'>;

    try {
      await whatsappContactsRepository.updateLeadStatus(targetChatId, newStatus);

      if (requestId !== leadMutationRequestIdRef.current || selectedChatIdRef.current !== targetChatId) {
        void loadChats();
        return;
      }

      if (shouldPromptFirstReminderAfterQuote(newStatus)) {
        setStatusReminderLead(statusReminderLeadSnapshot);
        setStatusReminderPromptMessage('Deseja agendar o primeiro lembrete após a proposta enviada?');
      } else if (normalizedStatus === 'perdido' || normalizedStatus === 'convertido') {
        await clearInboxLeadAgenda(leadPanel.id);
        setChatAgendaSummary({ pendingCount: 0, nextReminder: null });
      }

      const refreshes: Array<Promise<unknown> | void> = [
        loadLeadPanel(selectedChat),
        loadChatAgendaSummary(leadPanel.id, leadContracts.map((contract) => contract.id)),
      ];
      if (!deferChatListRefresh) {
        refreshes.push(loadChats());
      }
      await Promise.all(refreshes);
    } catch (error) {
      if (requestId !== leadMutationRequestIdRef.current || selectedChatIdRef.current !== targetChatId) {
        return;
      }
      console.error('[WhatsAppInbox] erro ao atualizar status do lead', error);
      toast.error(error instanceof Error ? error.message : 'Não foi possível atualizar o status do lead.');
      throw error;
    } finally {
      leadMutationLockRef.current.release(targetChatId);
      setLeadMutationLoadingChatId((current) => (current === targetChatId ? null : current));
    }
  }, [isChatSendActive, leadContracts, leadMutationLockRef, leadMutationRequestIdRef, leadPanel, loadChatAgendaSummary, loadChats, loadLeadPanel, selectedChat, selectedChatIdRef, setChatAgendaSummary, setLeadMutationLoadingChatId, setStatusReminderLead, setStatusReminderPromptMessage]);

  const handleLeadResponsavelChange = useCallback(async (_leadId: string, responsavelValue: string) => {
    if (!selectedChat || selectedChat.is_group) {
      return;
    }

    const targetChatId = selectedChat.id;
    if (!leadMutationLockRef.current.tryAcquire(targetChatId)) {
      return;
    }

    const requestId = ++leadMutationRequestIdRef.current;
    setLeadMutationLoadingChatId(targetChatId);
    try {
      await whatsappContactsRepository.updateLeadResponsible(targetChatId, responsavelValue);
      if (requestId !== leadMutationRequestIdRef.current || selectedChatIdRef.current !== targetChatId) {
        return;
      }
      await Promise.all([loadLeadPanel(selectedChat), loadChats()]);
    } catch (error) {
      if (requestId !== leadMutationRequestIdRef.current || selectedChatIdRef.current !== targetChatId) {
        return;
      }
      console.error('[WhatsAppInbox] erro ao atualizar responsável do lead', error);
      toast.error(error instanceof Error ? error.message : 'Não foi possível atualizar o responsável do lead.');
    } finally {
      leadMutationLockRef.current.release(targetChatId);
      setLeadMutationLoadingChatId((current) => (current === targetChatId ? null : current));
    }
  }, [leadMutationLockRef, leadMutationRequestIdRef, loadChats, loadLeadPanel, selectedChat, selectedChatIdRef, setLeadMutationLoadingChatId]);

  return {
    handleCreateLeadFromChatSaved,
    handleLinkLead,
    handleUnlinkLead,
    handleLeadStatusChange,
    handleLeadResponsavelChange,
  };
};
