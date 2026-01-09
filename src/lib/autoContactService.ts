import { Lead } from './supabase';
import { normalizeChatId, sendWhatsAppMessage } from './whatsappApiService';

export const AUTO_CONTACT_INTEGRATION_SLUG = 'whatsapp_auto_contact';

export type AutoContactTemplate = {
  id: string;
  name: string;
  message: string;
};

export type AutoContactSettings = {
  enabled: boolean;
  autoSend?: boolean;
  apiKey: string;
  statusOnSend: string;
  statusOnInvalidNumber?: string;
  messageTemplates: AutoContactTemplate[];
  selectedTemplateId: string;
};

const DEFAULT_STATUS = 'Contato Inicial';

export const DEFAULT_MESSAGE_TEMPLATES: AutoContactTemplate[] = [
  {
    id: 'template-1',
    name: 'Contato inicial',
    message:
      'Oi {{primeiro_nome}}, tudo bem? Sou a Luiza Kifer, especialista em planos de saúde, e vi que você demonstrou interesse em receber uma cotação.',
  },
  {
    id: 'template-2',
    name: 'Convite para conversar',
    message:
      'Será que você tem um minutinho pra conversarmos? Quero entender melhor o que você está buscando no plano de saúde 😊',
  },
];

export const normalizeAutoContactSettings = (rawSettings: Record<string, any> | null | undefined): AutoContactSettings => {
  const settings = rawSettings && typeof rawSettings === 'object' ? rawSettings : {};
  const rawTemplates =
    Array.isArray(settings.messageTemplates) && settings.messageTemplates.length > 0
      ? settings.messageTemplates
      : DEFAULT_MESSAGE_TEMPLATES;
  const messageTemplates = rawTemplates.map((template, index) => ({
    id: typeof template?.id === 'string' && template.id.trim() ? template.id : `template-${index}`,
    name: typeof template?.name === 'string' ? template.name : '',
    message: typeof template?.message === 'string' ? template.message : '',
  }));
  const selectedTemplateId =
    typeof settings.selectedTemplateId === 'string' && settings.selectedTemplateId.trim()
      ? settings.selectedTemplateId
      : messageTemplates[0]?.id ?? '';

  const apiKeyValue = typeof settings.apiKey === 'string' ? settings.apiKey : (typeof settings.token === 'string' ? settings.token : '');
  const validSelectedTemplateId = messageTemplates.some((template) => template.id === selectedTemplateId)
    ? selectedTemplateId
    : messageTemplates[0]?.id ?? '';

  return {
    enabled: settings.enabled !== false,
    autoSend: settings.autoSend === true,
    apiKey: apiKeyValue,
    statusOnSend:
      typeof settings.statusOnSend === 'string' && settings.statusOnSend.trim()
        ? settings.statusOnSend.trim()
        : DEFAULT_STATUS,
    statusOnInvalidNumber:
      typeof settings.statusOnInvalidNumber === 'string' && settings.statusOnInvalidNumber.trim()
        ? settings.statusOnInvalidNumber.trim()
        : '',
    messageTemplates,
    selectedTemplateId: validSelectedTemplateId,
  };
};

export const applyTemplateVariables = (template: string, lead: Lead) => {
  const firstName = lead.nome_completo?.trim().split(/\s+/)[0] ?? '';

  return template
    .replace(/{{\s*nome\s*}}/gi, lead.nome_completo || '')
    .replace(/{{\s*primeiro_nome\s*}}/gi, firstName)
    .replace(/{{\s*origem\s*}}/gi, lead.origem || '')
    .replace(/{{\s*cidade\s*}}/gi, lead.cidade || '')
    .replace(/{{\s*responsavel\s*}}/gi, lead.responsavel || '');
};

const normalizePhone = (phone: string) => phone.replace(/\D/g, '');

export async function sendAutoContactMessage({
  lead,
  message,
  settings,
}: {
  lead: Lead;
  message: string;
  settings: AutoContactSettings;
}): Promise<void> {
  const normalizedPhone = normalizePhone(lead.telefone || '');
  if (!normalizedPhone) {
    throw new Error('Telefone inválido para envio automático.');
  }

  if (!settings.apiKey) {
    throw new Error('Token da Whapi Cloud não configurado na integração de mensagens automáticas.');
  }

  const chatId = normalizeChatId(normalizedPhone);

  console.info('[AutoContact] Enviando automação via Whapi Cloud', {
    leadId: lead.id,
    normalizedPhone,
    chatId,
  });

  try {
    await sendWhatsAppMessage({
      chatId,
      contentType: 'string',
      content: message,
    });
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error);
    console.error('[AutoContact] Erro ao enviar mensagem automática:', details);
    throw error;
  }
}

export async function runAutoContactFlow({
  lead,
  settings,
  signal,
  onFirstMessageSent,
}: {
  lead: Lead;
  settings: AutoContactSettings;
  signal?: () => boolean;
  onFirstMessageSent?: () => Promise<void> | void;
}): Promise<void> {
  if (signal?.() === false) return;

  const templates = settings.messageTemplates ?? [];
  const selectedTemplate =
    templates.find((template) => template.id === settings.selectedTemplateId) ?? templates[0] ?? null;

  if (!selectedTemplate?.message.trim()) return;

  const finalMessage = applyTemplateVariables(selectedTemplate.message, lead);
  await sendAutoContactMessage({ lead, message: finalMessage, settings });
  await onFirstMessageSent?.();
}
