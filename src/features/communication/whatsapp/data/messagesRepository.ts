import { commWhatsAppService } from './commWhatsAppService';

/** Message persistence and commands. Media transport lives in mediaRepository. */
export const whatsappMessagesRepository = {
  search: commWhatsAppService.searchMessages,
  listPage: commWhatsAppService.listMessagesPage,
  listContext: commWhatsAppService.listMessageContext,
  listAll: commWhatsAppService.listAllMessages.bind(commWhatsAppService),
  refreshStatuses: commWhatsAppService.refreshMessageStatuses,
  sendText: commWhatsAppService.sendTextMessage,
  transcribe: commWhatsAppService.transcribeMessage,
  react: commWhatsAppService.reactToMessage,
  star: commWhatsAppService.starMessage,
  edit: commWhatsAppService.editMessage,
  delete: commWhatsAppService.deleteMessage,
  forward: commWhatsAppService.forwardMessage,
  forwardToChats: commWhatsAppService.forwardMessageToChats,
};
