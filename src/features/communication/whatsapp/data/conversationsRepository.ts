import { commWhatsAppService } from './commWhatsAppService';

/** Data access used to list, synchronize and mutate inbox conversations. */
export const whatsappConversationsRepository = {
  getUnreadCount: commWhatsAppService.getUnreadChatsCount,
  getArchivedCount: commWhatsAppService.getArchivedChatsCount,
  getOperationalState: commWhatsAppService.getOperationalState,
  list: commWhatsAppService.listChats,
  getThread: commWhatsAppService.getChatThread,
  updateInboxState: commWhatsAppService.updateChatInboxState,
  setAutonomousAttendanceStatus: commWhatsAppService.setAutonomousAttendanceStatus,
  delete: commWhatsAppService.deleteChat,
  markRead: commWhatsAppService.markChatRead,
  syncHistory: commWhatsAppService.syncChatHistory,
  syncAllBatch: commWhatsAppService.syncAllChatsBatch,
  syncAll: commWhatsAppService.syncAllChats.bind(commWhatsAppService),
};
