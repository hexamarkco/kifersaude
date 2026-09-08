import { commWhatsAppService } from './commWhatsAppService';

/** AI-assisted communication and follow-up use cases. */
export const whatsappFollowUpService = {
  generate: commWhatsAppService.generateFollowUp,
  listPendingChats: commWhatsAppService.getPendingFollowUpChats,
  refine: commWhatsAppService.refineFollowUp,
  rewrite: commWhatsAppService.rewriteMessage,
  suggestReply: commWhatsAppService.suggestReply,
  critiqueAttendance: commWhatsAppService.critiqueAttendance,
  listAttendanceCritiques: commWhatsAppService.listAttendanceCritiques,
  previewAgendaOrganization: commWhatsAppService.previewFollowUpAgendaOrganization,
  applyAgendaOrganization: commWhatsAppService.applyFollowUpAgendaOrganization,
};
