/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import {
  ensurePrimaryChannel,
  extractWhapiMessageId,
  fetchWhapiWithTimeout,
  formatPhoneLabel,
  getCommWhatsAppPhoneLookupKeys,
  getWhapiToken,
  normalizeWhapiChatId,
  parseWhapiError,
  persistCommWhatsAppMessage,
  readResponsePayload,
  resolveCommWhatsAppCanonicalChatRoute,
  resolveCommWhatsAppCanonicalChatRouteByUuid,
  resolveWhapiOutboundDeliveryStatus,
  sanitizeWhapiToken,
  WHAPI_BASE_URL,
} from '../_shared/comm-whatsapp.ts';
import { isDuplicateLead } from '../_shared/leads.ts';
const DEFAULT_GREETING_TIMEZONE = 'America/Sao_Paulo';

const buildHourFormatter = (timeZone: string) =>
  new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: '2-digit',
    hour12: false,
  });

const getHourFromFormatter = (formatter: Intl.DateTimeFormat, date: Date): number => {
  const hourPart = formatter.formatToParts(date).find((part) => part.type === 'hour');
  if (!hourPart) {
    return date.getUTCHours();
  }
  const hour = Number.parseInt(hourPart.value, 10);
  return Number.isFinite(hour) ? hour : date.getUTCHours();
};

const resolveHourInTimeZone = (date: Date, timeZone: string, fallbackTimeZone: string): number => {
  const normalizedTimeZone = timeZone?.trim() || fallbackTimeZone;

  try {
    return getHourFromFormatter(buildHourFormatter(normalizedTimeZone), date);
  } catch {
    if (normalizedTimeZone !== fallbackTimeZone) {
      try {
        return getHourFromFormatter(buildHourFormatter(fallbackTimeZone), date);
      } catch {
        return date.getUTCHours();
      }
    }
    return date.getUTCHours();
  }
};

const getGreetingForDate = (date: Date, timeZone: string = DEFAULT_GREETING_TIMEZONE): string => {
  const hour = resolveHourInTimeZone(date, timeZone, DEFAULT_GREETING_TIMEZONE);

  if (hour >= 5 && hour < 12) {
    return 'bom dia';
  }

  if (hour >= 12 && hour < 18) {
    return 'boa tarde';
  }

  return 'boa noite';
};

const formatGreetingTitle = (greeting: string): string => {
  const trimmed = greeting.trim();
  if (!trimmed) return '';
  return `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1)}`;
};

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

type DashboardRole = 'admin' | 'observer';

type AuthorizedDashboardUser = {
  id: string;
  role: DashboardRole;
};

const ADMIN_ROLE_SET = new Set<DashboardRole>(['admin']);
const READ_ROLE_SET = new Set<DashboardRole>(['admin', 'observer']);

const jsonResponse = (body: Record<string, unknown>, status: number): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const getBearerToken = (authHeader: string | null): string | null => {
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim();
  return token || null;
};

const collectCredentialCandidates = (value: unknown, target: Set<string>, depth = 0): void => {
  if (depth > 6 || value == null) return;

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return;

    target.add(trimmed);

    const looksJsonLike =
      (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']')) ||
      (trimmed.startsWith('"') && trimmed.endsWith('"'));

    if (looksJsonLike) {
      try {
        const parsed = JSON.parse(trimmed);
        collectCredentialCandidates(parsed, target, depth + 1);
      } catch {
        // no-op
      }
    }
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectCredentialCandidates(item, target, depth + 1));
    return;
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const preferredKeys = [
      'value',
      'token',
      'apiKey',
      'apikey',
      'key',
      'secret',
      'supabase_service_role_key',
      'service_role_key',
    ];

    preferredKeys.forEach((key) => {
      if (key in record) {
        collectCredentialCandidates(record[key], target, depth + 1);
      }
    });

    Object.values(record).forEach((nested) => collectCredentialCandidates(nested, target, depth + 1));
  }
};

const extractCredentialCandidates = (value: unknown): string[] => {
  const candidates = new Set<string>();
  collectCredentialCandidates(value, candidates);
  return Array.from(candidates);
};

const normalizeDashboardRole = (value: unknown): DashboardRole | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === 'admin' || normalized === 'observer') {
    return normalized;
  }

  return null;
};

const isServiceRoleRequest = (req: Request, serviceRoleKey: string): boolean => {
  const expectedCandidates = new Set(extractCredentialCandidates(serviceRoleKey));
  if (expectedCandidates.size === 0) {
    return false;
  }

  const matchesExpected = (candidate: string | null | undefined) =>
    extractCredentialCandidates(candidate).some((value) => expectedCandidates.has(value));

  const bearerToken = getBearerToken(req.headers.get('Authorization'));
  if (matchesExpected(bearerToken)) {
    return true;
  }

  const apiKeyHeader = req.headers.get('apikey')?.trim() ?? req.headers.get('x-api-key')?.trim();
  return matchesExpected(apiKeyHeader);
};

const assertInternalServiceRole = (req: Request, serviceRoleKey: string): Response | null => {
  if (isServiceRoleRequest(req, serviceRoleKey)) {
    return null;
  }

  return jsonResponse(
    {
      success: false,
      error: 'Acesso não autorizado para esta ação',
    },
    401,
  );
};

const authorizeDashboardUser = async ({
  req,
  supabaseUrl,
  supabaseAnonKey,
  supabase,
  allowedRoles,
}: {
  req: Request;
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabase: ReturnType<typeof createClient>;
  allowedRoles: ReadonlySet<DashboardRole>;
}): Promise<{ authorized: true; user: AuthorizedDashboardUser } | { authorized: false; response: Response }> => {
  const authHeader = req.headers.get('Authorization');
  const bearerToken = getBearerToken(authHeader);

  if (!bearerToken) {
    return {
      authorized: false,
      response: jsonResponse(
        {
          success: false,
          error: 'Não autenticado',
        },
        401,
      ),
    };
  }

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${bearerToken}`,
      },
    },
  });

  const {
    data: { user },
    error: userError,
  } = await authClient.auth.getUser();

  if (userError || !user) {
    return {
      authorized: false,
      response: jsonResponse(
        {
          success: false,
          error: 'Token de autenticação inválido',
        },
        401,
      ),
    };
  }

  const profileId = typeof user.id === 'string' ? user.id.trim() : '';
  if (!profileId) {
    return {
      authorized: false,
      response: jsonResponse(
        {
          success: false,
          error: 'Perfil do usuário não encontrado',
        },
        403,
      ),
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', profileId)
    .maybeSingle();

  if (profileError) {
    return {
      authorized: false,
      response: jsonResponse(
        {
          success: false,
          error: 'Erro ao validar permissões do usuário',
        },
        500,
      ),
    };
  }

  const role = normalizeDashboardRole(profile?.role);

  if (!role) {
    return {
      authorized: false,
      response: jsonResponse(
        {
          success: false,
          error: 'Perfil sem permissão válida para acessar esta rota',
        },
        403,
      ),
    };
  }

  const effectiveRole = role;

  if (!allowedRoles.has(effectiveRole)) {
    return {
      authorized: false,
      response: jsonResponse(
        {
          success: false,
          error: 'Permissões insuficientes',
        },
        403,
      ),
    };
  }

  return {
    authorized: true,
    user: {
      id: profileId,
      role: effectiveRole,
    },
  };
};

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
  statusOnSend: string;
  messageFlow: AutoContactStep[];
  scheduling?: {
    timezone?: string;
  };
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

type AutoContactFlowActionType =
  | 'send_message'
  | 'update_status'
  | 'archive_lead'
  | 'delete_lead'
  | 'webhook'
  | 'create_task'
  | 'send_email'
  | 'activate_autonomous_service';

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
  delayValue?: number;
  delayUnit?: 'minutes' | 'hours' | 'days';
  delayExpression?: string;
  actionType: AutoContactFlowActionType;
  messageSource?: AutoContactFlowMessageSource;
  templateId?: string;
  customMessage?: AutoContactFlowCustomMessage;
  messages?: Array<{ templateId?: string; custom?: AutoContactFlowCustomMessage }>;
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

type AutoContactFlowConditionField =
  | 'origem'
  | 'cidade'
  | 'responsavel'
  | 'status'
  | 'tag'
  | 'event'
  | 'lead_created'
  | 'canal'
  | 'whatsapp_valid'
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

type AutoContactFlowScheduling = {
  startHour: string;
  endHour: string;
  allowedWeekdays: number[];
  dailySendLimit: number | null;
};

type AutoContactInvalidNumberAction = 'none' | 'update_status' | 'archive_lead' | 'delete_lead';

type AutoContactFlow = {
  id: string;
  name: string;
  triggerStatus: string;
  ativo?: boolean;
  triggerType?: 'lead_created' | 'status_changed' | 'status_duration' | 'inactivity_duration';
  triggerStatuses?: string[];
  triggerDurationHours?: number;
  steps: AutoContactFlowStep[];
  finalStatus?: string;
  conditionLogic?: 'all' | 'any';
  conditions?: AutoContactFlowCondition[];
  exitConditionLogic?: 'all' | 'any';
  exitConditions?: AutoContactFlowCondition[];
  tags?: string[];
  scheduling?: AutoContactFlowScheduling;
  invalidNumberAction?: AutoContactInvalidNumberAction;
  invalidNumberStatus?: string;
};

type AutoContactSchedulingSettings = {
  timezone: string;
  startHour: string;
  endHour: string;
  allowedWeekdays: number[];
  skipHolidays: boolean;
  dailySendLimit: number | null;
};

type AutoContactFlowSettings = {
  enabled: boolean;
  autoSend: boolean;
  messageTemplates: AutoContactTemplate[];
  flows: AutoContactFlow[];
  scheduling: AutoContactSchedulingSettings;
};

type AutoContactFlowEvent = 'lead_created' | 'status_changed';

type LookupTableRow = { id: string; nome?: string | null; label?: string | null; padrao?: boolean | null };

function normalizeText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

const DEFAULT_SCHEDULING: AutoContactSchedulingSettings = {
  timezone: 'America/Sao_Paulo',
  startHour: '08:00',
  endHour: '19:00',
  allowedWeekdays: [1, 2, 3, 4, 5],
  skipHolidays: true,
  dailySendLimit: null,
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

const buildDateInTimeZone = ({ year, month, day, hour, minute }: DateParts, timeZone: string): Date => {
  const utcDate = new Date(Date.UTC(year, month, day, hour, minute, 0));
  const offset = getTimeZoneOffset(utcDate, timeZone);
  return new Date(utcDate.getTime() - offset);
};

const addDaysToZoned = (zoned: Date, days: number): Date => new Date(zoned.getTime() + days * 86400000);

const getWeekdayNumber = (zoned: Date): number => {
  const day = zoned.getUTCDay();
  return day === 0 ? 7 : day;
};

const getNextAllowedSendAt = (reference: Date, scheduling: AutoContactSchedulingSettings): Date => {
  const allowedWeekdays = scheduling.allowedWeekdays?.length
    ? scheduling.allowedWeekdays
    : [1, 2, 3, 4, 5, 6, 7];
  const start = parseHourMinute(scheduling.startHour);
  const end = parseHourMinute(scheduling.endHour);
  let candidate = new Date(reference.getTime());

  for (let attempt = 0; attempt < 370; attempt += 1) {
    const zoned = toZonedDate(candidate, scheduling.timezone);
    const weekday = getWeekdayNumber(zoned);
    const isAllowedWeekday = allowedWeekdays.includes(weekday);

    if (!isAllowedWeekday) {
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

    const currentMinutes = zoned.getUTCHours() * 60 + zoned.getUTCMinutes();
    const startMinutes = start.hour * 60 + start.minute;
    const endMinutes = end.hour * 60 + end.minute;

    if (currentMinutes < startMinutes) {
      candidate = buildDateInTimeZone(
        {
          year: zoned.getUTCFullYear(),
          month: zoned.getUTCMonth(),
          day: zoned.getUTCDate(),
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

const buildTimeZoneDayWindow = (
  reference: Date,
  timeZone: string,
): { dayKey: string; start: Date; end: Date } => {
  const zoned = toZonedDate(reference, timeZone);
  const year = zoned.getUTCFullYear();
  const month = zoned.getUTCMonth();
  const day = zoned.getUTCDate();
  const nextDayUtc = new Date(Date.UTC(year, month, day + 1, 0, 0, 0));
  const start = buildDateInTimeZone({ year, month, day, hour: 0, minute: 0 }, timeZone);
  const end = buildDateInTimeZone(
    {
      year: nextDayUtc.getUTCFullYear(),
      month: nextDayUtc.getUTCMonth(),
      day: nextDayUtc.getUTCDate(),
      hour: 0,
      minute: 0,
    },
    timeZone,
  );
  const dayKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return { dayKey, start, end };
};

const getFlowDailySendCount = async ({
  supabase,
  flowId,
  start,
  end,
  logWithContext,
}: {
  supabase: ReturnType<typeof createClient>;
  flowId: string;
  start: Date;
  end: Date;
  logWithContext: (message: string, details?: Record<string, unknown>) => void;
}): Promise<number> => {
  const { count, error } = await supabase
    .from('auto_contact_flow_jobs')
    .select('id', { count: 'exact', head: true })
    .eq('flow_id', flowId)
    .eq('action_type', 'send_message')
    .eq('status', 'completed')
    .gte('updated_at', start.toISOString())
    .lt('updated_at', end.toISOString());

  if (error) {
    logWithContext('Erro ao consultar limite diário por fluxo', {
      flowId,
      error: error.message,
      start: start.toISOString(),
      end: end.toISOString(),
    });
    return 0;
  }

  return count ?? 0;
};

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
    origem: lead.origem_id ? lookups.originById.get(lead.origem_id) ?? lead.origem ?? null : lead.origem ?? null,
    tipo_contratacao: lead.tipo_contratacao_id
      ? lookups.tipoById.get(lead.tipo_contratacao_id) ?? lead.tipo_contratacao ?? null
      : lead.tipo_contratacao ?? null,
    status: lead.status_id
      ? lookups.statusById.get(lead.status_id) ?? lead.status ?? null
      : lead.status ?? null,
    responsavel: lead.responsavel_id
      ? lookups.responsavelById.get(lead.responsavel_id) ?? lead.responsavel ?? null
      : lead.responsavel ?? null,
  };
}

function getDuplicateStatusId(lookups: LeadLookupMaps) {
  return lookups.statusByName.get(normalizeText('Duplicado')) ?? null;
}

function normalizeTelefone(telefone: string): string {
  return telefone.replace(/\D/g, '');
}

const WHAPI_REQUEST_TIMEOUT_MS = 15000;
const MAX_WHAPI_TEMPORARY_RETRIES = 3;
const WHAPI_CONTACT_VALIDATION_RETRY_DELAYS_MS = [1500, 4000];
const WHAPI_RETRY_DELAYS_MS = [2 * 60 * 1000, 10 * 60 * 1000, 30 * 60 * 1000];

type WhapiContactCheckResult = {
  exists: boolean;
  chatId: string | null;
};

class TemporaryWhapiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TemporaryWhapiError';
  }
}

const isRetryableWhapiStatus = (status: number): boolean => status === 408 || status === 429 || status >= 500;

const getWhapiRetryDelayMs = (previousAttempts: number): number => {
  const index = Math.min(Math.max(previousAttempts, 0), WHAPI_RETRY_DELAYS_MS.length - 1);
  return WHAPI_RETRY_DELAYS_MS[index];
};

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });



const isTemporaryWhapiError = (error: unknown): boolean => {
  if (error instanceof TemporaryWhapiError) return true;

  const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
  return (
    message.includes('timeout') ||
    message.includes('timed out') ||
    message.includes('temporar') ||
    message.includes('temporary') ||
    message.includes('rate limit') ||
    message.includes('429') ||
    message.includes('502') ||
    message.includes('503') ||
    message.includes('504') ||
    message.includes('network')
  );
};

function normalizeBrazilianPhoneLocal(telefone?: string | null): string {
  const digits = normalizeTelefone(telefone ?? '');
  if (!digits) return '';
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    return digits.slice(2);
  }
  return digits;
}

function toWhapiPhoneNumber(telefone?: string | null): string {
  const local = normalizeBrazilianPhoneLocal(telefone);
  if (!local) return '';
  return local.startsWith('55') ? local : `55${local}`;
}

function isValidWhatsappNumber(telefone?: string | null): boolean {
  const local = normalizeBrazilianPhoneLocal(telefone);
  if (!local) return false;
  return local.length === 10 || local.length === 11;
}

function normalizeBooleanConditionValue(value: unknown): 'true' | 'false' | null {
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value !== 'string') return null;

  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;

  if (normalized === 'sim' || normalized === 'true' || normalized === '1' || normalized === 'yes') {
    return 'true';
  }

  if (normalized === 'nao' || normalized === 'não' || normalized === 'false' || normalized === '0' || normalized === 'no') {
    return 'false';
  }

  return null;
}

const usesWhatsappValidCondition = (flow: AutoContactFlow): boolean => {
  const conditions = Array.isArray(flow.conditions) ? flow.conditions : [];
  const exitConditions = Array.isArray(flow.exitConditions) ? flow.exitConditions : [];
  return [...conditions, ...exitConditions].some((condition) => condition.field === 'whatsapp_valid');
};

const buildFlowRuntimeContext = (flow: AutoContactFlow, lead: any): Record<string, string> | null => {
  const runtimeContext: Record<string, string> = {};

  if (usesWhatsappValidCondition(flow)) {
    const whatsappValid = normalizeBooleanConditionValue(lead?.whatsapp_valid);
    if (whatsappValid) {
      runtimeContext.whatsapp_valid = whatsappValid;
    }
  }

  return Object.keys(runtimeContext).length > 0 ? runtimeContext : null;
};

const mergeJobActionPayload = (
  payload: Record<string, unknown> | null,
  runtimeContext: Record<string, string> | null,
): Record<string, unknown> | null => {
  if (!runtimeContext) {
    return payload;
  }

  return {
    ...(payload ?? {}),
    runtimeContext,
  };
};

const getJobRuntimeContext = (payload: unknown): Record<string, string> => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return {};
  }

  const runtimeContext = (payload as Record<string, unknown>).runtimeContext;
  if (!runtimeContext || typeof runtimeContext !== 'object' || Array.isArray(runtimeContext)) {
    return {};
  }

  const rt = runtimeContext as Record<string, unknown>;

  const result: Record<string, string> = {};

  const normalizedWhatsappValid = normalizeBooleanConditionValue(rt.whatsapp_valid);
  if (normalizedWhatsappValid) {
    result.whatsapp_valid = normalizedWhatsappValid;
  }

  if (typeof rt.inactivity_started_at === 'string') {
    result.inactivity_started_at = rt.inactivity_started_at;
  }

  return result;
};

const checkWhatsAppExistence = async (telefone?: string | null): Promise<WhapiContactCheckResult> => {
  const digits = toWhapiPhoneNumber(telefone);
  if (!digits || !isValidWhatsappNumber(telefone)) {
    return { exists: false, chatId: null };
  }

  const token = getWhapiToken();
  if (!token) {
    throw new Error('WHAPI_TOKEN não configurado para validar WhatsApp.');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), WHAPI_REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${WHAPI_BASE_URL}/contacts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      body: JSON.stringify({
        contacts: [digits],
        force_check: true,
      }),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new TemporaryWhapiError('Timeout ao validar numero na Whapi.');
    }
    throw new TemporaryWhapiError('Falha de conexao ao validar numero na Whapi.');
  } finally {
    clearTimeout(timeoutId);
  }

  const payload = await readResponsePayload(response);

  if (!response.ok) {
    const errorText = parseWhapiError(payload);
    if (response.status === 400 || response.status === 404 || response.status === 422) {
      return { exists: false, chatId: null };
    }
    if (response.status === 401 || response.status === 403) {
      throw new Error('Falha de autenticacao ao validar WhatsApp na Whapi.');
    }
    if (isRetryableWhapiStatus(response.status)) {
      throw new TemporaryWhapiError(
        `Whapi temporariamente indisponivel ao validar numero (${response.status}): ${errorText || 'sem detalhes'}`,
      );
    }
    throw new Error(errorText || 'Falha ao validar numero na Whapi.');
  }

  if (!payload || typeof payload !== 'object') {
    return { exists: false, chatId: null };
  }

  const contacts = (payload as Record<string, unknown>).contacts;
  const firstContact = Array.isArray(contacts) && contacts.length > 0 && contacts[0] && typeof contacts[0] === 'object'
    ? (contacts[0] as Record<string, unknown>)
    : null;

  const status = typeof firstContact?.status === 'string' ? firstContact.status.trim().toLowerCase() : '';
  const chatId = normalizeWhapiChatId(firstContact?.wa_id);

  if (status === 'valid' && chatId) {
    return { exists: true, chatId };
  }

  return { exists: false, chatId: null };
};

const resolveWhatsappValid = async (lead: any): Promise<string> => {
  const fallbackValue = normalizeBooleanConditionValue(lead?.whatsapp_valid);

  if (!getWhapiToken()) {
    console.warn('Validação de WhatsApp desativada: WHAPI_TOKEN não configurado.', { leadId: lead?.id ?? null });
    return fallbackValue ?? 'false';
  }

  for (let attempt = 0; attempt <= WHAPI_CONTACT_VALIDATION_RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      const result = await checkWhatsAppExistence(lead?.telefone);
      return result.exists ? 'true' : 'false';
    } catch (error) {
      if (isTemporaryWhapiError(error) && attempt < WHAPI_CONTACT_VALIDATION_RETRY_DELAYS_MS.length) {
        console.warn('Erro temporario ao validar WhatsApp no Whapi; tentando novamente', {
          attempt: attempt + 1,
          leadId: lead?.id ?? null,
          message: error instanceof Error ? error.message : String(error),
        });
        await sleep(WHAPI_CONTACT_VALIDATION_RETRY_DELAYS_MS[attempt]);
        continue;
      }

      console.warn('Erro ao validar WhatsApp no Whapi', error);
      break;
    }
  }

  return fallbackValue ?? 'false';
};

const isInvalidNumberError = (error: unknown): boolean => {
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
  return (
    message.includes('nao possui whatsapp') ||
    message.includes('não possui whatsapp') ||
    message.includes('invalid') ||
    message.includes('invalido') ||
    message.includes('inválido') ||
    message.includes('does not exist') ||
    message.includes('nao existe') ||
    message.includes('não existe') ||
    message.includes('not on whatsapp') ||
    message.includes('recipient not found') ||
    message.includes('recipient does not exist') ||
    message.includes('chat not found') ||
    message.includes('invalid chatid')
  );
};

const applyInvalidNumberAction = async ({
  supabase,
  lead,
  flow,
  lookups,
  logWithContext,
}: {
  supabase: ReturnType<typeof createClient>;
  lead: any;
  flow: AutoContactFlow;
  lookups: LeadLookupMaps;
  logWithContext: (message: string, details?: Record<string, unknown>) => void;
}): Promise<void> => {
  const requestedAction = flow.invalidNumberAction ?? 'none';
  const action: AutoContactInvalidNumberAction = requestedAction === 'none' ? 'update_status' : requestedAction;

  if (action === 'delete_lead') {
    await supabase.from('leads').delete().eq('id', lead.id);
    logWithContext('Lead removido após número inválido', { leadId: lead.id, flowId: flow.id });
    return;
  }

  if (action === 'archive_lead') {
    await supabase.from('leads').update({ arquivado: true }).eq('id', lead.id);
    await supabase.from('interactions').insert({
      lead_id: lead.id,
      tipo: 'Sistema',
      descricao: 'Lead arquivado automaticamente por número inválido/sem WhatsApp.',
      responsavel: 'Sistema',
    });
    logWithContext('Lead arquivado após número inválido', { leadId: lead.id, flowId: flow.id });
    return;
  }

  const configuredStatus = flow.invalidNumberStatus?.trim();
  const fallbackLost = 'Perdido';
  const targetStatus = configuredStatus || fallbackLost;
  const targetStatusId =
    lookups.statusByName.get(normalizeText(targetStatus)) ??
    lookups.statusByName.get(normalizeText(fallbackLost));

  if (!targetStatusId) {
    const reason = 'Status "Perdido" não configurado para ação de número inválido.';
    logWithContext('Falha ao resolver status para número inválido', {
      leadId: lead.id,
      flowId: flow.id,
      requestedStatus: targetStatus,
      reason,
    });
    throw new Error(reason);
  }

  await supabase.from('leads').update({ status_id: targetStatusId }).eq('id', lead.id);
  await supabase.from('interactions').insert({
    lead_id: lead.id,
    tipo: 'Sistema',
    descricao: `Lead movido automaticamente para "${targetStatus}" por número inválido/sem WhatsApp.`,
    responsavel: 'Sistema',
  });
  logWithContext('Status atualizado após número inválido', {
    leadId: lead.id,
    flowId: flow.id,
    status: targetStatus,
  });
};

async function sendWhatsappMessages({
  endpoint,
  chatId,
  messages,
}: {
  endpoint: string;
  chatId: string;
  messages: string[];
}): Promise<void> {
  const token = getWhapiToken();
  if (!token) {
    throw new Error('WHAPI_TOKEN não configurado para enviar mensagens.');
  }

  for (const content of messages) {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': token,
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

  const rawScheduling = settings.scheduling && typeof settings.scheduling === 'object' ? settings.scheduling : {};

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
    statusOnSend:
      typeof settings.statusOnSend === 'string' && settings.statusOnSend.trim()
        ? settings.statusOnSend.trim()
        : 'Contato Inicial',
    messageFlow,
    scheduling: {
      timezone: typeof rawScheduling.timezone === 'string' ? rawScheduling.timezone : undefined,
    },
  };
};

type FormulaContext = {
  lead: any;
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

const buildFormulaContext = (lead: any, _timeZone?: string): FormulaContext => {
  const firstName = lead?.nome_completo?.trim()?.split(/\s+/)?.[0] ?? '';
  return {
    lead,
    now: new Date(),
    nome: lead?.nome_completo ?? '',
    primeiro_nome: firstName,
    telefone: lead?.telefone ?? '',
    email: lead?.email ?? '',
    status: lead?.status ?? '',
    origem: lead?.origem ?? '',
    cidade: lead?.cidade ?? '',
    responsavel: lead?.responsavel ?? '',
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
      ? parsed.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
      : parsed.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
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

const parseRecipientList = (value?: string): { email: string }[] =>
  (value ?? '')
    .split(/[;,]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((email) => ({ email }));

const parseHeaderValue = (value: unknown): Record<string, string> => {
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, val]) => [key, String(val ?? '')]),
    );
  }
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object') {
        return Object.fromEntries(
          Object.entries(parsed as Record<string, unknown>).map(([key, val]) => [key, String(val ?? '')]),
        );
      }
    } catch {
      return {};
    }
  }
  return {};
};

const applyTemplateVariables = (template: string, lead: any, timeZone?: string) => {
  const firstName = lead?.nome_completo?.trim()?.split(/\s+/)?.[0] ?? '';
  const greeting = getGreetingForDate(new Date(), timeZone);
  const greetingTitle = formatGreetingTitle(greeting);

  const withVariables = template
    .replace(/{{\s*nome\s*}}/gi, lead?.nome_completo || '')
    .replace(/{{\s*primeiro_nome\s*}}/gi, firstName)
    .replace(/{{\s*saudacao\s*}}/gi, greeting)
    .replace(/{{\s*saudacao_(?:capitalizada|titulo)\s*}}/gi, greetingTitle)
    .replace(/{{\s*origem\s*}}/gi, lead?.origem || '')
    .replace(/{{\s*cidade\s*}}/gi, lead?.cidade || '')
    .replace(/{{\s*responsavel\s*}}/gi, lead?.responsavel || '');

  const context = buildFormulaContext(lead, timeZone);
  return applyFormulaTokens(withVariables, context);
};

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
      case 'whatsapp_valid':
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

  const normalizeConditionValue = (field: AutoContactFlowConditionField, value: unknown): string => {
    const rawValue = typeof value === 'string' ? value : '';
    if (field !== 'whatsapp_valid') return rawValue;
    return normalizeBooleanConditionValue(rawValue) ?? rawValue;
  };

  const normalizeActionType = (value: unknown): AutoContactFlowActionType => {
  switch (value) {
    case 'send_message':
    case 'update_status':
    case 'archive_lead':
    case 'delete_lead':
    case 'webhook':
    case 'create_task':
    case 'send_email':
    case 'activate_autonomous_service':
      return value;
    default:
      return 'send_message';
  }
  };

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

  const normalizeMessageSource = (value: unknown): AutoContactFlowMessageSource =>
    value === 'custom' ? 'custom' : 'template';

  const normalizeDelayUnit = (value: unknown): 'minutes' | 'hours' | 'days' => {
    switch (value) {
      case 'minutes':
      case 'hours':
      case 'days':
        return value;
      default:
        return 'hours';
    }
  };

  const normalizeCustomMessage = (message: any): AutoContactFlowCustomMessage => ({
    type: normalizeMessageType(message?.type),
    text: typeof message?.text === 'string' ? message.text : '',
    mediaUrl: typeof message?.mediaUrl === 'string' ? message.mediaUrl : '',
    caption: typeof message?.caption === 'string' ? message.caption : '',
    filename: typeof message?.filename === 'string' ? message.filename : '',
  });

  const rawScheduling =
    settings.scheduling && typeof settings.scheduling === 'object' ? settings.scheduling : {};
  const rawDailySendLimit = Number((rawScheduling as any).dailySendLimit ?? (settings as any).dailySendLimit);
  const dailySendLimit =
    Number.isFinite(rawDailySendLimit) && rawDailySendLimit > 0 ? rawDailySendLimit : null;
  const scheduling: AutoContactSchedulingSettings = {
    timezone: typeof (rawScheduling as any).timezone === 'string'
      ? (rawScheduling as any).timezone
      : DEFAULT_SCHEDULING.timezone,
    startHour: typeof (rawScheduling as any).startHour === 'string'
      ? (rawScheduling as any).startHour
      : DEFAULT_SCHEDULING.startHour,
    endHour: typeof (rawScheduling as any).endHour === 'string'
      ? (rawScheduling as any).endHour
      : DEFAULT_SCHEDULING.endHour,
    allowedWeekdays: Array.isArray((rawScheduling as any).allowedWeekdays)
      ? (rawScheduling as any).allowedWeekdays
          .map((value: unknown) => Number(value))
          .filter((value: number) => Number.isFinite(value) && value >= 1 && value <= 7)
      : DEFAULT_SCHEDULING.allowedWeekdays,
    skipHolidays: (rawScheduling as any).skipHolidays !== false,
    dailySendLimit,
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
            value: normalizeConditionValue(field, condition?.value),
          };
        })
        .filter((condition) => condition.field === 'lead_created' || condition.value.trim());
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
            value: normalizeConditionValue(field, condition?.value),
          };
        })
        .filter((condition) => condition.field === 'lead_created' || condition.value.trim());
      const normalizedSteps = steps.map((step: any, stepIndex: number) => {
        const delayValueRaw = Number(step?.delayValue ?? step?.delayHours);
        const delayValue = Number.isFinite(delayValueRaw) && delayValueRaw >= 0 ? delayValueRaw : 0;
        const delayUnit = normalizeDelayUnit(step?.delayUnit ?? (step?.delayHours != null ? 'hours' : undefined));
        const delayExpression = typeof step?.delayExpression === 'string' ? step.delayExpression.trim() : '';
        const delayHours = delayUnit === 'minutes'
          ? delayValue / 60
          : delayUnit === 'days'
            ? delayValue * 24
            : delayValue;
        const actionType = normalizeActionType(step?.actionType);
        if (actionType === 'send_message') {
          const messageSource = normalizeMessageSource(step?.messageSource);
          const templateId = typeof step?.templateId === 'string' ? step.templateId : '';
          const validTemplateId =
            messageTemplates.some((template) => template.id === templateId) ? templateId : fallbackTemplateId;
          return {
            id: typeof step?.id === 'string' && step.id.trim() ? step.id : `flow-${flowId}-step-${stepIndex}`,
            delayHours,
            delayValue,
            delayUnit,
            delayExpression: delayExpression || undefined,
            actionType,
            messageSource,
            templateId: validTemplateId,
            customMessage: normalizeCustomMessage(step?.customMessage),
            messages: Array.isArray(step?.messages)
              ? step.messages
                  .map((item: any) => {
                    if (!item || typeof item !== 'object') return null;
                    if (typeof item.templateId === 'string' && item.templateId.trim()) {
                      return {
                        templateId: messageTemplates.some((t) => t.id === item.templateId)
                          ? item.templateId
                          : validTemplateId,
                      };
                    }
                    if (item.custom && typeof item.custom === 'object') {
                      return { custom: normalizeCustomMessage(item.custom) };
                    }
                    return null;
                  })
                  .filter(Boolean)
              : undefined,
          };
        }

        if (actionType === 'update_status') {
          return {
            id: typeof step?.id === 'string' && step.id.trim() ? step.id : `flow-${flowId}-step-${stepIndex}`,
            delayHours,
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
            delayHours,
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
            delayHours,
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
            delayHours,
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
          delayHours,
          delayValue,
          delayUnit,
          delayExpression: delayExpression || undefined,
          actionType,
        };
      });

      const rawFlowScheduling =
        flow?.scheduling && typeof flow.scheduling === 'object' ? flow.scheduling : {};
      const rawFlowDailySendLimit = Number((rawFlowScheduling as any).dailySendLimit);
      const flowScheduling: AutoContactFlowScheduling = {
        startHour:
          typeof rawFlowScheduling.startHour === 'string' ? rawFlowScheduling.startHour : scheduling.startHour,
        endHour:
          typeof rawFlowScheduling.endHour === 'string' ? rawFlowScheduling.endHour : scheduling.endHour,
        allowedWeekdays: Array.isArray(rawFlowScheduling.allowedWeekdays)
          ? rawFlowScheduling.allowedWeekdays
              .map((value: unknown) => Number(value))
              .filter((value: number) => Number.isFinite(value) && value >= 1 && value <= 7)
          : scheduling.allowedWeekdays,
        dailySendLimit:
          Number.isFinite(rawFlowDailySendLimit) && rawFlowDailySendLimit > 0
            ? Math.floor(rawFlowDailySendLimit)
            : null,
      };

      return {
        id: flowId,
        name: typeof flow?.name === 'string' ? flow.name : '',
        triggerStatus: typeof flow?.triggerStatus === 'string' ? flow.triggerStatus : '',
        ativo: flow?.ativo !== false,
        triggerType:
          flow?.triggerType === 'status_changed' ||
          flow?.triggerType === 'status_duration' ||
          flow?.triggerType === 'inactivity_duration'
            ? flow.triggerType
            : 'lead_created',
        triggerStatuses: Array.isArray(flow?.triggerStatuses)
          ? flow.triggerStatuses.filter((status: unknown) => typeof status === 'string')
          : [],
        triggerDurationHours:
          Number.isFinite(Number(flow?.triggerDurationHours)) && Number(flow.triggerDurationHours) >= 1
            ? Math.max(1, Number(flow.triggerDurationHours))
            : 24,
        steps: normalizedSteps,
        finalStatus: typeof flow?.finalStatus === 'string' ? flow.finalStatus : '',
        conditionLogic: flow?.conditionLogic === 'any' ? 'any' : 'all',
        conditions: normalizedConditions,
        exitConditionLogic: flow?.exitConditionLogic === 'all' ? 'all' : 'any',
        exitConditions: normalizedExitConditions,
        tags: Array.isArray(flow?.tags)
          ? flow.tags.filter((tag: unknown) => typeof tag === 'string' && tag.trim()).map((tag: string) => tag.trim())
          : [],
        scheduling: flowScheduling,
        invalidNumberAction: normalizeInvalidNumberAction(flow?.invalidNumberAction),
        invalidNumberStatus: typeof flow?.invalidNumberStatus === 'string' ? flow.invalidNumberStatus : '',
      };
    })
    .filter((flow) => flow.steps.length > 0);

  return {
    enabled: settings.enabled !== false,
    autoSend: settings.autoSend !== false,
    messageTemplates,
    flows: normalizedFlows,
    scheduling,
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
    case 'whatsapp_valid':
      if (typeof lead.whatsapp_valid === 'string' && lead.whatsapp_valid.length) {
        return normalizeBooleanConditionValue(lead.whatsapp_valid) ?? 'false';
      }
      if (typeof lead.whatsapp_valid === 'boolean') {
        return lead.whatsapp_valid ? 'true' : 'false';
      }
      return 'false';
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

const BOOLEAN_CONDITION_FIELDS = ['whatsapp_valid'];

const matchesFlowCondition = (
  condition: AutoContactFlowCondition,
  lead: any,
  event?: AutoContactFlowEvent,
  options: { ignoreEventConditions?: boolean } = {},
): boolean => {
  if (options.ignoreEventConditions && (condition.field === 'lead_created' || condition.field === 'event')) {
    return true;
  }

  if (condition.field === 'lead_created') {
    return event === 'lead_created';
  }

  if (BOOLEAN_CONDITION_FIELDS.includes(condition.field)) {
    const leadValue = getLeadFieldValue(lead, condition.field, event);
    const normalizedLeadValue = normalizeBooleanConditionValue(leadValue) ?? 'false';
    const normalizedExpectedValue = normalizeBooleanConditionValue(condition.value) ?? 'true';

    if (condition.operator === 'not_equals' || condition.operator === 'not_contains') {
      return normalizedLeadValue !== normalizedExpectedValue;
    }

    return normalizedLeadValue === normalizedExpectedValue;
  }

  const context = buildFormulaContext(lead);
  const resolvedValue = condition.value.trim().startsWith('=')
    ? String(evaluateExpression(condition.value, context) ?? '')
    : condition.value;
  const value = normalizeText(resolvedValue);
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

const matchesAutoContactFlow = (
  flow: AutoContactFlow,
  lead: any,
  event?: AutoContactFlowEvent,
  options: { enforceTrigger?: boolean; ignoreEventConditions?: boolean } = {},
): boolean => {
  const enforceTrigger = options.enforceTrigger !== false;

  if (enforceTrigger) {
    const triggerType = flow.triggerType ?? 'lead_created';

    if (triggerType === 'lead_created') {
      if (event !== 'lead_created') return false;
    }

    if (triggerType === 'status_changed') {
      if (event !== 'status_changed') return false;
      const triggerStatuses = flow.triggerStatuses ?? [];
      if (triggerStatuses.length > 0 && !triggerStatuses.includes(lead.status ?? '')) {
        return false;
      }
    }

    if (triggerType === 'status_duration' || triggerType === 'inactivity_duration') {
      return false;
    }
  }

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

  const isMatch = (condition: AutoContactFlowCondition) =>
    matchesFlowCondition(condition, lead, event, { ignoreEventConditions: options.ignoreEventConditions });
  return flow.conditionLogic === 'any' ? conditions.some(isMatch) : conditions.every(isMatch);
};

const shouldExitFlow = (flow: AutoContactFlow, lead: any, event?: AutoContactFlowEvent): boolean => {
  const exitConditions = flow.exitConditions ?? [];
  if (exitConditions.length === 0) return false;
  const isMatch = (condition: AutoContactFlowCondition) => matchesFlowCondition(condition, lead, event);
  return flow.exitConditionLogic === 'all' ? exitConditions.every(isMatch) : exitConditions.some(isMatch);
};

const getDelaySeconds = (step: AutoContactFlowStep, lead?: any): number => {
  if (step.delayExpression && lead) {
    const context = buildFormulaContext(lead);
    const result = evaluateExpression(step.delayExpression, context);
    const parsed = typeof result === 'number' ? result : Number(result);
    if (Number.isFinite(parsed)) {
      if (step.delayUnit === 'minutes') return Math.max(0, parsed) * 60;
      if (step.delayUnit === 'days') return Math.max(0, parsed) * 24 * 60 * 60;
      return Math.max(0, parsed) * 60 * 60;
    }
  }

  if (typeof step.delayValue === 'number' && step.delayUnit) {
    if (step.delayUnit === 'minutes') return Math.max(0, step.delayValue) * 60;
    if (step.delayUnit === 'days') return Math.max(0, step.delayValue) * 24 * 60 * 60;
    return Math.max(0, step.delayValue) * 60 * 60;
  }
  return Math.max(0, step.delayHours) * 60 * 60;
};

const HIDDEN_PREVIEW_TEXTS = new Set([
  '[mensagem]', '[mensagem sem texto]', '[mensagem sem conteudo]', '[mensagem sem conteúdo]',
  '[payload invalido]', '[payload inválido]', '[acao]', '[ação]', '[action]', '[reacao]', '[reação]',
  '[reaction]', '[atualizacao de midia]', '[atualização de mídia]', '[media update]', '[voto em enquete]',
]);

const VISIBLE_MEDIA_MARKERS = new Set([
  '[imagem]', '[video]', '[documento]', '[audio]', '[link]',
  '[localizacao]', '[sticker]', '[contato]', '[enquete]', '[quiz]', '[pergunta]',
  '[evento]', '[produto]', '[catalogo]', '[convite]', '[newsletter]', '[convite admin]',
  '[sistema]', '[chamada]', '[fixada]', '[status]', '[album]',
  '[resposta]', '[lista]', '[botoes]', '[mensagem interativa]',
]);

const isHiddenPreviewText = (text: string | null | undefined, messageType?: string | null): boolean => {
  const value = (text ?? '').trim().toLowerCase();
  if (!value) return false;

  if (HIDDEN_PREVIEW_TEXTS.has(value)) return true;

  const messageTypeKey = (messageType ?? '').trim().toLowerCase();
  const messageMarker = messageTypeKey
    ? (messageTypeKey === 'text' ? '[mensagem]'
      : messageTypeKey === 'image' ? '[imagem]'
      : messageTypeKey === 'video' || messageTypeKey === 'gif' || messageTypeKey === 'short' ? '[video]'
      : messageTypeKey === 'audio' || messageTypeKey === 'voice' ? '[audio]'
      : messageTypeKey === 'document' ? '[documento]'
      : messageTypeKey === 'link_preview' ? '[link]'
      : messageTypeKey === 'location' || messageTypeKey === 'live_location' ? '[localizacao]'
      : messageTypeKey === 'sticker' ? '[sticker]'
      : messageTypeKey === 'contact' || messageTypeKey === 'contact_list' ? '[contato]'
      : messageTypeKey === 'poll' ? '[enquete]'
      : messageTypeKey === 'quiz' ? '[quiz]'
      : messageTypeKey === 'question' ? '[pergunta]'
      : messageTypeKey === 'event' ? '[evento]'
      : messageTypeKey === 'product' ? '[produto]'
      : messageTypeKey === 'catalog' ? '[catalogo]'
      : messageTypeKey === 'group_invite' ? '[convite]'
      : messageTypeKey === 'newsletter_invite' ? '[newsletter]'
      : messageTypeKey === 'admin_invite' ? '[convite admin]'
      : messageTypeKey === 'system' ? '[sistema]'
      : messageTypeKey === 'call' ? '[chamada]'
      : messageTypeKey === 'pin' ? '[fixada]'
      : messageTypeKey === 'story' ? '[status]'
      : messageTypeKey === 'album' ? '[album]'
      : messageTypeKey === 'reply' ? '[resposta]'
      : messageTypeKey === 'list' ? '[lista]'
      : messageTypeKey === 'buttons' ? '[botoes]'
      : messageTypeKey === 'interactive' || messageTypeKey === 'hsm' || messageTypeKey === 'carousel' ? '[mensagem interativa]'
      : '[' + messageTypeKey + ']')
    : null;

  if (messageMarker && value === messageMarker && !VISIBLE_MEDIA_MARKERS.has(messageMarker)) return true;

  if (/^\[[^\]]+\]$/.test(value) && !VISIBLE_MEDIA_MARKERS.has(value)) return true;

  return false;
};

const isMessageVisible = (msg: { text_content?: string | null; media_caption?: string | null; message_type?: string | null }): boolean => {
  const caption = msg.media_caption?.trim();
  const text = msg.text_content?.trim();
  const msgType = msg.message_type;

  if (caption && !isHiddenPreviewText(caption, msgType)) return true;
  if (text && !isHiddenPreviewText(text, msgType)) return true;

  if (msgType === 'image') return true;
  if (msgType === 'video' || msgType === 'gif' || msgType === 'short') return true;
  if (msgType === 'audio' || msgType === 'voice') return true;
  if (msgType === 'document') return true;
  if (msgType === 'sticker') return true;
  if (msgType === 'location' || msgType === 'live_location') return true;
  if (msgType === 'contact' || msgType === 'contact_list') return true;
  if (msgType === 'poll') return true;
  if (msgType === 'interactive' || msgType === 'hsm' || msgType === 'carousel') return true;
  if (msgType === 'reply') return true;

  return false;
};

async function getLatestChatMessageAt({
  supabase,
  leadId,
  direction,
  visibleOnly = true,
}: {
  supabase: ReturnType<typeof createClient>;
  leadId: string;
  direction?: 'inbound';
  visibleOnly?: boolean;
}): Promise<string | null> {
  const { data: chats, error: chatsError } = await supabase
    .from('comm_whatsapp_chats')
    .select('id')
    .eq('lead_id', leadId)
    .is('merged_into_chat_id', null);

  if (chatsError || !chats?.length) return null;

  let query = supabase
    .from('comm_whatsapp_messages')
    .select('message_at, text_content, media_caption, message_type')
    .in('chat_id', chats.map((chat) => chat.id))
    .order('message_at', { ascending: false })
    .limit(visibleOnly ? 50 : 1);

  if (direction) {
    query = query.eq('direction', direction);
  }

  const { data: messages } = await query;

  if (!messages?.length) return null;

  if (!visibleOnly) {
    return typeof messages[0]?.message_at === 'string' ? messages[0].message_at : null;
  }

  for (const msg of messages) {
    if (isMessageVisible(msg) && typeof msg.message_at === 'string') {
      return msg.message_at;
    }
  }

  return null;
}

const isAfter = (candidate: string | null, reference: string): boolean => {
  if (!candidate) return false;
  const candidateTime = new Date(candidate).getTime();
  const referenceTime = new Date(reference).getTime();
  return Number.isFinite(candidateTime) && Number.isFinite(referenceTime) && candidateTime > referenceTime;
};

async function scheduleFlowJobs({
  supabase,
  leadId,
  lead,
  flow,
  scheduling,
  runtimeContext,
  anchorAt,
  enrollmentId,
  triggerMessageId,
  triggerMessageAt,
}: {
  supabase: ReturnType<typeof createClient>;
  leadId: string;
  lead: any;
  flow: AutoContactFlow;
  scheduling: AutoContactSchedulingSettings;
  runtimeContext?: Record<string, string> | null;
  anchorAt?: Date;
  enrollmentId?: string;
  triggerMessageId?: string;
  triggerMessageAt?: Date;
}): Promise<void> {
  const now = new Date();
  const effectiveScheduling: AutoContactSchedulingSettings = {
    ...scheduling,
    startHour: flow.scheduling?.startHour ?? scheduling.startHour,
    endHour: flow.scheduling?.endHour ?? scheduling.endHour,
    allowedWeekdays:
      flow.scheduling?.allowedWeekdays?.length ? flow.scheduling.allowedWeekdays : scheduling.allowedWeekdays,
    dailySendLimit: flow.scheduling?.dailySendLimit ?? null,
  };

  const buildActionPayload = (step: AutoContactFlowStep): Record<string, unknown> | null => {
    switch (step.actionType) {
      case 'webhook':
        return {
          url: step.webhookUrl ?? '',
          method: step.webhookMethod ?? 'POST',
          headers: step.webhookHeaders ?? '',
          body: step.webhookBody ?? '',
        };
      case 'create_task':
        return {
          title: step.taskTitle ?? '',
          description: step.taskDescription ?? '',
          dueHours: step.taskDueHours ?? null,
          priority: step.taskPriority ?? 'normal',
        };
      case 'send_email':
        return {
          to: step.emailTo ?? '',
          cc: step.emailCc ?? '',
          bcc: step.emailBcc ?? '',
          subject: step.emailSubject ?? '',
          body: step.emailBody ?? '',
        };
      default:
        return null;
    }
  };

  const buildJobRow = (
    step: AutoContactFlowStep,
    stepOrder: number,
    scheduledAt: Date,
    actionPayloadOverride?: Record<string, unknown> | null,
  ) => {
    const actionPayload = actionPayloadOverride ?? buildActionPayload(step);
    let finalActionPayload = mergeJobActionPayload(actionPayload, runtimeContext ?? null);
    if (step.actionType === 'send_message' && Array.isArray(step.messages) && step.messages.length > 0) {
      if (!finalActionPayload) finalActionPayload = {};
      finalActionPayload.messages = step.messages;
    }
    return {
      lead_id: leadId,
      flow_id: flow.id,
      step_id: step.id,
      step_order: stepOrder,
      action_type: step.actionType,
      message_source: step.messageSource ?? null,
      template_id: step.templateId ?? null,
      custom_message: step.customMessage ?? null,
      status_to_set: step.statusToSet ?? null,
      action_payload: finalActionPayload,
      scheduled_at: scheduledAt.toISOString(),
      status: 'pending',
      enrollment_id: enrollmentId ?? null,
      trigger_message_id: triggerMessageId ?? null,
      trigger_message_at: triggerMessageAt?.toISOString() ?? null,
    };
  };

  const firstStep = flow.steps[0];
  if (!firstStep) return;

  const baseAt = anchorAt ?? now;
  const firstDelaySeconds = getDelaySeconds(firstStep, lead);
  let firstScheduledAt = getNextAllowedSendAt(new Date(baseAt.getTime() + firstDelaySeconds * 1000), effectiveScheduling);

  if (firstScheduledAt.getTime() < now.getTime()) {
    // The lead completed its window in the past (e.g. while the queue was
    // paused). Abordagem (lead_created) never spreads: it fires as soon as
    // detected, respecting the window (now if inside, next opening otherwise).
    // Fresh eligibility (cron pickup a few minutes late) also fires
    // immediately; only real backlogs are spread deterministically across the
    // send window so drains happen individually instead of bursting.
    const backlogMinutes = (now.getTime() - firstScheduledAt.getTime()) / 60000;
    firstScheduledAt =
      flow.triggerType === 'lead_created' || backlogMinutes <= 15
        ? getNextAllowedSendAt(now, effectiveScheduling)
        : getSpreadSendAt(now, leadId, effectiveScheduling);
  }

  // For enrollment-based flows: only delete pending jobs for the SAME enrollment
  // (or legacy jobs without enrollment_id). Never delete a different enrollment's jobs.
  if (enrollmentId) {
    await supabase
      .from('auto_contact_flow_jobs')
      .delete()
      .eq('lead_id', leadId)
      .eq('flow_id', flow.id)
      .eq('status', 'pending')
      .or(`enrollment_id.is.null,enrollment_id.eq.${enrollmentId}`);
  } else {
    // Legacy path (lead_created, status_duration): delete all pending for lead+flow
    await supabase
      .from('auto_contact_flow_jobs')
      .delete()
      .eq('lead_id', leadId)
      .eq('flow_id', flow.id)
      .eq('status', 'pending');
  }

  await supabase.from('auto_contact_flow_jobs').insert(buildJobRow(firstStep, 0, firstScheduledAt));
}

const getLeadSpreadMinutes = (leadId: string, windowMinutes: number): number => {
  let hash = 0;
  for (let i = 0; i < leadId.length; i += 1) {
    hash = (hash * 31 + leadId.charCodeAt(i)) >>> 0;
  }
  return hash % Math.max(1, windowMinutes);
};

const getSpreadSendAt = (
  from: Date,
  leadId: string,
  scheduling: AutoContactSchedulingSettings,
): Date => {
  const timeZone = scheduling.timezone || 'America/Sao_Paulo';
  const start = parseHourMinute(scheduling.startHour);
  const end = parseHourMinute(scheduling.endHour);
  const windowMinutes = Math.max(
    60,
    end.hour * 60 + end.minute - (start.hour * 60 + start.minute),
  );
  const spreadMinutes = getLeadSpreadMinutes(leadId, windowMinutes);

  const earliest = getNextAllowedSendAt(new Date(from.getTime() + 60000), scheduling);
  const zoned = toZonedDate(earliest, timeZone);

  const windowStartUtc = buildDateInTimeZone(
    {
      year: zoned.getUTCFullYear(),
      month: zoned.getUTCMonth(),
      day: zoned.getUTCDate(),
      hour: start.hour,
      minute: start.minute,
    },
    timeZone,
  );
  const windowEndUtc = buildDateInTimeZone(
    {
      year: zoned.getUTCFullYear(),
      month: zoned.getUTCMonth(),
      day: zoned.getUTCDate(),
      hour: end.hour,
      minute: end.minute,
    },
    timeZone,
  );

  const candidate = new Date(windowStartUtc.getTime() + spreadMinutes * 60000);
  if (candidate.getTime() >= earliest.getTime() && candidate.getTime() <= windowEndUtc.getTime()) {
    return candidate;
  }
  if (candidate.getTime() < earliest.getTime()) {
    return earliest;
  }
  const nextDayStart = buildDateInTimeZone(
    {
      year: zoned.getUTCFullYear(),
      month: zoned.getUTCMonth(),
      day: zoned.getUTCDate() + 1,
      hour: start.hour,
      minute: start.minute,
    },
    timeZone,
  );
  return getNextAllowedSendAt(new Date(nextDayStart.getTime() + spreadMinutes * 60000), scheduling);
};

async function scheduleNextFlowStep({
  supabase,
  lead,
  flow,
  completedJob,
  scheduling,
}: {
  supabase: ReturnType<typeof createClient>;
  lead: any;
  flow: AutoContactFlow;
  completedJob: any;
  scheduling: AutoContactSchedulingSettings;
}): Promise<Date | null> {
  const nextStep = flow.steps[completedJob.step_order + 1];
  if (!nextStep) return null;

  const { data: existing } = await supabase
    .from('auto_contact_flow_jobs')
    .select('id')
    .eq('lead_id', completedJob.lead_id)
    .eq('flow_id', flow.id)
    .eq('step_order', completedJob.step_order + 1)
    .limit(1)
    .maybeSingle();
  if (existing) return null;

  const effectiveScheduling: AutoContactSchedulingSettings = {
    ...scheduling,
    startHour: flow.scheduling?.startHour ?? scheduling.startHour,
    endHour: flow.scheduling?.endHour ?? scheduling.endHour,
    allowedWeekdays:
      flow.scheduling?.allowedWeekdays?.length ? flow.scheduling.allowedWeekdays : scheduling.allowedWeekdays,
    dailySendLimit: flow.scheduling?.dailySendLimit ?? null,
  };

  const delaySeconds = getDelaySeconds(nextStep, lead);
  const desiredAt = new Date(Date.now() + delaySeconds * 1000);
  const scheduledAt = getNextAllowedSendAt(desiredAt, effectiveScheduling);

  const actionPayload = (() => {
    switch (nextStep.actionType) {
      case 'webhook':
        return {
          url: nextStep.webhookUrl ?? '',
          method: nextStep.webhookMethod ?? 'POST',
          headers: nextStep.webhookHeaders ?? '',
          body: nextStep.webhookBody ?? '',
        };
      case 'create_task':
        return {
          title: nextStep.taskTitle ?? '',
          description: nextStep.taskDescription ?? '',
          dueHours: nextStep.taskDueHours ?? null,
          priority: nextStep.taskPriority ?? 'normal',
        };
      case 'send_email':
        return {
          to: nextStep.emailTo ?? '',
          cc: nextStep.emailCc ?? '',
          bcc: nextStep.emailBcc ?? '',
          subject: nextStep.emailSubject ?? '',
          body: nextStep.emailBody ?? '',
        };
      default:
        return null;
    }
  })();

  const runtimeContext = getJobRuntimeContext(completedJob.action_payload) ?? {};
  const finalActionPayload = mergeJobActionPayload(actionPayload, runtimeContext);
  if (nextStep.actionType === 'send_message' && Array.isArray(nextStep.messages) && nextStep.messages.length > 0) {
    finalActionPayload.messages = nextStep.messages;
  }

  await supabase.from('auto_contact_flow_jobs').insert({
    lead_id: completedJob.lead_id,
    flow_id: flow.id,
    step_id: nextStep.id,
    step_order: completedJob.step_order + 1,
    action_type: nextStep.actionType,
    message_source: nextStep.messageSource ?? null,
    template_id: nextStep.templateId ?? null,
    custom_message: nextStep.customMessage ?? null,
    status_to_set: nextStep.statusToSet ?? null,
    action_payload: finalActionPayload,
    scheduled_at: scheduledAt.toISOString(),
    status: 'pending',
    enrollment_id: completedJob.enrollment_id ?? null,
    trigger_message_id: completedJob.trigger_message_id ?? null,
    trigger_message_at: completedJob.trigger_message_at ?? null,
  });

  return scheduledAt;
}

const canContinueLeadCreatedAdministrativeStep = (flow: AutoContactFlow, job: any): boolean =>
  job.action_type === 'activate_autonomous_service'
    && flow.triggerType !== 'inactivity_duration'
    && flow.steps.some((step) => step.id === job.step_id && step.actionType === 'activate_autonomous_service');

async function cancelFlowJobs({
  supabase,
  leadId,
  flowId,
  enrollmentId,
  reason,
}: {
  supabase: ReturnType<typeof createClient>;
  leadId: string;
  flowId?: string | null;
  enrollmentId?: string | null;
  reason?: string;
}): Promise<void> {
  let query = supabase
    .from('auto_contact_flow_jobs')
    .update({ status: 'skipped', last_error: reason ?? 'Fluxo cancelado' })
    .eq('lead_id', leadId)
    .eq('status', 'pending');

  if (flowId) {
    query = query.eq('flow_id', flowId);
  }

  // Enrollment-scoped: only cancel jobs belonging to this enrollment
  if (enrollmentId) {
    query = query.eq('enrollment_id', enrollmentId);
  }

  await query;
}

async function processFlowJobs({
  supabase,
  lookups,
  settings,
  logWithContext,
  leadId,
  cascadeDepth = 0,
}: {
  supabase: ReturnType<typeof createClient>;
  lookups: LeadLookupMaps;
  settings: AutoContactFlowSettings;
  logWithContext: (message: string, details?: Record<string, unknown>) => void;
  leadId?: string;
  cascadeDepth?: number;
}): Promise<void> {
  const flowDailyUsageCache = new Map<string, { count: number }>();
  const nowIso = new Date().toISOString();
  const maxCascadeDepth = 5;

  // Self-healing: jobs stuck in 'processing' (edge function died mid-send) are
  // reset to pending so the lead is not blocked forever.
  await supabase
    .from('auto_contact_flow_jobs')
    .update({ status: 'pending', last_error: 'Job reiniciado (processamento interrompido)' })
    .eq('status', 'processing')
    .lt('updated_at', new Date(Date.now() - 10 * 60 * 1000).toISOString());

  let jobsQuery = supabase
    .from('auto_contact_flow_jobs')
    .select('*')
    .eq('status', 'pending')
    .lte('scheduled_at', nowIso)
    .order('scheduled_at', { ascending: true })
    .order('step_order', { ascending: true })
    .limit(25);

  if (leadId) {
    jobsQuery = jobsQuery.eq('lead_id', leadId);
  }

  const { data: jobs, error: jobsError } = await jobsQuery;

  if (jobsError) {
    logWithContext('Erro ao buscar jobs pendentes', { error: jobsError.message });
    return;
  }

  if (!jobs || jobs.length === 0) {
    return;
  }

  for (const job of jobs) {
    const previousAttempts = job.attempts ?? 0;
    const currentAttempt = previousAttempts + 1;
    const { data: updatedJob } = await supabase
      .from('auto_contact_flow_jobs')
      .update({ status: 'processing', attempts: currentAttempt })
      .eq('id', job.id)
      .eq('status', 'pending')
      .lte('scheduled_at', nowIso)
      .select('id')
      .maybeSingle();

    if (!updatedJob) {
      continue;
    }

    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('*')
      .eq('id', job.lead_id)
      .maybeSingle();

    if (leadError || !lead) {
      await supabase
        .from('auto_contact_flow_jobs')
        .update({ status: 'failed', last_error: leadError?.message ?? 'Lead não encontrado' })
        .eq('id', job.id);
      continue;
    }

    const flow = settings.flows.find((item) => item.id === job.flow_id);
    if (!flow) {
      await supabase
        .from('auto_contact_flow_jobs')
        .update({ status: 'skipped', last_error: 'Fluxo não encontrado' })
        .eq('id', job.id);
      continue;
    }

    if (flow.ativo === false) {
      await supabase
        .from('auto_contact_flow_jobs')
        .update({ status: 'skipped', last_error: 'Fluxo desativado' })
        .eq('id', job.id);
      continue;
    }

    const effectiveScheduling: AutoContactSchedulingSettings = {
      ...settings.scheduling,
      startHour: flow.scheduling?.startHour ?? settings.scheduling.startHour,
      endHour: flow.scheduling?.endHour ?? settings.scheduling.endHour,
      allowedWeekdays:
        flow.scheduling?.allowedWeekdays?.length ? flow.scheduling.allowedWeekdays : settings.scheduling.allowedWeekdays,
      dailySendLimit: flow.scheduling?.dailySendLimit ?? null,
    };
    const rawFlowDailySendLimit = Number(effectiveScheduling.dailySendLimit);
    const flowDailySendLimit =
      Number.isFinite(rawFlowDailySendLimit) && rawFlowDailySendLimit > 0
        ? Math.floor(rawFlowDailySendLimit)
        : null;
    const now = new Date();
    const nextAllowed = getNextAllowedSendAt(now, effectiveScheduling);
    if (nextAllowed.getTime() > now.getTime()) {
      await supabase
        .from('auto_contact_flow_jobs')
        .update({
          status: 'pending',
          scheduled_at: nextAllowed.toISOString(),
          last_error: 'Fora da janela de envio',
          attempts: previousAttempts,
        })
        .eq('id', job.id);
      continue;
    }

      const leadWithRelations = mapLeadRelationsForResponse(lead, lookups);
      if (!leadWithRelations.status) {
        leadWithRelations.status = lookups.statusById.get(lead.status_id) ?? 'Novo';
      }

      const jobRuntimeContext = getJobRuntimeContext(job.action_payload);
      if (jobRuntimeContext.whatsapp_valid) {
        leadWithRelations.whatsapp_valid = jobRuntimeContext.whatsapp_valid;
      } else if (usesWhatsappValidCondition(flow)) {
        leadWithRelations.whatsapp_valid = await resolveWhatsappValid(leadWithRelations);
      }

      const canContinueAdministrativeStep = canContinueLeadCreatedAdministrativeStep(flow, job);
      if (
        !canContinueAdministrativeStep &&
        (
          shouldExitFlow(flow, leadWithRelations) ||
          !matchesAutoContactFlow(flow, leadWithRelations, undefined, {
            enforceTrigger: false,
            ignoreEventConditions: true,
          })
        )
      ) {
        await supabase
          .from('auto_contact_flow_jobs')
          .update({ status: 'skipped', last_error: 'Condições não atendidas' })
          .eq('id', job.id);
      continue;
    }

    const inactivityStartedAt =
      flow.triggerType === 'inactivity_duration' &&
      job.action_payload &&
      typeof job.action_payload === 'object' &&
      (job.action_payload as Record<string, unknown>).runtimeContext &&
      typeof (job.action_payload as Record<string, unknown>).runtimeContext === 'object' &&
      typeof ((job.action_payload as Record<string, unknown>).runtimeContext as Record<string, unknown>).inactivity_started_at === 'string'
        ? ((job.action_payload as Record<string, unknown>).runtimeContext as Record<string, unknown>).inactivity_started_at as string
        : null;
    if (inactivityStartedAt) {
      const latestInboundAt = await getLatestChatMessageAt({
        supabase,
        leadId: lead.id,
        direction: 'inbound',
        visibleOnly: true,
      });
      const latestOutboundAt = await getLatestChatMessageAt({
        supabase,
        leadId: lead.id,
        direction: 'outbound',
        visibleOnly: true,
      });

      // Enrollment-based guard: if inbound arrived AFTER the trigger message,
      // this enrollment is stale — cancel only this enrollment's jobs.
      const triggerAt = job.trigger_message_at ?? inactivityStartedAt;
      if (latestInboundAt && isAfter(latestInboundAt, triggerAt)) {
        const reason = 'Cliente respondeu após a última mensagem enviada';
        await supabase
          .from('auto_contact_flow_jobs')
          .update({ status: 'skipped', last_error: reason })
          .eq('id', job.id);
        // Cancel only jobs in the same enrollment (not all jobs for the lead)
        if (job.enrollment_id) {
          await cancelFlowJobs({ supabase, leadId: lead.id, flowId: flow.id, enrollmentId: job.enrollment_id, reason });
        }
        continue;
      }

      // Also skip if a newer outbound exists (operator sent a new message)
      // and it's different from the trigger — the enrollment is stale
      if (
        job.trigger_message_at
        && latestOutboundAt
        && isAfter(latestOutboundAt, job.trigger_message_at)
      ) {
        const reason = 'Nova mensagem enviada após abertura desta janela';
        await supabase
          .from('auto_contact_flow_jobs')
          .update({ status: 'skipped', last_error: reason })
          .eq('id', job.id);
        if (job.enrollment_id) {
          await cancelFlowJobs({ supabase, leadId: lead.id, flowId: flow.id, enrollmentId: job.enrollment_id, reason });
        }
        continue;
      }
    }

    try {
      let flowDailyUsageCacheKey: string | null = null;
      if (job.action_type === 'send_message') {
        if (!getWhapiToken()) {
          const reason = 'WHAPI_TOKEN não configurado; envio de WhatsApp desativado.';
          logWithContext(reason, { jobId: job.id, leadId: lead.id, flowId: flow.id });
          await supabase
            .from('auto_contact_flow_jobs')
            .update({ status: 'skipped', last_error: reason })
            .eq('id', job.id);
          continue;
        }

        if (flowDailySendLimit) {
          const { dayKey, start, end } = buildTimeZoneDayWindow(now, effectiveScheduling.timezone);
          flowDailyUsageCacheKey = `${flow.id}:${dayKey}`;
          let cachedUsage = flowDailyUsageCache.get(flowDailyUsageCacheKey);
          if (!cachedUsage) {
            const currentCount = await getFlowDailySendCount({
              supabase,
              flowId: flow.id,
              start,
              end,
              logWithContext,
            });
            cachedUsage = { count: currentCount };
            flowDailyUsageCache.set(flowDailyUsageCacheKey, cachedUsage);
          }

          if (cachedUsage.count >= flowDailySendLimit) {
            const nextReference = new Date(end.getTime() + 60000);
            const nextAvailableAt = getSpreadSendAt(nextReference, job.lead_id, effectiveScheduling);
            await supabase
              .from('auto_contact_flow_jobs')
              .update({
                status: 'pending',
                scheduled_at: nextAvailableAt.toISOString(),
                last_error: `Limite diário do fluxo (${flowDailySendLimit}) atingido`,
                attempts: previousAttempts,
              })
              .eq('id', job.id);
            continue;
          }
        }

        let payload:
          | { contentType: FlowMessageType; content: string | { url: string; caption?: string; filename?: string } }
          | null = null;

        const multiMessages = Array.isArray(job.action_payload?.messages)
          ? (job.action_payload.messages as Array<{ templateId?: string; custom?: AutoContactFlowCustomMessage }>)
          : null;

        if (multiMessages && multiMessages.length > 0) {
          for (const item of multiMessages) {
            const itemPayload = item?.templateId
              ? (() => {
                  const template =
                    settings.messageTemplates.find((t) => t.id === item.templateId) ?? null;
                  const message = getTemplateMessage(template);
                  return message.trim()
                    ? {
                        contentType: 'text' as const,
                        content: applyTemplateVariables(message, leadWithRelations, settings.scheduling?.timezone),
                      }
                    : null;
                })()
              : buildCustomMessagePayload(item?.custom ?? null, leadWithRelations, settings.scheduling?.timezone);
            if (!itemPayload) continue;
            await sendAutoContactMessage({
              supabase,
              lead: leadWithRelations,
              contentType: itemPayload.contentType,
              content: itemPayload.content,
            });
          }
        } else if (job.message_source === 'custom') {
          payload = buildCustomMessagePayload(job.custom_message, leadWithRelations, settings.scheduling?.timezone);
        } else {
          const template =
            settings.messageTemplates.find((item) => item.id === job.template_id) ??
            settings.messageTemplates[0] ??
            null;
          const message = getTemplateMessage(template);
          if (message.trim()) {
            payload = {
              contentType: 'text',
              content: applyTemplateVariables(message, leadWithRelations, settings.scheduling?.timezone),
            };
          }
        }

        if (!payload && !(multiMessages && multiMessages.length > 0)) {
          throw new Error('Conteúdo inválido para envio automático.');
        }

        if (payload) {
          await sendAutoContactMessage({
            supabase,
            lead: leadWithRelations,
            contentType: payload.contentType,
            content: payload.content,
          });
        }

        const contactNowIso = new Date().toISOString();
        await supabase.from('leads').update({ ultimo_contato: contactNowIso }).eq('id', lead.id);
        await supabase.from('interactions').insert({
          lead_id: lead.id,
          tipo: 'Mensagem Automática',
          descricao: 'Fluxo automático executado via fila',
          responsavel: leadWithRelations.responsavel ?? 'Sistema',
        });
      }

      if (job.action_type === 'webhook') {
        const payload = job.action_payload ?? {};
        const urlTemplate = typeof payload.url === 'string' ? payload.url : '';
        const url = applyTemplateVariables(urlTemplate, leadWithRelations, settings.scheduling?.timezone).trim();
        if (!url) {
          throw new Error('Webhook sem URL configurada.');
        }
        const method = typeof payload.method === 'string' ? payload.method : 'POST';
        const rawHeaders = payload.headers;
        const headers = parseHeaderValue(rawHeaders);
        const bodyTemplate = typeof payload.body === 'string' ? payload.body : '';
        const resolvedBody = bodyTemplate
          ? applyTemplateVariables(bodyTemplate, leadWithRelations, settings.scheduling?.timezone)
          : JSON.stringify({ lead: leadWithRelations, flowId: job.flow_id, stepId: job.step_id });

        const contentTypeHeader = headers['Content-Type'] ?? headers['content-type'];
        const finalHeaders = {
          'Content-Type': contentTypeHeader ?? 'application/json',
          ...headers,
        };

        let bodyToSend: string | undefined = resolvedBody;
        if (finalHeaders['Content-Type']?.includes('application/json')) {
          try {
            const parsed = JSON.parse(resolvedBody);
            bodyToSend = JSON.stringify(parsed);
          } catch {
            bodyToSend = JSON.stringify({ payload: resolvedBody });
          }
        }

        const response = await fetch(url, {
          method,
          headers: finalHeaders,
          body: method === 'GET' ? undefined : bodyToSend,
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(errorText || 'Falha ao executar webhook.');
        }
      }

      if (job.action_type === 'update_status') {
        const statusName = job.status_to_set?.trim();
        if (!statusName) {
          throw new Error('Status alvo não configurado para a etapa.');
        }
        const statusId = lookups.statusByName.get(normalizeText(statusName)) ?? null;
        if (!statusId) {
          throw new Error('Status alvo não encontrado.');
        }
        await supabase.from('leads').update({ status_id: statusId }).eq('id', lead.id);
      }

      if (job.action_type === 'create_task') {
        const payload = job.action_payload ?? {};
        const title = applyTemplateVariables(String(payload.title ?? ''), leadWithRelations, settings.scheduling?.timezone).trim();
        if (!title) {
          throw new Error('Tarefa sem título configurado.');
        }
        const description = applyTemplateVariables(
          String(payload.description ?? ''),
          leadWithRelations,
          settings.scheduling?.timezone,
        ).trim();
        const dueHours = Number(payload.dueHours);
        const baseDate = new Date(job.scheduled_at);
        const dueAt = Number.isFinite(dueHours)
          ? new Date(baseDate.getTime() + dueHours * 3600000)
          : baseDate;
        const priority = typeof payload.priority === 'string' ? payload.priority : 'normal';

        await supabase.from('reminders').insert({
          lead_id: lead.id,
          tipo: 'Automacao',
          titulo: title,
          descricao: description || undefined,
          data_lembrete: dueAt.toISOString(),
          lido: false,
          prioridade: priority,
          responsavel: leadWithRelations.responsavel ?? null,
        });
      }

      if (job.action_type === 'send_email') {
        const payload = job.action_payload ?? {};
        const toList = parseRecipientList(String(payload.to ?? ''));
        if (toList.length === 0) {
          throw new Error('E-mail sem destinatário.');
        }
        const ccList = parseRecipientList(String(payload.cc ?? ''));
        const bccList = parseRecipientList(String(payload.bcc ?? ''));
        const subject = applyTemplateVariables(
          String(payload.subject ?? ''),
          leadWithRelations,
          settings.scheduling?.timezone,
        ).trim();
        const body = applyTemplateVariables(
          String(payload.body ?? ''),
          leadWithRelations,
          settings.scheduling?.timezone,
        ).trim();

        const { data: primaryAccount } = await supabase
          .from('email_accounts')
          .select('id, email_address, display_name, is_primary')
          .order('is_primary', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!primaryAccount) {
          throw new Error('Nenhuma conta de e-mail configurada.');
        }

        const { data: thread, error: threadError } = await supabase
          .from('email_threads')
          .insert({
            account_id: primaryAccount.id,
            subject,
            preview: body.slice(0, 120),
            folder: 'sent',
            participants: toList,
            unread: false,
          })
          .select('id')
          .single();

        if (threadError || !thread) {
          throw new Error('Erro ao criar thread de e-mail.');
        }

        await supabase.from('email_messages').insert({
          thread_id: thread.id,
          account_id: primaryAccount.id,
          direction: 'outbound',
          from_participant: {
            email: primaryAccount.email_address,
            name: primaryAccount.display_name,
          },
          to_participants: toList,
          cc_participants: ccList.length ? ccList : null,
          bcc_participants: bccList.length ? bccList : null,
          subject,
          body,
          folder: 'sent',
          unread: false,
          sent_at: new Date().toISOString(),
        });
      }

      if (job.action_type === 'archive_lead') {
        await supabase.from('leads').update({ arquivado: true }).eq('id', lead.id);
      }

      if (job.action_type === 'delete_lead') {
        await supabase.from('leads').delete().eq('id', lead.id);
      }

      if (job.action_type === 'activate_autonomous_service') {
        await activateAutonomousServiceForLead({ supabase, lead });
      }

      await supabase
        .from('auto_contact_flow_jobs')
        .update({ status: 'completed', last_error: null })
        .eq('id', job.id);

      const nextScheduledAt = await scheduleNextFlowStep({
        supabase,
        lead: leadWithRelations,
        flow,
        completedJob: job,
        scheduling: effectiveScheduling,
      });

      if (
        nextScheduledAt &&
        nextScheduledAt.getTime() <= Date.now() &&
        cascadeDepth < maxCascadeDepth
      ) {
        await processFlowJobs({
          supabase,
          lookups,
          settings,
          logWithContext,
          leadId: lead.id,
          cascadeDepth: cascadeDepth + 1,
        });
      }

      if (job.action_type === 'send_message' && flowDailyUsageCacheKey) {
        const cachedUsage = flowDailyUsageCache.get(flowDailyUsageCacheKey);
        if (cachedUsage) {
          cachedUsage.count += 1;
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      if (
        (job.action_type === 'send_message' || job.action_type === 'activate_autonomous_service')
        && isInvalidNumberError(error)
      ) {
        const reason = 'invalid_number: Número inválido/sem WhatsApp. Fluxo encerrado automaticamente.';
        try {
          await applyInvalidNumberAction({
            supabase,
            lead,
            flow,
            lookups,
            logWithContext,
          });
          await cancelFlowJobs({
            supabase,
            leadId: lead.id,
            flowId: flow.id,
            reason,
          });
          await supabase
            .from('auto_contact_flow_jobs')
            .update({ status: 'skipped', last_error: reason })
            .eq('id', job.id);
          continue;
        } catch (invalidNumberActionError) {
          const invalidActionMessage =
            invalidNumberActionError instanceof Error
              ? invalidNumberActionError.message
              : String(invalidNumberActionError);
          await supabase
            .from('auto_contact_flow_jobs')
            .update({
              status: 'failed',
              last_error: `${reason} Erro ao aplicar ação: ${invalidActionMessage}`,
            })
            .eq('id', job.id);
          continue;
        }
      }

      if (job.action_type === 'send_message' && isTemporaryWhapiError(error)) {
        if (previousAttempts < MAX_WHAPI_TEMPORARY_RETRIES) {
          const retryDelayMs = getWhapiRetryDelayMs(previousAttempts);
          const retryAt = new Date(Date.now() + retryDelayMs);
          const followUpAt = new Date(retryAt.getTime() + 60000);
          const retryReason =
            `temporary_whapi_error: tentativa ${currentAttempt}/${MAX_WHAPI_TEMPORARY_RETRIES + 1}. ` +
            `${message}`;

          await supabase
            .from('auto_contact_flow_jobs')
            .update({
              status: 'pending',
              scheduled_at: retryAt.toISOString(),
              last_error: retryReason,
            })
            .eq('id', job.id);

          await supabase
            .from('auto_contact_flow_jobs')
            .update({
              scheduled_at: followUpAt.toISOString(),
              last_error: `Aguardando reprocessamento do envio ${job.id}.`,
            })
            .eq('lead_id', lead.id)
            .eq('flow_id', flow.id)
            .eq('status', 'pending')
            .neq('id', job.id);

          continue;
        }

        const exhaustedReason =
          `temporary_whapi_error: limite de tentativas excedido (${MAX_WHAPI_TEMPORARY_RETRIES + 1}). ${message}`;

        await supabase
          .from('auto_contact_flow_jobs')
          .update({ status: 'failed', last_error: exhaustedReason })
          .eq('id', job.id);

        await cancelFlowJobs({
          supabase,
          leadId: lead.id,
          flowId: flow.id,
          reason: exhaustedReason,
        });
        continue;
      }

      if (job.action_type === 'activate_autonomous_service' && message.startsWith('autonomous_service_skipped:')) {
        await supabase
          .from('auto_contact_flow_jobs')
          .update({ status: 'skipped', last_error: message.replace(/^autonomous_service_skipped:\s*/, '') })
          .eq('id', job.id);
        continue;
      }

      await supabase
        .from('auto_contact_flow_jobs')
        .update({ status: 'failed', last_error: message })
        .eq('id', job.id);

      if (job.action_type === 'send_message') {
        await cancelFlowJobs({
          supabase,
          leadId: lead.id,
          flowId: flow.id,
          reason: `send_failed: ${message}`,
        });
      }
    }
  }
}

// Ativa o atendimento autonomo (IA) para o chat de WhatsApp deste lead
// especifico. Nao manda nenhuma mensagem — so liga o "interruptor" naquele
// chat; a partir dai, cada mensagem inbound nele agenda uma resposta da IA
// (ver webhook + ai-autonomous-reply-worker). Todo outro chat do numero
// (leads ja atendidos, clientes, conversas pessoais) permanece manual.
async function activateAutonomousServiceForLead({
  supabase,
  lead,
}: {
  supabase: ReturnType<typeof createClient>;
  lead: any;
}): Promise<void> {
  const whapiPhone = toWhapiPhoneNumber(lead?.telefone || '');
  if (!whapiPhone || !isValidWhatsappNumber(lead?.telefone || '')) {
    throw new Error('Telefone invalido para ativar atendimento autonomo.');
  }

  const whatsappCheck = await checkWhatsAppExistence(lead?.telefone);
  if (!whatsappCheck.exists) {
    throw new Error('Numero nao possui WhatsApp.');
  }

  const channel = await ensurePrimaryChannel(supabase);
  const requestedChatId = whatsappCheck.chatId ?? `${whapiPhone}@s.whatsapp.net`;
  const chatRoute = await resolveCommWhatsAppCanonicalChatRoute(supabase, {
    channelId: channel.id,
    externalChatId: requestedChatId,
  });

  if (chatRoute.identityConflict) {
    throw new Error('Identidade WhatsApp exige revisao manual antes de ativar o atendimento autonomo.');
  }
  if (chatRoute.leadId && lead?.id && chatRoute.leadId !== lead.id) {
    throw new Error('A identidade WhatsApp esta vinculada a outro lead.');
  }
  const requestedPhoneKeys = new Set(getCommWhatsAppPhoneLookupKeys(whapiPhone));
  if (
    chatRoute.phoneNumber
    && !getCommWhatsAppPhoneLookupKeys(chatRoute.phoneNumber).some((key) => requestedPhoneKeys.has(key))
  ) {
    throw new Error('A identidade WhatsApp resolvida pertence a outro telefone.');
  }
  if (!chatRoute.chatId) {
    throw new Error('Conversa do WhatsApp ainda nao existe para este lead.');
  }

  const leadCreatedAt = typeof lead?.created_at === 'string' ? lead.created_at : null;
  if (!leadCreatedAt) {
    throw new Error('autonomous_service_skipped: Atendimento autonomo nao ativado: lead sem data de criacao confiavel.');
  }

  const { data: previousMessages, error: previousMessagesError } = await supabase
    .from('comm_whatsapp_messages')
    .select('message_at,text_content,media_caption,message_type')
    .eq('chat_id', chatRoute.chatId)
    .lt('message_at', leadCreatedAt)
    .order('message_at', { ascending: false })
    .limit(50);

  if (previousMessagesError) {
    throw new Error(`Erro ao verificar historico do chat antes de ativar atendimento autonomo: ${previousMessagesError.message}`);
  }

  const hasVisiblePreviousHistory = (previousMessages ?? []).some((message) => isMessageVisible(message));
  if (hasVisiblePreviousHistory) {
    throw new Error('autonomous_service_skipped: Atendimento autonomo nao ativado: chat possui historico visivel anterior ao lead.');
  }

  const { error: updateError } = await supabase
    .from('comm_whatsapp_chats')
    .update({ autonomous_attendance_status: 'active' })
    .eq('id', chatRoute.chatId);
  if (updateError) {
    throw new Error(`Erro ao ativar atendimento autonomo: ${updateError.message}`);
  }

  // Como as etapas do fluxo passam pela fila (cron de 1 em 1 minuto), o lead
  // pode responder ANTES desta etapa rodar de fato — o webhook nao agenda
  // resposta nesse caso porque o chat ainda estava 'inactive' na hora. Sem
  // esse catch-up, essa mensagem ficaria sem resposta pra sempre (so
  // mensagens NOVAS disparam o agendamento). A funcao no banco e segura
  // mesmo se nao houver nada pendente: o worker cancela o job se a ultima
  // mensagem ja for nossa.
  try {
    await supabase.rpc('schedule_ai_autonomous_reply_job', {
      p_chat_id: chatRoute.chatId,
      p_delay_seconds: 30,
    });
  } catch {
    // Best-effort: a proxima mensagem inbound do lead ainda vai disparar normalmente.
  }
}

async function sendAutoContactMessage({
  supabase,
  lead,
  contentType,
  content,
}: {
  supabase: ReturnType<typeof createClient>;
  lead: any;
  contentType: FlowMessageType;
  content: string | { url: string; caption?: string; filename?: string };
}): Promise<void> {
  const whapiPhone = toWhapiPhoneNumber(lead?.telefone || '');
  if (!whapiPhone || !isValidWhatsappNumber(lead?.telefone || '')) {
    throw new Error('Telefone inválido para envio automático.');
  }

  const token = getWhapiToken();
  if (!token) {
    throw new Error('WHAPI_TOKEN não configurado para envio automático.');
  }

  const whatsappCheck = await checkWhatsAppExistence(lead?.telefone);
  if (!whatsappCheck.exists) {
    throw new Error('Numero nao possui WhatsApp.');
  }

  const channel = await ensurePrimaryChannel(supabase);
  const requestedChatId = whatsappCheck.chatId ?? `${whapiPhone}@s.whatsapp.net`;
  let chatRoute = await resolveCommWhatsAppCanonicalChatRoute(supabase, {
    channelId: channel.id,
    externalChatId: requestedChatId,
  });
  const requestedPhoneKeys = new Set(getCommWhatsAppPhoneLookupKeys(whapiPhone));
  if (chatRoute.identityConflict) {
    throw new Error('Identidade WhatsApp exige revisao manual antes de envios automaticos.');
  }
  if (lead?.id !== 'flow-test' && chatRoute.leadId && lead?.id && chatRoute.leadId !== lead.id) {
    throw new Error('A identidade WhatsApp esta vinculada a outro lead.');
  }
  if (
    chatRoute.phoneNumber
    && !getCommWhatsAppPhoneLookupKeys(chatRoute.phoneNumber).some((key) => requestedPhoneKeys.has(key))
  ) {
    throw new Error('A identidade WhatsApp resolvida pertence a outro telefone.');
  }

  let chatId = chatRoute.externalChatId;
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

  const dispatchRoute = chatRoute.chatId
    ? await resolveCommWhatsAppCanonicalChatRouteByUuid(supabase, chatRoute.chatId)
    : await resolveCommWhatsAppCanonicalChatRoute(supabase, {
        channelId: channel.id,
        externalChatId: chatId,
      });
  if (!dispatchRoute || dispatchRoute.identityConflict) {
    throw new Error('Identidade WhatsApp mudou antes do envio automatico e exige revisao manual.');
  }
  if (lead?.id !== 'flow-test' && dispatchRoute.leadId && lead?.id && dispatchRoute.leadId !== lead.id) {
    throw new Error('A identidade WhatsApp esta vinculada a outro lead.');
  }
  if (
    dispatchRoute.phoneNumber
    && !getCommWhatsAppPhoneLookupKeys(dispatchRoute.phoneNumber).some((key) => requestedPhoneKeys.has(key))
  ) {
    throw new Error('A identidade WhatsApp resolvida pertence a outro telefone.');
  }
  chatRoute = dispatchRoute;
  chatId = dispatchRoute.externalChatId;
  body.to = chatId;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), WHAPI_REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${WHAPI_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new TemporaryWhapiError('Timeout ao enviar mensagem na Whapi.');
    }
    throw new TemporaryWhapiError('Falha de conexao ao enviar mensagem na Whapi.');
  } finally {
    clearTimeout(timeoutId);
  }

  const responsePayload = await readResponsePayload(response);

  if (!response.ok) {
    const errorText = parseWhapiError(responsePayload);
    if (isRetryableWhapiStatus(response.status)) {
      throw new TemporaryWhapiError(
        `Whapi temporariamente indisponivel ao enviar mensagem (${response.status}): ${errorText || 'sem detalhes'}`,
      );
    }
    throw new Error(errorText || 'Falha ao enviar mensagem automatica');
  }

  if (responsePayload && typeof responsePayload === 'object' && !Array.isArray(responsePayload)) {
    const sent = (responsePayload as Record<string, unknown>).sent;
    if (sent === false) {
      throw new Error('Whapi nao confirmou o envio da mensagem (sent=false).');
    }
  }

  const externalMessageId = extractWhapiMessageId(responsePayload);
  if (!externalMessageId) {
    log('Mensagem automatica enviada sem identificador da Whapi; aguardando webhook para persistencia.', {
      leadId: lead?.id,
      chatId,
    });
    return;
  }

  try {
    const nowIso = new Date().toISOString();
    const media = contentType === 'text' ? null : content as { url: string; caption?: string; filename?: string };
    const textContent = contentType === 'text' ? content as string : media?.caption ?? null;

    await persistCommWhatsAppMessage(supabase, {
      channelId: channel.id,
      externalChatId: chatId,
      phoneNumber: chatRoute.phoneNumber || whapiPhone,
      displayName: chatRoute.displayName || lead?.nome_completo || formatPhoneLabel(whapiPhone),
      pushName: chatRoute.pushName,
      lastMessageText: textContent,
      lastMessageDirection: 'outbound',
      lastMessageAt: nowIso,
      incrementUnread: false,
      externalMessageId,
      direction: 'outbound',
      messageType: contentType,
      deliveryStatus: resolveWhapiOutboundDeliveryStatus(responsePayload, externalMessageId),
      textContent,
      createdBy: null,
      source: 'auto_contact',
      senderName: null,
      senderPhone: channel.phone_number,
      statusUpdatedAt: nowIso,
      errorMessage: null,
      mediaId: null,
      mediaUrl: media?.url ?? null,
      mediaMimeType: null,
      mediaFileName: media?.filename ?? null,
      mediaSizeBytes: null,
      mediaDurationSeconds: null,
      mediaCaption: media?.caption ?? null,
      metadata: { provider: 'whapi', automation: 'auto_contact', lead_id: lead?.id ?? null },
    });
  } catch (error) {
    // The message was accepted by Whapi; avoid retrying it solely because local history failed.
    log('Mensagem automatica enviada, mas nao foi possivel persisti-la no Inbox.', {
      leadId: lead?.id,
      chatId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

const buildCustomMessagePayload = (
  customMessage: AutoContactFlowCustomMessage | undefined,
  lead: any,
  timeZone?: string,
): { contentType: FlowMessageType; content: string | { url: string; caption?: string; filename?: string } } | null => {
  if (!customMessage) return null;
  if (customMessage.type === 'text') {
    const message = applyTemplateVariables(customMessage.text ?? '', lead, timeZone).trim();
    if (!message) return null;
    return { contentType: 'text', content: message };
  }

  if (!customMessage.mediaUrl?.trim()) return null;
  return {
    contentType: customMessage.type,
    content: {
      url: customMessage.mediaUrl,
      caption: customMessage.caption ? applyTemplateVariables(customMessage.caption, lead, timeZone) : undefined,
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

  const whapiPhone = toWhapiPhoneNumber(lead?.telefone || '');
  if (!whapiPhone || !isValidWhatsappNumber(lead?.telefone || '')) {
    logWithContext('Lead sem telefone válido para automação', { leadId: lead?.id });
    return;
  }

  const message = applyTemplateVariables(firstStep.message, lead, settings.scheduling?.timezone);

  try {
    await sendAutoContactMessage({
      supabase,
      lead,
      contentType: 'text',
      content: message,
    });

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
    if ((lead as Record<string, unknown> | null)?.skip_automation === true) {
      logWithContext('Fluxo automático interrompido por skip_automation', { leadId: lead?.id });
      return;
    }

    const settings = providedSettings ?? await loadAutoContactFlowSettings(supabase);
    if (!settings || !settings.enabled) {
      logWithContext('Fluxo automático desativado ou não configurado');
      return;
    }

    if (!settings.autoSend) {
      logWithContext('Fluxo automático configurado, mas envio automático está desativado');
      return;
    }

    if (!getWhapiToken()) {
      logWithContext('Fluxo automático de WhatsApp desativado: WHAPI_TOKEN não configurado');
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

    if (settings.flows.some(usesWhatsappValidCondition)) {
      leadWithRelations.whatsapp_valid = await resolveWhatsappValid(leadWithRelations);
    }

    const matchingFlow =
      settings.flows.find(
        (flow) => flow.ativo !== false && matchesAutoContactFlow(flow, leadWithRelations, event),
      ) ?? null;
    if (!matchingFlow) {
      logWithContext('Nenhum fluxo automático corresponde ao lead recém-criado', { leadId: lead.id });
      return;
    }

    logWithContext('Fluxo automático selecionado', {
      leadId: lead.id,
      flowId: matchingFlow.id,
      flowName: matchingFlow.name,
    });

    if (shouldExitFlow(matchingFlow, leadWithRelations, event)) {
      logWithContext('Fluxo automático interrompido por condição de saída', {
        leadId: lead.id,
        flowId: matchingFlow.id,
      });
      return;
    }

    await scheduleFlowJobs({
      supabase,
      leadId: lead.id,
      lead,
      flow: matchingFlow,
      scheduling: settings.scheduling,
      runtimeContext: buildFlowRuntimeContext(matchingFlow, leadWithRelations),
      anchorAt: new Date(lead.created_at || Date.now()),
    });

    await processFlowJobs({
      supabase,
      lookups,
      settings,
      logWithContext,
      leadId: lead.id,
    });

    logWithContext('Etapas do fluxo agendadas', {
      leadId: lead.id,
      flowId: matchingFlow.id,
      totalSteps: matchingFlow.steps.length,
    });
  } catch (error) {
    logWithContext('Erro ao executar fluxo automático', {
      leadId: lead?.id,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
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
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const path = url.pathname;
    const action = url.searchParams.get('action') ?? req.headers.get('x-action');

    logWithContext('Request received', { method: req.method, path, search: url.search || undefined });

    const authorizeDashboard = async (allowedRoles: ReadonlySet<DashboardRole>) =>
      authorizeDashboardUser({
        req,
        supabaseUrl,
        supabaseAnonKey,
        supabase,
        allowedRoles,
      });

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
      const deniedResponse = assertInternalServiceRole(req, supabaseServiceKey);
      if (deniedResponse) {
        logWithContext('Unauthorized auto-contact request', {
          method: req.method,
          path,
          action,
        });
        return deniedResponse;
      }

      const payload = await req.json().catch(() => null);
      const payloadType = typeof payload?.type === 'string' ? payload.type.trim().toLowerCase() : '';
      const record = payload?.record ?? null;
      const oldRecord = payload?.old_record ?? null;
      const hasOldRecord = Boolean(oldRecord && typeof oldRecord === 'object');
      const toComparableValue = (value: unknown): string => {
        if (typeof value === 'string') {
          return value.trim();
        }

        if (value == null) {
          return '';
        }

        return String(value).trim();
      };

      const inferredStatusChange =
        hasOldRecord &&
        (toComparableValue((oldRecord as Record<string, unknown>).status_id) !==
          toComparableValue((record as Record<string, unknown> | null)?.status_id) ||
          toComparableValue((oldRecord as Record<string, unknown>).status) !==
            toComparableValue((record as Record<string, unknown> | null)?.status));
      const isStatusChange = payload?.is_status_change === true || payloadType === 'status_changed' || inferredStatusChange;
      const event: AutoContactFlowEvent | undefined =
        payloadType === 'insert' || payloadType === 'lead_created' || !hasOldRecord
          ? 'lead_created'
          : isStatusChange
            ? 'status_changed'
            : undefined;

      if (!record || typeof record !== 'object' || !record.id) {
        return new Response(JSON.stringify({ success: false, error: 'Payload inválido para automação' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if ((record as Record<string, unknown>).skip_automation === true) {
        logWithContext('Lead com skip_automation ativo ignorado no auto-contact', {
          leadId: record.id,
        });

        return new Response(JSON.stringify({ success: true, skipped: true, reason: 'skip_automation' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!event) {
        logWithContext('Ignorando atualização de lead sem evento acionável para automação', {
          leadId: record.id,
          payloadType,
          hasOldRecord,
          isStatusChange,
        });

        return new Response(JSON.stringify({ success: true, skipped: true, reason: 'non_status_update' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const lookups = await getLookups();

      const mapLeadForMatch = (lead: any) => {
        const mapped = mapLeadRelationsForResponse(lead, lookups);
        if (!mapped.status) {
          mapped.status = lookups.statusById.get(lead.status_id) ?? 'Novo';
        }
        mapped.status = mapped.status || 'Novo';
        return mapped;
      };

      const settings = await loadAutoContactFlowSettings(supabase);

      const tryLegacyFallback = async (reason: string) => {
        if (event !== 'lead_created') {
          return false;
        }

        const legacySettings = await loadAutoContactSettings(supabase);
        const hasLegacyFlow = Boolean(
          legacySettings?.enabled
          && legacySettings.messageFlow.some((step) => step.active && step.message.trim()),
        );

        if (!hasLegacyFlow) {
          return false;
        }

        if (!getWhapiToken()) {
          logWithContext('Fallback legado de WhatsApp desativado: WHAPI_TOKEN não configurado', {
            leadId: record.id,
          });
          return false;
        }

        logWithContext('Flow engine indisponível, tentando fallback legado', {
          leadId: record.id,
          reason,
        });

        const mappedRecord = mapLeadForMatch(record);
        await triggerAutoContactForLead({
          supabase,
          lead: mappedRecord,
          lookups,
          logWithContext,
        });

        return true;
      };

      if (!settings || !settings.enabled || !settings.autoSend) {
        return new Response(JSON.stringify({ success: true, skipped: true, reason: 'flow_settings_unavailable' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (settings.flows.length === 0) {
        const fallbackUsed = await tryLegacyFallback('legacy_only_mode');
        return new Response(JSON.stringify({ success: true, skipped: !fallbackUsed, fallback: fallbackUsed ? 'legacy' : null }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!getWhapiToken()) {
        logWithContext('Fluxo automático de WhatsApp desativado: WHAPI_TOKEN não configurado', { leadId: record.id });
        return new Response(JSON.stringify({ success: true, skipped: true, reason: 'whapi_token_missing' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const mappedLead = mapLeadForMatch(record);
      const mappedOldLead = oldRecord && typeof oldRecord === 'object' ? mapLeadForMatch(oldRecord) : null;
      if (settings.flows.some(usesWhatsappValidCondition)) {
        mappedLead.whatsapp_valid = await resolveWhatsappValid(mappedLead);
        if (mappedOldLead) {
          mappedOldLead.whatsapp_valid = await resolveWhatsappValid(mappedOldLead);
        }
      }

      let eventForExecution = event;
      let isForcedNovoReentry = false;
      let newMatchingFlow = settings.flows.find((flow) => matchesAutoContactFlow(flow, mappedLead, eventForExecution)) ?? null;

      if (!newMatchingFlow && event === 'status_changed' && mappedOldLead) {
        const novoNormalized = normalizeText('Novo');
        const currentStatusNormalized = normalizeText(mappedLead.status ?? '');
        const previousStatusNormalized = normalizeText(mappedOldLead.status ?? '');

        if (currentStatusNormalized === novoNormalized && previousStatusNormalized !== novoNormalized) {
          const reentryFlow =
            settings.flows.find((flow) => matchesAutoContactFlow(flow, mappedLead, 'lead_created')) ?? null;

          if (reentryFlow) {
            newMatchingFlow = reentryFlow;
            eventForExecution = 'lead_created';
            isForcedNovoReentry = true;
            logWithContext('Reentrada automática ao retornar para status Novo', {
              leadId: record.id,
              flowId: reentryFlow.id,
              flowName: reentryFlow.name,
            });
          }
        }
      }

      if (!newMatchingFlow) {
        // 'activate_autonomous_service' e sempre a ULTIMA etapa de um fluxo,
        // pensada pra rodar logo depois de uma etapa 'update_status' do
        // MESMO fluxo — e normal, portanto, o lead deixar de bater com o
        // gatilho original (ex: "Lead criado" com status Novo) exatamente
        // por causa dessa mudanca de status que o proprio fluxo fez. Sem
        // essa excecao, a etapa de ativar a IA seria sempre cancelada antes
        // de rodar. Outras etapas pendentes continuam sendo canceladas
        // normalmente quando o lead sai das condicoes do fluxo.
        await supabase
          .from('auto_contact_flow_jobs')
          .update({ status: 'skipped', last_error: 'Lead não atende mais as condições do fluxo' })
          .eq('lead_id', record.id)
          .eq('status', 'pending')
          .neq('action_type', 'activate_autonomous_service');

        return new Response(JSON.stringify({ success: true, skipped: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (mappedOldLead) {
        const oldMatchingFlow =
          settings.flows.find((flow) => matchesAutoContactFlow(flow, mappedOldLead, eventForExecution)) ?? null;

        if (oldMatchingFlow?.id === newMatchingFlow.id) {
          const { data: activeJobs } = await supabase
            .from('auto_contact_flow_jobs')
            .select('id')
            .eq('lead_id', record.id)
            .eq('flow_id', newMatchingFlow.id)
            .in('status', ['pending', 'processing'])
            .limit(1);

          if (activeJobs && activeJobs.length > 0) {
            await processFlowJobs({
              supabase,
              lookups,
              settings,
              logWithContext,
              leadId: record.id,
            });

            return new Response(JSON.stringify({ success: true, recovered: true, source: 'active_jobs' }), {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }

          if (!isForcedNovoReentry) {
            const { data: completedJobs } = await supabase
              .from('auto_contact_flow_jobs')
              .select('id')
              .eq('lead_id', record.id)
              .eq('flow_id', newMatchingFlow.id)
              .eq('status', 'completed')
              .limit(1);

            if (completedJobs && completedJobs.length > 0) {
              return new Response(JSON.stringify({ success: true, skipped: true, reason: 'already_completed' }), {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              });
            }
          }

          await runAutoContactFlowEngine({
            supabase,
            lead: record,
            lookups,
            logWithContext,
            settings,
            event: eventForExecution,
          });

          return new Response(JSON.stringify({ success: true, recovered: true, source: 'rescheduled' }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      await cancelFlowJobs({
        supabase,
        leadId: record.id,
        reason: 'Fluxo atualizado, removendo jobs pendentes anteriores',
      });

      try {
        await runAutoContactFlowEngine({
          supabase,
          lead: record,
          lookups,
          logWithContext,
          settings,
          event: eventForExecution,
        });
      } catch (automationError) {
        logWithContext('Erro ao executar automação automática via trigger', {
          leadId: record.id,
          error: automationError instanceof Error ? automationError.message : String(automationError),
        });

        return new Response(JSON.stringify({ success: false, error: 'Erro ao executar automação automática.' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'process-flow-jobs' && req.method === 'POST') {
      const deniedResponse = assertInternalServiceRole(req, supabaseServiceKey);
      if (deniedResponse) {
        logWithContext('Unauthorized process-flow-jobs request', {
          method: req.method,
          path,
          action,
        });
        return deniedResponse;
      }

      const lookups = await getLookups();
      const settings = await loadAutoContactFlowSettings(supabase);

      if (!settings || !settings.enabled || !settings.autoSend) {
        return new Response(JSON.stringify({ success: true, skipped: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      await processFlowJobs({
        supabase,
        lookups,
        settings,
        logWithContext,
      });

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if ((action === 'check-status-duration' || action === 'check-inactivity-duration') && req.method === 'POST') {
      const deniedResponse = assertInternalServiceRole(req, supabaseServiceKey);
      if (deniedResponse) {
        logWithContext('Unauthorized duration-check request', {
          method: req.method,
          path,
          action,
        });
        return deniedResponse;
      }

      const payload = await req.json().catch(() => null);
      const leadId = payload?.lead_id ?? null;
      const flowId = payload?.flow_id ?? null;
      const inactivityStartedAt =
        typeof payload?.inactivity_started_at === 'string' && !Number.isNaN(new Date(payload.inactivity_started_at).getTime())
          ? payload.inactivity_started_at
          : null;
      const triggerMessageId = typeof payload?.trigger_message_id === 'string'
        ? payload.trigger_message_id
        : null;

      const lookups = await getLookups();
      const settings = await loadAutoContactFlowSettings(supabase);

      if (!settings || !settings.enabled || !settings.autoSend || settings.flows.length === 0) {
        return new Response(JSON.stringify({ success: true, skipped: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      let targetFlow: typeof settings.flows[number] | null = null;
      if (flowId) {
        targetFlow = settings.flows.find(f => f.id === flowId) ?? null;
      }

      const expectedTriggerType = action === 'check-inactivity-duration' ? 'inactivity_duration' : 'status_duration';
      if (!targetFlow || targetFlow.triggerType !== expectedTriggerType) {
        return new Response(JSON.stringify({ success: false, error: `Flow not found or not a ${expectedTriggerType} flow` }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (targetFlow.ativo === false) {
        return new Response(
          JSON.stringify({ success: true, skipped: true, reason: 'flow_disabled' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      if (leadId) {
        const { data: lead } = await supabase
          .from('leads')
          .select('*')
          .eq('id', leadId)
          .single();

        if (!lead) {
          return new Response(JSON.stringify({ success: false, error: 'Lead not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        if (lead.skip_automation === true) {
          return new Response(JSON.stringify({ success: true, skipped: true, reason: 'skip_automation' }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const mappedLead = mapLeadRelationsForResponse(lead, lookups);
        if (!mappedLead.status) {
          mappedLead.status = lookups.statusById.get(lead.status_id) ?? 'Novo';
        }

        const triggerStatuses = targetFlow.triggerStatuses ?? [];
        if (triggerStatuses.length > 0 && !triggerStatuses.includes(mappedLead.status ?? '')) {
          return new Response(JSON.stringify({ success: false, error: 'Lead not in trigger status' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        if (targetFlow.triggerType === 'inactivity_duration') {
          if (triggerStatuses.length === 0) {
            return new Response(JSON.stringify({ success: false, error: 'Inactivity flows require at least one trigger status' }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }

          if (!inactivityStartedAt) {
            return new Response(JSON.stringify({ success: false, error: 'Missing inactivity reference timestamp' }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }

          // Enrollment-based: check that the last visible message is outbound
          // and no inbound has arrived after the trigger message.
          const latestInboundAt = await getLatestChatMessageAt({ supabase, leadId, direction: 'inbound', visibleOnly: true });
          const latestOutboundAt = await getLatestChatMessageAt({ supabase, leadId, direction: 'outbound', visibleOnly: true });

          // If no outbound exists, or inbound is newer than outbound, skip
          if (!latestOutboundAt || (latestInboundAt && isAfter(latestInboundAt, latestOutboundAt))) {
            return new Response(JSON.stringify({ success: true, skipped: true, reason: 'last_message_not_outbound' }), {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }

          // The trigger timestamp must be the last outbound (not an old one)
          // If inactivityStartedAt (from cron) is older than latestOutboundAt,
          // the cron used a stale reference — use the fresher one
          const effectiveTriggerAt = isAfter(latestOutboundAt, inactivityStartedAt)
            ? latestOutboundAt
            : inactivityStartedAt;

          // Dedup: check if an active enrollment already exists for this trigger
          const { data: existingEnrollment } = await supabase
            .from('auto_contact_flow_jobs')
            .select('id')
            .eq('lead_id', leadId)
            .eq('flow_id', targetFlow.id)
            .eq('trigger_message_at', effectiveTriggerAt)
            .in('status', ['pending', 'processing'])
            .limit(1)
            .maybeSingle();
          if (existingEnrollment) {
            return new Response(JSON.stringify({ success: true, skipped: true, reason: 'enrollment_already_exists' }), {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }

          // Also check general active enrollment (any trigger) to prevent duplicates
          const { data: anyActiveJob } = await supabase
            .from('auto_contact_flow_jobs')
            .select('id')
            .eq('lead_id', leadId)
            .eq('flow_id', targetFlow.id)
            .in('status', ['pending', 'processing'])
            .limit(1)
            .maybeSingle();
          if (anyActiveJob) {
            return new Response(JSON.stringify({ success: true, skipped: true, reason: 'active_enrollment_exists' }), {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        }

        if (targetFlow.triggerType === 'status_duration') {
          const { error: execError } = await supabase
            .from('auto_contact_flow_executions')
            .upsert({
              lead_id: leadId,
              flow_id: targetFlow.id,
            }, {
              onConflict: 'lead_id,flow_id',
              ignoreDuplicates: true,
            });

          if (execError) {
            logWithContext('Error recording flow execution', { leadId, flowId: targetFlow.id, error: execError.message });
          }
        }

        const runtimeContext = buildFlowRuntimeContext(targetFlow, mappedLead) ?? {};
        if (inactivityStartedAt) runtimeContext.inactivity_started_at = inactivityStartedAt;

        const anchorAt = inactivityStartedAt
          ? new Date(
              new Date(inactivityStartedAt).getTime() +
                Math.max(1, Number(targetFlow.triggerDurationHours) || 24) * 3600000,
            )
          : new Date();

        // Generate enrollment for inactivity flows
        const enrollmentId = targetFlow.triggerType === 'inactivity_duration'
          ? crypto.randomUUID()
          : undefined;
        const enrollmentTriggerMsgId = targetFlow.triggerType === 'inactivity_duration'
          ? (triggerMessageId ?? undefined)
          : undefined;
        // Use effectiveTriggerAt (not raw inactivityStartedAt) so dedup matches what's stored
        const triggerMessageAt = targetFlow.triggerType === 'inactivity_duration'
          ? effectiveTriggerAt
          : undefined;

        await scheduleFlowJobs({
          supabase,
          leadId,
          lead: mappedLead,
          flow: targetFlow,
          scheduling: settings.scheduling,
          runtimeContext,
          anchorAt,
          enrollmentId,
          triggerMessageId: enrollmentTriggerMsgId,
          triggerMessageAt,
        });

        return new Response(JSON.stringify({ success: true, leadId, flowId: targetFlow.id }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ success: true, message: 'Use lead_id and flow_id in body' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'check-lead-created-backlog' && req.method === 'POST') {
      // Rede de segurança do fluxo de abordagem: reavalia um lead que ficou
      // sem nenhum job de automação porque o disparo síncrono do trigger de
      // INSERT falhou (ver check_lead_created_backlog_triggers no banco).
      const deniedResponse = assertInternalServiceRole(req, supabaseServiceKey);
      if (deniedResponse) {
        logWithContext('Unauthorized check-lead-created-backlog request', {
          method: req.method,
          path,
          action,
        });
        return deniedResponse;
      }

      const payload = await req.json().catch(() => null);
      const leadId = typeof payload?.lead_id === 'string' ? payload.lead_id : null;
      if (!leadId) {
        return jsonResponse({ success: false, error: 'lead_id é obrigatório' }, 400);
      }

      const lookups = await getLookups();
      const settings = await loadAutoContactFlowSettings(supabase);

      if (!settings || !settings.enabled || !settings.autoSend || settings.flows.length === 0) {
        return jsonResponse({ success: true, skipped: true, reason: 'flow_settings_unavailable' }, 200);
      }

      const { data: lead, error: leadError } = await supabase
        .from('leads')
        .select('*')
        .eq('id', leadId)
        .maybeSingle();

      if (leadError || !lead) {
        return jsonResponse({ success: false, error: leadError?.message ?? 'Lead not found' }, 404);
      }

      if (lead.skip_automation === true) {
        return jsonResponse({ success: true, skipped: true, reason: 'skip_automation' }, 200);
      }

      if (String((lead as Record<string, unknown>).canal ?? '') === 'whatsapp_campaign') {
        return jsonResponse({ success: true, skipped: true, reason: 'campaign_lead' }, 200);
      }

      // Defesa extra contra corrida com o trigger de INSERT: se já existe
      // algum job (de qualquer status), este lead não está órfão de verdade.
      const { data: existingJobs } = await supabase
        .from('auto_contact_flow_jobs')
        .select('id')
        .eq('lead_id', leadId)
        .limit(1);

      if (existingJobs && existingJobs.length > 0) {
        return jsonResponse({ success: true, skipped: true, reason: 'already_has_job' }, 200);
      }

      logWithContext('Reprocessando lead sem job de abordagem (rede de segurança)', { leadId });

      try {
        await runAutoContactFlowEngine({
          supabase,
          lead,
          lookups,
          logWithContext,
          settings,
          event: 'lead_created',
        });
      } catch (automationError) {
        logWithContext('Erro ao reprocessar lead órfão do fluxo de abordagem', {
          leadId,
          error: automationError instanceof Error ? automationError.message : String(automationError),
        });

        return jsonResponse({ success: false, error: 'Erro ao reprocessar lead.' }, 500);
      }

      return jsonResponse({ success: true, leadId }, 200);
    }

    if (action === 'test-flow' && req.method === 'POST') {
      const authResult = await authorizeDashboard(ADMIN_ROLE_SET);
      if (!authResult.authorized) {
        return authResult.response;
      }

      const payload = await req.json().catch(() => null);
      const flowId = typeof payload?.flow_id === 'string' ? payload.flow_id.trim() : '';
      const stepId = typeof payload?.step_id === 'string' ? payload.step_id.trim() : '';
      const testPhone = typeof payload?.test_phone === 'string' ? payload.test_phone.trim() : '';
      const testName = typeof payload?.test_name === 'string' ? payload.test_name.trim() : 'Contato de teste';

      if (!flowId || !stepId || !testPhone) {
        return jsonResponse({ success: false, error: 'Informe fluxo, etapa e número de teste.' }, 400);
      }

      if (!getWhapiToken()) {
        return jsonResponse({ success: false, error: 'WHAPI_TOKEN não configurado para envio de teste.' }, 503);
      }

      const settings = await loadAutoContactFlowSettings(supabase);
      const flow = settings?.flows.find((item) => item.id === flowId);
      const step = flow?.steps.find((item) => item.id === stepId);
      if (!flow || !step || step.actionType !== 'send_message') {
        return jsonResponse({ success: false, error: 'Etapa de mensagem não encontrada no fluxo salvo.' }, 404);
      }

      const testLead = {
        id: 'flow-test',
        nome_completo: testName || 'Contato de teste',
        telefone: testPhone,
        status: flow.triggerStatuses?.[0] ?? flow.triggerStatus ?? 'Teste',
      };
      const messagePayload = step.messageSource === 'custom'
        ? buildCustomMessagePayload(step.customMessage, testLead, settings?.scheduling.timezone)
        : (() => {
            const template = settings?.messageTemplates.find((item) => item.id === step.templateId) ?? null;
            const message = getTemplateMessage(template);
            return message.trim()
              ? {
                  contentType: 'text' as const,
                  content: applyTemplateVariables(message, testLead, settings?.scheduling.timezone),
                }
              : null;
          })();

      if (!messagePayload) {
        return jsonResponse({ success: false, error: 'A etapa não possui uma mensagem válida para teste.' }, 400);
      }

      await sendAutoContactMessage({
        supabase,
        lead: testLead,
        contentType: messagePayload.contentType,
        content: messagePayload.content,
      });

      logWithContext('Mensagem de teste de fluxo enviada', { flowId, stepId });
      return jsonResponse({ success: true, message: 'Mensagem de teste enviada.' }, 200);
    }

    if (action === 'manual-automation' && req.method === 'POST') {
      const authResult = await authorizeDashboard(ADMIN_ROLE_SET);
      if (!authResult.authorized) {
        logWithContext('Unauthorized manual-automation request', {
          method: req.method,
          path,
          action,
        });
        return authResult.response;
      }

      const body = await req.json().catch(() => null);

      if (!body || typeof body.chatId !== 'string' || !Array.isArray(body.messages)) {
        return new Response(JSON.stringify({ success: false, error: 'Payload inválido' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const requestedChatId = normalizeWhapiChatId(body.chatId);
      const messages = body.messages
        .filter((msg: unknown) => typeof msg === 'string' && msg.trim())
        .map((msg: string) => msg.trim());

      if (!requestedChatId || messages.length === 0) {
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

      if (!getWhapiToken()) {
        logWithContext('Envio manual de WhatsApp bloqueado: WHAPI_TOKEN não configurado');
        return new Response(JSON.stringify({ success: false, error: 'WHAPI_TOKEN não configurado para envio de mensagens' }), {
          status: 503,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const endpoint = `${settings.baseUrl.replace(/\/+$/, '')}/client/sendMessage/${settings.sessionId}`;

      try {
        const channel = await ensurePrimaryChannel(supabase);
        const chatRoute = await resolveCommWhatsAppCanonicalChatRoute(supabase, {
          channelId: channel.id,
          externalChatId: requestedChatId,
        });
        const chatId = chatRoute.externalChatId;
        await sendWhatsappMessages({ endpoint, chatId, messages });
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
      const authResult = await authorizeDashboard(ADMIN_ROLE_SET);
      if (!authResult.authorized) {
        logWithContext('Unauthorized lead creation request', {
          method: req.method,
          path,
          userRole: null,
        });
        return authResult.response;
      }

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
      const authResult = await authorizeDashboard(READ_ROLE_SET);
      if (!authResult.authorized) {
        logWithContext('Unauthorized lead list request', {
          method: req.method,
          path,
        });
        return authResult.response;
      }

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
      const authResult = await authorizeDashboard(ADMIN_ROLE_SET);
      if (!authResult.authorized) {
        logWithContext('Unauthorized lead update request', {
          method: req.method,
          path,
        });
        return authResult.response;
      }

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
      const authResult = await authorizeDashboard(ADMIN_ROLE_SET);
      if (!authResult.authorized) {
        logWithContext('Unauthorized lead batch request', {
          method: req.method,
          path,
        });
        return authResult.response;
      }

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
