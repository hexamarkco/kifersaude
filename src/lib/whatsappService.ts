export const WHATSAPP_CHAT_EVENT = 'open-whatsapp-chat';

export type WhatsAppChatRequestDetail = {
  phone?: string | null;
  leadName?: string | null;
  leadId?: string | null;
  prefillMessage?: string | null;
  source?: string;
};

export type OpenWhatsAppChatOptions = {
  withMessage?: boolean;
  leadId?: string | null;
  source?: string;
};

export const openWhatsAppInBackgroundTab = (
  telefone: string,
  nome: string,
  options: OpenWhatsAppChatOptions = {}
): void => {
  try {
    const { withMessage = true, leadId = null, source } = options;
    const digitsOnly = (telefone || '').replace(/\D/g, '');
    const sanitizedPhone = digitsOnly.length > 0 ? digitsOnly : (telefone || '').trim();
    const prefillMessage = withMessage
      ? `Olá ${nome}, tudo bem? Sou *Luiza Kifer*, especialista em planos de saúde aqui da UnitedClass, e vi que você demonstrou interesse em um plano de saúde.`
      : null;

    const eventDetail: WhatsAppChatRequestDetail = {
      phone: sanitizedPhone,
      leadName: nome,
      leadId,
      prefillMessage,
      source,
    };

    window.dispatchEvent(new CustomEvent<WhatsAppChatRequestDetail>(WHATSAPP_CHAT_EVENT, { detail: eventDetail }));
  } catch (error) {
    console.error('Erro ao abrir chat do WhatsApp interno:', error);
  }
};
