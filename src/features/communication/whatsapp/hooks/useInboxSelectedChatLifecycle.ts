import { useEffect, type Dispatch, type SetStateAction } from 'react';

import type { Lead } from '../../../leads';
import type { CommWhatsAppMessage } from '../domain/types';

type CurrentValue<Value> = { current: Value };

export type InboxCreateLeadDraft = {
  chatId: string;
  initialValues: Partial<Lead>;
};

export type InboxStatusReminderLead = Pick<Lead, 'id' | 'nome_completo' | 'telefone' | 'responsavel'>;

type InboxSelectedChatLifecycleOptions = {
  selectedChatId: string | null;
  leadDrawerOpen: boolean;
  refs: {
    selectedChatIdRef: CurrentValue<string | null>;
    suppressAutoChatSelectionRef: CurrentValue<boolean>;
    leadMutationRequestIdRef: CurrentValue<number>;
  };
  state: {
    setLinkLoadingLeadId: Dispatch<SetStateAction<string | null>>;
    setThreadActionsMenuOpen: Dispatch<SetStateAction<boolean>>;
    setSaveContactDialogOpen: Dispatch<SetStateAction<boolean>>;
    setSaveContactName: Dispatch<SetStateAction<string>>;
    setCreateLeadDraft: Dispatch<SetStateAction<InboxCreateLeadDraft | null>>;
    setMessagePendingDeletion: Dispatch<SetStateAction<CommWhatsAppMessage | null>>;
    setRetryPendingMessage: Dispatch<SetStateAction<CommWhatsAppMessage | null>>;
    setStatusReminderLead: Dispatch<SetStateAction<InboxStatusReminderLead | null>>;
    setStatusReminderPromptMessage: Dispatch<SetStateAction<string | null>>;
    setScheduleMessageModalOpen: Dispatch<SetStateAction<boolean>>;
    setScheduledMessagesPanelOpen: Dispatch<SetStateAction<boolean>>;
    setChatFilesOpen: Dispatch<SetStateAction<boolean>>;
    setMediaDrawerOpen: Dispatch<SetStateAction<boolean>>;
    setLeadSearchQuery: Dispatch<SetStateAction<string>>;
  };
};

export const useInboxSelectedChatLifecycle = ({ selectedChatId, leadDrawerOpen, refs, state }: InboxSelectedChatLifecycleOptions) => {
  const {
    setLinkLoadingLeadId,
    setThreadActionsMenuOpen,
    setSaveContactDialogOpen,
    setSaveContactName,
    setCreateLeadDraft,
    setMessagePendingDeletion,
    setRetryPendingMessage,
    setStatusReminderLead,
    setStatusReminderPromptMessage,
    setScheduleMessageModalOpen,
    setScheduledMessagesPanelOpen,
    setChatFilesOpen,
    setMediaDrawerOpen,
    setLeadSearchQuery,
  } = state;

  useEffect(() => {
    refs.leadMutationRequestIdRef.current += 1;
    setLinkLoadingLeadId(null);
    setThreadActionsMenuOpen(false);
  }, [refs.leadMutationRequestIdRef, selectedChatId, setLinkLoadingLeadId, setThreadActionsMenuOpen]);

  useEffect(() => {
    // Clear conversation-scoped UI so a pending action cannot target a different chat.
    setSaveContactDialogOpen(false);
    setSaveContactName('');
    setCreateLeadDraft(null);
    setMessagePendingDeletion(null);
    setRetryPendingMessage(null);
    setStatusReminderLead(null);
    setStatusReminderPromptMessage(null);
    setScheduleMessageModalOpen(false);
    setScheduledMessagesPanelOpen(false);
    setChatFilesOpen(false);
    setMediaDrawerOpen(false);
  }, [
    selectedChatId,
    setChatFilesOpen,
    setCreateLeadDraft,
    setMediaDrawerOpen,
    setMessagePendingDeletion,
    setRetryPendingMessage,
    setSaveContactDialogOpen,
    setSaveContactName,
    setScheduleMessageModalOpen,
    setScheduledMessagesPanelOpen,
    setStatusReminderLead,
    setStatusReminderPromptMessage,
  ]);

  useEffect(() => {
    refs.selectedChatIdRef.current = selectedChatId;
    if (selectedChatId) {
      refs.suppressAutoChatSelectionRef.current = false;
    }
  }, [refs.selectedChatIdRef, refs.suppressAutoChatSelectionRef, selectedChatId]);

  useEffect(() => {
    if (leadDrawerOpen) {
      setLeadSearchQuery('');
    }
  }, [leadDrawerOpen, selectedChatId, setLeadSearchQuery]);
};
