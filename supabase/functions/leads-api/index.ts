import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey, X-API-Key',
};

function log(message: string, details?: Record<string, unknown>) {
  const timestamp = new Date().toISOString();

  if (details && Object.keys(details).length > 0) {
    console.log(`[leads-api] ${timestamp} - ${message}`, details);
  } else {
    console.log(`[leads-api] ${timestamp} - ${message}`);
  }
}

type LeadLookupMaps = {
  originById: Map<string, string>;
  originByName: Map<string, string>;
  tipoById: Map<string, string>;
  tipoByLabel: Map<string, string>;
  statusById: Map<string, string>;
  statusByName: Map<string, string>;
  defaultStatusId: string | null;
  responsavelById: Map<string, string>;
  responsavelByLabel: Map<string, string>;
};

type AutoContactStep = {
  message: string;
  delaySeconds: number;
  active: boolean;
};

type AutoContactSettings = {
  enabled: boolean;
  baseUrl: string;
  sessionId: string;
  apiKey: string;
  statusOnSend: string;
  messageFlow: AutoContactStep[];
};

type FlowMessageType = 'text' | 'image' | 'video' | 'audio' | 'document';

type AutoContactTemplateMessage = {
  id: string;
  type: FlowMessageType;
  text?: string;
  mediaUrl?: string;
  caption?: string;
  filename?: string;
};

type AutoContactTemplate = {
  id: string;
  name: string;
  message: string;
  messages?: AutoContactTemplateMessage[];
};

type AutoContactFlowActionType = 'send_message' | 'update_status' | 'archive_lead' | 'delete_lead';

type AutoContactFlowMessageSource = 'template' | 'custom';

type AutoContactFlowCustomMessage = {
  type: FlowMessageType;
  text?: string;
  mediaUrl?: string;
  caption?: string;
  filename?: string;
};

type AutoContactFlowStep = {
  id: string;
  delayHours: number;
  actionType: AutoContactFlowActionType;
  messageSource?: AutoContactFlowMessageSource;
  templateId?: string;
  customMessage?: AutoContactFlowCustomMessage;
  statusToSet?: string;
};

type AutoContactFlowConditionField =
  | 'origem'
  | 'cidade'
  | 'responsavel'
  | 'status'
  | 'tag'
  | 'event'
  | 'lead_created'
  | 'canal'
  | 'estado'
  | 'regiao'
  | 'tipo_contratacao'
  | 'operadora_atual'
  | 'email'
  | 'telefone'
  | 'data_criacao'
  | 'ultimo_contato'
  | 'proximo_retorno';

type AutoContactFlowConditionOperator =
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

type AutoContactFlowCondition = {
  id: string;
  field: AutoContactFlowConditionField;
  operator: AutoContactFlowConditionOperator;
  value: string;
};

type AutoContactFlow = {
  id: string;
  name: string;
  triggerStatus: string;
  steps: AutoContactFlowStep[];
  finalStatus?: string;
  conditionLogic?: 'all' | 'any';
  conditions?: AutoContactFlowCondition[];
  exitConditionLogic?: 'all' | 'any';
  exitConditions?: AutoContactFlowCondition[];
  tags?: string[];
};

type AutoContactFlowSettings = {
  enabled: boolean;
  autoSend: boolean;
  apiKey: string;
  messageTemplates: AutoContactTemplate[];
  flows: AutoContactFlow[];
};

type AutoContactFlowEvent = 'lead_created';

type LookupTableRow = { id: string; nome?: string | null; label?: string | null; padrao?: boolean | null };

function normalizeText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

function buildLookupMaps({
  origins,
  statuses,
  tipos,
  responsaveis,
}: {
  origins: LookupTableRow[];
  statuses: LookupTableRow[];
  tipos: LookupTableRow[];
  responsaveis: LookupTableRow[];
}): LeadLookupMaps {
  const originById = new Map<string, string>();
  const originByName = new Map<string, string>();
  origins.forEach((origin) => {
    if (origin.id && origin.nome) {
      originById.set(origin.id, origin.nome);
      originByName.set(normalizeText(origin.nome), origin.id);
    }
  });

  const tipoById = new Map<string, string>();
  const tipoByLabel = new Map<string, string>();
  tipos.forEach((tipo) => {
    if (tipo.id && tipo.label) {
      tipoById.set(tipo.id, tipo.label);
      tipoByLabel.set(normalizeText(tipo.label), tipo.id);
    }
  });

  const statusById = new Map<string, string>();
  const statusByName = new Map<string, string>();
  statuses.forEach((status) => {
    if (status.id && status.nome) {
      statusById.set(status.id, status.nome);
      statusByName.set(normalizeText(status.nome), status.id);
    }
  });

  const responsavelById = new Map<string, string>();
  const responsavelByLabel = new Map<string, string>();
  responsaveis.forEach((responsavel) => {
    if (responsavel.id && responsavel.label) {
      responsavelById.set(responsavel.id, responsavel.label);
      responsavelByLabel.set(normalizeText(responsavel.label), responsavel.id);
    }
  });

  const defaultStatusId =
    statuses.find((status) => status.padrao)?.id || statuses.find((status) => status.id)?.id || null;

  return {
    originById,
    originByName,
    tipoById,
    tipoByLabel,
    statusById,
    statusByName,
    defaultStatusId,
    responsavelById,
    responsavelByLabel,
  };
}

async function loadLeadLookupMaps(supabase: ReturnType<typeof createClient>): Promise<LeadLookupMaps> {
  const [origins, statuses, tipos, responsaveis] = await Promise.all([
    supabase.from('lead_origens').select('id, nome'),
    supabase.from('lead_status_config').select('id, nome, padrao'),
    supabase.from('lead_tipos_contratacao').select('id, label'),
    supabase.from('lead_responsaveis').select('id, label'),
  ]);

  const errors = [origins.error, statuses.error, tipos.error, responsaveis.error].filter(Boolean);
  if (errors.length > 0) {
    throw new Error(errors.map((err) => err?.message).join('; '));
  }

  return buildLookupMaps({
    origins: origins.data || [],
    statuses: statuses.data || [],
    tipos: tipos.data || [],
    responsaveis: responsaveis.data || [],
  });
}

function resolveForeignKey(
  idInput: unknown,
  nameInput: unknown,
  idMap: Map<string, string>,
  nameMap: Map<string, string>,
): string | null {
  if (typeof idInput === 'string' && idInput.trim() && idMap.has(idInput.trim())) {
    return idInput.trim();
  }

  if (typeof nameInput === 'string' && nameInput.trim()) {
    const normalized = normalizeText(nameInput);
    return nameMap.get(normalized) ?? null;
  }

  return null;
}

interface LeadData {
  nome_completo: string;
  telefone: string;
  email?: string | null;
  cidade?: string | null;
  regiao?: string | null;
  cep?: string | null;
  endereco?: string | null;
  estado?: string | null;
  origem_id: string;
  tipo_contratacao_id: string;
  operadora_atual?: string | null;
  status_id: string;
  responsavel_id: string;
  proximo_retorno?: string | null;
  observacoes?: string | null;
  data_criacao: string;
  ultimo_contato: string;
  arquivado: boolean;
}

function parseDateInputToISOString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  let normalized = trimmed;
  const hasTime = trimmed.includes('T');
  const timezoneRegex = /(Z|[+-]\d{2}:?\d{2})$/i;

  if (!hasTime) {
    normalized = `${trimmed}T00:00:00`;
  } else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(trimmed)) {
    normalized = `${trimmed}:00`;
  }

  if (!timezoneRegex.test(normalized)) {
    // Assume horário de Brasília quando o fuso não é informado
    normalized = `${normalized}-03:00`;
  } else if (/^.*[+-]\d{4}$/i.test(normalized)) {
    // Garante que o offset tenha o formato +-HH:MM
    normalized = `${normalized.slice(0, -2)}:${normalized.slice(-2)}`;
  }

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}

function sanitizeOptionalString(value: any): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  return null;
}

function validateLeadData(
  data: any,
  lookups: LeadLookupMaps,
): { valid: boolean; errors: string[]; leadData?: LeadData } {
  const errors: string[] = [];

  if (!data.nome_completo || typeof data.nome_completo !== 'string') {
    errors.push('Campo "nome_completo" é obrigatório e deve ser uma string');
  }

  if (!data.telefone || typeof data.telefone !== 'string') {
    errors.push('Campo "telefone" é obrigatório e deve ser uma string');
  }

  const origemId = resolveForeignKey(data.origem_id, data.origem, lookups.originById, lookups.originByName);
  if (!origemId) {
    errors.push('Campo "origem" é obrigatório e deve corresponder a uma origem válida');
  }
  const origemName = origemId ? lookups.originById.get(origemId) : null;

  const tipoContratacaoId = resolveForeignKey(
    data.tipo_contratacao_id,
    data.tipo_contratacao,
    lookups.tipoById,
    lookups.tipoByLabel,
  );
  if (!tipoContratacaoId) {
    errors.push('Campo "tipo_contratacao" é obrigatório e deve corresponder a um tipo de contratação válido');
  }
  const tipoContratacaoLabel = tipoContratacaoId ? lookups.tipoById.get(tipoContratacaoId) : null;

  const responsavelId = resolveForeignKey(
    data.responsavel_id,
    data.responsavel,
    lookups.responsavelById,
    lookups.responsavelByLabel,
  );
  if (!responsavelId) {
    errors.push('Campo "responsavel" é obrigatório e deve corresponder a um responsável válido');
  }
  const responsavelLabel = responsavelId ? lookups.responsavelById.get(responsavelId) : null;

  const statusId =
    resolveForeignKey(data.status_id, data.status, lookups.statusById, lookups.statusByName) ||
    lookups.defaultStatusId;
  if (!statusId) {
    errors.push('Campo "status" é obrigatório e deve corresponder a um status válido');
  }
  const statusName = statusId ? lookups.statusById.get(statusId) : null;

  if (data.email && typeof data.email === 'string') {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      errors.push('Campo "email" deve ser um endereço de e-mail válido');
    }
  }

  let creationDateIso: string | null = null;
  if (data.data_criacao !== undefined) {
    creationDateIso = parseDateInputToISOString(data.data_criacao);
    if (!creationDateIso) {
      errors.push('Campo "data_criacao" deve ser uma data válida (ISO 8601 ou YYYY-MM-DD)');
    }
  }

  let proximoRetorno: string | null = null;
  if (data.proximo_retorno !== undefined) {
    const parsed = parseDateInputToISOString(data.proximo_retorno);
    if (data.proximo_retorno && !parsed) {
      errors.push('Campo "proximo_retorno" deve ser uma data válida (ISO 8601 ou YYYY-MM-DD)');
    } else {
      proximoRetorno = parsed;
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  const now = new Date();
  const creationDate = creationDateIso ? new Date(creationDateIso) : now;
  const creationDateIsoValue = creationDate.toISOString();

  const leadData: LeadData = {
    nome_completo: data.nome_completo.trim(),
    telefone: normalizeTelefone(data.telefone),
    email: sanitizeOptionalString(data.email),
    cidade: sanitizeOptionalString(data.cidade),
    regiao: sanitizeOptionalString(data.regiao),
    cep: sanitizeOptionalString(data.cep),
    endereco: sanitizeOptionalString(data.endereco),
    estado: sanitizeOptionalString(data.estado),
    origem_id: origemId!,
    tipo_contratacao_id: tipoContratacaoId!,
    operadora_atual: sanitizeOptionalString(data.operadora_atual),
    status_id: statusId!,
    responsavel_id: responsavelId!,
    proximo_retorno: proximoRetorno,
    observacoes: sanitizeOptionalString(data.observacoes),
    data_criacao: creationDateIsoValue,
    ultimo_contato: creationDateIsoValue,
    arquivado: false,
  };

  return { valid: true, errors: [], leadData };
}

function validateLeadUpdate(
  data: any,
  lookups: LeadLookupMaps,
): { valid: boolean; errors: string[]; updateData: Partial<LeadData> } {
  const errors: string[] = [];
  const updateData: Partial<LeadData> = {};

  if (data.nome_completo !== undefined) {
    if (typeof data.nome_completo !== 'string') {
      errors.push('Campo "nome_completo" deve ser uma string');
    } else {
      updateData.nome_completo = data.nome_completo.trim();
    }
  }

  if (data.telefone !== undefined) {
    if (typeof data.telefone !== 'string') {
      errors.push('Campo "telefone" deve ser uma string');
    } else {
      updateData.telefone = normalizeTelefone(data.telefone);
    }
  }

  if (data.email !== undefined) {
    const email = sanitizeOptionalString(data.email);
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        errors.push('Campo "email" deve ser um endereço de e-mail válido');
      }
    }
    updateData.email = email;
  }

  if (data.cidade !== undefined) updateData.cidade = sanitizeOptionalString(data.cidade);
  if (data.regiao !== undefined) updateData.regiao = sanitizeOptionalString(data.regiao);
  if (data.cep !== undefined) updateData.cep = sanitizeOptionalString(data.cep);
  if (data.endereco !== undefined) updateData.endereco = sanitizeOptionalString(data.endereco);
  if (data.estado !== undefined) updateData.estado = sanitizeOptionalString(data.estado);
  if (data.operadora_atual !== undefined) updateData.operadora_atual = sanitizeOptionalString(data.operadora_atual);
  if (data.proximo_retorno !== undefined) {
    const parsed = parseDateInputToISOString(data.proximo_retorno);
    if (data.proximo_retorno && !parsed) {
      errors.push('Campo "proximo_retorno" deve ser uma data válida (ISO 8601 ou YYYY-MM-DD)');
    } else {
      updateData.proximo_retorno = parsed;
    }
  }
  if (data.observacoes !== undefined) updateData.observacoes = sanitizeOptionalString(data.observacoes);

  if (data.origem_id !== undefined || data.origem !== undefined) {
    const origemId = resolveForeignKey(data.origem_id, data.origem, lookups.originById, lookups.originByName);
    if (!origemId) {
      errors.push('Campo "origem" deve corresponder a uma origem válida');
    } else {
      updateData.origem_id = origemId;
    }
  }

  if (data.tipo_contratacao_id !== undefined || data.tipo_contratacao !== undefined) {
    const tipoId = resolveForeignKey(
      data.tipo_contratacao_id,
      data.tipo_contratacao,
      lookups.tipoById,
      lookups.tipoByLabel,
    );
    if (!tipoId) {
      errors.push('Campo "tipo_contratacao" deve corresponder a um tipo de contratação válido');
    } else {
      updateData.tipo_contratacao_id = tipoId;
    }
  }

  if (data.responsavel_id !== undefined || data.responsavel !== undefined) {
    const responsavelId = resolveForeignKey(
      data.responsavel_id,
      data.responsavel,
      lookups.responsavelById,
      lookups.responsavelByLabel,
    );
    if (!responsavelId) {
      errors.push('Campo "responsavel" deve corresponder a um responsável válido');
    } else {
      updateData.responsavel_id = responsavelId;
    }
  }

  if (data.status_id !== undefined || data.status !== undefined) {
    const statusId = resolveForeignKey(data.status_id, data.status, lookups.statusById, lookups.statusByName);
    if (!statusId) {
      errors.push('Campo "status" deve corresponder a um status válido');
    } else {
      updateData.status_id = statusId;
    }
  }

  if (data.data_criacao !== undefined) {
    const parsedDate = parseDateInputToISOString(data.data_criacao);
    if (!parsedDate) {
      errors.push('Campo "data_criacao" deve ser uma data válida (ISO 8601 ou YYYY-MM-DD)');
    } else {
      updateData.data_criacao = parsedDate;
    }
  }

  return { valid: errors.length === 0, errors, updateData };
}

function resolveFilterId(
  value: string | null,
  idMap: Map<string, string>,
  nameMap: Map<string, string>,
): string | null {
  if (!value) return null;
  if (idMap.has(value)) return value;
  return nameMap.get(normalizeText(value)) ?? null;
}

function mapLeadRelationsForResponse(lead: any, lookups: LeadLookupMaps) {
  return {
    ...lead,
    origem: lead.origem ?? (lead.origem_id ? lookups.originById.get(lead.origem_id) ?? null : null),
    tipo_contratacao:
      lead.tipo_contratacao ?? (lead.tipo_contratacao_id ? lookups.tipoById.get(lead.tipo_contratacao_id) ?? null : null),
    status: lead.status ?? (lead.status_id ? lookups.statusById.get(lead.status_id) ?? null : null),
    responsavel:
      lead.responsavel ?? (lead.responsavel_id ? lookups.responsavelById.get(lead.responsavel_id) ?? null : null),
  };
}

function getDuplicateStatusId(lookups: LeadLookupMaps) {
  return lookups.statusByName.get(normalizeText('Duplicado')) ?? null;
}

async function isDuplicateLead(
  supabase: ReturnType<typeof createClient>,
  telefone: string,
  email?: string | null,
): Promise<boolean> {
  const filters = [telefone ? `telefone.eq.${telefone}` : null, email ? `email.ilike.${email.toLowerCase()}` : null].filter(
    Boolean,
  );

  if (filters.length === 0) return false;

  const { data, error } = await supabase.from('leads').select('id').or(filters.join(',')).limit(1);

  if (error) {
    console.error('Erro ao verificar duplicidade de lead', error);
    return false;
  }

  return (data?.length ?? 0) > 0;
}

function normalizeTelefone(telefone: string): string {
  return telefone.replace(/\D/g, '');
}

async function sendWhatsappMessages({
  endpoint,
  apiKey,
  chatId,
  messages,
}: {
  endpoint: string;
  apiKey: string;
  chatId: string;
  messages: string[];
}): Promise<void> {
  for (const content of messages) {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        chatId,
        contentType: 'string',
        content,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || 'Falha ao enviar mensagem automática');
    }
  }
}

const normalizeAutoContactSettings = (settings: any): AutoContactSettings | null => {
  if (!settings || typeof settings !== 'object') return null;

  const messageFlow: AutoContactStep[] = Array.isArray(settings.messageFlow)
    ? settings.messageFlow.map((step: any, index: number) => ({
        message: typeof step?.message === 'string' ? step.message : '',
        delaySeconds:
          Number.isFinite(step?.delaySeconds)
            ? Math.max(0, Number(step.delaySeconds))
            : Number.isFinite(step?.delayMinutes)
              ? Math.max(0, Number(step.delayMinutes) * 60)
              : 0,
        active: step?.active !== false,
      }))
    : [];

  return {
    enabled: settings.enabled !== false,
    baseUrl:
      typeof settings.baseUrl === 'string' && settings.baseUrl.trim()
        ? settings.baseUrl.trim()
        : 'http://localhost:3000',
    sessionId:
      typeof settings.sessionId === 'string' && settings.sessionId.trim() ? settings.sessionId.trim() : '',
    apiKey: typeof settings.apiKey === 'string' ? settings.apiKey : '',
    statusOnSend:
      typeof settings.statusOnSend === 'string' && settings.statusOnSend.trim()
        ? settings.statusOnSend.trim()
        : 'Contato Inicial',
    messageFlow,
  };
};

const applyTemplateVariables = (template: string, lead: any) => {
  const firstName = lead?.nome_completo?.trim()?.split(/\s+/)?.[0] ?? '';

  return template
    .replace(/{{\s*nome\s*}}/gi, lead?.nome_completo || '')
    .replace(/{{\s*primeiro_nome\s*}}/gi, firstName)
    .replace(/{{\s*origem\s*}}/gi, lead?.origem || '')
    .replace(/{{\s*cidade\s*}}/gi, lead?.cidade || '')
    .replace(/{{\s*responsavel\s*}}/gi, lead?.responsavel || '');
};

const sanitizeWhapiToken = (token: string): string => token?.replace(/^Bearer\s+/i, '').trim();

const normalizeMessageType = (type: unknown): FlowMessageType =>
  type === 'image' || type === 'video' || type === 'audio' || type === 'document' ? type : 'text';

const getTemplateMessages = (template?: AutoContactTemplate | null): AutoContactTemplateMessage[] => {
  if (!template) return [];
  const rawMessages = Array.isArray(template.messages) ? template.messages : [];
  if (rawMessages.length > 0) {
    return rawMessages.map((message, index) => ({
      id: typeof message?.id === 'string' && message.id.trim() ? message.id : `message-${template.id}-${index}`,
      type: normalizeMessageType(message?.type),
      text: typeof message?.text === 'string' ? message.text : '',
      mediaUrl: typeof message?.mediaUrl === 'string' ? message.mediaUrl : '',
      caption: typeof message?.caption === 'string' ? message.caption : '',
      filename: typeof message?.filename === 'string' ? message.filename : '',
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

const composeTemplateMessage = (messages: AutoContactTemplateMessage[]): string => {
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

const getTemplateMessage = (template?: AutoContactTemplate | null): string => {
  if (!template) return '';
  const composed = composeTemplateMessage(getTemplateMessages(template));
  return composed || template.message || '';
};

const normalizeAutoContactFlowSettings = (settings: any): AutoContactFlowSettings | null => {
  if (!settings || typeof settings !== 'object') return null;

  const rawTemplates = Array.isArray(settings.messageTemplates) ? settings.messageTemplates : [];
  const messageTemplates: AutoContactTemplate[] = rawTemplates.map((template: any, index: number) => {
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

  const apiKeyValue =
    typeof settings.apiKey === 'string'
      ? settings.apiKey
      : typeof settings.token === 'string'
        ? settings.token
        : '';

  const rawFlows = Array.isArray(settings.flows) ? settings.flows : [];
  const fallbackTemplateId = messageTemplates[0]?.id ?? '';
  const normalizeConditionField = (field: unknown): AutoContactFlowConditionField => {
    switch (field) {
      case 'origem':
      case 'cidade':
      case 'responsavel':
      case 'status':
      case 'tag':
      case 'event':
      case 'lead_created':
      case 'canal':
      case 'estado':
      case 'regiao':
      case 'tipo_contratacao':
      case 'operadora_atual':
      case 'email':
      case 'telefone':
      case 'data_criacao':
      case 'ultimo_contato':
      case 'proximo_retorno':
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

  const normalizeCustomMessage = (message: any): AutoContactFlowCustomMessage => ({
    type: normalizeMessageType(message?.type),
    text: typeof message?.text === 'string' ? message.text : '',
    mediaUrl: typeof message?.mediaUrl === 'string' ? message.mediaUrl : '',
    caption: typeof message?.caption === 'string' ? message.caption : '',
    filename: typeof message?.filename === 'string' ? message.filename : '',
  });

  const normalizedFlows: AutoContactFlow[] = rawFlows
    .map((flow: any, flowIndex: number) => {
      const flowId = typeof flow?.id === 'string' && flow.id.trim() ? flow.id : `flow-${flowIndex}`;
      const steps = Array.isArray(flow?.steps) ? flow.steps : [];
      const rawConditions = Array.isArray(flow?.conditions) ? flow.conditions : [];
      const rawExitConditions = Array.isArray(flow?.exitConditions) ? flow.exitConditions : [];
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
        .filter((condition) => condition.field === 'lead_created' || condition.value.trim());
      const normalizedExitConditions = rawExitConditions
        .map((condition: any, conditionIndex: number) => ({
          id:
            typeof condition?.id === 'string' && condition.id.trim()
              ? condition.id
              : `flow-${flowId}-exit-condition-${conditionIndex}`,
          field: normalizeConditionField(condition?.field),
          operator: normalizeConditionOperator(condition?.operator),
          value: typeof condition?.value === 'string' ? condition.value : '',
        }))
        .filter((condition) => condition.field === 'lead_created' || condition.value.trim());
      const normalizedSteps = steps.map((step: any, stepIndex: number) => {
        const delayHoursRaw = Number(step?.delayHours);
        const delayHours = Number.isFinite(delayHoursRaw) && delayHoursRaw >= 0 ? delayHoursRaw : 0;
        const actionType = normalizeActionType(step?.actionType);
        if (actionType === 'send_message') {
          const messageSource = normalizeMessageSource(step?.messageSource);
          const templateId = typeof step?.templateId === 'string' ? step.templateId : '';
          const validTemplateId =
            messageTemplates.some((template) => template.id === templateId) ? templateId : fallbackTemplateId;
          return {
            id: typeof step?.id === 'string' && step.id.trim() ? step.id : `flow-${flowId}-step-${stepIndex}`,
            delayHours,
            actionType,
            messageSource,
            templateId: validTemplateId,
            customMessage: normalizeCustomMessage(step?.customMessage),
          };
        }

        if (actionType === 'update_status') {
          return {
            id: typeof step?.id === 'string' && step.id.trim() ? step.id : `flow-${flowId}-step-${stepIndex}`,
            delayHours,
            actionType,
            statusToSet: typeof step?.statusToSet === 'string' ? step.statusToSet : '',
          };
        }

        return {
          id: typeof step?.id === 'string' && step.id.trim() ? step.id : `flow-${flowId}-step-${stepIndex}`,
          delayHours,
          actionType,
        };
      });

      return {
        id: flowId,
        name: typeof flow?.name === 'string' ? flow.name : '',
        triggerStatus: typeof flow?.triggerStatus === 'string' ? flow.triggerStatus : '',
        steps: normalizedSteps,
        finalStatus: typeof flow?.finalStatus === 'string' ? flow.finalStatus : '',
        conditionLogic: flow?.conditionLogic === 'any' ? 'any' : 'all',
        conditions: normalizedConditions,
        exitConditionLogic: flow?.exitConditionLogic === 'all' ? 'all' : 'any',
        exitConditions: normalizedExitConditions,
        tags: Array.isArray(flow?.tags)
          ? flow.tags.filter((tag: unknown) => typeof tag === 'string' && tag.trim()).map((tag: string) => tag.trim())
          : [],
      };
    })
    .filter((flow) => flow.steps.length > 0);

  return {
    enabled: settings.enabled !== false,
    autoSend: settings.autoSend !== false,
    apiKey: apiKeyValue,
    messageTemplates,
    flows: normalizedFlows,
  };
};

async function loadAutoContactSettings(
  supabase: ReturnType<typeof createClient>,
): Promise<AutoContactSettings | null> {
  const { data, error } = await supabase
    .from('integration_settings')
    .select('settings')
    .eq('slug', 'whatsapp_auto_contact')
    .maybeSingle();

  if (error) {
    console.warn('Erro ao carregar integração de mensagens automáticas', error);
    return null;
  }

  return normalizeAutoContactSettings(data?.settings) ?? null;
}

async function loadAutoContactFlowSettings(
  supabase: ReturnType<typeof createClient>,
): Promise<AutoContactFlowSettings | null> {
  const { data, error } = await supabase
    .from('integration_settings')
    .select('settings')
    .eq('slug', 'whatsapp_auto_contact')
    .maybeSingle();

  if (error) {
    console.warn('Erro ao carregar fluxos de automação', error);
    return null;
  }

  return normalizeAutoContactFlowSettings(data?.settings) ?? null;
}

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

const splitListValues = (value: string): string[] =>
  value
    .split(/[;,]/)
    .map((item) => normalizeText(item))
    .filter(Boolean);

const parseComparableValue = (value: string): number | null => {
  const numericValue = Number(value);
  if (Number.isFinite(numericValue)) return numericValue;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : timestamp;
};

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

const getLeadFieldValue = (lead: any, field: AutoContactFlowConditionField, event?: AutoContactFlowEvent): string => {
  switch (field) {
    case 'lead_created':
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
    case 'data_criacao':
      return lead.data_criacao ?? '';
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

const matchesFlowCondition = (
  condition: AutoContactFlowCondition,
  lead: any,
  event?: AutoContactFlowEvent,
): boolean => {
  if (condition.field === 'lead_created') {
    return event === 'lead_created';
  }

  const value = normalizeText(condition.value);
  if (!value) return false;

  if (condition.field === 'tag') {
    const tags = Array.isArray(lead.tags) ? lead.tags : [];
    const normalizedTags = tags.map((tag) => normalizeText(tag)).filter(Boolean);
    return matchArrayCondition(normalizedTags, value, condition.operator);
  }

  const leadValue = normalizeText(getLeadFieldValue(lead, condition.field, event));
  if (!leadValue) return condition.operator === 'not_contains' || condition.operator === 'not_equals';
  return matchTextCondition(leadValue, value, condition.operator);
};

const matchesAutoContactFlow = (flow: AutoContactFlow, lead: any, event?: AutoContactFlowEvent): boolean => {
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

const shouldExitFlow = (flow: AutoContactFlow, lead: any, event?: AutoContactFlowEvent): boolean => {
  const exitConditions = flow.exitConditions ?? [];
  if (exitConditions.length === 0) return false;
  const isMatch = (condition: AutoContactFlowCondition) => matchesFlowCondition(condition, lead, event);
  return flow.exitConditionLogic === 'all' ? exitConditions.every(isMatch) : exitConditions.some(isMatch);
};

async function sendAutoContactMessage({
  lead,
  contentType,
  content,
  settings,
}: {
  lead: any;
  contentType: FlowMessageType;
  content: string | { url: string; caption?: string; filename?: string };
  settings: AutoContactFlowSettings;
}): Promise<void> {
  const normalizedPhone = normalizeTelefone(lead?.telefone || '');
  if (!normalizedPhone) {
    throw new Error('Telefone inválido para envio automático.');
  }

  const apiKey = sanitizeWhapiToken(settings.apiKey);
  if (!apiKey) {
    throw new Error('Token da Whapi Cloud não configurado na integração de mensagens automáticas.');
  }

  const chatId = `55${normalizedPhone}@s.whatsapp.net`;
  let endpoint = '';
  const body: Record<string, unknown> = { to: chatId };

  if (contentType === 'text') {
    endpoint = '/messages/text';
    body.body = content as string;
  } else {
    endpoint = `/messages/${contentType}`;
    const media = content as { url: string; caption?: string; filename?: string };
    body.media = media.url;
    if (media.caption) body.caption = media.caption;
    if (media.filename && contentType === 'document') body.filename = media.filename;
  }

  const response = await fetch(`https://gate.whapi.cloud${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'Falha ao enviar mensagem automática');
  }
}

const buildCustomMessagePayload = (
  customMessage: AutoContactFlowCustomMessage | undefined,
  lead: any,
): { contentType: FlowMessageType; content: string | { url: string; caption?: string; filename?: string } } | null => {
  if (!customMessage) return null;
  if (customMessage.type === 'text') {
    const message = applyTemplateVariables(customMessage.text ?? '', lead).trim();
    if (!message) return null;
    return { contentType: 'text', content: message };
  }

  if (!customMessage.mediaUrl?.trim()) return null;
  return {
    contentType: customMessage.type,
    content: {
      url: customMessage.mediaUrl,
      caption: customMessage.caption ? applyTemplateVariables(customMessage.caption, lead) : undefined,
      filename: customMessage.filename,
    },
  };
};

async function triggerAutoContactForLead({
  supabase,
  lead,
  lookups,
  logWithContext,
}: {
  supabase: ReturnType<typeof createClient>;
  lead: any;
  lookups: LeadLookupMaps;
  logWithContext: (message: string, details?: Record<string, unknown>) => void;
}): Promise<void> {
  const settings = await loadAutoContactSettings(supabase);
  if (!settings || !settings.enabled) {
    logWithContext('Integração de auto contato desativada ou não configurada');
    return;
  }

  const activeSteps = settings.messageFlow
    .filter((step) => step.active && step.message.trim())
    .sort((a, b) => a.delaySeconds - b.delaySeconds);

  const firstStep = activeSteps[0];
  if (!firstStep) {
    logWithContext('Fluxo de mensagens automáticas sem etapas ativas');
    return;
  }

  const normalizedPhone = normalizeTelefone(lead?.telefone || '');
  if (!normalizedPhone) {
    logWithContext('Lead sem telefone válido para automação', { leadId: lead?.id });
    return;
  }

  if (!settings.sessionId) {
    logWithContext('Integração de automação sem Session ID configurado');
    return;
  }

  const message = applyTemplateVariables(firstStep.message, lead);

  try {
    const url = `${settings.baseUrl.replace(/\/+$/, '')}/client/sendMessage/${settings.sessionId}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': settings.apiKey,
      },
      body: JSON.stringify({
        chatId: `55${normalizedPhone}@s.whatsapp.net`,
        contentType: 'string',
        content: message,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || 'Falha ao enviar automação para o lead');
    }

    logWithContext('Mensagem automática enviada', { leadId: lead.id });

    const targetStatusName = settings.statusOnSend?.trim();
    const normalizedTarget = targetStatusName ? normalizeText(targetStatusName) : null;
    const targetStatusId = normalizedTarget
      ? lookups.statusByName.get(normalizedTarget) ?? lookups.defaultStatusId
      : lookups.defaultStatusId;

    const now = new Date().toISOString();

    await supabase.from('interactions').insert([
      {
        lead_id: lead.id,
        tipo: 'Mensagem Automática',
        descricao: 'Fluxo automático disparado pela API de leads',
        responsavel: lead.responsavel,
      },
    ]);

    if (targetStatusId) {
      await supabase
        .from('leads')
        .update({
          status_id: targetStatusId,
          ultimo_contato: now,
        })
        .eq('id', lead.id);
    } else {
      await supabase
        .from('leads')
        .update({ ultimo_contato: now })
        .eq('id', lead.id);
    }
  } catch (error) {
    logWithContext('Erro ao disparar automação para o lead', {
      leadId: lead?.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function runAutoContactFlowEngine({
  supabase,
  lead,
  lookups,
  logWithContext,
  settings: providedSettings,
  event,
}: {
  supabase: ReturnType<typeof createClient>;
  lead: any;
  lookups: LeadLookupMaps;
  logWithContext: (message: string, details?: Record<string, unknown>) => void;
  settings?: AutoContactFlowSettings | null;
  event?: AutoContactFlowEvent;
}): Promise<void> {
  try {
    const settings = providedSettings ?? await loadAutoContactFlowSettings(supabase);
    if (!settings || !settings.enabled) {
      logWithContext('Fluxo automático desativado ou não configurado');
      return;
    }

    if (!settings.autoSend) {
      logWithContext('Fluxo automático configurado, mas envio automático está desativado');
      return;
    }

    if (!settings.apiKey) {
      logWithContext('Fluxo automático sem token configurado');
      return;
    }

    if (settings.flows.length === 0) {
      logWithContext('Nenhum fluxo automático disponível para execução');
      return;
    }

    const leadWithRelations = mapLeadRelationsForResponse(lead, lookups);
    if (!leadWithRelations.status) {
      leadWithRelations.status = lookups.statusById.get(lead.status_id) ?? 'Novo';
    }
    leadWithRelations.status = leadWithRelations.status || 'Novo';

    const matchingFlow =
      settings.flows.find((flow) => matchesAutoContactFlow(flow, leadWithRelations, event)) ?? null;
    if (!matchingFlow) {
      logWithContext('Nenhum fluxo automático corresponde ao lead recém-criado', { leadId: lead.id });
      return;
    }

    logWithContext('Fluxo automático selecionado', {
      leadId: lead.id,
      flowId: matchingFlow.id,
      flowName: matchingFlow.name,
    });

    let firstMessageSent = false;

    for (const step of matchingFlow.steps) {
      if (shouldExitFlow(matchingFlow, leadWithRelations, event)) {
        logWithContext('Fluxo automático interrompido por condição de saída', {
          leadId: lead.id,
          flowId: matchingFlow.id,
        });
        break;
      }

      const delayMs = Math.max(0, step.delayHours) * 60 * 60 * 1000;
      if (delayMs > 0) {
        logWithContext('Aguardando atraso configurado para etapa do fluxo', {
          leadId: lead.id,
          flowId: matchingFlow.id,
          stepId: step.id,
          delayHours: step.delayHours,
        });
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }

      if (step.actionType === 'send_message') {
        let payload:
          | { contentType: FlowMessageType; content: string | { url: string; caption?: string; filename?: string } }
          | null = null;

        if (step.messageSource === 'custom') {
          payload = buildCustomMessagePayload(step.customMessage, leadWithRelations);
        } else {
          const template =
            settings.messageTemplates.find((item) => item.id === step.templateId) ??
            settings.messageTemplates[0] ??
            null;
          const message = getTemplateMessage(template);
          if (message.trim()) {
            payload = {
              contentType: 'text',
              content: applyTemplateVariables(message, leadWithRelations),
            };
          }
        }

        if (!payload) {
          logWithContext('Etapa de envio sem conteúdo válido, ignorando', {
            leadId: lead.id,
            flowId: matchingFlow.id,
            stepId: step.id,
          });
          continue;
        }

        await sendAutoContactMessage({
          lead: leadWithRelations,
          contentType: payload.contentType,
          content: payload.content,
          settings,
        });

        logWithContext('Mensagem automática enviada via fluxo', {
          leadId: lead.id,
          flowId: matchingFlow.id,
          stepId: step.id,
        });

        if (!firstMessageSent) {
          firstMessageSent = true;
          const now = new Date().toISOString();
          await supabase.from('leads').update({ ultimo_contato: now }).eq('id', lead.id);
          await supabase.from('interactions').insert({
            lead_id: lead.id,
            tipo: 'Mensagem Automática',
            descricao: 'Fluxo automático disparado pela API de leads',
            responsavel: leadWithRelations.responsavel ?? 'Sistema',
          });
        }

        continue;
      }

      if (step.actionType === 'update_status') {
        const statusName = step.statusToSet?.trim();
        if (!statusName) {
          logWithContext('Etapa de fluxo sem status configurado', {
            leadId: lead.id,
            flowId: matchingFlow.id,
            stepId: step.id,
          });
          continue;
        }

        const statusId = lookups.statusByName.get(normalizeText(statusName)) ?? null;
        if (!statusId) {
          logWithContext('Status configurado não encontrado para etapa do fluxo', {
            leadId: lead.id,
            flowId: matchingFlow.id,
            stepId: step.id,
            status: statusName,
          });
          continue;
        }

        const { error } = await supabase.from('leads').update({ status_id: statusId }).eq('id', lead.id);
        if (error) {
          logWithContext('Erro ao atualizar status do lead pelo fluxo', {
            leadId: lead.id,
            flowId: matchingFlow.id,
            stepId: step.id,
            error: error.message,
          });
        } else {
          leadWithRelations.status = statusName;
        }

        continue;
      }

      if (step.actionType === 'archive_lead') {
        const { error } = await supabase.from('leads').update({ arquivado: true }).eq('id', lead.id);
        if (error) {
          logWithContext('Erro ao arquivar lead pelo fluxo', {
            leadId: lead.id,
            flowId: matchingFlow.id,
            stepId: step.id,
            error: error.message,
          });
        } else {
          leadWithRelations.arquivado = true;
        }
        continue;
      }

      if (step.actionType === 'delete_lead') {
        const { error } = await supabase.from('leads').delete().eq('id', lead.id);
        if (error) {
          logWithContext('Erro ao excluir lead pelo fluxo', {
            leadId: lead.id,
            flowId: matchingFlow.id,
            stepId: step.id,
            error: error.message,
          });
        }
        return;
      }
    }
  } catch (error) {
    logWithContext('Erro ao executar fluxo automático', {
      leadId: lead?.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

Deno.serve(async (req: Request) => {
  const requestId = crypto.randomUUID();
  const logWithContext = (message: string, details?: Record<string, unknown>) =>
    log(message, { requestId, ...details });

  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const path = url.pathname;
    const action = url.searchParams.get('action') ?? req.headers.get('x-action');

    logWithContext('Request received', { method: req.method, path, search: url.search || undefined });

    let lookupMaps: LeadLookupMaps | null = null;
    const getLookups = async () => {
      if (!lookupMaps) {
        logWithContext('Loading lookup tables');
        lookupMaps = await loadLeadLookupMaps(supabase);
        logWithContext('Lookup tables loaded', {
          origins: lookupMaps.originById.size,
          statuses: lookupMaps.statusById.size,
          tipos: lookupMaps.tipoById.size,
          responsaveis: lookupMaps.responsavelById.size,
        });
      }
      return lookupMaps;
    };

    if (action === 'auto-contact' && req.method === 'POST') {
      const payload = await req.json().catch(() => null);
      const record = payload?.record ?? null;
      const oldRecord = payload?.old_record ?? null;
      const event: AutoContactFlowEvent | undefined =
        payload?.type === 'INSERT' || !oldRecord ? 'lead_created' : undefined;

      if (!record || typeof record !== 'object' || !record.id) {
        return new Response(JSON.stringify({ success: false, error: 'Payload inválido para automação' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const lookups = await getLookups();
      const settings = await loadAutoContactFlowSettings(supabase);

      if (!settings || !settings.enabled || !settings.autoSend || settings.flows.length === 0) {
        return new Response(JSON.stringify({ success: true, skipped: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const mapLeadForMatch = (lead: any) => {
        const mapped = mapLeadRelationsForResponse(lead, lookups);
        if (!mapped.status) {
          mapped.status = lookups.statusById.get(lead.status_id) ?? 'Novo';
        }
        mapped.status = mapped.status || 'Novo';
        return mapped;
      };

      const mappedLead = mapLeadForMatch(record);
      const newMatchingFlow =
        settings.flows.find((flow) => matchesAutoContactFlow(flow, mappedLead, event)) ?? null;

      if (!newMatchingFlow) {
        return new Response(JSON.stringify({ success: true, skipped: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (oldRecord && typeof oldRecord === 'object') {
        const mappedOldLead = mapLeadForMatch(oldRecord);
        const oldMatchingFlow =
          settings.flows.find((flow) => matchesAutoContactFlow(flow, mappedOldLead)) ?? null;

        if (oldMatchingFlow?.id === newMatchingFlow.id) {
          return new Response(JSON.stringify({ success: true, skipped: true }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      try {
        await runAutoContactFlowEngine({
          supabase,
          lead: record,
          lookups,
          logWithContext,
          settings,
          event,
        });
      } catch (automationError) {
        logWithContext('Erro ao executar automação automática via trigger', {
          leadId: record.id,
          error: automationError instanceof Error ? automationError.message : String(automationError),
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'manual-automation' && req.method === 'POST') {
      const body = await req.json().catch(() => null);

      if (!body || typeof body.chatId !== 'string' || !Array.isArray(body.messages)) {
        return new Response(JSON.stringify({ success: false, error: 'Payload inválido' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const chatId = body.chatId.trim();
      const messages = body.messages
        .filter((msg: unknown) => typeof msg === 'string' && msg.trim())
        .map((msg: string) => msg.trim());

      if (!chatId || messages.length === 0) {
        return new Response(JSON.stringify({ success: false, error: 'Dados incompletos para envio manual' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const settings = await loadAutoContactSettings(supabase);

      if (!settings || !settings.baseUrl || !settings.sessionId) {
        return new Response(
          JSON.stringify({ success: false, error: 'Integração de mensagens automáticas não configurada' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        );
      }

      const endpoint = `${settings.baseUrl.replace(/\/+$/, '')}/client/sendMessage/${settings.sessionId}`;

      try {
        await sendWhatsappMessages({ endpoint, apiKey: settings.apiKey, chatId, messages });
        logWithContext('Envio manual de automação concluído', { chatId });

        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (error) {
        console.error('Erro ao enviar automação manual', error);
        const message = error instanceof Error ? error.message : 'Falha ao enviar automação manual';
        return new Response(JSON.stringify({ success: false, error: message }), {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    if (path.endsWith('/health')) {
      return new Response(
        JSON.stringify({
          status: 'ok',
          timestamp: new Date().toISOString(),
          service: 'leads-api',
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (path.endsWith('/leads') && req.method === 'POST') {
      const body = await req.json();
      const lookups = await getLookups();
      const validation = validateLeadData(body, lookups);

      if (!validation.valid || !validation.leadData) {
        logWithContext('Lead creation validation failed', { errors: validation.errors });
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Dados inválidos',
            details: validation.errors,
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      const duplicateStatusId = getDuplicateStatusId(lookups);
      const duplicateLead = await isDuplicateLead(
        supabase,
        validation.leadData.telefone,
        validation.leadData.email ?? null,
      );

      if (duplicateLead && duplicateStatusId) {
        validation.leadData.status_id = duplicateStatusId;
      }

      const { data, error } = await supabase
        .from('leads')
        .insert([validation.leadData])
        .select()
        .single();

      if (error) {
        console.error('Erro ao inserir lead:', error);
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Erro ao criar lead',
            details: error.message,
          }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      logWithContext('Lead created successfully', { leadId: data.id });

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Lead criado com sucesso',
          data: mapLeadRelationsForResponse(data, lookups),
        }),
        {
          status: 201,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (path.endsWith('/leads') && req.method === 'GET') {
      const lookups = await getLookups();
      const searchParams = url.searchParams;
      const status = searchParams.get('status_id') || searchParams.get('status');
      const responsavel = searchParams.get('responsavel_id') || searchParams.get('responsavel');
      const origem = searchParams.get('origem_id') || searchParams.get('origem');
      const tipoContratacao = searchParams.get('tipo_contratacao_id') || searchParams.get('tipo_contratacao');
      const telefone = searchParams.get('telefone');
      const email = searchParams.get('email');
      const parsedLimit = parseInt(searchParams.get('limit') || '100', 10);
      const limit = Number.isNaN(parsedLimit) ? 100 : parsedLimit;

      const statusId = resolveFilterId(status, lookups.statusById, lookups.statusByName);
      const responsavelId = resolveFilterId(
        responsavel,
        lookups.responsavelById,
        lookups.responsavelByLabel,
      );
      const origemId = resolveFilterId(origem, lookups.originById, lookups.originByName);
      const tipoContratacaoId = resolveFilterId(
        tipoContratacao,
        lookups.tipoById,
        lookups.tipoByLabel,
      );

      const invalidFilters: string[] = [];
      if (status && !statusId) invalidFilters.push('status');
      if (responsavel && !responsavelId) invalidFilters.push('responsavel');
      if (origem && !origemId) invalidFilters.push('origem');
      if (tipoContratacao && !tipoContratacaoId) invalidFilters.push('tipo_contratacao');

      if (invalidFilters.length > 0) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Filtros inválidos',
            details: invalidFilters.map((field) => `Valor de filtro inválido para "${field}"`),
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      logWithContext('Listing leads', {
        filters: { statusId, responsavelId, origemId, tipoContratacaoId, telefone: telefone ? normalizeTelefone(telefone) : null, email },
        limit,
      });

      let query = supabase
        .from('leads')
        .select('*')
        .eq('arquivado', false)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (statusId) query = query.eq('status_id', statusId);
      if (responsavelId) query = query.eq('responsavel_id', responsavelId);
      if (origemId) query = query.eq('origem_id', origemId);
      if (tipoContratacaoId) query = query.eq('tipo_contratacao_id', tipoContratacaoId);
      if (telefone) query = query.eq('telefone', normalizeTelefone(telefone));
      if (email) query = query.ilike('email', email);

      const { data, error } = await query;

      if (error) {
        console.error('Erro ao buscar leads:', error);
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Erro ao buscar leads',
            details: error.message,
          }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      const leads = (data || []).map((lead) => mapLeadRelationsForResponse(lead, lookups));

      logWithContext('Lead search completed', { count: leads.length });

      return new Response(
        JSON.stringify({
          success: true,
          count: leads.length,
          data: leads,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (path.match(/\/leads\/[a-f0-9-]+$/) && req.method === 'PUT') {
      const leadId = path.split('/').pop();
      const body = await req.json();
      const lookups = await getLookups();
      const validation = validateLeadUpdate(body, lookups);

      if (!validation.valid) {
        logWithContext('Lead update validation failed', { leadId, errors: validation.errors });
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Dados inválidos',
            details: validation.errors,
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      const { data, error } = await supabase
        .from('leads')
        .update(validation.updateData)
        .eq('id', leadId)
        .select()
        .single();

      if (error) {
        console.error('Erro ao atualizar lead:', error);
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Erro ao atualizar lead',
            details: error.message,
          }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      logWithContext('Lead updated successfully', { leadId });

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Lead atualizado com sucesso',
          data: mapLeadRelationsForResponse(data, lookups),
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (path.endsWith('/leads/batch') && req.method === 'POST') {
      const body = await req.json();
      const lookups = await getLookups();

      if (!Array.isArray(body.leads)) {
        logWithContext('Batch lead creation failed: leads is not array');
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Campo "leads" deve ser um array',
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      const results = {
        success: [],
        failed: [],
      };

      for (const [index, leadInput] of body.leads.entries()) {
        const validation = validateLeadData(leadInput, lookups);

        if (!validation.valid || !validation.leadData) {
          results.failed.push({
            index,
            data: leadInput,
            errors: validation.errors,
          });
          continue;
        }

        const duplicateStatusId = getDuplicateStatusId(lookups);
        const duplicateLead = await isDuplicateLead(
          supabase,
          validation.leadData.telefone,
          validation.leadData.email ?? null,
        );

        if (duplicateLead && duplicateStatusId) {
          validation.leadData.status_id = duplicateStatusId;
        }

        const { data, error } = await supabase
          .from('leads')
          .insert([validation.leadData])
          .select()
          .single();

        if (error) {
          results.failed.push({
            index,
            data: leadInput,
            error: error.message,
          });
        } else {
          results.success.push({
            index,
            data: mapLeadRelationsForResponse(data, lookups),
          });
        }
      }

      logWithContext('Batch lead creation summary', {
        total: body.leads.length,
        success: results.success.length,
        failed: results.failed.length,
      });

      return new Response(
        JSON.stringify({
          success: true,
          message: `Processados ${body.leads.length} leads: ${results.success.length} sucesso, ${results.failed.length} falhas`,
          results,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Endpoint não encontrado',
        message: 'Rotas disponíveis: POST /leads, GET /leads, PUT /leads/:id, POST /leads/batch, GET /health',
      }),
      {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    logWithContext('Erro interno', { error: error instanceof Error ? error.message : String(error) });
    console.error('Erro interno:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Erro interno do servidor',
        details: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
