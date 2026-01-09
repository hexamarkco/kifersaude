import { Lead } from './supabase';
import { normalizeChatId, sendWhatsAppMessage } from './whatsappApiService';

export const AUTO_CONTACT_INTEGRATION_SLUG = 'whatsapp_auto_contact';

export type TemplateMessageType = 'text' | 'image' | 'video' | 'audio' | 'document';

export type TemplateMessage = {
  id: string;
  type: TemplateMessageType;
  text?: string;
  mediaUrl?: string;
  caption?: string;
};

export type AutoContactTemplate = {
  id: string;
  name: string;
  message: string;
  messages?: TemplateMessage[];
};

export type AutoContactFlowStep = {
  id: string;
  delayHours: number;
  templateId: string;
};

export type AutoContactFlow = {
  id: string;
  name: string;
  triggerStatus: string;
  steps: AutoContactFlowStep[];
  stopOnStatusChange: boolean;
  finalStatus?: string;
};

export type AutoContactSettings = {
  enabled: boolean;
  autoSend?: boolean;
  apiKey: string;
  statusOnSend: string;
  statusOnInvalidNumber?: string;
  messageTemplates: AutoContactTemplate[];
  selectedTemplateId: string;
  flows: AutoContactFlow[];
};

const DEFAULT_STATUS = 'Contato Inicial';

export const DEFAULT_MESSAGE_TEMPLATES: AutoContactTemplate[] = [
  {
    id: 'template-1',
    name: 'Contato inicial',
    message:
      'Oi {{primeiro_nome}}, tudo bem? Sou a Luiza Kifer, especialista em planos de saúde, e vi que você demonstrou interesse em receber uma cotação.',
    messages: [
      {
        id: 'template-1-message-1',
        type: 'text',
        text:
          'Oi {{primeiro_nome}}, tudo bem? Sou a Luiza Kifer, especialista em planos de saúde, e vi que você demonstrou interesse em receber uma cotação.',
      },
    ],
  },
  {
    id: 'template-2',
    name: 'Convite para conversar',
    message:
      'Será que você tem um minutinho pra conversarmos? Quero entender melhor o que você está buscando no plano de saúde 😊',
    messages: [
      {
        id: 'template-2-message-1',
        type: 'text',
        text:
          'Será que você tem um minutinho pra conversarmos? Quero entender melhor o que você está buscando no plano de saúde 😊',
      },
    ],
  },
  {
    id: 'template-3',
    name: 'Lembrete cordial',
    message:
      'Oi {{primeiro_nome}}, passando para ver se conseguiu analisar a proposta. Posso te ajudar em algo?',
    messages: [
      {
        id: 'template-3-message-1',
        type: 'text',
        text: 'Oi {{primeiro_nome}}, passando para ver se conseguiu analisar a proposta. Posso te ajudar em algo?',
      },
    ],
  },
];

const normalizeMessageType = (type: unknown): TemplateMessageType =>
  type === 'image' || type === 'video' || type === 'audio' || type === 'document' ? type : 'text';

export const DEFAULT_AUTO_CONTACT_FLOWS: AutoContactFlow[] = [
  {
    id: 'flow-1',
    name: 'Follow-up automático',
    triggerStatus: DEFAULT_STATUS,
    stopOnStatusChange: true,
    finalStatus: '',
    steps: [
      { id: 'flow-1-step-1', delayHours: 2, templateId: 'template-1' },
      { id: 'flow-1-step-2', delayHours: 24, templateId: 'template-2' },
      { id: 'flow-1-step-3', delayHours: 48, templateId: 'template-3' },
    ],
  },
];

export const getTemplateMessages = (template?: AutoContactTemplate | null): TemplateMessage[] => {
  if (!template) return [];
  const rawMessages = Array.isArray(template.messages) ? template.messages : [];
  if (rawMessages.length > 0) {
    return rawMessages.map((message, index) => ({
      id: typeof message?.id === 'string' && message.id.trim() ? message.id : `message-${template.id}-${index}`,
      type: normalizeMessageType(message?.type),
      text: typeof message?.text === 'string' ? message.text : '',
      mediaUrl: typeof message?.mediaUrl === 'string' ? message.mediaUrl : '',
      caption: typeof message?.caption === 'string' ? message.caption : '',
    }));
  }

  if (template.message?.trim()) {
    return [
      {
        id: `message-${template.id}-0`,
        type: 'text',
        text: template.message,
      },
    ];
  }

  return [];
};

export const composeTemplateMessage = (messages: TemplateMessage[]): string => {
  const parts = messages
    .map((message) => {
      if (message.type === 'text') {
        return message.text?.trim();
      }
      const caption = message.caption?.trim();
      if (caption) return caption;
      const mediaUrl = message.mediaUrl?.trim();
      if (mediaUrl) return `Anexo: ${mediaUrl}`;
      return '';
    })
    .filter((part): part is string => Boolean(part));

  return parts.join('\n\n');
};

export const getTemplateMessage = (template?: AutoContactTemplate | null): string => {
  if (!template) return '';
  const composed = composeTemplateMessage(getTemplateMessages(template));
  return composed || template.message || '';
};

export const normalizeAutoContactSettings = (rawSettings: Record<string, any> | null | undefined): AutoContactSettings => {
  const settings = rawSettings && typeof rawSettings === 'object' ? rawSettings : {};
  const rawTemplates =
    Array.isArray(settings.messageTemplates) && settings.messageTemplates.length > 0
      ? settings.messageTemplates
      : DEFAULT_MESSAGE_TEMPLATES;
  const messageTemplates = rawTemplates.map((template, index) => {
    const templateId = typeof template?.id === 'string' && template.id.trim() ? template.id : `template-${index}`;
    const templateName = typeof template?.name === 'string' ? template.name : '';
    const templateMessage = typeof template?.message === 'string' ? template.message : '';
    const normalizedMessages = getTemplateMessages({
      id: templateId,
      name: templateName,
      message: templateMessage,
      messages: Array.isArray(template?.messages) ? template.messages : undefined,
    });
    const composedMessage = composeTemplateMessage(normalizedMessages);

    return {
      id: templateId,
      name: templateName,
      messages: normalizedMessages,
      message: composedMessage || templateMessage,
    };
  });
  const selectedTemplateId =
    typeof settings.selectedTemplateId === 'string' && settings.selectedTemplateId.trim()
      ? settings.selectedTemplateId
      : messageTemplates[0]?.id ?? '';

  const apiKeyValue = typeof settings.apiKey === 'string' ? settings.apiKey : (typeof settings.token === 'string' ? settings.token : '');
  const validSelectedTemplateId = messageTemplates.some((template) => template.id === selectedTemplateId)
    ? selectedTemplateId
    : messageTemplates[0]?.id ?? '';
  const rawFlows =
    Array.isArray(settings.flows) && settings.flows.length > 0 ? settings.flows : DEFAULT_AUTO_CONTACT_FLOWS;
  const fallbackTemplateId = messageTemplates[0]?.id ?? '';
  const normalizedFlows = rawFlows
    .map((flow: any, flowIndex: number) => {
      const flowId = typeof flow?.id === 'string' && flow.id.trim() ? flow.id : `flow-${flowIndex}`;
      const steps = Array.isArray(flow?.steps) ? flow.steps : [];
      const normalizedSteps = steps
        .map((step: any, stepIndex: number) => {
          const delayHoursRaw = Number(step?.delayHours);
          const delayHours = Number.isFinite(delayHoursRaw) && delayHoursRaw >= 0 ? delayHoursRaw : 0;
          const templateId = typeof step?.templateId === 'string' ? step.templateId : '';
          const validTemplateId =
            messageTemplates.some((template) => template.id === templateId) ? templateId : fallbackTemplateId;
          return {
            id: typeof step?.id === 'string' && step.id.trim() ? step.id : `flow-${flowId}-step-${stepIndex}`,
            delayHours,
            templateId: validTemplateId,
          };
        })
        .filter((step) => step.templateId);

      return {
        id: flowId,
        name: typeof flow?.name === 'string' ? flow.name : '',
        triggerStatus: typeof flow?.triggerStatus === 'string' ? flow.triggerStatus : '',
        steps: normalizedSteps,
        stopOnStatusChange: flow?.stopOnStatusChange !== false,
        finalStatus: typeof flow?.finalStatus === 'string' ? flow.finalStatus : '',
      };
    })
    .filter((flow) => flow.triggerStatus.trim() && flow.steps.length > 0);

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
    flows: normalizedFlows.length ? normalizedFlows : DEFAULT_AUTO_CONTACT_FLOWS,
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

  const message = getTemplateMessage(selectedTemplate);
  if (!message.trim()) return;

  const finalMessage = applyTemplateVariables(message, lead);
  await sendAutoContactMessage({ lead, message: finalMessage, settings });
  await onFirstMessageSent?.();
}
