import type {
  WhatsAppCampaignAudienceSource,
  WhatsAppCampaignFlowStep,
  WhatsAppCampaignStatus,
  WhatsAppCampaignTargetStatus,
} from '../types/whatsappCampaigns';

export type CampaignVariableSuggestion = {
  key: string;
  label: string;
  description: string;
};

export type ParsedCampaignCsvRow = {
  rowNumber: number;
  values: Record<string, string>;
};

export type ParsedCampaignCsv = {
  delimiter: ',' | ';';
  headers: string[];
  normalizedHeaders: string[];
  rows: ParsedCampaignCsvRow[];
};

export type ExistingCampaignLeadMatch = {
  id?: string;
  nome_completo?: string | null;
  telefone?: string | null;
  email?: string | null;
  status?: string | null;
  status_id?: string | null;
  origem?: string | null;
  origem_id?: string | null;
  cidade?: string | null;
  responsavel?: string | null;
  responsavel_id?: string | null;
  canal?: string | null;
};

export type CampaignVariableContext = {
  lead?: ExistingCampaignLeadMatch | null;
  payload?: Record<string, unknown> | null;
  now?: Date;
  timeZone?: string;
};

export type CsvAudienceAnalysisItem = {
  rowNumber: number;
  rawPhone: string;
  normalizedPhone: string;
  chatId: string;
  payload: Record<string, string>;
  displayName: string;
  duplicateOfRowNumber: number | null;
  existingLead: ExistingCampaignLeadMatch | null;
  needsLeadCreation: boolean;
  invalidReason: 'missing_phone' | 'duplicate_phone' | 'missing_name' | null;
};

export type CsvAudienceAnalysisSummary = {
  totalRows: number;
  validRows: number;
  missingPhoneRows: number;
  duplicateRows: number;
  missingNameRows: number;
  existingLeadRows: number;
  newLeadRows: number;
};

export type CsvAudienceAnalysis = {
  items: CsvAudienceAnalysisItem[];
  validItems: CsvAudienceAnalysisItem[];
  summary: CsvAudienceAnalysisSummary;
  variableKeys: string[];
};

export const WHATSAPP_CAMPAIGN_PROCESSING_LEASE_MS = 10 * 60 * 1000;
export const CAMPAIGN_TARGET_REQUEUEABLE_STATUSES: WhatsAppCampaignTargetStatus[] = ['failed'];
export const CAMPAIGN_DEFAULT_AUDIENCE_SOURCE: WhatsAppCampaignAudienceSource = 'filters';
export const CAMPAIGN_VARIABLE_TIMEZONE = 'America/Sao_Paulo';

const BASE_CAMPAIGN_VARIABLE_SUGGESTIONS: CampaignVariableSuggestion[] = [
  { key: 'nome', label: 'Nome', description: 'Nome completo do contato ou valor importado no CSV.' },
  { key: 'primeiro_nome', label: 'Primeiro nome', description: 'Primeiro nome derivado do campo nome.' },
  { key: 'telefone', label: 'Telefone', description: 'Telefone usado no envio da campanha.' },
  { key: 'email', label: 'E-mail', description: 'E-mail do lead quando disponivel.' },
  { key: 'status', label: 'Status', description: 'Status atual do lead quando disponivel.' },
  { key: 'origem', label: 'Origem', description: 'Origem atual do lead ou valor importado.' },
  { key: 'cidade', label: 'Cidade', description: 'Cidade atual do lead ou valor importado.' },
  { key: 'responsavel', label: 'Responsavel', description: 'Responsavel atual do lead ou valor importado.' },
  { key: 'saudacao', label: 'Saudacao', description: 'Saudacao atual em minusculo.' },
  { key: 'saudacao_titulo', label: 'Saudacao titulo', description: 'Saudacao atual capitalizada.' },
  { key: 'saudacao_capitalizada', label: 'Saudacao capitalizada', description: 'Alias da saudacao capitalizada.' },
  { key: 'data_hoje', label: 'Data de hoje', description: 'Data atual no fuso configurado.' },
  { key: 'hora_agora', label: 'Hora atual', description: 'Hora atual no fuso configurado.' },
];

const SIMPLE_TOKEN_PATTERN = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

const padNumber = (value: number): string => value.toString().padStart(2, '0');

const titleizeKey = (value: string): string =>
  value
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const buildCsvVariableDescription = (key: string): string => `Valor da coluna importada "${titleizeKey(key)}".`;

const formatRuntimeDate = (date: Date, timeZone: string, options: Intl.DateTimeFormatOptions): string =>
  new Intl.DateTimeFormat('pt-BR', {
    timeZone,
    ...options,
  }).format(date);

const getGreetingForDate = (date: Date, timeZone: string): string => {
  const hour = Number.parseInt(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour: '2-digit',
      hour12: false,
    }).format(date),
    10,
  );

  if (Number.isNaN(hour)) return 'ola';
  if (hour < 12) return 'bom dia';
  if (hour < 18) return 'boa tarde';
  return 'boa noite';
};

const formatGreetingTitle = (value: string): string =>
  value.replace(/\b\p{L}/gu, (letter) => letter.toUpperCase());

const pickBestName = (
  payload: Record<string, string>,
  explicitNameKey?: string | null,
  lead?: ExistingCampaignLeadMatch | null,
): string => {
  const candidates = [
    explicitNameKey ? payload[explicitNameKey] : '',
    payload.nome,
    payload.nome_completo,
    payload.name,
    lead?.nome_completo ?? '',
  ];

  return candidates.find((value) => typeof value === 'string' && value.trim())?.trim() ?? '';
};

const normalizeCell = (value: string | undefined): string => (value ?? '').trim();

const countDelimiterOutsideQuotes = (line: string, delimiter: ',' | ';'): number => {
  let count = 0;
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        index += 1;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }

    if (!inQuotes && char === delimiter) {
      count += 1;
    }
  }

  return count;
};

const ensureUniqueHeaders = (headers: string[]): string[] => {
  const seen = new Map<string, number>();

  return headers.map((header, index) => {
    const base = normalizeCsvHeader(header) || `coluna_${index + 1}`;
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);

    if (count === 0) {
      return base;
    }

    return `${base}_${count + 1}`;
  });
};

export const normalizeCsvHeader = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

export const normalizeCampaignSourcePayload = (value: unknown): Record<string, string> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const normalized: Record<string, string> = {};

  Object.entries(value as Record<string, unknown>).forEach(([key, entryValue]) => {
    const normalizedKey = normalizeCsvHeader(key);
    if (!normalizedKey) {
      return;
    }

    if (entryValue == null) {
      normalized[normalizedKey] = '';
      return;
    }

    normalized[normalizedKey] = String(entryValue).trim();
  });

  return normalized;
};

export const normalizePhoneForCampaign = (value: string | null | undefined): string => {
  const digitsOnly = (value || '').replace(/\D/g, '');
  if (!digitsOnly) return '';

  let normalized = digitsOnly.replace(/^00+/, '');
  if (!normalized) return '';

  if (normalized.startsWith('55')) {
    const localDigits = normalized.slice(2).replace(/^0+/, '');
    if (localDigits.length === 10 || localDigits.length === 11) {
      return `55${localDigits}`;
    }

    return '';
  }

  normalized = normalized.replace(/^0+/, '');
  if (normalized.length === 10 || normalized.length === 11) {
    return `55${normalized}`;
  }

  return '';
};

export const buildChatIdFromPhoneDigits = (digits: string): string => `${digits}@s.whatsapp.net`;

export const parseCampaignCsvText = (input: string): ParsedCampaignCsv => {
  const text = input.replace(/^\uFEFF/, '');
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  const delimiter: ',' | ';' =
    countDelimiterOutsideQuotes(lines[0] ?? '', ';') > countDelimiterOutsideQuotes(lines[0] ?? '', ',') ? ';' : ',';

  const parsedRows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (char === '"') {
      if (inQuotes && text[index + 1] === '"') {
        currentField += '"';
        index += 1;
        continue;
      }

      inQuotes = !inQuotes;
      continue;
    }

    if (!inQuotes && char === delimiter) {
      currentRow.push(currentField);
      currentField = '';
      continue;
    }

    if (!inQuotes && (char === '\n' || char === '\r')) {
      if (char === '\r' && text[index + 1] === '\n') {
        index += 1;
      }

      currentRow.push(currentField);
      currentField = '';

      if (currentRow.some((value) => value.trim())) {
        parsedRows.push(currentRow);
      }

      currentRow = [];
      continue;
    }

    currentField += char;
  }

  currentRow.push(currentField);
  if (currentRow.some((value) => value.trim())) {
    parsedRows.push(currentRow);
  }

  if (parsedRows.length === 0) {
    return {
      delimiter,
      headers: [],
      normalizedHeaders: [],
      rows: [],
    };
  }

  const headers = parsedRows[0].map((header) => normalizeCell(header));
  const normalizedHeaders = ensureUniqueHeaders(headers);

  const rows = parsedRows.slice(1).map((rowValues, rowIndex) => {
    const values: Record<string, string> = {};
    const columnCount = Math.max(normalizedHeaders.length, rowValues.length);

    for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
      const normalizedKey = normalizedHeaders[columnIndex] ?? `coluna_${columnIndex + 1}`;
      values[normalizedKey] = normalizeCell(rowValues[columnIndex]);
    }

    return {
      rowNumber: rowIndex + 2,
      values,
    };
  });

  return {
    delimiter,
    headers,
    normalizedHeaders,
    rows,
  };
};

export const buildCampaignVariableSuggestions = (additionalKeys: string[] = []): CampaignVariableSuggestion[] => {
  const suggestions = new Map<string, CampaignVariableSuggestion>();

  BASE_CAMPAIGN_VARIABLE_SUGGESTIONS.forEach((suggestion) => {
    suggestions.set(suggestion.key, suggestion);
  });

  additionalKeys
    .map((key) => normalizeCsvHeader(key))
    .filter(Boolean)
    .forEach((key) => {
      if (suggestions.has(key)) {
        return;
      }

      suggestions.set(key, {
        key,
        label: titleizeKey(key),
        description: buildCsvVariableDescription(key),
      });
    });

  return Array.from(suggestions.values());
};

export const getAvailableCampaignVariableKeys = (additionalKeys: string[] = []): string[] =>
  buildCampaignVariableSuggestions(additionalKeys).map((suggestion) => suggestion.key);

export const extractCampaignVariableTokens = (value: string): string[] => {
  const tokens = new Set<string>();
  let match: RegExpExecArray | null;

  SIMPLE_TOKEN_PATTERN.lastIndex = 0;
  while ((match = SIMPLE_TOKEN_PATTERN.exec(value)) !== null) {
    tokens.add(String(match[1]).toLowerCase());
  }

  return Array.from(tokens);
};

export const collectUnknownCampaignVariableKeys = (
  values: string[],
  allowedKeys: Iterable<string>,
): string[] => {
  const allowed = new Set(Array.from(allowedKeys, (key) => key.toLowerCase()));
  const unknown = new Set<string>();

  values.forEach((value) => {
    extractCampaignVariableTokens(value).forEach((token) => {
      if (!allowed.has(token)) {
        unknown.add(token);
      }
    });
  });

  return Array.from(unknown).sort((left, right) => left.localeCompare(right, 'pt-BR'));
};

export const collectUnknownCampaignFlowVariableKeys = (
  steps: WhatsAppCampaignFlowStep[],
  allowedKeys: Iterable<string>,
): string[] =>
  collectUnknownCampaignVariableKeys(
    steps.flatMap((step) => [step.text ?? '', step.caption ?? '']),
    allowedKeys,
  );

export const resolveCampaignTemplateText = (
  template: string,
  context: CampaignVariableContext = {},
): string => {
  if (!template) {
    return '';
  }

  const payload = normalizeCampaignSourcePayload(context.payload ?? {});
  const lead = context.lead ?? null;
  const timeZone = context.timeZone || CAMPAIGN_VARIABLE_TIMEZONE;
  const now = context.now ?? new Date();

  const payloadName = pickBestName(payload, null, lead);
  const name = payloadName || lead?.nome_completo?.trim() || '';
  const firstName = name.split(/\s+/).filter(Boolean)[0] || '';
  const greeting = getGreetingForDate(now, timeZone);
  const greetingTitle = formatGreetingTitle(greeting);

  const variables = new Map<string, string>(Object.entries(payload));
  const builtInEntries: Array<[string, string]> = [
    ['nome', name],
    ['primeiro_nome', firstName],
    ['telefone', payload.telefone || normalizePhoneForCampaign(lead?.telefone ?? '')],
    ['email', payload.email || lead?.email?.trim() || ''],
    ['status', payload.status || lead?.status?.trim() || ''],
    ['origem', payload.origem || lead?.origem?.trim() || ''],
    ['cidade', payload.cidade || lead?.cidade?.trim() || ''],
    ['responsavel', payload.responsavel || lead?.responsavel?.trim() || ''],
    ['saudacao', greeting],
    ['saudacao_titulo', greetingTitle],
    ['saudacao_capitalizada', greetingTitle],
    ['data_hoje', formatRuntimeDate(now, timeZone, { day: '2-digit', month: '2-digit', year: 'numeric' })],
    ['hora_agora', formatRuntimeDate(now, timeZone, { hour: '2-digit', minute: '2-digit', hour12: false })],
  ];

  builtInEntries.forEach(([key, value]) => {
    if (!variables.has(key)) {
      variables.set(key, value);
      return;
    }

    if (!variables.get(key)?.trim()) {
      variables.set(key, value);
    }
  });

  return template.replace(SIMPLE_TOKEN_PATTERN, (fullMatch, token) => {
    const normalizedToken = String(token).toLowerCase();
    if (!variables.has(normalizedToken)) {
      return fullMatch;
    }

    return variables.get(normalizedToken) ?? '';
  });
};

export const buildCampaignLeadIndex = (leads: ExistingCampaignLeadMatch[]): Map<string, ExistingCampaignLeadMatch> => {
  const index = new Map<string, ExistingCampaignLeadMatch>();

  leads.forEach((lead) => {
    const normalizedPhone = normalizePhoneForCampaign(lead.telefone ?? '');
    if (!normalizedPhone || index.has(normalizedPhone)) {
      return;
    }

    index.set(normalizedPhone, lead);
  });

  return index;
};

export const analyzeCsvAudience = ({
  rows,
  phoneColumnKey,
  nameColumnKey,
  existingLeads,
}: {
  rows: ParsedCampaignCsvRow[];
  phoneColumnKey: string;
  nameColumnKey?: string | null;
  existingLeads: ExistingCampaignLeadMatch[];
}): CsvAudienceAnalysis => {
  const normalizedPhoneKey = normalizeCsvHeader(phoneColumnKey);
  const normalizedNameKey = nameColumnKey ? normalizeCsvHeader(nameColumnKey) : null;
  const leadIndex = buildCampaignLeadIndex(existingLeads);
  const seenPhoneRows = new Map<string, number>();
  const variableKeys = new Set<string>();

  rows.forEach((row) => {
    Object.keys(row.values).forEach((key) => variableKeys.add(key));
  });

  const items = rows.map<CsvAudienceAnalysisItem>((row) => {
    const payload = normalizeCampaignSourcePayload(row.values);
    const rawPhone = payload[normalizedPhoneKey] ?? '';
    const normalizedPhone = normalizePhoneForCampaign(rawPhone);
    const firstSeenRow = normalizedPhone ? seenPhoneRows.get(normalizedPhone) ?? null : null;
    const existingLead = normalizedPhone ? leadIndex.get(normalizedPhone) ?? null : null;
    const displayName = pickBestName(payload, normalizedNameKey, existingLead);
    const needsLeadCreation = Boolean(normalizedPhone) && !existingLead;
    const duplicateOfRowNumber = normalizedPhone && firstSeenRow && firstSeenRow !== row.rowNumber ? firstSeenRow : null;

    let invalidReason: CsvAudienceAnalysisItem['invalidReason'] = null;
    if (!normalizedPhone) {
      invalidReason = 'missing_phone';
    } else if (duplicateOfRowNumber) {
      invalidReason = 'duplicate_phone';
    } else if (needsLeadCreation && !displayName) {
      invalidReason = 'missing_name';
    }

    if (normalizedPhone && !seenPhoneRows.has(normalizedPhone)) {
      seenPhoneRows.set(normalizedPhone, row.rowNumber);
    }

    return {
      rowNumber: row.rowNumber,
      rawPhone,
      normalizedPhone,
      chatId: normalizedPhone ? buildChatIdFromPhoneDigits(normalizedPhone) : '',
      payload,
      displayName,
      duplicateOfRowNumber,
      existingLead,
      needsLeadCreation,
      invalidReason,
    };
  });

  const summary: CsvAudienceAnalysisSummary = {
    totalRows: items.length,
    validRows: items.filter((item) => item.invalidReason === null).length,
    missingPhoneRows: items.filter((item) => item.invalidReason === 'missing_phone').length,
    duplicateRows: items.filter((item) => item.invalidReason === 'duplicate_phone').length,
    missingNameRows: items.filter((item) => item.invalidReason === 'missing_name').length,
    existingLeadRows: items.filter((item) => item.invalidReason === null && item.existingLead).length,
    newLeadRows: items.filter((item) => item.invalidReason === null && item.needsLeadCreation).length,
  };

  return {
    items,
    validItems: items.filter((item) => item.invalidReason === null),
    summary,
    variableKeys: Array.from(variableKeys).sort((left, right) => left.localeCompare(right, 'pt-BR')),
  };
};

export const splitIntoBatches = <T>(items: T[], batchSize: number): T[][] => {
  if (batchSize <= 0) {
    return [items];
  }

  const batches: T[][] = [];
  for (let index = 0; index < items.length; index += batchSize) {
    batches.push(items.slice(index, index + batchSize));
  }
  return batches;
};

export const getCampaignIdsReadyToAutoStart = (
  campaigns: Array<{ id: string; status: WhatsAppCampaignStatus; scheduled_at: string | null }>,
  now: Date = new Date(),
): string[] =>
  campaigns
    .filter((campaign) => {
      if (campaign.status !== 'draft' || !campaign.scheduled_at) {
        return false;
      }

      const scheduledDate = new Date(campaign.scheduled_at);
      return !Number.isNaN(scheduledDate.getTime()) && scheduledDate.getTime() <= now.getTime();
    })
    .map((campaign) => campaign.id);

export const clampCompletedCampaignStepIndex = (value: unknown, totalSteps: number): number => {
  if (!Number.isFinite(totalSteps) || totalSteps <= 0) {
    return -1;
  }

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return -1;
  }

  const normalized = Math.trunc(value);
  return Math.min(Math.max(normalized, -1), totalSteps - 1);
};

export const isCampaignTargetReadyForProcessing = (
  target: {
    status: WhatsAppCampaignTargetStatus;
    next_step_due_at?: string | null;
    processing_expires_at?: string | null;
    last_attempt_at?: string | null;
  },
  now: Date = new Date(),
  leaseMs: number = WHATSAPP_CAMPAIGN_PROCESSING_LEASE_MS,
): boolean => {
  const nowMs = now.getTime();
  const nextStepDueAtMs = target.next_step_due_at ? new Date(target.next_step_due_at).getTime() : Number.NaN;
  if (!Number.isNaN(nextStepDueAtMs) && nextStepDueAtMs > nowMs) {
    return false;
  }

  if (target.status === 'pending') {
    return true;
  }

  if (target.status !== 'processing') {
    return false;
  }

  const expiresAtMs = target.processing_expires_at ? new Date(target.processing_expires_at).getTime() : Number.NaN;
  if (!Number.isNaN(expiresAtMs)) {
    return expiresAtMs <= nowMs;
  }

  const lastAttemptMs = target.last_attempt_at ? new Date(target.last_attempt_at).getTime() : Number.NaN;
  if (Number.isNaN(lastAttemptMs)) {
    return true;
  }

  return lastAttemptMs + leaseMs <= nowMs;
};

export const canRequeueCampaignTarget = (status: WhatsAppCampaignTargetStatus): boolean =>
  CAMPAIGN_TARGET_REQUEUEABLE_STATUSES.includes(status);

export const normalizeCampaignAudienceSource = (value: unknown): WhatsAppCampaignAudienceSource =>
  value === 'csv' ? 'csv' : CAMPAIGN_DEFAULT_AUDIENCE_SOURCE;

export const formatCsvSummaryLabel = (summary: CsvAudienceAnalysisSummary): string =>
  `${summary.validRows} validos, ${summary.existingLeadRows} existentes, ${summary.newLeadRows} novos, ${summary.duplicateRows} duplicados`;

export const formatDateTimeInputValue = (value: string | null): string => {
  if (!value) {
    return '';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }

  return `${parsed.getFullYear()}-${padNumber(parsed.getMonth() + 1)}-${padNumber(parsed.getDate())}T${padNumber(parsed.getHours())}:${padNumber(parsed.getMinutes())}`;
};
