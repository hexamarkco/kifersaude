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

type RoleAccessMetadata = {
  role?: string;
  module?: string;
  can_view?: unknown;
  can_edit?: unknown;
  canView?: unknown;
  canEdit?: unknown;
  [key: string]: unknown;
};

type RoleAccessConfigRow = Omit<ConfigOption, 'metadata'> & {
  metadata: RoleAccessMetadata | null;
};

const normalizeConfigOption = (option: ConfigOption & { active?: boolean | null }): ConfigOption => {
  const ativoValue = option?.ativo ?? option?.active;
  return {
    ...option,
    ativo: ativoValue === undefined || ativoValue === null ? true : Boolean(ativoValue),
  };
};

const isMissingColumnError = (error: PostgrestError | null | undefined, column: string) => {
  if (!error) return false;
  const message = typeof error.message === 'string' ? error.message.toLowerCase() : '';
  const normalizedMessage = message.replace(/"/g, "'");
  const columnLower = column.toLowerCase();
  return (
    error.code === 'PGRST204' &&
    (normalizedMessage.includes(`'${columnLower}'`) || normalizedMessage.includes(columnLower))
  );
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

const mapFallbackOptionToRoleAccessRule = (option: RoleAccessConfigRow): RoleAccessRule => {
  const metadata = option.metadata ?? {};
  const [valueRole, valueModule] = typeof option.value === 'string' ? option.value.split(':') : ['', ''];
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

const upsertFallbackRoleAccessRule = async (
  role: string,
  module: string,
  updates: Partial<Pick<RoleAccessRule, 'can_view' | 'can_edit'>>,
): Promise<{ data: RoleAccessRule | null; error: PostgrestError | null }> => {
  const key = `${role}:${module}`;

  const { data: existing, error: fetchError } = await supabase
    .from('system_configurations')
    .select('*')
    .eq('category', FALLBACK_ROLE_ACCESS_CATEGORY)
    .eq('value', key)
    .maybeSingle();

  if (fetchError && fetchError.code !== 'PGRST116') {
    return { data: null, error: fetchError };
  }

  const metadataRecord: RoleAccessMetadata = existing?.metadata ?? {};
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
    value: key,
    metadata,
    ativo: true,
    ordem: existing?.ordem ?? 0,
    label: existing?.label ?? `${role} - ${module}`,
  };

  const timestamp = new Date().toISOString();

  if (existing) {
    const { data, error } = await supabase
      .from('system_configurations')
      .update({ ...basePayload, updated_at: timestamp })
      .eq('id', existing.id)
      .select()
      .single();

    if (error) return { data: null, error };
    return { data: mapFallbackOptionToRoleAccessRule(data as RoleAccessConfigRow), error: null };
  }

  const { data, error } = await supabase
    .from('system_configurations')
    .insert([{ ...basePayload, created_at: timestamp, updated_at: timestamp }])
    .select()
    .single();

  if (error) return { data: null, error };
  return { data: mapFallbackOptionToRoleAccessRule(data as RoleAccessConfigRow), error: null };
};

const deleteFallbackRoleAccessRule = async (id: string): Promise<{ error: PostgrestError | null }> => {
  const { error } = await supabase.from('system_configurations').delete().eq('id', id);
  return { error };
};

export type ConfigCategory =
  | 'lead_tipo_contratacao'
  | 'lead_responsavel'
  | 'contract_status'
  | 'contract_modalidade'
  | 'contract_abrangencia'
  | 'contract_acomodacao'
  | 'contract_carencia';

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
    try {
      const { data, error } = await supabase
        .from('system_configurations')
        .select('*')
        .eq('category', category)
        .order('ordem', { ascending: true })
        .order('label', { ascending: true });

      if (error) throw error;
      return (data || []).map(normalizeConfigOption);
    } catch (error) {
      console.error('Error loading config options:', error);
      return [];
    }
  },

  async createConfigOption(
    category: ConfigCategory,
    option: { label: string; value?: string; description?: string; ordem?: number; ativo?: boolean; metadata?: Record<string, any> },
  ): Promise<{ data: ConfigOption | null; error: any }> {
    try {
      const basePayload = {
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

      let { data, error } = await insert({ ...basePayload, ativo: ativoValue });

      if (error && isMissingColumnError(error, 'ativo')) {
        ({ data, error } = await insert({ ...basePayload, active: ativoValue }));
      }

      return { data: data ? normalizeConfigOption(data) : null, error };
    } catch (error) {
      console.error('Error creating config option:', error);
      return { data: null, error };
    }
  },

  async updateConfigOption(
    id: string,
    updates: Partial<Pick<ConfigOption, 'label' | 'value' | 'description' | 'ordem' | 'ativo' | 'metadata'>>,
  ): Promise<{ error: any }> {
    try {
      const { ativo, ...rest } = updates;
      const timestamp = new Date().toISOString();
      const basePayload: Record<string, any> = { ...rest, updated_at: timestamp };

      if (ativo !== undefined) {
        basePayload.ativo = ativo;
      }

      let { error } = await supabase.from('system_configurations').update(basePayload).eq('id', id);

      if (error && ativo !== undefined && isMissingColumnError(error, 'ativo')) {
        const retryPayload: Record<string, any> = { ...rest, updated_at: timestamp, active: ativo };
        ({ error } = await supabase.from('system_configurations').update(retryPayload).eq('id', id));
      }

      return { error };
    } catch (error) {
      console.error('Error updating config option:', error);
      return { error };
    }
  },

  async deleteConfigOption(id: string): Promise<{ error: any }> {
    try {
      const { error } = await supabase
        .from('system_configurations')
        .delete()
        .eq('id', id);

      return { error };
    } catch (error) {
      console.error('Error deleting config option:', error);
      return { error };
    }
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
