import { commWhatsAppService } from './commWhatsAppService';

/** Operational read models and exports for the inbox dashboard. */
export const whatsappDashboardService = {
  getMetrics: commWhatsAppService.getDashboardMetrics,
  exportConversations: commWhatsAppService.exportInboxConversations.bind(commWhatsAppService),
};
