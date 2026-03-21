import type {
  WhatsAppCampaignCondition,
  WhatsAppCampaignConditionLogic,
  WhatsAppCampaignConditionOperator,
  WhatsAppCampaignFlowStep,
  WhatsAppCampaignFlowStepDelayUnit,
} from '../types/whatsappCampaigns';

export type WhatsAppCampaignConditionFieldType = 'text' | 'boolean' | 'datetime';
export type WhatsAppCampaignConditionFieldGroup = 'lead' | 'conversation' | 'campaign' | 'payload';

export type WhatsAppCampaignConditionFieldOption = {
  value: string;
  label: string;
};

export type WhatsAppCampaignConditionFieldDefinition = {
  key: string;
  label: string;
  description: string;
  type: WhatsAppCampaignConditionFieldType;
  group: WhatsAppCampaignConditionFieldGroup;
  operators?: WhatsAppCampaignConditionOperator[];
  options?: WhatsAppCampaignConditionFieldOption[];
};

export type WhatsAppCampaignConditionFieldCatalogOptions = {
  statusOptions?: WhatsAppCampaignConditionFieldOption[];
  origemOptions?: WhatsAppCampaignConditionFieldOption[];
  responsavelOptions?: WhatsAppCampaignConditionFieldOption[];
  canalOptions?: string[];
  payloadKeys?: string[];
};

export type WhatsAppCampaignConversationRuntime = {
  hasInbound?: boolean;
  hasInboundSinceLastStep?: boolean;
  lastInboundAt?: string | null;
};

export type WhatsAppCampaignRuntimeContext = {
  lead?: Record<string, unknown> | null;
  payload?: Record<string, unknown> | null;
  conversation?: WhatsAppCampaignConversationRuntime | null;
  campaign?: {
    lastSentStepAt?: string | null;
  } | null;
  target?: {
    createdAt?: string | null;
    attempts?: number | null;
    lastCompletedStepIndex?: number | null;
  } | null;
  now?: Date;
};

export const WHATSAPP_CAMPAIGN_DELAY_UNIT_LABELS: Record<
  WhatsAppCampaignFlowStepDelayUnit,
  { singular: string; plural: string }
> = {
  minutes: { singular: 'minuto', plural: 'minutos' },
  hours: { singular: 'hora', plural: 'horas' },
  days: { singular: 'dia', plural: 'dias' },
};

export const WHATSAPP_CAMPAIGN_CONDITION_OPERATOR_LABELS: Record<WhatsAppCampaignConditionOperator, string> = {
  equals: 'E igual a',
  contains: 'Contem',
  not_equals: 'Nao e igual',
  not_contains: 'Nao contem',
  starts_with: 'Comeca com',
  ends_with: 'Termina com',
  in_list: 'Esta em',
  not_in_list: 'Nao esta em',
  greater_than: 'Maior que',
  greater_or_equal: 'Maior ou igual',
  less_than: 'Menor que',
  less_or_equal: 'Menor ou igual',
};

const DEFAULT_STEP_DELAY_UNIT: WhatsAppCampaignFlowStepDelayUnit = 'hours';

const BASE_CONDITION_FIELD_DEFINITIONS: WhatsAppCampaignConditionFieldDefinition[] = [
  {
    key: 'lead.status',
    label: 'Status do lead',
    description: 'Compara com o status atual do lead.',
    type: 'text',
    group: 'lead',
  },
  {
    key: 'lead.origem',
    label: 'Origem do lead',
    description: 'Compara com a origem atual do lead.',
    type: 'text',
    group: 'lead',
  },
  {
    key: 'lead.cidade',
    label: 'Cidade do lead',
    description: 'Compara com a cidade atual do lead.',
    type: 'text',
    group: 'lead',
  },
  {
    key: 'lead.responsavel',
    label: 'Responsavel',
    description: 'Compara com o responsavel atual do lead.',
    type: 'text',
    group: 'lead',
  },
  {
    key: 'lead.canal',
    label: 'Canal',
    description: 'Compara com o canal atual do lead.',
    type: 'text',
    group: 'lead',
  },
  {
    key: 'lead.email',
    label: 'E-mail',
    description: 'Compara com o e-mail do lead.',
    type: 'text',
    group: 'lead',
  },
  {
    key: 'lead.telefone',
    label: 'Telefone',
    description: 'Compara com o telefone principal do lead.',
    type: 'text',
    group: 'lead',
  },
  {
    key: 'conversation.has_inbound',
    label: 'Contato ja respondeu',
    description: 'Verifica se existe qualquer mensagem inbound registrada para o chat.',
    type: 'boolean',
    group: 'conversation',
  },
  {
    key: 'conversation.has_inbound_since_last_step',
    label: 'Respondeu desde a ultima etapa',
    description: 'Verifica se houve resposta inbound depois da ultima mensagem enviada por esta campanha.',
    type: 'boolean',
    group: 'conversation',
  },
  {
    key: 'conversation.last_inbound_at',
    label: 'Ultima resposta do contato',
    description: 'Compara a data/hora da ultima mensagem inbound registrada para o chat.',
    type: 'datetime',
    group: 'conversation',
  },
  {
    key: 'campaign.last_sent_step_at',
    label: 'Ultima etapa enviada em',
    description: 'Compara a data/hora da ultima etapa enviada para este alvo.',
    type: 'datetime',
    group: 'campaign',
  },
];

const BOOLEAN_OPTIONS: WhatsAppCampaignConditionFieldOption[] = [
  { value: 'true', label: 'Sim' },
  { value: 'false', label: 'Nao' },
];

const TEXT_OPERATORS: WhatsAppCampaignConditionOperator[] = [
  'equals',
  'contains',
  'not_equals',
  'not_contains',
  'starts_with',
  'ends_with',
  'in_list',
  'not_in_list',
  'greater_than',
  'greater_or_equal',
  'less_than',
  'less_or_equal',
];

const BOOLEAN_OPERATORS: WhatsAppCampaignConditionOperator[] = ['equals', 'not_equals'];
const DATETIME_OPERATORS: WhatsAppCampaignConditionOperator[] = [
  'equals',
  'greater_than',
  'greater_or_equal',
  'less_than',
  'less_or_equal',
];

const DELAY_UNIT_TO_MS: Record<WhatsAppCampaignFlowStepDelayUnit, number> = {
  minutes: 60 * 1000,
  hours: 60 * 60 * 1000,
  days: 24 * 60 * 60 * 1000,
};

const padNumber = (value: number): string => value.toString().padStart(2, '0');

const normalizeLookupKey = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const titleizeKey = (value: string): string =>
  value
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const defaultCreateStepId = (): string => `step-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const defaultCreateConditionId = (): string => `condition-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const formatDateTimeLocalValue = (value: string): string => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return `${parsed.getFullYear()}-${padNumber(parsed.getMonth() + 1)}-${padNumber(parsed.getDate())}T${padNumber(parsed.getHours())}:${padNumber(parsed.getMinutes())}`;
};

const normalizeBooleanConditionValue = (value: unknown): string | null => {
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }

  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized) return null;
  if (['1', 'true', 'sim', 'yes', 'y'].includes(normalized)) return 'true';
  if (['0', 'false', 'nao', 'não', 'no', 'n'].includes(normalized)) return 'false';
  return null;
};

const getOperatorsForFieldType = (
  type: WhatsAppCampaignConditionFieldType,
): WhatsAppCampaignConditionOperator[] => {
  if (type === 'boolean') return BOOLEAN_OPERATORS;
  if (type === 'datetime') return DATETIME_OPERATORS;
  return TEXT_OPERATORS;
};

const normalizeText = (value: unknown): string => String(value ?? '').trim().toLowerCase();

const splitListValues = (value: string): string[] =>
  value
    .split(/[;,]/)
    .map((item) => normalizeText(item))
    .filter(Boolean);

const parseComparableValue = (value: string): number | null => {
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return numeric;

  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : timestamp;
};

const compareComparableValues = (
  source: string,
  expected: string,
  operator: 'greater_than' | 'greater_or_equal' | 'less_than' | 'less_or_equal',
): boolean => {
  const sourceValue = parseComparableValue(source);
  const expectedValue = parseComparableValue(expected);
  if (sourceValue === null || expectedValue === null) {
    return false;
  }

  switch (operator) {
    case 'greater_than':
      return sourceValue > expectedValue;
    case 'greater_or_equal':
      return sourceValue >= expectedValue;
    case 'less_than':
      return sourceValue < expectedValue;
    case 'less_or_equal':
      return sourceValue <= expectedValue;
    default:
      return false;
  }
};

const matchTextCondition = (
  source: string,
  expected: string,
  operator: WhatsAppCampaignConditionOperator,
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
    case 'in_list':
      return splitListValues(expected).includes(source);
    case 'not_in_list':
      return !splitListValues(expected).includes(source);
    case 'greater_than':
    case 'greater_or_equal':
    case 'less_than':
    case 'less_or_equal':
      return compareComparableValues(source, expected, operator);
    default:
      return false;
  }
};

export const normalizeWhatsAppCampaignFlowStepDelayUnit = (value: unknown): WhatsAppCampaignFlowStepDelayUnit => {
  if (value === 'minutes' || value === 'days') {
    return value;
  }

  return 'hours';
};

export const normalizeWhatsAppCampaignConditionOperator = (value: unknown): WhatsAppCampaignConditionOperator => {
  switch (value) {
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
      return value;
    default:
      return 'equals';
  }
};

export const normalizeWhatsAppCampaignConditionLogic = (value: unknown): WhatsAppCampaignConditionLogic =>
  value === 'any' ? 'any' : 'all';

export const buildWhatsAppCampaignConditionFieldDefinitions = (
  options: WhatsAppCampaignConditionFieldCatalogOptions = {},
): WhatsAppCampaignConditionFieldDefinition[] => {
  const {
    statusOptions = [],
    origemOptions = [],
    responsavelOptions = [],
    canalOptions = [],
    payloadKeys = [],
  } = options;

  const canalValueOptions = canalOptions.map((value) => ({ value, label: value }));

  const definitions = BASE_CONDITION_FIELD_DEFINITIONS.map((definition) => {
    if (definition.key === 'lead.status') {
      return { ...definition, options: statusOptions.length > 0 ? statusOptions : undefined };
    }

    if (definition.key === 'lead.origem') {
      return { ...definition, options: origemOptions.length > 0 ? origemOptions : undefined };
    }

    if (definition.key === 'lead.responsavel') {
      return { ...definition, options: responsavelOptions.length > 0 ? responsavelOptions : undefined };
    }

    if (definition.key === 'lead.canal') {
      return { ...definition, options: canalValueOptions.length > 0 ? canalValueOptions : undefined };
    }

    if (definition.type === 'boolean') {
      return { ...definition, options: BOOLEAN_OPTIONS };
    }

    return definition;
  });

  const payloadDefinitions = payloadKeys
    .map((key) => normalizeLookupKey(key))
    .filter(Boolean)
    .filter((key, index, list) => list.indexOf(key) === index)
    .map<WhatsAppCampaignConditionFieldDefinition>((key) => ({
      key: `payload.${key}`,
      label: `CSV: ${titleizeKey(key)}`,
      description: `Compara com o valor importado na coluna ${titleizeKey(key)}.`,
      type: 'text',
      group: 'payload',
    }));

  return [...definitions, ...payloadDefinitions].map((definition) => ({
    ...definition,
    operators: definition.operators ?? getOperatorsForFieldType(definition.type),
  }));
};

export const getWhatsAppCampaignConditionFieldDefinitionMap = (
  definitions: WhatsAppCampaignConditionFieldDefinition[],
): Map<string, WhatsAppCampaignConditionFieldDefinition> => new Map(definitions.map((definition) => [definition.key, definition]));

export const createWhatsAppCampaignCondition = (
  definitions: WhatsAppCampaignConditionFieldDefinition[],
  preferredField = 'lead.status',
  createId: () => string = defaultCreateConditionId,
): WhatsAppCampaignCondition => {
  const definitionMap = getWhatsAppCampaignConditionFieldDefinitionMap(definitions);
  const definition = definitionMap.get(preferredField) ?? definitions[0];
  const operators = definition?.operators ?? TEXT_OPERATORS;
  const defaultValue = definition?.type === 'boolean'
    ? 'false'
    : definition?.options?.[0]?.value ?? '';

  return {
    id: createId(),
    field: definition?.key ?? preferredField,
    operator: operators[0] ?? 'equals',
    value: defaultValue,
  };
};

export const formatWhatsAppCampaignStepDelay = (step: Pick<WhatsAppCampaignFlowStep, 'delayValue' | 'delayUnit'>): string => {
  const rawValue = Number(step.delayValue ?? 0);
  const value = Number.isFinite(rawValue) && rawValue > 0 ? Math.trunc(rawValue) : 0;
  if (value <= 0) {
    return 'Sem espera';
  }

  const unit = normalizeWhatsAppCampaignFlowStepDelayUnit(step.delayUnit ?? DEFAULT_STEP_DELAY_UNIT);
  const labels = WHATSAPP_CAMPAIGN_DELAY_UNIT_LABELS[unit];
  return `${value} ${value === 1 ? labels.singular : labels.plural}`;
};

export const getWhatsAppCampaignStepDelayMs = (step: Pick<WhatsAppCampaignFlowStep, 'delayValue' | 'delayUnit'>): number => {
  const rawValue = Number(step.delayValue ?? 0);
  const value = Number.isFinite(rawValue) && rawValue > 0 ? rawValue : 0;
  const unit = normalizeWhatsAppCampaignFlowStepDelayUnit(step.delayUnit ?? DEFAULT_STEP_DELAY_UNIT);
  return value * DELAY_UNIT_TO_MS[unit];
};

export const normalizeWhatsAppCampaignFlowSteps = (
  value: unknown,
  fallbackMessage: string,
  createStepId: () => string = defaultCreateStepId,
  createConditionId: () => string = defaultCreateConditionId,
): WhatsAppCampaignFlowStep[] => {
  if (!Array.isArray(value)) {
    return [
      {
        id: createStepId(),
        type: 'text',
        text: fallbackMessage || '',
        order: 0,
        delayValue: 0,
        delayUnit: DEFAULT_STEP_DELAY_UNIT,
        conditions: [],
        conditionLogic: 'all',
      },
    ];
  }

  const parsed: WhatsAppCampaignFlowStep[] = [];

  value.forEach((item, index) => {
    if (!item || typeof item !== 'object') {
      return;
    }

    const row = item as Record<string, unknown>;
    const type = row.type === 'image' || row.type === 'video' || row.type === 'audio' || row.type === 'document' ? row.type : 'text';
    const delayValueRaw = Number(row.delayValue ?? 0);
    const delayValue = Number.isFinite(delayValueRaw) && delayValueRaw >= 0 ? Math.trunc(delayValueRaw) : 0;
    const rawConditions = Array.isArray(row.conditions) ? row.conditions : [];
    const conditions = rawConditions
      .map((condition) => {
        if (!condition || typeof condition !== 'object') {
          return null;
        }

        const conditionRow = condition as Record<string, unknown>;
        const field = typeof conditionRow.field === 'string' ? conditionRow.field.trim() : '';
        if (!field) {
          return null;
        }

        return {
          id:
            typeof conditionRow.id === 'string' && conditionRow.id.trim()
              ? conditionRow.id
              : createConditionId(),
          field,
          operator: normalizeWhatsAppCampaignConditionOperator(conditionRow.operator),
          value: typeof conditionRow.value === 'string' ? conditionRow.value : '',
        } satisfies WhatsAppCampaignCondition;
      })
      .filter((condition): condition is WhatsAppCampaignCondition => Boolean(condition));

    parsed.push({
      id: typeof row.id === 'string' && row.id.trim() ? row.id : createStepId(),
      type,
      order: typeof row.order === 'number' ? row.order : index,
      text: typeof row.text === 'string' ? row.text : undefined,
      mediaUrl: typeof row.mediaUrl === 'string' ? row.mediaUrl : undefined,
      caption: typeof row.caption === 'string' ? row.caption : undefined,
      filename: typeof row.filename === 'string' ? row.filename : undefined,
      delayValue,
      delayUnit: normalizeWhatsAppCampaignFlowStepDelayUnit(row.delayUnit ?? DEFAULT_STEP_DELAY_UNIT),
      conditions,
      conditionLogic: normalizeWhatsAppCampaignConditionLogic(row.conditionLogic),
    });
  });

  parsed.sort((left, right) => (left.order ?? 0) - (right.order ?? 0));

  if (parsed.length === 0) {
    return [
      {
        id: createStepId(),
        type: 'text',
        text: fallbackMessage || '',
        order: 0,
        delayValue: 0,
        delayUnit: DEFAULT_STEP_DELAY_UNIT,
        conditions: [],
        conditionLogic: 'all',
      },
    ];
  }

  return parsed.map((step, index) => ({
    ...step,
    order: index,
    delayValue: Number.isFinite(Number(step.delayValue)) && Number(step.delayValue) >= 0 ? Math.trunc(Number(step.delayValue)) : 0,
    delayUnit: normalizeWhatsAppCampaignFlowStepDelayUnit(step.delayUnit ?? DEFAULT_STEP_DELAY_UNIT),
    conditions: Array.isArray(step.conditions) ? step.conditions : [],
    conditionLogic: normalizeWhatsAppCampaignConditionLogic(step.conditionLogic),
  }));
};

export const resolveWhatsAppCampaignConditionFieldValue = (
  field: string,
  context: WhatsAppCampaignRuntimeContext,
): string | boolean => {
  const lead = context.lead ?? null;
  const payload = context.payload ?? null;
  const conversation = context.conversation ?? null;
  const campaign = context.campaign ?? null;

  if (field.startsWith('payload.')) {
    const rawKey = field.slice('payload.'.length);
    const normalizedKey = normalizeLookupKey(rawKey);
    if (!normalizedKey || !payload || typeof payload !== 'object') {
      return '';
    }

    const payloadRecord = payload as Record<string, unknown>;
    const match = Object.entries(payloadRecord).find(([key]) => normalizeLookupKey(key) === normalizedKey);
    return match?.[1] == null ? '' : String(match[1]);
  }

  if (field === 'conversation.has_inbound') {
    return Boolean(conversation?.hasInbound);
  }

  if (field === 'conversation.has_inbound_since_last_step') {
    return Boolean(conversation?.hasInboundSinceLastStep);
  }

  if (field === 'conversation.last_inbound_at') {
    return conversation?.lastInboundAt ?? '';
  }

  if (field === 'campaign.last_sent_step_at') {
    return campaign?.lastSentStepAt ?? '';
  }

  if (field.startsWith('lead.')) {
    const key = field.slice('lead.'.length);
    const normalizedKey = normalizeLookupKey(key);
    if (!normalizedKey || !lead || typeof lead !== 'object') {
      return '';
    }

    const leadRecord = lead as Record<string, unknown>;
    const match = Object.entries(leadRecord).find(([entryKey]) => normalizeLookupKey(entryKey) === normalizedKey);
    return match?.[1] == null ? '' : String(match[1]);
  }

  return '';
};

export const matchesWhatsAppCampaignCondition = (
  condition: WhatsAppCampaignCondition,
  context: WhatsAppCampaignRuntimeContext,
): boolean => {
  const rawValue = resolveWhatsAppCampaignConditionFieldValue(condition.field, context);

  if (typeof rawValue === 'boolean') {
    const actual = normalizeBooleanConditionValue(rawValue) ?? 'false';
    const expected = normalizeBooleanConditionValue(condition.value) ?? 'true';
    if (condition.operator === 'not_equals') {
      return actual !== expected;
    }
    return actual === expected;
  }

  const value = normalizeText(condition.value);
  const source = normalizeText(rawValue);
  if (!value) {
    return false;
  }
  if (!source) {
    return condition.operator === 'not_contains' || condition.operator === 'not_equals';
  }

  return matchTextCondition(source, value, condition.operator);
};

export const matchesWhatsAppCampaignConditionGroup = (
  conditions: WhatsAppCampaignCondition[] | null | undefined,
  logic: WhatsAppCampaignConditionLogic | null | undefined,
  context: WhatsAppCampaignRuntimeContext,
): boolean => {
  const list = Array.isArray(conditions) ? conditions : [];
  if (list.length === 0) {
    return true;
  }

  const isMatch = (condition: WhatsAppCampaignCondition) => matchesWhatsAppCampaignCondition(condition, context);
  return logic === 'any' ? list.some(isMatch) : list.every(isMatch);
};

export const buildWhatsAppCampaignConditionValueInput = (
  field: WhatsAppCampaignConditionFieldDefinition,
  value: string,
): string => {
  if (field.type === 'datetime' && value.trim()) {
    return formatDateTimeLocalValue(value);
  }

  return value;
};
