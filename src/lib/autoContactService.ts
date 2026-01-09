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

export type AutoContactFlowConditionField = 'origem' | 'cidade' | 'responsavel' | 'status' | 'tag';
export type AutoContactFlowConditionOperator = 'equals' | 'contains' | 'not_equals' | 'not_contains';

export type AutoContactFlowCondition = {
  id: string;
  field: AutoContactFlowConditionField;
  operator: AutoContactFlowConditionOperator;
  value: string;
};

export type AutoContactFlow = {
  id: string;
  name: string;
  triggerStatus: string;
  steps: AutoContactFlowStep[];
  stopOnStatusChange: boolean;
  finalStatus?: string;
  conditionLogic?: 'all' | 'any';
  conditions?: AutoContactFlowCondition[];
  tags?: string[];
};

export type AutoContactSchedulingSettings = {
  timezone: string;
  startHour: string;
  endHour: string;
  allowedWeekdays: number[];
  skipHolidays: boolean;
};

export type AutoContactMonitoringSettings = {
  realtimeEnabled: boolean;
  refreshSeconds: number;
};

export type AutoContactLoggingSettings = {
  enabled: boolean;
  retentionDays: number;
  includePayloads: boolean;
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
  scheduling: AutoContactSchedulingSettings;
  monitoring: AutoContactMonitoringSettings;
  logging: AutoContactLoggingSettings;
};

type DateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

const DEFAULT_STATUS = 'Contato Inicial';
const DEFAULT_SCHEDULING: AutoContactSchedulingSettings = {
  timezone: 'America/Sao_Paulo',
  startHour: '08:00',
  endHour: '19:00',
  allowedWeekdays: [1, 2, 3, 4, 5],
  skipHolidays: true,
};
const DEFAULT_MONITORING: AutoContactMonitoringSettings = {
  realtimeEnabled: true,
  refreshSeconds: 30,
};
const DEFAULT_LOGGING: AutoContactLoggingSettings = {
  enabled: true,
  retentionDays: 30,
  includePayloads: false,
};

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
    conditionLogic: 'all',
    conditions: [],
    tags: ['follow-up', 'automacao'],
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
  const normalizeConditionField = (field: unknown): AutoContactFlowConditionField => {
    if (field === 'origem' || field === 'cidade' || field === 'responsavel' || field === 'status' || field === 'tag') {
      return field;
    }
    return 'origem';
  };
  const normalizeConditionOperator = (operator: unknown): AutoContactFlowConditionOperator => {
    if (operator === 'equals' || operator === 'contains' || operator === 'not_equals' || operator === 'not_contains') {
      return operator;
    }
    return 'contains';
  };
  const normalizedFlows = rawFlows
    .map((flow: any, flowIndex: number) => {
      const flowId = typeof flow?.id === 'string' && flow.id.trim() ? flow.id : `flow-${flowIndex}`;
      const steps = Array.isArray(flow?.steps) ? flow.steps : [];
      const rawConditions = Array.isArray(flow?.conditions) ? flow.conditions : [];
      const normalizedConditions = rawConditions
        .map((condition: any, conditionIndex: number) => ({
          id:
            typeof condition?.id === 'string' && condition.id.trim()
              ? condition.id
              : `flow-${flowId}-condition-${conditionIndex}`,
          field: normalizeConditionField(condition?.field),
          operator: normalizeConditionOperator(condition?.operator),
          value: typeof condition?.value === 'string' ? condition.value : '',
        }))
        .filter((condition) => condition.value.trim());
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
        conditionLogic: flow?.conditionLogic === 'any' ? 'any' : 'all',
        conditions: normalizedConditions,
        tags: Array.isArray(flow?.tags)
          ? flow.tags.filter((tag: unknown) => typeof tag === 'string' && tag.trim()).map((tag: string) => tag.trim())
          : [],
      };
    })
    .filter((flow) => flow.triggerStatus.trim() && flow.steps.length > 0);

  const rawScheduling = settings.scheduling && typeof settings.scheduling === 'object' ? settings.scheduling : {};
  const scheduling: AutoContactSchedulingSettings = {
    timezone: typeof rawScheduling.timezone === 'string' ? rawScheduling.timezone : DEFAULT_SCHEDULING.timezone,
    startHour: typeof rawScheduling.startHour === 'string' ? rawScheduling.startHour : DEFAULT_SCHEDULING.startHour,
    endHour: typeof rawScheduling.endHour === 'string' ? rawScheduling.endHour : DEFAULT_SCHEDULING.endHour,
    allowedWeekdays: Array.isArray(rawScheduling.allowedWeekdays)
      ? rawScheduling.allowedWeekdays
          .map((value: unknown) => Number(value))
          .filter((value: number) => Number.isFinite(value) && value >= 1 && value <= 7)
      : DEFAULT_SCHEDULING.allowedWeekdays,
    skipHolidays: rawScheduling.skipHolidays !== false,
  };
  const rawMonitoring = settings.monitoring && typeof settings.monitoring === 'object' ? settings.monitoring : {};
  const monitoring: AutoContactMonitoringSettings = {
    realtimeEnabled: rawMonitoring.realtimeEnabled !== false,
    refreshSeconds:
      Number.isFinite(Number(rawMonitoring.refreshSeconds)) && Number(rawMonitoring.refreshSeconds) > 0
        ? Number(rawMonitoring.refreshSeconds)
        : DEFAULT_MONITORING.refreshSeconds,
  };
  const rawLogging = settings.logging && typeof settings.logging === 'object' ? settings.logging : {};
  const logging: AutoContactLoggingSettings = {
    enabled: rawLogging.enabled !== false,
    retentionDays:
      Number.isFinite(Number(rawLogging.retentionDays)) && Number(rawLogging.retentionDays) > 0
        ? Number(rawLogging.retentionDays)
        : DEFAULT_LOGGING.retentionDays,
    includePayloads: rawLogging.includePayloads === true,
  };

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
    scheduling,
    monitoring,
    logging,
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

const parseHourMinute = (value: string): { hour: number; minute: number } => {
  if (!value) return { hour: 0, minute: 0 };
  const [rawHour, rawMinute] = value.split(':');
  const hour = Number(rawHour);
  const minute = Number(rawMinute);
  return {
    hour: Number.isFinite(hour) ? Math.min(Math.max(hour, 0), 23) : 0,
    minute: Number.isFinite(minute) ? Math.min(Math.max(minute, 0), 59) : 0,
  };
};

const getTimeZoneOffset = (date: Date, timeZone: string): number => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const lookup: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== 'literal') {
      lookup[part.type] = part.value;
    }
  }
  const year = Number(lookup.year);
  const month = Number(lookup.month);
  const day = Number(lookup.day);
  const hour = Number(lookup.hour);
  const minute = Number(lookup.minute);
  const second = Number(lookup.second);
  const asUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  return asUtc - date.getTime();
};

const toZonedDate = (date: Date, timeZone: string): Date => {
  const offset = getTimeZoneOffset(date, timeZone);
  return new Date(date.getTime() + offset);
};

const getZonedParts = (date: Date, timeZone: string): DateParts => {
  const zoned = toZonedDate(date, timeZone);
  return {
    year: zoned.getUTCFullYear(),
    month: zoned.getUTCMonth(),
    day: zoned.getUTCDate(),
    hour: zoned.getUTCHours(),
    minute: zoned.getUTCMinutes(),
  };
};

const buildDateInTimeZone = (
  { year, month, day, hour, minute }: DateParts,
  timeZone: string,
): Date => {
  const utcDate = new Date(Date.UTC(year, month, day, hour, minute, 0));
  const offset = getTimeZoneOffset(utcDate, timeZone);
  return new Date(utcDate.getTime() - offset);
};

const addDaysToZoned = (zoned: Date, days: number): Date => new Date(zoned.getTime() + days * 86400000);

const getWeekdayNumber = (zoned: Date): number => {
  const day = zoned.getUTCDay();
  return day === 0 ? 7 : day;
};

const formatDateKey = (zoned: Date): string => {
  const year = zoned.getUTCFullYear();
  const month = String(zoned.getUTCMonth() + 1).padStart(2, '0');
  const day = String(zoned.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getHolidayCalendarForYear = (_year: number, _timeZone: string): string[] => {
  // TODO: consultar calendário de feriados configurado (stub 2).
  return [];
};

const isHolidayDate = (zoned: Date, timeZone: string): boolean => {
  const calendar = getHolidayCalendarForYear(zoned.getUTCFullYear(), timeZone);
  return calendar.includes(formatDateKey(zoned));
};

export const getNextAllowedSendAt = (
  reference: Date,
  scheduling: AutoContactSchedulingSettings,
): Date => {
  const allowedWeekdays = scheduling.allowedWeekdays?.length ? scheduling.allowedWeekdays : [1, 2, 3, 4, 5, 6, 7];
  const start = parseHourMinute(scheduling.startHour);
  const end = parseHourMinute(scheduling.endHour);
  let candidate = new Date(reference.getTime());

  for (let attempt = 0; attempt < 370; attempt += 1) {
    const zoned = toZonedDate(candidate, scheduling.timezone);
    const weekday = getWeekdayNumber(zoned);
    const isAllowedWeekday = allowedWeekdays.includes(weekday);
    const shouldSkipHoliday = scheduling.skipHolidays && isHolidayDate(zoned, scheduling.timezone);

    if (!isAllowedWeekday || shouldSkipHoliday) {
      const nextDay = addDaysToZoned(zoned, 1);
      const parts = {
        year: nextDay.getUTCFullYear(),
        month: nextDay.getUTCMonth(),
        day: nextDay.getUTCDate(),
        hour: start.hour,
        minute: start.minute,
      };
      candidate = buildDateInTimeZone(parts, scheduling.timezone);
      continue;
    }

    const currentMinutes = zoned.getUTCHours() * 60 + zoned.getUTCMinutes();
    const startMinutes = start.hour * 60 + start.minute;
    const endMinutes = end.hour * 60 + end.minute;

    if (currentMinutes < startMinutes) {
      candidate = buildDateInTimeZone(
        {
          ...getZonedParts(candidate, scheduling.timezone),
          hour: start.hour,
          minute: start.minute,
        },
        scheduling.timezone,
      );
      return candidate;
    }

    if (currentMinutes > endMinutes) {
      const nextDay = addDaysToZoned(zoned, 1);
      candidate = buildDateInTimeZone(
        {
          year: nextDay.getUTCFullYear(),
          month: nextDay.getUTCMonth(),
          day: nextDay.getUTCDate(),
          hour: start.hour,
          minute: start.minute,
        },
        scheduling.timezone,
      );
      continue;
    }

    return candidate;
  }

  return candidate;
};

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
  const flows = settings.flows ?? [];
  const matchingFlow = flows.find((flow) => flow.triggerStatus === (lead.status ?? '')) ?? flows[0] ?? null;
  if (!matchingFlow) return;

  let cumulativeDelayHours = 0;
  let firstMessageSent = false;

  for (const step of matchingFlow.steps) {
    if (signal?.() === false) return;
    cumulativeDelayHours += step.delayHours;

    const desiredAt = new Date(Date.now() + cumulativeDelayHours * 60 * 60 * 1000);
    const scheduledAt = getNextAllowedSendAt(desiredAt, settings.scheduling);
    const now = new Date();
    const waitMs = scheduledAt.getTime() - now.getTime();

    if (waitMs > 0) {
      console.info('[AutoContact] Mensagem agendada para envio futuro', {
        leadId: lead.id,
        stepId: step.id,
        scheduledAt: scheduledAt.toISOString(),
      });
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      if (signal?.() === false) return;
    }

    const template =
      templates.find((item) => item.id === step.templateId) ??
      templates.find((item) => item.id === settings.selectedTemplateId) ??
      templates[0] ??
      null;
    const message = getTemplateMessage(template);
    if (!message.trim()) continue;

    const finalMessage = applyTemplateVariables(message, lead);
    await sendAutoContactMessage({ lead, message: finalMessage, settings });
    if (!firstMessageSent) {
      await onFirstMessageSent?.();
      firstMessageSent = true;
    }
  }
}
