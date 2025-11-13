import type { PostgrestError } from '@supabase/supabase-js';

import {
  supabase,
  SystemSettings,
  Operadora,
  ProdutoPlano,
  LeadStatusConfig,
  LeadOrigem,
  ConfigOption,
  RoleAccessRule,
} from './supabase';

export type ConfigCategory =
  | 'lead_tipo_contratacao'
  | 'lead_responsavel'
  | 'contract_status'
  | 'contract_modalidade'
  | 'contract_abrangencia'
  | 'contract_acomodacao'
  | 'contract_carencia';

type RoleAccessMetadata = {
  role?: string;
  module?: string;
  can_view?: unknown;
  can_edit?: unknown;
  canView?: unknown;
  canEdit?: unknown;
  [key: string]: unknown;
};

type RoleAccessConfigRow = {
  id?: string;
  category?: string | null;
  value?: string | null;
  label?: string | null;
  ordem?: number | null;
  ativo?: boolean | null;
  active?: boolean | null;
  metadata?: RoleAccessMetadata | null;
  config_key?: string | null;
  config_value?: unknown;
  description?: string | null;
  created_at?: string;
  updated_at?: string;
};

type RawConfigOption = Partial<ConfigOption> & {
  id: string;
  label: string;
  value?: string | null;
  description?: string | null;
  ordem?: number | null;
  ativo?: boolean | null;
  active?: boolean | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string | null;
  updated_at?: string | null;
  category?: string | null;
};

const normalizeConfigOption = (category: ConfigCategory, option: RawConfigOption): ConfigOption => {
  const fallbackValue =
    typeof option.value === 'string' && option.value.length > 0 ? option.value : (option.label ?? '');

  const normalizedLabel =
    typeof option.label === 'string' && option.label.length > 0
      ? option.label
      : typeof fallbackValue === 'string' && fallbackValue.length > 0
        ? fallbackValue
        : '';

  const normalizedOrdem = typeof option.ordem === 'number' && Number.isFinite(option.ordem) ? option.ordem : 0;
  const ativoValue = option?.ativo ?? option?.active;
  const metadata =
    option?.metadata && isRecord(option.metadata) ? (option.metadata as Record<string, any>) : null;

  const createdAt = option?.created_at ?? new Date().toISOString();
  const updatedAt = option?.updated_at ?? createdAt;

  return {
    id: option.id,
    category: option.category ?? category,
    label: normalizedLabel,
    value: typeof fallbackValue === 'string' && fallbackValue.length > 0 ? fallbackValue : normalizedLabel,
    description: option.description ?? null,
    ordem: normalizedOrdem,
    ativo: ativoValue === undefined || ativoValue === null ? true : Boolean(ativoValue),
    metadata,
    created_at: createdAt,
    updated_at: updatedAt,
  };
};

const CONFIG_CATEGORY_TABLE_MAP: Record<ConfigCategory, string> = {
  lead_tipo_contratacao: 'lead_tipos_contratacao',
  lead_responsavel: 'lead_responsaveis',
  contract_status: 'contract_status_config',
  contract_modalidade: 'contract_modalidades',
  contract_abrangencia: 'contract_abrangencias',
  contract_acomodacao: 'contract_acomodacoes',
  contract_carencia: 'contract_carencias',
};

const fetchLegacyConfigOptions = async (category: ConfigCategory): Promise<ConfigOption[]> => {
  try {
    const baseQuery = () =>
      supabase
        .from('system_configurations')
        .select('*')
        .eq('category', category);

    let { data, error } = await baseQuery().order('ordem', { ascending: true }).order('label', { ascending: true });

    if (error && isMissingColumnError(error, 'ordem')) {
      ({ data, error } = await baseQuery().order('label', { ascending: true }));
    }

    if (error && isMissingColumnError(error, 'label')) {
      ({ data, error } = await baseQuery());
    }

    if (error) throw error;
    return (data || []).map(option => normalizeConfigOption(category, option as RawConfigOption));
  } catch (error) {
    console.error('Error loading config options:', error);
    return [];
  }
};

const createLegacyConfigOption = async (
  category: ConfigCategory,
  option: { label: string; value?: string; description?: string; ordem?: number; ativo?: boolean; metadata?: Record<string, any> },
): Promise<{ data: ConfigOption | null; error: any }> => {
  try {
    const basePayload: Record<string, any> = {
      category,
      label: option.label,
      value: option.value || option.label,
      description: option.description || null,
      ordem: option.ordem ?? 0,
      metadata: option.metadata || null,
    };
    const ativoValue = option.ativo ?? true;

    const insert = async (payload: Record<string, any>) =>
      supabase.from('system_configurations').insert([payload]).select().single();

    let payload: Record<string, any> = { ...basePayload, ativo: ativoValue };
    let { data, error } = await insert(payload);
    const triedColumns = new Set<string>();

    while (error) {
      if (isMissingColumnError(error, 'ativo') && !triedColumns.has('ativo')) {
        triedColumns.add('ativo');
        const { ativo, ...rest } = payload;
        payload = { ...rest, active: ativo ?? ativoValue };
      } else if (isMissingColumnError(error, 'active') && !triedColumns.has('active')) {
        triedColumns.add('active');
        const { active: _omitActive, ...rest } = payload;
        payload = rest;
      } else if (isMissingColumnError(error, 'metadata') && !triedColumns.has('metadata')) {
        triedColumns.add('metadata');
        const { metadata: _omitMetadata, ...rest } = payload;
        payload = rest;
      } else if (isMissingColumnError(error, 'description') && !triedColumns.has('description')) {
        triedColumns.add('description');
        const { description: _omitDescription, ...rest } = payload;
        payload = rest;
      } else if (isMissingColumnError(error, 'ordem') && !triedColumns.has('ordem')) {
        triedColumns.add('ordem');
        const { ordem: _omitOrdem, ...rest } = payload;
        payload = rest;
      } else if (isMissingColumnError(error, 'value') && !triedColumns.has('value')) {
        triedColumns.add('value');
        const { value: _omitValue, ...rest } = payload;
        payload = rest;
      } else if (isMissingColumnError(error, 'label') || isMissingColumnError(error, 'category')) {
        break;
      } else {
        break;
      }

      ({ data, error } = await insert(payload));
    }

    if (error) {
      return { data: null, error: toPostgrestError(error) };
    }

    return { data: data ? normalizeConfigOption(category, data as RawConfigOption) : null, error: null };
  } catch (error) {
    console.error('Error creating config option:', error);
    return { data: null, error: toPostgrestError(error) };
  }
};

const updateLegacyConfigOption = async (
  id: string,
  updates: Partial<Pick<ConfigOption, 'label' | 'value' | 'description' | 'ordem' | 'ativo' | 'metadata'>>,
): Promise<{ error: any }> => {
  try {
    const { ativo, ...rest } = updates;
    const timestamp = new Date().toISOString();
    let payload: Record<string, any> = { ...rest, updated_at: timestamp };

    if (ativo !== undefined) {
      payload.ativo = ativo;
    }

    const performUpdate = (data: Record<string, any>) =>
      supabase.from('system_configurations').update(data).eq('id', id);

    let { error } = await performUpdate(payload);
    const triedColumns = new Set<string>();

    while (error) {
      if (ativo !== undefined && isMissingColumnError(error, 'ativo') && !triedColumns.has('ativo')) {
        triedColumns.add('ativo');
        const { ativo: _omitAtivo, ...restPayload } = payload;
        payload = { ...restPayload, active: ativo };
      } else if (ativo !== undefined && isMissingColumnError(error, 'active') && !triedColumns.has('active')) {
        triedColumns.add('active');
        const { active: _omitActive, ...restPayload } = payload;
        payload = restPayload;
      } else if (isMissingColumnError(error, 'metadata') && !triedColumns.has('metadata')) {
        triedColumns.add('metadata');
        const { metadata: _omitMetadata, ...restPayload } = payload;
        payload = restPayload;
      } else if (isMissingColumnError(error, 'description') && !triedColumns.has('description')) {
        triedColumns.add('description');
        const { description: _omitDescription, ...restPayload } = payload;
        payload = restPayload;
      } else if (isMissingColumnError(error, 'ordem') && !triedColumns.has('ordem')) {
        triedColumns.add('ordem');
        const { ordem: _omitOrdem, ...restPayload } = payload;
        payload = restPayload;
      } else if (isMissingColumnError(error, 'value') && !triedColumns.has('value')) {
        triedColumns.add('value');
        const { value: _omitValue, ...restPayload } = payload;
        payload = restPayload;
      } else {
        break;
      }

      ({ error } = await performUpdate(payload));
    }

    return { error: error ? toPostgrestError(error) : null };
  } catch (error) {
    console.error('Error updating config option:', error);
    return { error: toPostgrestError(error) };
  }
};

const deleteLegacyConfigOption = async (id: string): Promise<{ error: any }> => {
  try {
    const { error } = await supabase
      .from('system_configurations')
      .delete()
      .eq('id', id);

    return { error: error ? toPostgrestError(error) : null };
  } catch (error) {
    console.error('Error deleting config option:', error);
    return { error: toPostgrestError(error) };
  }
};

const isMissingColumnError = (error: PostgrestError | null | undefined, column: string) => {
  if (!error) return false;
  const normalizedCode = typeof error.code === 'string' ? error.code.toUpperCase() : '';
  const message = typeof error.message === 'string' ? error.message.toLowerCase() : '';
  const normalizedMessage = message.replace(/"/g, "'");
  const columnLower = column.toLowerCase();
  return (
    (normalizedCode === 'PGRST204' || normalizedCode === '42703') &&
    (normalizedMessage.includes(`'${columnLower}'`) || normalizedMessage.includes(columnLower))
  );
};

const isColumnTypeError = (error: PostgrestError | null | undefined, column: string) => {
  if (!error) return false;
  const normalizedCode = typeof error.code === 'string' ? error.code.toUpperCase() : '';
  if (!['22P02', '42804', '23502', '22007', '42883'].includes(normalizedCode)) {
    return false;
  }

  const message = typeof error.message === 'string' ? error.message.toLowerCase() : '';
  const normalizedMessage = message.replace(/"/g, "'");
  const columnLower = column.toLowerCase();

  return normalizedMessage.includes(`'${columnLower}'`) || normalizedMessage.includes(columnLower);
};

const FALLBACK_ROLE_ACCESS_CATEGORY = 'role_access_rules';

const ensureBoolean = (value: unknown, defaultValue = false) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', 't', '1'].includes(normalized)) return true;
    if (['false', 'f', '0'].includes(normalized)) return false;
  }
  return defaultValue;
};

const isTableMissingError = (error: unknown, table: string) => {
  if (!error || typeof error !== 'object') return false;
  const { code, message, details, hint } = error as PostgrestError;
  const normalizedCode = typeof code === 'string' ? code.toUpperCase() : '';
  const tableLower = table.toLowerCase();
  const normalizedMessage = typeof message === 'string' ? message.toLowerCase() : '';
  const normalizedDetails = typeof details === 'string' ? details.toLowerCase() : '';
  const normalizedHint = typeof hint === 'string' ? hint.toLowerCase() : '';

  if (normalizedCode === 'PGRST302' || normalizedCode === 'PGRST301' || normalizedCode === '42P01') return true;

  return (
    normalizedMessage.includes(`resource ${tableLower}`) ||
    normalizedMessage.includes(`relation "${tableLower}`) ||
    normalizedMessage.includes(`relation '${tableLower}`) ||
    normalizedMessage.includes('does not exist') ||
    normalizedMessage.includes(tableLower) ||
    normalizedDetails.includes(tableLower) ||
    normalizedHint.includes(tableLower)
  );
};

const toPostgrestError = (error: unknown): PostgrestError => {
  if (error && typeof error === 'object' && 'message' in error && 'code' in error) {
    return error as PostgrestError;
  }

  const message = error instanceof Error ? error.message : 'Unknown error';
  return {
    message,
    details: '',
    hint: '',
    code: 'UNKNOWN',
    name: 'Error',
  };
};

const getRoleModuleKey = (role: string, module: string) => `${role}:${module}`;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const extractRoleAccessMetadata = (option: RoleAccessConfigRow): RoleAccessMetadata => {
  const optionMetadata = option?.metadata;
  if (isRecord(optionMetadata)) {
    return optionMetadata as RoleAccessMetadata;
  }

  const configValue = option?.config_value;
  if (isRecord(configValue)) {
    return configValue as RoleAccessMetadata;
  }

  if (typeof option?.description === 'string') {
    try {
      const parsed = JSON.parse(option.description);
      if (isRecord(parsed)) {
        return parsed as RoleAccessMetadata;
      }
    } catch (error) {
      // Ignore JSON parse errors and fall through to empty metadata
    }
  }

  return {};
};

const resolveOptionValueKey = (option: RoleAccessConfigRow, metadata: RoleAccessMetadata): string => {
  if (typeof option?.value === 'string' && option.value.length > 0) {
    return option.value;
  }

  if (typeof option?.config_key === 'string' && option.config_key.length > 0) {
    return option.config_key;
  }

  if (typeof metadata?.value === 'string' && metadata.value.length > 0) {
    return metadata.value;
  }

  const role = typeof metadata?.role === 'string' ? metadata.role : '';
  const module = typeof metadata?.module === 'string' ? metadata.module : '';

  if (role && module) {
    return getRoleModuleKey(role, module);
  }

  return '';
};

const mapFallbackOptionToRoleAccessRule = (option: RoleAccessConfigRow): RoleAccessRule => {
  const metadata = extractRoleAccessMetadata(option);
  const optionValue = resolveOptionValueKey(option, metadata);
  const [valueRole, valueModule] = optionValue.includes(':') ? optionValue.split(':') : ['', ''];
  const role = String(metadata.role ?? valueRole ?? '');
  const module = String(metadata.module ?? valueModule ?? '');
  const canView = ensureBoolean(metadata.can_view ?? metadata.canView, false);
  const canEdit = ensureBoolean(metadata.can_edit ?? metadata.canEdit, false);

  return {
    id: option?.id ?? '',
    role,
    module,
    can_view: canView,
    can_edit: canEdit,
    created_at: option?.created_at ?? new Date().toISOString(),
    updated_at: option?.updated_at ?? new Date().toISOString(),
  };
};

const getFallbackRoleAccessRules = async (): Promise<RoleAccessRule[]> => {
  const { data, error } = await supabase
    .from('system_configurations')
    .select('*')
    .eq('category', FALLBACK_ROLE_ACCESS_CATEGORY)
    .order('ordem', { ascending: true })
    .order('label', { ascending: true });

  if (error) {
    throw error;
  }

  const rows = (data as RoleAccessConfigRow[] | null) ?? [];
  return rows.map(mapFallbackOptionToRoleAccessRule);
};

const findMatchingFallbackRoleAccessRule = (
  rows: RoleAccessConfigRow[],
  role: string,
  module: string,
): RoleAccessConfigRow | undefined => {
  const roleLower = role.toLowerCase();
  const moduleLower = module.toLowerCase();
  const key = getRoleModuleKey(role, module).toLowerCase();

  return rows.find((row) => {
    const metadata = extractRoleAccessMetadata(row);
    const resolvedValue = resolveOptionValueKey(row, metadata).toLowerCase();
    const valueMatch = resolvedValue === key;
    const metadataRole = String(metadata?.role ?? '').toLowerCase();
    const metadataModule = String(metadata?.module ?? '').toLowerCase();
    const label = typeof row.label === 'string' ? row.label.toLowerCase() : '';
    const labelMatch = label === `${roleLower} - ${moduleLower}`;
    const configKey = typeof row.config_key === 'string' ? row.config_key.toLowerCase() : '';

    return (
      valueMatch ||
      (metadataRole === roleLower && metadataModule === moduleLower) ||
      labelMatch ||
      configKey === key
    );
  });
};

const upsertFallbackRoleAccessRule = async (
  role: string,
  module: string,
  updates: Partial<Pick<RoleAccessRule, 'can_view' | 'can_edit'>>,
): Promise<{ data: RoleAccessRule | null; error: PostgrestError | null }> => {
  const key = getRoleModuleKey(role, module);

  const {
    data: existing,
    error: fetchError,
  } = await supabase
    .from('system_configurations')
    .select('*')
    .eq('category', FALLBACK_ROLE_ACCESS_CATEGORY)
    .eq('value', key)
    .maybeSingle();

  let resolvedExisting = existing as RoleAccessConfigRow | null;
  let resolvedError = fetchError;

  if (resolvedError && isMissingColumnError(resolvedError, 'value')) {
    const { data: fallbackRows, error: fallbackError } = await supabase
      .from('system_configurations')
      .select('*')
      .eq('category', FALLBACK_ROLE_ACCESS_CATEGORY);

    if (fallbackError) {
      return { data: null, error: fallbackError };
    }

    const rows = (fallbackRows as RoleAccessConfigRow[] | null) ?? [];
    resolvedExisting = findMatchingFallbackRoleAccessRule(rows, role, module) ?? null;
    resolvedError = null;
  }

  if (resolvedError && resolvedError.code !== 'PGRST116') {
    return { data: null, error: resolvedError };
  }

  const metadataRecord: RoleAccessMetadata = extractRoleAccessMetadata((resolvedExisting ?? {}) as RoleAccessConfigRow);
  const canView = updates.can_view ?? ensureBoolean(metadataRecord.can_view ?? metadataRecord.canView, false);
  const canEdit = updates.can_edit ?? ensureBoolean(metadataRecord.can_edit ?? metadataRecord.canEdit, false);
  const metadata: Record<string, unknown> = {
    ...metadataRecord,
    role,
    module,
    can_view: canView,
    can_edit: canEdit,
  };

  const basePayload: Record<string, unknown> = {
    category: FALLBACK_ROLE_ACCESS_CATEGORY,
    ordem: resolvedExisting?.ordem ?? 0,
  };

  if (!resolvedExisting || 'value' in resolvedExisting) {
    basePayload.value = key;
  }

  if (!resolvedExisting || 'label' in resolvedExisting) {
    basePayload.label = resolvedExisting?.label ?? `${role} - ${module}`;
  }

  if (!resolvedExisting || 'ativo' in resolvedExisting) {
    basePayload.ativo = true;
  } else if (resolvedExisting && 'active' in resolvedExisting) {
    basePayload.active = true;
  }

  if (!resolvedExisting || 'metadata' in resolvedExisting) {
    basePayload.metadata = metadata;
  } else if (resolvedExisting && 'config_value' in resolvedExisting) {
    basePayload.config_value = metadata;
    basePayload.config_key = resolvedExisting.config_key ?? key;
  } else {
    basePayload.metadata = metadata;
  }

  const timestamp = new Date().toISOString();

  if (resolvedExisting && resolvedExisting.id) {
    let updatePayload: Record<string, unknown> = { ...basePayload, updated_at: timestamp };

    const existingId = resolvedExisting.id ?? '';

    const performUpdate = async (payload: Record<string, unknown>) =>
      supabase
        .from('system_configurations')
        .update(payload)
        .eq('id', existingId)
        .select()
        .single();

    let { data, error } = await performUpdate(updatePayload);

    const triedColumns = new Set<string>();

    while (error) {
      if (isMissingColumnError(error, 'ativo') && !triedColumns.has('ativo')) {
        triedColumns.add('ativo');
        const { ativo, ...rest } = updatePayload;
        updatePayload = { ...rest, active: ativo ?? true };
      } else if (isMissingColumnError(error, 'active') && !triedColumns.has('active')) {
        triedColumns.add('active');
        const { active: _omitActive, ...rest } = updatePayload;
        updatePayload = rest;
      } else if (isMissingColumnError(error, 'metadata') && !triedColumns.has('metadata')) {
        triedColumns.add('metadata');
        const { metadata: _omitMetadata, ...rest } = updatePayload;
        updatePayload = {
          ...rest,
          config_value: metadata,
          config_key: resolvedExisting?.config_key ?? key,
        };
      } else if (isMissingColumnError(error, 'value') && !triedColumns.has('value')) {
        triedColumns.add('value');
        const { value: _omitValue, ...rest } = updatePayload;
        updatePayload = {
          ...rest,
          config_key: resolvedExisting?.config_key ?? key,
        };
      } else if (isMissingColumnError(error, 'label') && !triedColumns.has('label')) {
        triedColumns.add('label');
        const { label: _omitLabel, ...rest } = updatePayload;
        updatePayload = rest;
      } else if (isColumnTypeError(error, 'label') && !triedColumns.has('label_type')) {
        triedColumns.add('label_type');
        const { label: _omitLabel, ...rest } = updatePayload;
        updatePayload = rest;
      } else if (isColumnTypeError(error, 'ordem') && !triedColumns.has('ordem')) {
        triedColumns.add('ordem');
        const { ordem: _omitOrdem, ...rest } = updatePayload;
        updatePayload = rest;
      } else if (isMissingColumnError(error, 'config_value') && !triedColumns.has('config_value')) {
        triedColumns.add('config_value');
        const { config_value: _omitConfigValue, ...rest } = updatePayload;
        updatePayload = rest;
      } else if (isMissingColumnError(error, 'config_key') && !triedColumns.has('config_key')) {
        triedColumns.add('config_key');
        const { config_key: _omitConfigKey, ...rest } = updatePayload;
        updatePayload = rest;
      } else {
        break;
      }

      ({ data, error } = await performUpdate(updatePayload));
    }

    if (error) return { data: null, error };
    return { data: mapFallbackOptionToRoleAccessRule(data as RoleAccessConfigRow), error: null };
  }

  let insertPayload: Record<string, unknown> = { ...basePayload, created_at: timestamp, updated_at: timestamp };

  const insert = async (payload: Record<string, unknown>) =>
    supabase.from('system_configurations').insert([payload]).select().single();

  let { data, error } = await insert(insertPayload);
  const triedColumns = new Set<string>();

  while (error) {
    if (isMissingColumnError(error, 'ativo') && !triedColumns.has('ativo')) {
      triedColumns.add('ativo');
      const { ativo, ...rest } = insertPayload;
      insertPayload = { ...rest, active: ativo ?? true };
    } else if (isMissingColumnError(error, 'active') && !triedColumns.has('active')) {
      triedColumns.add('active');
      const { active: _omitActive, ...rest } = insertPayload;
      insertPayload = rest;
    } else if (isMissingColumnError(error, 'metadata') && !triedColumns.has('metadata')) {
      triedColumns.add('metadata');
      const { metadata: _omitMetadata, ...rest } = insertPayload;
      insertPayload = {
        ...rest,
        config_value: metadata,
        config_key: key,
      };
    } else if (isMissingColumnError(error, 'value') && !triedColumns.has('value')) {
      triedColumns.add('value');
      const { value: _omitValue, ...rest } = insertPayload;
      insertPayload = {
        ...rest,
        config_key: key,
      };
    } else if (isMissingColumnError(error, 'label') && !triedColumns.has('label')) {
      triedColumns.add('label');
      const { label: _omitLabel, ...rest } = insertPayload;
      insertPayload = rest;
    } else if (isColumnTypeError(error, 'label') && !triedColumns.has('label_type')) {
      triedColumns.add('label_type');
      const { label: _omitLabel, ...rest } = insertPayload;
      insertPayload = rest;
    } else if (isColumnTypeError(error, 'ordem') && !triedColumns.has('ordem')) {
      triedColumns.add('ordem');
      const { ordem: _omitOrdem, ...rest } = insertPayload;
      insertPayload = rest;
    } else if (isMissingColumnError(error, 'config_value') && !triedColumns.has('config_value')) {
      triedColumns.add('config_value');
      const { config_value: _omitConfigValue, ...rest } = insertPayload;
      insertPayload = rest;
    } else if (isMissingColumnError(error, 'config_key') && !triedColumns.has('config_key')) {
      triedColumns.add('config_key');
      const { config_key: _omitConfigKey, ...rest } = insertPayload;
      insertPayload = rest;
    } else {
      break;
    }

    ({ data, error } = await insert(insertPayload));
  }

  if (error) return { data: null, error };
  return { data: mapFallbackOptionToRoleAccessRule(data as RoleAccessConfigRow), error: null };
};

const deleteFallbackRoleAccessRule = async (id: string): Promise<{ error: PostgrestError | null }> => {
  const { error } = await supabase.from('system_configurations').delete().eq('id', id);
  return { error };
};

export const configService = {
  async getSystemSettings(): Promise<SystemSettings | null> {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error loading system settings:', error);
      return null;
    }
  },

  async updateSystemSettings(settings: Partial<SystemSettings>): Promise<{ error: any }> {
    try {
      const { data: existing } = await supabase
        .from('system_settings')
        .select('id')
        .limit(1)
        .maybeSingle();

      if (!existing) {
        return { error: new Error('System settings not found') };
      }

      const { error } = await supabase
        .from('system_settings')
        .update({ ...settings, updated_at: new Date().toISOString() })
        .eq('id', existing.id);

      return { error };
    } catch (error) {
      console.error('Error updating system settings:', error);
      return { error };
    }
  },

  async getOperadoras(): Promise<Operadora[]> {
    try {
      const { data, error } = await supabase
        .from('operadoras')
        .select('*')
        .order('nome', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error loading operadoras:', error);
      return [];
    }
  },

  async createOperadora(operadora: Omit<Operadora, 'id' | 'created_at' | 'updated_at'>): Promise<{ data: Operadora | null; error: any }> {
    try {
      const { data, error } = await supabase
        .from('operadoras')
        .insert([operadora])
        .select()
        .single();

      return { data, error };
    } catch (error) {
      console.error('Error creating operadora:', error);
      return { data: null, error: toPostgrestError(error) };
    }
  },

  async updateOperadora(id: string, updates: Partial<Operadora>): Promise<{ error: any }> {
    try {
      const { error } = await supabase
        .from('operadoras')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);

      return { error: toPostgrestError(error) };
    } catch (error) {
      console.error('Error updating operadora:', error);
      return { error };
    }
  },

  async deleteOperadora(id: string): Promise<{ error: any }> {
    try {
      const { error } = await supabase
        .from('operadoras')
        .delete()
        .eq('id', id);

      return { error };
    } catch (error) {
      console.error('Error deleting operadora:', error);
      return { error };
    }
  },

  async getProdutosPlanos(): Promise<ProdutoPlano[]> {
    try {
      const { data, error } = await supabase
        .from('produtos_planos')
        .select('*')
        .order('nome', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error loading produtos:', error);
      return [];
    }
  },

  async createProdutoPlano(produto: Omit<ProdutoPlano, 'id' | 'created_at' | 'updated_at'>): Promise<{ data: ProdutoPlano | null; error: any }> {
    try {
      const { data, error } = await supabase
        .from('produtos_planos')
        .insert([produto])
        .select()
        .single();

      return { data, error };
    } catch (error) {
      console.error('Error creating produto:', error);
      return { data: null, error: toPostgrestError(error) };
    }
  },

  async updateProdutoPlano(id: string, updates: Partial<ProdutoPlano>): Promise<{ error: any }> {
    try {
      const { error } = await supabase
        .from('produtos_planos')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);

      return { error: toPostgrestError(error) };
    } catch (error) {
      console.error('Error updating produto:', error);
      return { error };
    }
  },

  async deleteProdutoPlano(id: string): Promise<{ error: any }> {
    try {
      const { error } = await supabase
        .from('produtos_planos')
        .delete()
        .eq('id', id);

      return { error };
    } catch (error) {
      console.error('Error deleting produto:', error);
      return { error };
    }
  },

  async getLeadStatusConfig(): Promise<LeadStatusConfig[]> {
    try {
      const { data, error } = await supabase
        .from('lead_status_config')
        .select('*')
        .order('ordem', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error loading status config:', error);
      return [];
    }
  },

  async createLeadStatus(status: Omit<LeadStatusConfig, 'id' | 'created_at' | 'updated_at'>): Promise<{ data: LeadStatusConfig | null; error: any }> {
    try {
      const { data, error } = await supabase
        .from('lead_status_config')
        .insert([status])
        .select()
        .single();

      return { data, error };
    } catch (error) {
      console.error('Error creating status:', error);
      return { data: null, error };
    }
  },

  async updateLeadStatus(id: string, updates: Partial<LeadStatusConfig>): Promise<{ error: any }> {
    try {
      const { error } = await supabase
        .from('lead_status_config')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);

      return { error };
    } catch (error) {
      console.error('Error updating status:', error);
      return { error };
    }
  },

  async deleteLeadStatus(id: string): Promise<{ error: any }> {
    try {
      const { error } = await supabase
        .from('lead_status_config')
        .delete()
        .eq('id', id);

      return { error };
    } catch (error) {
      console.error('Error deleting status:', error);
      return { error };
    }
  },

  async getLeadOrigens(): Promise<LeadOrigem[]> {
    try {
      const { data, error } = await supabase
        .from('lead_origens')
        .select('*')
        .order('nome', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error loading origens:', error);
      return [];
    }
  },

  async createLeadOrigem(origem: Omit<LeadOrigem, 'id' | 'created_at'>): Promise<{ data: LeadOrigem | null; error: any }> {
    try {
      const { data, error } = await supabase
        .from('lead_origens')
        .insert([origem])
        .select()
        .single();

      return { data, error };
    } catch (error) {
      console.error('Error creating origem:', error);
      return { data: null, error };
    }
  },

  async updateLeadOrigem(id: string, updates: Partial<LeadOrigem>): Promise<{ error: any }> {
    try {
      const { error } = await supabase
        .from('lead_origens')
        .update(updates)
        .eq('id', id);

      return { error };
    } catch (error) {
      console.error('Error updating origem:', error);
      return { error };
    }
  },

  async deleteLeadOrigem(id: string): Promise<{ error: any }> {
    try {
      const { error } = await supabase
        .from('lead_origens')
        .delete()
        .eq('id', id);

      return { error };
    } catch (error) {
      console.error('Error deleting origem:', error);
      return { error };
    }
  },

  async getConfigOptions(category: ConfigCategory): Promise<ConfigOption[]> {
    const table = CONFIG_CATEGORY_TABLE_MAP[category];

    if (table) {
      try {
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .order('ordem', { ascending: true })
          .order('label', { ascending: true });

        if (error) {
          if (isTableMissingError(error, table)) {
            return await fetchLegacyConfigOptions(category);
          }
          throw error;
        }

        return (data || []).map(option => normalizeConfigOption(category, option as RawConfigOption));
      } catch (error) {
        if (isTableMissingError(error, table)) {
          return await fetchLegacyConfigOptions(category);
        }
        console.error('Error loading config options:', error);
        return [];
      }
    }

    return await fetchLegacyConfigOptions(category);
  },

  async createConfigOption(
    category: ConfigCategory,
    option: { label: string; value?: string; description?: string; ordem?: number; ativo?: boolean; metadata?: Record<string, any> },
  ): Promise<{ data: ConfigOption | null; error: any }> {
    const table = CONFIG_CATEGORY_TABLE_MAP[category];

    if (table) {
      try {
        const payload: Record<string, any> = {
          label: option.label,
          value: option.value || option.label,
          description: option.description ?? null,
          ordem: option.ordem ?? 0,
          ativo: option.ativo ?? true,
          metadata: option.metadata ?? null,
        };

        const { data, error } = await supabase.from(table).insert([payload]).select().single();

        if (error) {
          if (isTableMissingError(error, table)) {
            return await createLegacyConfigOption(category, option);
          }
          return { data: null, error: toPostgrestError(error) };
        }

        return { data: data ? normalizeConfigOption(category, data as RawConfigOption) : null, error: null };
      } catch (error) {
        if (isTableMissingError(error, table)) {
          return await createLegacyConfigOption(category, option);
        }
        console.error('Error creating config option:', error);
        return { data: null, error: toPostgrestError(error) };
      }
    }

    return await createLegacyConfigOption(category, option);
  },

  async updateConfigOption(
    category: ConfigCategory,
    id: string,
    updates: Partial<Pick<ConfigOption, 'label' | 'value' | 'description' | 'ordem' | 'ativo' | 'metadata'>>,
  ): Promise<{ error: any }> {
    const table = CONFIG_CATEGORY_TABLE_MAP[category];

    if (table) {
      const payload: Record<string, any> = {};

      if (Object.prototype.hasOwnProperty.call(updates, 'label')) {
        payload.label = updates.label ?? '';
      }
      if (Object.prototype.hasOwnProperty.call(updates, 'value')) {
        payload.value = updates.value ?? '';
      }
      if (Object.prototype.hasOwnProperty.call(updates, 'description')) {
        payload.description = updates.description ?? null;
      }
      if (Object.prototype.hasOwnProperty.call(updates, 'ordem')) {
        payload.ordem = updates.ordem ?? 0;
      }
      if (Object.prototype.hasOwnProperty.call(updates, 'ativo')) {
        payload.ativo = updates.ativo;
      }
      if (Object.prototype.hasOwnProperty.call(updates, 'metadata')) {
        payload.metadata = updates.metadata ?? null;
      }

      if (Object.keys(payload).length === 0) {
        return { error: null };
      }

      payload.updated_at = new Date().toISOString();

      try {
        const { error } = await supabase.from(table).update(payload).eq('id', id);

        if (error) {
          if (isTableMissingError(error, table)) {
            return await updateLegacyConfigOption(id, updates);
          }
          return { error: toPostgrestError(error) };
        }

        return { error: null };
      } catch (error) {
        if (isTableMissingError(error, table)) {
          return await updateLegacyConfigOption(id, updates);
        }
        console.error('Error updating config option:', error);
        return { error: toPostgrestError(error) };
      }
    }

    return await updateLegacyConfigOption(id, updates);
  },

  async deleteConfigOption(category: ConfigCategory, id: string): Promise<{ error: any }> {
    const table = CONFIG_CATEGORY_TABLE_MAP[category];

    if (table) {
      try {
        const { error } = await supabase.from(table).delete().eq('id', id);

        if (error) {
          if (isTableMissingError(error, table)) {
            return await deleteLegacyConfigOption(id);
          }
          return { error: toPostgrestError(error) };
        }

        return { error: null };
      } catch (error) {
        if (isTableMissingError(error, table)) {
          return await deleteLegacyConfigOption(id);
        }
        console.error('Error deleting config option:', error);
        return { error: toPostgrestError(error) };
      }
    }

    return await deleteLegacyConfigOption(id);
  },

  async getRoleAccessRules(): Promise<RoleAccessRule[]> {
    try {
      const { data, error, status } = await supabase
        .from('role_access_rules')
        .select('*')
        .order('role', { ascending: true })
        .order('module', { ascending: true });

      if (error) {
        if (status === 404 || isTableMissingError(error, 'role_access_rules')) {
          return await getFallbackRoleAccessRules();
        }
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Error loading role access rules:', error);

      if (isTableMissingError(error, 'role_access_rules')) {
        try {
          return await getFallbackRoleAccessRules();
        } catch (fallbackError) {
          console.error('Fallback role access rules failed:', fallbackError);
        }
      }

      return [];
    }
  },

  async upsertRoleAccessRule(
    role: string,
    module: string,
    updates: Partial<Pick<RoleAccessRule, 'can_view' | 'can_edit'>>,
  ): Promise<{ data: RoleAccessRule | null; error: PostgrestError | null }> {
    try {
      const { data, error, status } = await supabase
        .from('role_access_rules')
        .upsert(
          {
            role,
            module,
            ...updates,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'role,module', ignoreDuplicates: false },
        )
        .select()
        .single();

      if (error) {
        if (status === 404 || isTableMissingError(error, 'role_access_rules')) {
          return await upsertFallbackRoleAccessRule(role, module, updates);
        }
        return { data: null, error };
      }

      return { data, error: null };
    } catch (error) {
      console.error('Error upserting role access rule:', error);

      if (isTableMissingError(error, 'role_access_rules')) {
        return await upsertFallbackRoleAccessRule(role, module, updates);
      }

      return { data: null, error: toPostgrestError(error) };
    }
  },

  async deleteRoleAccessRule(id: string): Promise<{ error: PostgrestError | null }> {
    try {
      const { error, status } = await supabase
        .from('role_access_rules')
        .delete()
        .eq('id', id);

      if (error) {
        if (status === 404 || isTableMissingError(error, 'role_access_rules')) {
          return await deleteFallbackRoleAccessRule(id);
        }
        return { error };
      }

      return { error: null };
    } catch (error) {
      console.error('Error deleting role access rule:', error);

      if (isTableMissingError(error, 'role_access_rules')) {
        return await deleteFallbackRoleAccessRule(id);
      }

      return { error: toPostgrestError(error) };
    }
  },
};
