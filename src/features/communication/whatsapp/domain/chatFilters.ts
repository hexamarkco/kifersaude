import type { CommWhatsAppChat } from './types';

export type ChatActivityFilter = 'all' | 'unread';

type ChatFilterTarget = Pick<
  CommWhatsAppChat,
  'unread_count' | 'manual_unread' | 'lead_status' | 'lead_responsavel_id'
>;

export const createChatFilterMatcher = (params: {
  activityFilter: ChatActivityFilter;
  leadStatusFilters: readonly string[];
  leadResponsavelFilters: readonly string[];
}) => {
  const acceptedStatuses = new Set(
    params.leadStatusFilters.map((status) => status.trim().toLowerCase()).filter(Boolean),
  );
  const acceptedResponsavelIds = new Set(
    params.leadResponsavelFilters.map((id) => id.trim()).filter(Boolean),
  );

  return (chat: ChatFilterTarget) => {
    if (params.activityFilter === 'unread' && chat.unread_count <= 0 && !chat.manual_unread) {
      return false;
    }

    if (params.leadStatusFilters.length > 0) {
      const chatLeadStatus = String(chat.lead_status ?? '').trim().toLowerCase();
      if (!chatLeadStatus || !acceptedStatuses.has(chatLeadStatus)) {
        return false;
      }
    }

    if (params.leadResponsavelFilters.length > 0) {
      const chatResponsavelId = String(chat.lead_responsavel_id ?? '').trim();
      if (!chatResponsavelId || !acceptedResponsavelIds.has(chatResponsavelId)) {
        return false;
      }
    }

    return true;
  };
};
