import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  listInboxAgendaReminders,
  subscribeToInboxReminders,
  type CommWhatsAppLeadContractSummary,
  type InboxAgendaSummaryReminder,
} from '../data';

type ChatAgendaSummary = {
  pendingCount: number;
  nextReminder: InboxAgendaSummaryReminder | null;
};

type InboxChatAgendaSummaryOptions = {
  selectedChatLeadId: string | null;
  leadPanelId: string | null;
  leadContracts: CommWhatsAppLeadContractSummary[];
};

const EMPTY_CHAT_AGENDA_SUMMARY: ChatAgendaSummary = { pendingCount: 0, nextReminder: null };

export const useInboxChatAgendaSummary = ({
  selectedChatLeadId,
  leadPanelId,
  leadContracts,
}: InboxChatAgendaSummaryOptions) => {
  const [chatAgendaSummary, setChatAgendaSummary] = useState(EMPTY_CHAT_AGENDA_SUMMARY);
  const [chatAgendaSummaryLoading, setChatAgendaSummaryLoading] = useState(false);
  const [chatAgendaSummaryError, setChatAgendaSummaryError] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const currentLeadIdRef = useRef<string | null>(null);
  const contractIds = useMemo(() => leadContracts.map((contract) => contract.id), [leadContracts]);

  const loadChatAgendaSummary = useCallback(async (leadId: string | null, currentContractIds: string[] = []) => {
    const requestId = ++requestIdRef.current;

    if (!leadId) {
      currentLeadIdRef.current = null;
      setChatAgendaSummary(EMPTY_CHAT_AGENDA_SUMMARY);
      setChatAgendaSummaryError(null);
      setChatAgendaSummaryLoading(false);
      return;
    }

    const shouldShowLoading = currentLeadIdRef.current !== leadId;
    currentLeadIdRef.current = leadId;

    if (shouldShowLoading) {
      setChatAgendaSummaryLoading(true);
    }

    try {
      const reminders = await listInboxAgendaReminders(leadId, currentContractIds);
      const pendingReminders = reminders
        .filter((reminder) => !reminder.lido)
        .sort((left, right) => new Date(left.data_lembrete).getTime() - new Date(right.data_lembrete).getTime());

      if (requestId !== requestIdRef.current || currentLeadIdRef.current !== leadId) {
        return;
      }

      setChatAgendaSummary({
        pendingCount: pendingReminders.length,
        nextReminder: pendingReminders[0] ?? null,
      });
      setChatAgendaSummaryError(null);
    } catch (error) {
      if (requestId !== requestIdRef.current || currentLeadIdRef.current !== leadId) {
        return;
      }

      console.error('[WhatsAppInbox] erro ao carregar resumo da agenda do chat', error);
      setChatAgendaSummary(EMPTY_CHAT_AGENDA_SUMMARY);
      setChatAgendaSummaryError(
        error instanceof Error ? error.message : 'Não foi possível consultar os lembretes deste chat.',
      );
    } finally {
      if (requestId === requestIdRef.current && currentLeadIdRef.current === leadId) {
        setChatAgendaSummaryLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!selectedChatLeadId) {
      requestIdRef.current += 1;
      currentLeadIdRef.current = null;
      setChatAgendaSummary(EMPTY_CHAT_AGENDA_SUMMARY);
      setChatAgendaSummaryError(null);
      setChatAgendaSummaryLoading(false);
      return;
    }

    if (leadPanelId !== selectedChatLeadId) {
      currentLeadIdRef.current = null;
      setChatAgendaSummary(EMPTY_CHAT_AGENDA_SUMMARY);
      setChatAgendaSummaryError(null);
      setChatAgendaSummaryLoading(true);
    }
  }, [leadPanelId, selectedChatLeadId]);

  useEffect(() => {
    void loadChatAgendaSummary(leadPanelId, contractIds);
  }, [contractIds, leadPanelId, loadChatAgendaSummary]);

  useEffect(() => {
    if (!leadPanelId) {
      return undefined;
    }

    return subscribeToInboxReminders(leadPanelId, contractIds, () => {
      void loadChatAgendaSummary(leadPanelId, contractIds);
    });
  }, [contractIds, leadPanelId, loadChatAgendaSummary]);

  useEffect(() => () => {
    requestIdRef.current += 1;
    currentLeadIdRef.current = null;
  }, []);

  return {
    chatAgendaSummary,
    chatAgendaSummaryLoading,
    chatAgendaSummaryError,
    setChatAgendaSummary,
    loadChatAgendaSummary,
  };
};
