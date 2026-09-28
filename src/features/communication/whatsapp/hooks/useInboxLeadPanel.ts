import { useCallback, type Dispatch, type SetStateAction } from 'react';

import {
  whatsappContactsRepository,
  type CommWhatsAppLeadContractSummary,
  type CommWhatsAppLeadPanel,
} from '../data';
import type { CommWhatsAppChat } from '../domain/types';
import { collectPhoneLookupKeys } from '../domain/contactLookup';

type CurrentValue<T> = { current: T };

type InboxLeadPanelOptions = {
  refs: {
    leadPanelRequestIdRef: CurrentValue<number>;
    leadContractsRequestIdRef: CurrentValue<number>;
    selectedChatIdRef: CurrentValue<string | null>;
    prefetchedLeadNameByPhoneRef: CurrentValue<Map<string, string>>;
  };
  setLeadPanel: Dispatch<SetStateAction<CommWhatsAppLeadPanel | null>>;
  setLeadPanelError: Dispatch<SetStateAction<string | null>>;
  setLeadPanelLoading: Dispatch<SetStateAction<boolean>>;
  setLeadContracts: Dispatch<SetStateAction<CommWhatsAppLeadContractSummary[]>>;
  setLeadContractsError: Dispatch<SetStateAction<string | null>>;
  setLeadContractsLoading: Dispatch<SetStateAction<boolean>>;
  setChats: Dispatch<SetStateAction<CommWhatsAppChat[]>>;
  applyFrontendSavedContactNames: (chats: CommWhatsAppChat[]) => CommWhatsAppChat[];
  applyPrefetchedLeadNames: (chats: CommWhatsAppChat[]) => CommWhatsAppChat[];
  upsertChatLocally: (chat: CommWhatsAppChat) => void;
};

export const useInboxLeadPanel = ({
  refs,
  setLeadPanel,
  setLeadPanelError,
  setLeadPanelLoading,
  setLeadContracts,
  setLeadContractsError,
  setLeadContractsLoading,
  setChats,
  applyFrontendSavedContactNames,
  applyPrefetchedLeadNames,
  upsertChatLocally,
}: InboxLeadPanelOptions) => {
  const {
    leadPanelRequestIdRef,
    leadContractsRequestIdRef,
    selectedChatIdRef,
    prefetchedLeadNameByPhoneRef,
  } = refs;

  const loadLeadContracts = useCallback(async (leadId: string | null) => {
    const requestId = ++leadContractsRequestIdRef.current;

    if (!leadId) {
      setLeadContracts([]);
      setLeadContractsError(null);
      setLeadContractsLoading(false);
      return;
    }

    setLeadContractsLoading(true);
    try {
      const contracts = await whatsappContactsRepository.listLeadContracts(leadId);
      if (requestId !== leadContractsRequestIdRef.current) {
        return;
      }
      setLeadContracts(contracts);
      setLeadContractsError(null);
    } catch (error) {
      if (requestId !== leadContractsRequestIdRef.current) {
        return;
      }
      console.error('[WhatsAppInbox] erro ao carregar contratos do lead', error);
      setLeadContracts([]);
      setLeadContractsError(error instanceof Error ? error.message : 'Não foi possível carregar os contratos do lead.');
    } finally {
      if (requestId === leadContractsRequestIdRef.current) {
        setLeadContractsLoading(false);
      }
    }
  }, [leadContractsRequestIdRef, setLeadContracts, setLeadContractsError, setLeadContractsLoading]);

  const loadLeadPanel = useCallback(async (chat: CommWhatsAppChat | null) => {
    const requestId = ++leadPanelRequestIdRef.current;
    const targetChatId = chat?.id ?? null;

    if (!chat?.lead_id) {
      setLeadPanel(null);
      setLeadPanelError(null);
      setLeadPanelLoading(false);
      setLeadContracts([]);
      setLeadContractsLoading(false);
      setLeadContractsError(null);
      return;
    }

    setLeadPanelLoading(true);
    setLeadPanelError(null);
    try {
      const lead = await whatsappContactsRepository.getLeadPanel(chat.id);
      if (requestId !== leadPanelRequestIdRef.current || selectedChatIdRef.current !== targetChatId) {
        return;
      }
      setLeadPanel(lead);
      setLeadPanelLoading(false);
      const nextLeadStatus = lead?.status_value ?? lead?.status_nome ?? null;
      const shouldHydrateChatFromLead = Boolean(
        lead
          && ((lead.nome_completo && chat.lead_name !== lead.nome_completo)
            || (nextLeadStatus && chat.lead_status !== nextLeadStatus)),
      );
      if (shouldHydrateChatFromLead && lead) {
        upsertChatLocally({
          ...chat,
          lead_name: lead.nome_completo || chat.lead_name,
          lead_status: nextLeadStatus,
        });
      }
      if (lead?.nome_completo) {
        const phoneKeys = collectPhoneLookupKeys(chat.phone_digits || chat.phone_number);
        for (const key of phoneKeys) {
          prefetchedLeadNameByPhoneRef.current.set(key, lead.nome_completo);
        }
        if (phoneKeys.length > 0) {
          setChats((current) => applyFrontendSavedContactNames(applyPrefetchedLeadNames(current)));
        }
      }
      void loadLeadContracts(lead?.id ?? null);
    } catch (error) {
      if (requestId !== leadPanelRequestIdRef.current || selectedChatIdRef.current !== targetChatId) {
        return;
      }
      console.error('[WhatsAppInbox] erro ao carregar painel do lead', error);
      setLeadPanel(null);
      setLeadPanelError(error instanceof Error ? error.message : 'Não foi possível carregar as informações do lead.');
      setLeadContracts([]);
      setLeadContractsLoading(false);
      setLeadContractsError(null);
    } finally {
      if (requestId === leadPanelRequestIdRef.current && selectedChatIdRef.current === targetChatId) {
        setLeadPanelLoading(false);
      }
    }
  }, [
    applyFrontendSavedContactNames,
    applyPrefetchedLeadNames,
    leadPanelRequestIdRef,
    prefetchedLeadNameByPhoneRef,
    selectedChatIdRef,
    loadLeadContracts,
    setChats,
    setLeadContracts,
    setLeadContractsError,
    setLeadContractsLoading,
    setLeadPanel,
    setLeadPanelError,
    setLeadPanelLoading,
    upsertChatLocally,
  ]);

  return { loadLeadContracts, loadLeadPanel };
};
