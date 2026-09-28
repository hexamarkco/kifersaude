import { useEffect, type Dispatch, type SetStateAction } from 'react';

import type { CommWhatsAppLeadPanel } from '../data';
import type { CommWhatsAppChat } from '../domain/types';
import type { Lead } from '../../../leads';
import { subscribeToInboxLead } from '../data';

type CurrentValue<Value> = { current: Value };

type UseInboxSelectedLeadRealtimeOptions = {
  leadId: string | null | undefined;
  leadStatuses: ReadonlyArray<{ id: string; nome: string }>;
  latestChatsRef: CurrentValue<CommWhatsAppChat[]>;
  loadLeadPanel: (chat: CommWhatsAppChat | null) => Promise<unknown>;
  setLeadPanel: Dispatch<SetStateAction<CommWhatsAppLeadPanel | null>>;
  upsertChatLocally: (chat: CommWhatsAppChat) => void;
};

export const useInboxSelectedLeadRealtime = ({
  leadId,
  leadStatuses,
  latestChatsRef,
  loadLeadPanel,
  setLeadPanel,
  upsertChatLocally,
}: UseInboxSelectedLeadRealtimeOptions) => {
  useEffect(() => {
    const normalizedLeadId = leadId?.trim();
    if (!normalizedLeadId) {
      return;
    }

    const unsubscribe = subscribeToInboxLead(
      normalizedLeadId,
      (updatedLead: Partial<Lead>) => {
        const statusName =
          typeof updatedLead.status === 'string' && updatedLead.status.trim()
            ? updatedLead.status.trim()
            : typeof updatedLead.status_id === 'string'
              ? leadStatuses.find((status) => status.id === updatedLead.status_id)?.nome ?? null
              : null;

        const currentChat = latestChatsRef.current.find((chat) => chat.lead_id === normalizedLeadId) ?? null;
        if (!statusName) {
          void loadLeadPanel(currentChat);
          return;
        }

        setLeadPanel((current) => (
          current?.id === normalizedLeadId
            ? { ...current, status_nome: statusName, status_value: statusName }
            : current
        ));

        if (currentChat) {
          upsertChatLocally({ ...currentChat, lead_status: statusName });
        }
      },
      (status) => {
        if (status === 'unavailable') {
          console.warn('[WhatsAppInbox] realtime do lead selecionado indisponivel; polling permanece ativo.');
        }
      },
    );

    return unsubscribe;
  }, [leadId, leadStatuses, latestChatsRef, loadLeadPanel, setLeadPanel, upsertChatLocally]);
};
