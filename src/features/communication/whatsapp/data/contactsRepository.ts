import { commWhatsAppService } from './commWhatsAppService';

/** CRM lead linking and WhatsApp contact management. */
export const whatsappContactsRepository = {
  searchLeads: commWhatsAppService.searchCrmLeads,
  getLeadPanel: commWhatsAppService.getChatLeadPanel,
  listLeadContracts: commWhatsAppService.listLeadContracts,
  linkLead: commWhatsAppService.linkChatLead,
  unlinkLead: commWhatsAppService.unlinkChatLead,
  updateLeadStatus: commWhatsAppService.updateLinkedLeadStatus,
  updateLeadResponsible: commWhatsAppService.updateLinkedLeadResponsavel,
  listSaved: commWhatsAppService.listSavedContacts,
  lookupSavedByPhones: commWhatsAppService.lookupSavedContactsByPhones,
  startChat: commWhatsAppService.startChat,
  save: commWhatsAppService.saveContact,
  rename: commWhatsAppService.renameContact,
  findExistingChat: commWhatsAppService.findExistingChat,
};
