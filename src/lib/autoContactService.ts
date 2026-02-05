import { Lead, supabase } from './supabase';
import { formatGreetingTitle, getGreetingForDate } from './greeting';
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

export type AutoContactFlowActionType =
  | 'send_message'
  | 'update_status'
  | 'archive_lead'
  | 'delete_lead'
  | 'webhook'
  | 'create_task'
  | 'send_email';

export type AutoContactFlowMessageSource = 'template' | 'custom';

export type AutoContactInvalidNumberAction = 'none' | 'update_status' | 'archive_lead' | 'delete_lead';

export type AutoContactFlowCustomMessage = {
  type: TemplateMessageType;
  text?: string;
  mediaUrl?: string;
  caption?: string;
  filename?: string;
};

export type AutoContactDelayUnit = 'seconds' | 'minutes' | 'hours' | 'days';

export type AutoContactFlowStep = {
  id: string;
  delayValue: number;
  delayUnit: AutoContactDelayUnit;
  delayExpression?: string;
  actionType: AutoContactFlowActionType;
  messageSource?: AutoContactFlowMessageSource;
  templateId?: string;
  customMessage?: AutoContactFlowCustomMessage;
  statusToSet?: string;
  webhookUrl?: string;
  webhookMethod?: 'POST' | 'PUT' | 'PATCH' | 'GET';
  webhookHeaders?: string;
  webhookBody?: string;
  taskTitle?: string;
  taskDescription?: string;
  taskDueHours?: number;
  taskPriority?: 'baixa' | 'normal' | 'alta';
  emailTo?: string;
  emailCc?: string;
  emailBcc?: string;
  emailSubject?: string;
  emailBody?: string;
};

export type AutoContactFlowConditionField =
  | 'origem'
  | 'cidade'
  | 'responsavel'
  | 'status'
  | 'tag'
  | 'canal'
  | 'whatsapp_valid'
  | 'event'
  | 'estado'
  | 'regiao'
  | 'tipo_contratacao'
  | 'operadora_atual'
  | 'email'
  | 'telefone'
  | 'data_criacao'
  | 'lead_criado'
  | 'ultimo_contato'
  | 'proximo_retorno'
  | 'lead_created';
export type AutoContactFlowConditionOperator =
  | 'equals'
  | 'contains'
  | 'not_equals'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'in_list'
  | 'not_in_list'
  | 'greater_than'
  | 'greater_or_equal'
  | 'less_than'
  | 'less_or_equal';

export type AutoContactFlowCondition = {
  id: string;
  field: AutoContactFlowConditionField;
  operator: AutoContactFlowConditionOperator;
  value: string;
};

export type AutoContactFlowEvent = 'lead_created';

export type AutoContactFlowScheduling = {
  startHour: string;
  endHour: string;
  allowedWeekdays: number[];
};

export type AutoContactFlowGraphNodeType = 'trigger' | 'condition' | 'action';

export type AutoContactFlowGraphNodeData = {
  label: string;
  step?: AutoContactFlowStep;
  conditions?: AutoContactFlowCondition[];
  conditionLogic?: 'all' | 'any';
};

export type AutoContactFlowGraphNode = {
  id: string;
  type: AutoContactFlowGraphNodeType;
  position: { x: number; y: number };
  data: AutoContactFlowGraphNodeData;
};

export type AutoContactFlowGraphEdge = {
  id: string;
  source: string;
  target: string;
  label?: string;
  sourceHandle?: string;
  targetHandle?: string;
};

export type AutoContactFlowGraph = {
  nodes: AutoContactFlowGraphNode[];
  edges: AutoContactFlowGraphEdge[];
};

export type AutoContactFlow = {
  id: string;
  name: string;
  triggerStatus: string;
  steps: AutoContactFlowStep[];
  finalStatus?: string;
  invalidNumberAction?: AutoContactInvalidNumberAction;
  invalidNumberStatus?: string;
  conditionLogic?: 'all' | 'any';
  conditions?: AutoContactFlowCondition[];
  exitConditionLogic?: 'all' | 'any';
  exitConditions?: AutoContactFlowCondition[];
  tags?: string[];
  scheduling?: AutoContactFlowScheduling;
  flowGraph?: AutoContactFlowGraph;
};

export type AutoContactSchedulingSettings = {
  timezone: string;
  startHour: string;
  endHour: string;
  allowedWeekdays: number[];
  skipHolidays: boolean;
  dailySendLimit: number | null;
  holidays?: string[];
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
  autoSend: boolean;
  apiKey: string;
  messageTemplates: AutoContactTemplate[];
  flows: AutoContactFlow[];
  scheduling: AutoContactSchedulingSettings;
  monitoring: AutoContactMonitoringSettings;
  logging: AutoContactLoggingSettings;
};

export type AutoContactScheduleAdjustmentReason = 'outside_window' | 'weekend' | 'holiday';

export type AutoContactSchedulePreviewItem = {
  step: AutoContactFlowStep;
  scheduledAt: Date;
  adjustmentReasons: AutoContactScheduleAdjustmentReason[];
};

const DEFAULT_STATUS = 'Contato Inicial';
const DEFAULT_SCHEDULING: AutoContactSchedulingSettings = {
  timezone: 'America/Sao_Paulo',
  startHour: '08:00',
  endHour: '19:00',
  allowedWeekdays: [1, 2, 3, 4, 5],
  skipHolidays: true,
  dailySendLimit: null,
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

const DELAY_UNIT_TO_MS: Record<AutoContactDelayUnit, number> = {
  seconds: 1000,
  minutes: 60_000,
  hours: 3_600_000,
  days: 86_400_000,
};

const normalizeDelayUnit = (unit: unknown): AutoContactDelayUnit => {
  switch (unit) {
    case 'seconds':
    case 'minutes':
    case 'hours':
    case 'days':
      return unit;
    default:
      return 'hours';
  }
};

const safeNumber = (value: unknown): number | null => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

type FormulaContext = {
  lead: Lead;
  now: Date;
  nome: string;
  primeiro_nome: string;
  telefone: string;
  email: string;
  status: string;
  origem: string;
  cidade: string;
  responsavel: string;
};

const buildFormulaContext = (lead: Lead, _timeZone: string): FormulaContext => {
  const firstName = lead.nome_completo?.trim().split(/\s+/)[0] ?? '';
  return {
    lead,
    now: new Date(),
    nome: lead.nome_completo ?? '',
    primeiro_nome: firstName,
    telefone: lead.telefone ?? '',
    email: lead.email ?? '',
    status: lead.status ?? '',
    origem: lead.origem ?? '',
    cidade: lead.cidade ?? '',
    responsavel: lead.responsavel ?? '',
  };
};

const formulaUtils = {
  if: (condition: boolean, truthy: unknown, falsy: unknown) => (condition ? truthy : falsy),
  concat: (...args: unknown[]) => args.map((item) => String(item ?? '')).join(''),
  lower: (value: unknown) => String(value ?? '').toLowerCase(),
  upper: (value: unknown) => String(value ?? '').toUpperCase(),
  len: (value: unknown) => String(value ?? '').length,
  number: (value: unknown) => Number(value),
  now: () => new Date(),
  dateAdd: (date: unknown, amount: number, unit: 'minutes' | 'hours' | 'days') => {
    const base = date instanceof Date ? date : new Date(String(date));
    const delta = unit === 'days' ? 86400000 : unit === 'hours' ? 3600000 : 60000;
    return new Date(base.getTime() + amount * delta);
  },
  formatDate: (date: unknown, format: 'date' | 'datetime' = 'date') => {
    const parsed = date instanceof Date ? date : new Date(String(date));
    if (Number.isNaN(parsed.getTime())) return '';
    return format === 'datetime'
      ? parsed.toLocaleString('pt-BR', { timeZone: DEFAULT_SCHEDULING.timezone })
      : parsed.toLocaleDateString('pt-BR', { timeZone: DEFAULT_SCHEDULING.timezone });
  },
};

const evaluateExpression = (expression: string, context: FormulaContext): unknown => {
  const trimmed = expression.trim().replace(/^=+\s*/, '');
  if (!trimmed) return null;
  try {
    const fn = new Function('ctx', 'utils', `with(ctx){with(utils){return (${trimmed});}}`);
    return fn(context, formulaUtils);
  } catch {
    return null;
  }
};

const applyFormulaTokens = (value: string, context: FormulaContext): string =>
  value.replace(/{{=\s*([^}]+)\s*}}/g, (_match, expr) => {
    const result = evaluateExpression(expr, context);
    return result == null ? '' : String(result);
  });

export const getAutoContactStepDelayMs = (step: AutoContactFlowStep, lead?: Lead): number => {
  if (step.delayExpression && lead) {
    const context = buildFormulaContext(lead, DEFAULT_SCHEDULING.timezone);
    const result = evaluateExpression(step.delayExpression, context);
    const parsed = safeNumber(result);
    if (parsed !== null) {
      return Math.max(0, parsed) * (DELAY_UNIT_TO_MS[step.delayUnit] ?? DELAY_UNIT_TO_MS.hours);
    }
  }

  return (step.delayValue ?? 0) * (DELAY_UNIT_TO_MS[step.delayUnit] ?? DELAY_UNIT_TO_MS.hours);
};

export const DEFAULT_AUTO_CONTACT_FLOWS: AutoContactFlow[] = [
  {
    id: 'flow-1',
    name: 'Follow-up automático',
    triggerStatus: DEFAULT_STATUS,
    finalStatus: '',
    scheduling: {
      startHour: DEFAULT_SCHEDULING.startHour,
      endHour: DEFAULT_SCHEDULING.endHour,
      allowedWeekdays: DEFAULT_SCHEDULING.allowedWeekdays,
    },
    steps: [
      {
        id: 'flow-1-step-1',
        delayValue: 2,
        delayUnit: 'hours',
        actionType: 'send_message',
        messageSource: 'template',
        templateId: 'template-1',
      },
      {
        id: 'flow-1-step-2',
        delayValue: 24,
        delayUnit: 'hours',
        actionType: 'send_message',
        messageSource: 'template',
        templateId: 'template-2',
      },
      {
        id: 'flow-1-step-3',
        delayValue: 48,
        delayUnit: 'hours',
        actionType: 'send_message',
        messageSource: 'template',
        templateId: 'template-3',
      },
    ],
    conditionLogic: 'all',
    conditions: [],
    exitConditionLogic: 'any',
    exitConditions: [],
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
  const apiKeyValue = typeof settings.apiKey === 'string' ? settings.apiKey : (typeof settings.token === 'string' ? settings.token : '');
  const rawFlows =
    Array.isArray(settings.flows) && settings.flows.length > 0 ? settings.flows : DEFAULT_AUTO_CONTACT_FLOWS;
  const fallbackTemplateId = messageTemplates[0]?.id ?? '';
  const normalizeConditionField = (field: unknown): AutoContactFlowConditionField => {
    switch (field) {
      case 'origem':
      case 'cidade':
      case 'responsavel':
      case 'status':
      case 'tag':
      case 'canal':
      case 'whatsapp_valid':
      case 'event':
      case 'estado':
      case 'regiao':
      case 'tipo_contratacao':
      case 'operadora_atual':
      case 'email':
      case 'telefone':
      case 'data_criacao':
      case 'lead_criado':
      case 'ultimo_contato':
      case 'proximo_retorno':
      case 'lead_created':
        return field;
      default:
        return 'origem';
    }
  };
  const normalizeConditionOperator = (operator: unknown): AutoContactFlowConditionOperator => {
    switch (operator) {
      case 'equals':
      case 'contains':
      case 'not_equals':
      case 'not_contains':
      case 'starts_with':
      case 'ends_with':
      case 'in_list':
      case 'not_in_list':
      case 'greater_than':
      case 'greater_or_equal':
      case 'less_than':
      case 'less_or_equal':
        return operator;
      default:
        return 'contains';
    }
  };
  const normalizeActionType = (value: unknown): AutoContactFlowActionType => {
    switch (value) {
      case 'send_message':
      case 'update_status':
      case 'archive_lead':
      case 'delete_lead':
        return value;
      default:
        return 'send_message';
    }
  };
  const normalizeMessageSource = (value: unknown): AutoContactFlowMessageSource =>
    value === 'custom' ? 'custom' : 'template';
  const normalizeInvalidNumberAction = (value: unknown): AutoContactInvalidNumberAction => {
    switch (value) {
      case 'update_status':
      case 'archive_lead':
      case 'delete_lead':
        return value;
      default:
        return 'none';
    }
  };
  const normalizeCustomMessage = (message: any): AutoContactFlowCustomMessage => {
    const type = normalizeMessageType(message?.type);
    return {
      type,
      text: typeof message?.text === 'string' ? message.text : '',
      mediaUrl: typeof message?.mediaUrl === 'string' ? message.mediaUrl : '',
      caption: typeof message?.caption === 'string' ? message.caption : '',
      filename: typeof message?.filename === 'string' ? message.filename : '',
    };
  };

  const normalizeFlowGraph = (graph: any): AutoContactFlowGraph | undefined => {
    if (!graph || typeof graph !== 'object') return undefined;
    const nodes = Array.isArray(graph.nodes)
      ? graph.nodes
          .map((node: any) => {
            const nodeId = typeof node?.id === 'string' ? node.id : '';
            const type = node?.type as AutoContactFlowGraphNodeType;
            if (!nodeId || !type) return null;
            return {
              id: nodeId,
              type,
              position: {
                x: Number.isFinite(Number(node?.position?.x)) ? Number(node.position.x) : 0,
                y: Number.isFinite(Number(node?.position?.y)) ? Number(node.position.y) : 0,
              },
              data: {
                label: typeof node?.data?.label === 'string' ? node.data.label : '',
                step: node?.data?.step as AutoContactFlowStep | undefined,
                conditions: Array.isArray(node?.data?.conditions) ? node.data.conditions : undefined,
                conditionLogic: node?.data?.conditionLogic === 'any' ? 'any' : 'all',
              },
            } as AutoContactFlowGraphNode;
          })
          .filter(Boolean)
      : [];
    const edges = Array.isArray(graph.edges)
      ? graph.edges
          .map((edge: any) => {
            const edgeId = typeof edge?.id === 'string' ? edge.id : '';
            if (!edgeId || typeof edge?.source !== 'string' || typeof edge?.target !== 'string') return null;
            return {
              id: edgeId,
              source: edge.source,
              target: edge.target,
              label: typeof edge?.label === 'string' ? edge.label : undefined,
            } as AutoContactFlowGraphEdge;
          })
          .filter(Boolean)
      : [];
    if (nodes.length === 0) return undefined;
    return { nodes, edges };
  };

  const rawScheduling = settings.scheduling && typeof settings.scheduling === 'object' ? settings.scheduling : {};
  const rawDailySendLimit =
    Number(rawScheduling.dailySendLimit ?? settings.dailySendLimit);
  const dailySendLimit =
    Number.isFinite(rawDailySendLimit) && rawDailySendLimit > 0 ? rawDailySendLimit : null;
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
    dailySendLimit,
    holidays: Array.isArray(rawScheduling.holidays)
      ? rawScheduling.holidays.filter((value: unknown) => typeof value === 'string')
      : [],
  };

  const normalizedFlows: AutoContactFlow[] = rawFlows
    .map((flow: any, flowIndex: number) => {
      const flowId = typeof flow?.id === 'string' && flow.id.trim() ? flow.id : `flow-${flowIndex}`;
      const steps = Array.isArray(flow?.steps) ? flow.steps : [];
      const rawConditions = Array.isArray(flow?.conditions) ? flow.conditions : [];
      const rawExitConditions = Array.isArray(flow?.exitConditions) ? flow.exitConditions : [];
      const normalizedConditions = rawConditions
        .map((condition: any, conditionIndex: number) => {
          const field = normalizeConditionField(condition?.field);
          return {
          id:
            typeof condition?.id === 'string' && condition.id.trim()
              ? condition.id
              : `flow-${flowId}-condition-${conditionIndex}`,
          field,
          operator: normalizeConditionOperator(condition?.operator),
          value: typeof condition?.value === 'string' ? condition.value : '',
        };
        })
        // "lead_created" is treated as an event boolean and does not require a value.
        .filter((condition: AutoContactFlowCondition) =>
          condition.field === 'lead_created' || condition.value.trim(),
        );
      const normalizedExitConditions = rawExitConditions
        .map((condition: any, conditionIndex: number) => {
          const field = normalizeConditionField(condition?.field);
          return {
          id:
            typeof condition?.id === 'string' && condition.id.trim()
              ? condition.id
              : `flow-${flowId}-exit-condition-${conditionIndex}`,
          field,
          operator: normalizeConditionOperator(condition?.operator),
          value: typeof condition?.value === 'string' ? condition.value : '',
        };
        })
        // "lead_created" is treated as an event boolean and does not require a value.
        .filter((condition: AutoContactFlowCondition) =>
          condition.field === 'lead_created' || condition.value.trim(),
        );
      const normalizedSteps = steps
        .map((step: any, stepIndex: number) => {
          const delayValueRaw = Number(step?.delayValue ?? step?.delayHours);
          const delayValue = Number.isFinite(delayValueRaw) && delayValueRaw >= 0 ? delayValueRaw : 0;
          const delayUnit = normalizeDelayUnit(step?.delayUnit ?? (step?.delayHours != null ? 'hours' : undefined));
          const delayExpression = typeof step?.delayExpression === 'string' ? step.delayExpression.trim() : '';
          const actionType = normalizeActionType(step?.actionType);
          if (actionType === 'send_message') {
            const messageSource = normalizeMessageSource(step?.messageSource);
            const templateId = typeof step?.templateId === 'string' ? step.templateId : '';
            const validTemplateId =
              messageTemplates.some((template) => template.id === templateId) ? templateId : fallbackTemplateId;
            return {
              id: typeof step?.id === 'string' && step.id.trim() ? step.id : `flow-${flowId}-step-${stepIndex}`,
              delayValue,
              delayUnit,
              delayExpression: delayExpression || undefined,
              actionType,
              messageSource,
              templateId: validTemplateId,
              customMessage: normalizeCustomMessage(step?.customMessage),
            };
          }

        if (actionType === 'update_status') {
          return {
            id: typeof step?.id === 'string' && step.id.trim() ? step.id : `flow-${flowId}-step-${stepIndex}`,
            delayValue,
            delayUnit,
            delayExpression: delayExpression || undefined,
            actionType,
            statusToSet: typeof step?.statusToSet === 'string' ? step.statusToSet : '',
          };
        }

        if (actionType === 'webhook') {
          return {
            id: typeof step?.id === 'string' && step.id.trim() ? step.id : `flow-${flowId}-step-${stepIndex}`,
            delayValue,
            delayUnit,
            delayExpression: delayExpression || undefined,
            actionType,
            webhookUrl: typeof step?.webhookUrl === 'string' ? step.webhookUrl : '',
            webhookMethod: typeof step?.webhookMethod === 'string' ? step.webhookMethod : 'POST',
            webhookHeaders: typeof step?.webhookHeaders === 'string' ? step.webhookHeaders : '',
            webhookBody: typeof step?.webhookBody === 'string' ? step.webhookBody : '',
          };
        }

        if (actionType === 'create_task') {
          return {
            id: typeof step?.id === 'string' && step.id.trim() ? step.id : `flow-${flowId}-step-${stepIndex}`,
            delayValue,
            delayUnit,
            delayExpression: delayExpression || undefined,
            actionType,
            taskTitle: typeof step?.taskTitle === 'string' ? step.taskTitle : '',
            taskDescription: typeof step?.taskDescription === 'string' ? step.taskDescription : '',
            taskDueHours: Number.isFinite(Number(step?.taskDueHours)) ? Number(step.taskDueHours) : undefined,
            taskPriority:
              step?.taskPriority === 'alta' || step?.taskPriority === 'baixa' ? step.taskPriority : 'normal',
          };
        }

        if (actionType === 'send_email') {
          return {
            id: typeof step?.id === 'string' && step.id.trim() ? step.id : `flow-${flowId}-step-${stepIndex}`,
            delayValue,
            delayUnit,
            delayExpression: delayExpression || undefined,
            actionType,
            emailTo: typeof step?.emailTo === 'string' ? step.emailTo : '',
            emailCc: typeof step?.emailCc === 'string' ? step.emailCc : '',
            emailBcc: typeof step?.emailBcc === 'string' ? step.emailBcc : '',
            emailSubject: typeof step?.emailSubject === 'string' ? step.emailSubject : '',
            emailBody: typeof step?.emailBody === 'string' ? step.emailBody : '',
          };
        }

          return {
            id: typeof step?.id === 'string' && step.id.trim() ? step.id : `flow-${flowId}-step-${stepIndex}`,
            delayValue,
            delayUnit,
            delayExpression: delayExpression || undefined,
            actionType,
          };
        });

      const rawFlowScheduling =
        flow?.scheduling && typeof flow.scheduling === 'object' ? flow.scheduling : {};
      const flowScheduling: AutoContactFlowScheduling = {
        startHour:
          typeof rawFlowScheduling.startHour === 'string' ? rawFlowScheduling.startHour : scheduling.startHour,
        endHour: typeof rawFlowScheduling.endHour === 'string' ? rawFlowScheduling.endHour : scheduling.endHour,
        allowedWeekdays: Array.isArray(rawFlowScheduling.allowedWeekdays)
          ? rawFlowScheduling.allowedWeekdays
              .map((value: unknown) => Number(value))
              .filter((value: number) => Number.isFinite(value) && value >= 1 && value <= 7)
          : scheduling.allowedWeekdays,
      };

      const conditionLogic: AutoContactFlow['conditionLogic'] = flow?.conditionLogic === 'any' ? 'any' : 'all';
      const exitConditionLogic: AutoContactFlow['exitConditionLogic'] =
        flow?.exitConditionLogic === 'all' ? 'all' : 'any';

      return {
        id: flowId,
        name: typeof flow?.name === 'string' ? flow.name : '',
        triggerStatus: typeof flow?.triggerStatus === 'string' ? flow.triggerStatus : '',
        steps: normalizedSteps,
        finalStatus: typeof flow?.finalStatus === 'string' ? flow.finalStatus : '',
        invalidNumberAction: normalizeInvalidNumberAction(flow?.invalidNumberAction),
        invalidNumberStatus: typeof flow?.invalidNumberStatus === 'string' ? flow.invalidNumberStatus : '',
        conditionLogic,
        conditions: normalizedConditions,
        exitConditionLogic,
        exitConditions: normalizedExitConditions,
        tags: Array.isArray(flow?.tags)
          ? flow.tags.filter((tag: unknown) => typeof tag === 'string' && tag.trim()).map((tag: string) => tag.trim())
          : [],
        scheduling: flowScheduling,
        flowGraph: normalizeFlowGraph(flow?.flowGraph),
      };
    })
    .filter((flow) => flow.steps.length > 0);
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
    autoSend: settings.autoSend !== false,
    apiKey: apiKeyValue,
    messageTemplates,
    flows: normalizedFlows.length ? normalizedFlows : DEFAULT_AUTO_CONTACT_FLOWS,
    scheduling,
    monitoring,
    logging,
  };
};

export const applyTemplateVariables = (
  template: string,
  lead: Lead,
  timeZone: string = DEFAULT_SCHEDULING.timezone,
) => {
  const firstName = lead.nome_completo?.trim().split(/\s+/)[0] ?? '';
  const greeting = getGreetingForDate(new Date(), timeZone);
  const greetingTitle = formatGreetingTitle(greeting);

  const withVariables = template
    .replace(/{{\s*nome\s*}}/gi, lead.nome_completo || '')
    .replace(/{{\s*primeiro_nome\s*}}/gi, firstName)
    .replace(/{{\s*saudacao\s*}}/gi, greeting)
    .replace(/{{\s*saudacao_(?:capitalizada|titulo)\s*}}/gi, greetingTitle)
    .replace(/{{\s*origem\s*}}/gi, lead.origem || '')
    .replace(/{{\s*cidade\s*}}/gi, lead.cidade || '')
    .replace(/{{\s*responsavel\s*}}/gi, lead.responsavel || '');

  const context = buildFormulaContext(lead, timeZone);
  return applyFormulaTokens(withVariables, context);
};

const normalizePhone = (phone: string) => phone.replace(/\D/g, '');

const isValidWhatsappNumber = (lead: Lead): boolean => {
  const digits = normalizePhone(lead.telefone ?? '');
  if (!digits) return false;
  const local = digits.startsWith('55') ? digits.slice(2) : digits;
  return local.length === 10 || local.length === 11;
};

type DateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

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
  contentType,
  content,
  settings,
}: {
  lead: Lead;
  contentType: 'string' | 'image' | 'video' | 'audio' | 'document';
  content: string | { url: string; caption?: string; filename?: string };
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
    if (contentType === 'string') {
      await sendWhatsAppMessage({
        chatId,
        contentType: 'string',
        content: content as string,
      });
      return;
    }

    const media = content as { url: string; caption?: string; filename?: string };
    await sendWhatsAppMessage({
      chatId,
      contentType,
      content: {
        url: media.url,
        caption: media.caption,
        filename: contentType === 'document' ? media.filename : undefined,
      },
    });
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error);
    console.error('[AutoContact] Erro ao enviar mensagem automática:', details);
    throw error;
  }
}

const shouldExitFlow = (flow: AutoContactFlow, lead: Lead, event?: string): boolean => {
  const exitConditions = flow.exitConditions ?? [];
  if (exitConditions.length === 0) return false;
  const isMatch = (condition: AutoContactFlowCondition) => matchesFlowCondition(condition, lead, event);
  return flow.exitConditionLogic === 'all' ? exitConditions.every(isMatch) : exitConditions.some(isMatch);
};

const buildCustomMessagePayload = (
  customMessage: AutoContactFlowCustomMessage | undefined,
  lead: Lead,
  timeZone: string,
): { contentType: 'string' | 'image' | 'video' | 'audio' | 'document'; content: string | { url: string; caption?: string; filename?: string } } | null => {
  if (!customMessage) return null;
  const type = customMessage.type ?? 'text';
  const caption = applyTemplateVariables(customMessage.caption ?? '', lead, timeZone).trim();
  const text = applyTemplateVariables(customMessage.text ?? '', lead, timeZone).trim();
  const mediaUrl = customMessage.mediaUrl?.trim();

  if (type === 'text') {
    return text ? { contentType: 'string', content: text } : null;
  }

  if (!mediaUrl) {
    return text ? { contentType: 'string', content: text } : null;
  }

  return {
    contentType: type === 'image' || type === 'video' || type === 'audio' || type === 'document' ? type : 'document',
    content: {
      url: mediaUrl,
      caption: caption || text || undefined,
      filename: customMessage.filename?.trim() || undefined,
    },
  };
};

const updateLeadStatus = async (leadId: string, status: string): Promise<string> => {
  const trimmedStatus = status.trim();
  if (!trimmedStatus) return '';
  const { error } = await supabase.from('leads').update({ status: trimmedStatus }).eq('id', leadId);
  if (error) {
    console.error('[AutoContact] Erro ao atualizar status do lead:', error);
    throw error;
  }
  return trimmedStatus;
};

const updateLeadArchive = async (leadId: string, archive: boolean): Promise<void> => {
  const { error } = await supabase.from('leads').update({ arquivado: archive }).eq('id', leadId);
  if (error) {
    console.error('[AutoContact] Erro ao atualizar arquivamento do lead:', error);
    throw error;
  }
};

const deleteLead = async (leadId: string): Promise<void> => {
  const { error } = await supabase.from('leads').delete().eq('id', leadId);
  if (error) {
    console.error('[AutoContact] Erro ao excluir lead:', error);
    throw error;
  }
};

const isInvalidNumberError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();
  return (
    normalized.includes('não possui whatsapp') ||
    normalized.includes('nao possui whatsapp') ||
    normalized.includes('inválido') ||
    normalized.includes('invalido')
  );
};

const applyInvalidNumberAction = async (flow: AutoContactFlow, lead: Lead): Promise<void> => {
  const action = flow.invalidNumberAction ?? 'none';
  switch (action) {
    case 'update_status': {
      const updatedStatus = await updateLeadStatus(lead.id, flow.invalidNumberStatus ?? '');
      if (updatedStatus) {
        lead.status = updatedStatus;
      }
      return;
    }
    case 'archive_lead':
      await updateLeadArchive(lead.id, true);
      lead.arquivado = true;
      return;
    case 'delete_lead':
      await deleteLead(lead.id);
      return;
    default:
      return;
  }
};

export async function runAutoContactFlow({
  lead,
  settings,
  signal,
  event,
}: {
  lead: Lead;
  settings: AutoContactSettings;
  signal?: () => boolean;
  event?: AutoContactFlowEvent;
}): Promise<void> {
  if (signal?.() === false) return;

  const templates = settings.messageTemplates ?? [];
  const flows = settings.flows ?? [];
  const matchingFlow = flows.find((flow) => matchesAutoContactFlow(flow, lead, event)) ?? null;
  if (!matchingFlow) return;

  const flowScheduling = matchingFlow.scheduling;
  const effectiveScheduling: AutoContactSchedulingSettings = {
    ...settings.scheduling,
    startHour: flowScheduling?.startHour ?? settings.scheduling.startHour,
    endHour: flowScheduling?.endHour ?? settings.scheduling.endHour,
    allowedWeekdays:
      flowScheduling?.allowedWeekdays?.length ? flowScheduling.allowedWeekdays : settings.scheduling.allowedWeekdays,
  };

  let previousStepAt = new Date();

  for (const step of matchingFlow.steps) {
    if (signal?.() === false) return;
    if (shouldExitFlow(matchingFlow, lead, event)) return;
    const stepDelayMs = getAutoContactStepDelayMs(step, lead);
    const desiredAt = new Date(previousStepAt.getTime() + stepDelayMs);
    const scheduledAt = getNextAllowedSendAt(desiredAt, effectiveScheduling);
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

    if (step.actionType === 'send_message') {
      try {
        if (step.messageSource === 'custom') {
          const payload = buildCustomMessagePayload(step.customMessage, lead, effectiveScheduling.timezone);
          if (!payload) continue;
          await sendAutoContactMessage({
            lead,
            contentType: payload.contentType,
            content: payload.content,
            settings,
          });
        } else {
          const template =
            templates.find((item) => item.id === step.templateId) ??
            templates[0] ??
            null;
          const message = getTemplateMessage(template);
          if (!message.trim()) continue;

          const finalMessage = applyTemplateVariables(message, lead, effectiveScheduling.timezone);
          await sendAutoContactMessage({ lead, contentType: 'string', content: finalMessage, settings });
        }
      } catch (error) {
        if (isInvalidNumberError(error)) {
          console.warn('[AutoContact] Número inválido para envio automático.', {
            leadId: lead.id,
            flowId: matchingFlow.id,
            stepId: step.id,
          });
          await applyInvalidNumberAction(matchingFlow, lead);
          return;
        }
        throw error;
      }

      previousStepAt = new Date();
      continue;
    }

    if (step.actionType === 'update_status') {
      const updatedStatus = await updateLeadStatus(lead.id, step.statusToSet ?? '');
      if (updatedStatus) {
        lead.status = updatedStatus;
      }
      previousStepAt = new Date();
      continue;
    }

    if (step.actionType === 'archive_lead') {
      await updateLeadArchive(lead.id, true);
      lead.arquivado = true;
      previousStepAt = new Date();
      continue;
    }

    if (step.actionType === 'delete_lead') {
      await deleteLead(lead.id);
      return;
    }

    if (step.actionType === 'create_task' || step.actionType === 'send_email' || step.actionType === 'webhook') {
      console.info('[AutoContact] Ação não executada no cliente, use o processamento em fila.', {
        leadId: lead.id,
        stepId: step.id,
        actionType: step.actionType,
      });
      previousStepAt = new Date();
      continue;
    }

    previousStepAt = new Date();
  }
}

const matchesAutoContactFlow = (flow: AutoContactFlow, lead: Lead, event?: string): boolean => {
  const rawConditions = flow.conditions ?? [];
  const conditions = [...rawConditions];
  const triggerStatus = flow.triggerStatus?.trim();
  if (triggerStatus && !rawConditions.some((condition) => condition.field === 'status')) {
    conditions.push({
      id: 'trigger-status',
      field: 'status',
      operator: 'equals',
      value: triggerStatus,
    });
  }

  if (conditions.length === 0) return true;

  const isMatch = (condition: AutoContactFlowCondition) => matchesFlowCondition(condition, lead, event);
  return flow.conditionLogic === 'any' ? conditions.some(isMatch) : conditions.every(isMatch);
};

const matchesFlowCondition = (
  condition: AutoContactFlowCondition,
  lead: Lead,
  event?: string,
): boolean => {
  if (condition.field === 'lead_created') {
    return event === 'lead_created';
  }
  const context = buildFormulaContext(lead, DEFAULT_SCHEDULING.timezone);
  const resolvedValue = condition.value.trim().startsWith('=')
    ? String(evaluateExpression(condition.value, context) ?? '')
    : condition.value;
  const value = normalizeText(resolvedValue);
  if (!value) return false;

  if (condition.field === 'tag') {
    const tags = (lead.tags ?? []).map((tag) => normalizeText(tag)).filter(Boolean);
    return matchArrayCondition(tags, value, condition.operator);
  }

  const leadValue = normalizeText(getLeadFieldValue(lead, condition.field, event));
  if (!leadValue) return condition.operator === 'not_contains' || condition.operator === 'not_equals';
  return matchTextCondition(leadValue, value, condition.operator);
};

const getLeadFieldValue = (
  lead: Lead,
  field: AutoContactFlowConditionField,
  event?: string,
): string => {
  switch (field) {
    case 'lead_created':
      return event ?? '';
    case 'event':
      return event ?? '';
    case 'origem':
      return lead.origem ?? '';
    case 'cidade':
      return lead.cidade ?? '';
    case 'responsavel':
      return lead.responsavel ?? '';
    case 'status':
      return lead.status ?? '';
    case 'canal':
      return lead.canal ?? '';
    case 'estado':
      return lead.estado ?? '';
    case 'regiao':
      return lead.regiao ?? '';
    case 'tipo_contratacao':
      return lead.tipo_contratacao ?? '';
    case 'operadora_atual':
      return lead.operadora_atual ?? '';
    case 'email':
      return lead.email ?? '';
    case 'telefone':
      return lead.telefone ?? '';
    case 'whatsapp_valid':
      return isValidWhatsappNumber(lead) ? 'true' : 'false';
    case 'data_criacao':
      return lead.data_criacao ?? '';
    case 'lead_criado':
      return lead.created_at ?? '';
    case 'ultimo_contato':
      return lead.ultimo_contato ?? '';
    case 'proximo_retorno':
      return lead.proximo_retorno ?? '';
    case 'tag':
      return '';
    default:
      return '';
  }
};

const normalizeText = (value: string | null | undefined): string => value?.toString().trim().toLowerCase() ?? '';

const matchArrayCondition = (
  values: string[],
  expected: string,
  operator: AutoContactFlowConditionOperator,
): boolean => {
  if (operator === 'in_list' || operator === 'not_in_list') {
    const list = splitListValues(expected);
    const hasMatch = values.some((tag) => list.includes(tag));
    return operator === 'in_list' ? hasMatch : !hasMatch;
  }

  switch (operator) {
    case 'equals':
      return values.some((tag) => tag === expected);
    case 'contains':
      return values.some((tag) => tag.includes(expected));
    case 'not_equals':
      return !values.some((tag) => tag === expected);
    case 'not_contains':
      return !values.some((tag) => tag.includes(expected));
    case 'starts_with':
    case 'ends_with':
      return values.some((tag) => matchTextCondition(tag, expected, operator));
    default:
      return false;
  }
};

const matchTextCondition = (
  source: string,
  expected: string,
  operator: AutoContactFlowConditionOperator,
): boolean => {
  switch (operator) {
    case 'equals':
      return source === expected;
    case 'contains':
      return source.includes(expected);
    case 'not_equals':
      return source !== expected;
    case 'not_contains':
      return !source.includes(expected);
    case 'starts_with':
      return source.startsWith(expected);
    case 'ends_with':
      return source.endsWith(expected);
    case 'in_list': {
      const list = splitListValues(expected);
      return list.includes(source);
    }
    case 'not_in_list': {
      const list = splitListValues(expected);
      return !list.includes(source);
    }
    case 'greater_than':
    case 'greater_or_equal':
    case 'less_than':
    case 'less_or_equal':
      return compareComparableValues(source, expected, operator);
    default:
      return false;
  }
};

const splitListValues = (value: string): string[] =>
  value
    .split(/[;,]/)
    .map((item) => normalizeText(item))
    .filter(Boolean);

const compareComparableValues = (
  source: string,
  expected: string,
  operator: 'greater_than' | 'greater_or_equal' | 'less_than' | 'less_or_equal',
): boolean => {
  const sourceComparable = parseComparableValue(source);
  const expectedComparable = parseComparableValue(expected);
  if (sourceComparable === null || expectedComparable === null) return false;

  switch (operator) {
    case 'greater_than':
      return sourceComparable > expectedComparable;
    case 'greater_or_equal':
      return sourceComparable >= expectedComparable;
    case 'less_than':
      return sourceComparable < expectedComparable;
    case 'less_or_equal':
      return sourceComparable <= expectedComparable;
    default:
      return false;
  }
};

const parseComparableValue = (value: string): number | null => {
  const numericValue = Number(value);
  if (Number.isFinite(numericValue)) return numericValue;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : timestamp;
};

const utcToZonedTime = (date: Date, timeZone: string): Date => {
  const offset = getTimeZoneOffset(date, timeZone);
  return new Date(date.getTime() + offset);
};

const zonedTimeToUtc = (zonedDate: Date, timeZone: string): Date => {
  const utcDate = new Date(
    Date.UTC(
      zonedDate.getUTCFullYear(),
      zonedDate.getUTCMonth(),
      zonedDate.getUTCDate(),
      zonedDate.getUTCHours(),
      zonedDate.getUTCMinutes(),
      zonedDate.getUTCSeconds(),
    ),
  );
  const offset = getTimeZoneOffset(utcDate, timeZone);
  return new Date(utcDate.getTime() - offset);
};

const parseTimeValue = (value: string) => {
  const [hourRaw, minuteRaw] = value.split(':');
  const hour = Number.parseInt(hourRaw ?? '', 10);
  const minute = Number.parseInt(minuteRaw ?? '', 10);
  return {
    hour: Number.isFinite(hour) ? hour : 0,
    minute: Number.isFinite(minute) ? minute : 0,
  };
};

const toDateKey = (year: number, month: number, day: number) =>
  `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

const toMonthDayKey = (month: number, day: number) =>
  `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

const buildHolidaySet = (holidays?: string[]) => {
  const specificDates = new Set<string>();
  const recurringDates = new Set<string>();
  (holidays ?? []).forEach((holiday) => {
    const trimmed = holiday.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      specificDates.add(trimmed);
    } else if (/^\d{2}-\d{2}$/.test(trimmed)) {
      recurringDates.add(trimmed);
    }
  });
  return { specificDates, recurringDates };
};

const isOutsideWindow = (zonedDate: Date, startMinutes: number, endMinutes: number) => {
  const minutes = zonedDate.getUTCHours() * 60 + zonedDate.getUTCMinutes();
  return minutes < startMinutes || minutes > endMinutes;
};

const setZonedTime = (zonedDate: Date, hour: number, minute: number) =>
  new Date(Date.UTC(zonedDate.getUTCFullYear(), zonedDate.getUTCMonth(), zonedDate.getUTCDate(), hour, minute, 0));

const advanceToNextDayStart = (zonedDate: Date, startHour: number, startMinute: number) =>
  new Date(Date.UTC(zonedDate.getUTCFullYear(), zonedDate.getUTCMonth(), zonedDate.getUTCDate() + 1, startHour, startMinute, 0));

export const buildAutoContactScheduleTimeline = ({
  startAt,
  steps,
  scheduling,
  lead,
}: {
  startAt: Date;
  steps: AutoContactFlowStep[];
  scheduling: AutoContactSchedulingSettings;
  lead?: Lead;
}): AutoContactSchedulePreviewItem[] => {
  if (!steps.length) return [];
  const timeZone = scheduling.timezone || DEFAULT_SCHEDULING.timezone;
  const { hour: startHour, minute: startMinute } = parseTimeValue(scheduling.startHour || DEFAULT_SCHEDULING.startHour);
  const { hour: endHour, minute: endMinute } = parseTimeValue(scheduling.endHour || DEFAULT_SCHEDULING.endHour);
  const startMinutes = startHour * 60 + startMinute;
  const endMinutes = endHour * 60 + endMinute;
  const allowedWeekdays = scheduling.allowedWeekdays?.length
    ? scheduling.allowedWeekdays
    : DEFAULT_SCHEDULING.allowedWeekdays;
  const holidays = buildHolidaySet(scheduling.holidays);

  let cursor = utcToZonedTime(startAt, timeZone);
  return steps.map((step) => {
    const adjustmentReasons = new Set<AutoContactScheduleAdjustmentReason>();
    let scheduled = new Date(cursor.getTime() + getAutoContactStepDelayMs(step, lead));

    for (let guard = 0; guard < 366; guard += 1) {
      const weekdayNumber = getWeekdayNumber(scheduled);
      const isWeekend = weekdayNumber === 6 || weekdayNumber === 7;
      const dateKey = toDateKey(
        scheduled.getUTCFullYear(),
        scheduled.getUTCMonth() + 1,
        scheduled.getUTCDate(),
      );
      const monthDayKey = toMonthDayKey(scheduled.getUTCMonth() + 1, scheduled.getUTCDate());
      const isHoliday =
        scheduling.skipHolidays &&
        (holidays.specificDates.has(dateKey) || holidays.recurringDates.has(monthDayKey));

      if (isHoliday) {
        adjustmentReasons.add('holiday');
        scheduled = advanceToNextDayStart(scheduled, startHour, startMinute);
        continue;
      }

      if (!allowedWeekdays.includes(weekdayNumber)) {
        adjustmentReasons.add(isWeekend ? 'weekend' : 'outside_window');
        scheduled = advanceToNextDayStart(scheduled, startHour, startMinute);
        continue;
      }

      if (isOutsideWindow(scheduled, startMinutes, endMinutes)) {
        adjustmentReasons.add('outside_window');
        const minutes = scheduled.getUTCHours() * 60 + scheduled.getUTCMinutes();
        if (minutes < startMinutes) {
          scheduled = setZonedTime(scheduled, startHour, startMinute);
        } else {
          scheduled = advanceToNextDayStart(scheduled, startHour, startMinute);
        }
        continue;
      }

      break;
    }

    const scheduledUtc = zonedTimeToUtc(scheduled, timeZone);
    cursor = scheduled;
    return {
      step,
      scheduledAt: scheduledUtc,
      adjustmentReasons: Array.from(adjustmentReasons),
    };
  });
};
