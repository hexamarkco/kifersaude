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

type FallbackConfigOption = {
  label: string;
  value?: string;
  description?: string;
  ordem?: number;
  ativo?: boolean;
  metadata?: Record<string, any> | null;
};

const FALLBACK_TIMESTAMP = new Date(0).toISOString();

const FALLBACK_CONFIG_OPTIONS: Record<ConfigCategory, FallbackConfigOption[]> = {
  lead_tipo_contratacao: [
    { label: 'Pessoa Física', value: 'Pessoa Física' },
    { label: 'MEI', value: 'MEI' },
    { label: 'CNPJ (PME)', value: 'CNPJ (PME)' },
    { label: 'Adesão', value: 'Adesão' },
  ],
  lead_responsavel: [
    { label: 'Luiza', value: 'Luiza' },
    { label: 'Nick', value: 'Nick' },
  ],
  contract_status: [
    { label: 'Rascunho', value: 'Rascunho' },
    { label: 'Em análise', value: 'Em análise' },
    { label: 'Documentos pendentes', value: 'Documentos pendentes' },
    { label: 'Proposta enviada', value: 'Proposta enviada' },
    { label: 'Aguardando assinatura', value: 'Aguardando assinatura' },
    { label: 'Emitido', value: 'Emitido' },
    { label: 'Ativo', value: 'Ativo' },
    { label: 'Suspenso', value: 'Suspenso' },
    { label: 'Cancelado', value: 'Cancelado' },
    { label: 'Encerrado', value: 'Encerrado' },
  ],
  contract_modalidade: [
    { label: 'PF', value: 'PF' },
    { label: 'MEI', value: 'MEI' },
    { label: 'CNPJ (PME)', value: 'CNPJ (PME)' },
    { label: 'Adesão', value: 'Adesão' },
  ],
  contract_abrangencia: [
    { label: 'Nacional', value: 'Nacional' },
    { label: 'Regional', value: 'Regional' },
  ],
  contract_acomodacao: [
    { label: 'Enfermaria', value: 'Enfermaria' },
    { label: 'Apartamento', value: 'Apartamento' },
  ],
  contract_carencia: [
    { label: 'padrão', value: 'padrão' },
    { label: 'reduzida', value: 'reduzida' },
    { label: 'portabilidade', value: 'portabilidade' },
    { label: 'zero', value: 'zero' },
  ],
};

const FALLBACK_ROLE_RULES: RoleAccessRule[] = [
  {
    id: 'fallback-admin-all',
    role: 'admin',
    module: 'all',
    can_view: true,
    can_edit: true,
    created_at: FALLBACK_TIMESTAMP,
    updated_at: FALLBACK_TIMESTAMP,
  },
  {
    id: 'fallback-observer-all',
    role: 'observer',
    module: 'all',
    can_view: true,
    can_edit: false,
    created_at: FALLBACK_TIMESTAMP,
    updated_at: FALLBACK_TIMESTAMP,
  },
];

let configOptionsSupported: boolean | undefined;
let roleAccessRulesSupported: boolean | undefined;
let loggedConfigOptionsWarning = false;
let loggedRoleAccessWarning = false;

const buildFallbackOptions = (category: ConfigCategory): ConfigOption[] =>
  (FALLBACK_CONFIG_OPTIONS[category] || []).map((option, index) => ({
    id: `fallback-${category}-${index}`,
    category,
    label: option.label,
    value: option.value ?? option.label,
    description: option.description ?? null,
    ordem: option.ordem ?? index + 1,
    ativo: option.ativo ?? true,
    metadata: option.metadata ?? null,
    created_at: FALLBACK_TIMESTAMP,
    updated_at: FALLBACK_TIMESTAMP,
  }));

const warnMissingConfigOptionsTable = () => {
  if (!loggedConfigOptionsWarning) {
    console.warn(
      'Tabela "config_options" não encontrada no Supabase. Usando valores padrão locais até que as migrações sejam aplicadas.',
    );
    loggedConfigOptionsWarning = true;
  }
};

const warnMissingRoleAccessTable = () => {
  if (!loggedRoleAccessWarning) {
    console.warn(
      'Tabela "role_access_rules" não encontrada no Supabase. Usando permissões padrão locais até que as migrações sejam aplicadas.',
    );
    loggedRoleAccessWarning = true;
  }
};

const isMissingTableError = (error: any, tableName: string) => {
  if (!error) return false;
  const code = 'code' in error ? error.code : undefined;
  const message = 'message' in error ? error.message : undefined;
  return code === 'PGRST205' || (typeof message === 'string' && message.includes(tableName));
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
      return { data: null, error };
    }
  },

  async updateOperadora(id: string, updates: Partial<Operadora>): Promise<{ error: any }> {
    try {
      const { error } = await supabase
        .from('operadoras')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);

      return { error };
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
      return { data: null, error };
    }
  },

  async updateProdutoPlano(id: string, updates: Partial<ProdutoPlano>): Promise<{ error: any }> {
    try {
      const { error } = await supabase
        .from('produtos_planos')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);

      return { error };
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
    if (configOptionsSupported === false) {
      return buildFallbackOptions(category);
    }

    try {
      const { data, error } = await supabase
        .from('config_options')
        .select('*')
        .eq('category', category)
        .order('ordem', { ascending: true })
        .order('label', { ascending: true });

      if (error) {
        if (isMissingTableError(error, 'config_options')) {
          configOptionsSupported = false;
          warnMissingConfigOptionsTable();
          return buildFallbackOptions(category);
        }
        throw error;
      }

      configOptionsSupported = true;
      return data || buildFallbackOptions(category);
    } catch (error) {
      console.error('Error loading config options:', error);
      return buildFallbackOptions(category);
    }
  },

  async createConfigOption(
    category: ConfigCategory,
    option: { label: string; value?: string; description?: string; ordem?: number; ativo?: boolean; metadata?: Record<string, any> },
  ): Promise<{ data: ConfigOption | null; error: any }> {
    if (configOptionsSupported === false) {
      return {
        data: null,
        error: new Error('Configurações dinâmicas indisponíveis até que a tabela config_options seja criada no Supabase.'),
      };
    }

    try {
      const payload = {
        category,
        label: option.label,
        value: option.value || option.label,
        description: option.description || null,
        ordem: option.ordem ?? 0,
        ativo: option.ativo ?? true,
        metadata: option.metadata || null,
      };

      const { data, error } = await supabase
        .from('config_options')
        .insert([payload])
        .select()
        .single();

      return { data, error };
    } catch (error) {
      console.error('Error creating config option:', error);
      return { data: null, error };
    }
  },

  async updateConfigOption(
    id: string,
    updates: Partial<Pick<ConfigOption, 'label' | 'value' | 'description' | 'ordem' | 'ativo' | 'metadata'>>,
  ): Promise<{ error: any }> {
    if (configOptionsSupported === false) {
      return {
        error: new Error('Configurações dinâmicas indisponíveis até que a tabela config_options seja criada no Supabase.'),
      };
    }

    try {
      const { error } = await supabase
        .from('config_options')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);

      return { error };
    } catch (error) {
      console.error('Error updating config option:', error);
      return { error };
    }
  },

  async deleteConfigOption(id: string): Promise<{ error: any }> {
    if (configOptionsSupported === false) {
      return {
        error: new Error('Configurações dinâmicas indisponíveis até que a tabela config_options seja criada no Supabase.'),
      };
    }

    try {
      const { error } = await supabase
        .from('config_options')
        .delete()
        .eq('id', id);

      return { error };
    } catch (error) {
      console.error('Error deleting config option:', error);
      return { error };
    }
  },

  async getRoleAccessRules(): Promise<RoleAccessRule[]> {
    if (roleAccessRulesSupported === false) {
      return FALLBACK_ROLE_RULES;
    }

    try {
      const { data, error } = await supabase
        .from('role_access_rules')
        .select('*')
        .order('role', { ascending: true })
        .order('module', { ascending: true });

      if (error) {
        if (isMissingTableError(error, 'role_access_rules')) {
          roleAccessRulesSupported = false;
          warnMissingRoleAccessTable();
          return FALLBACK_ROLE_RULES;
        }
        throw error;
      }

      roleAccessRulesSupported = true;
      return data || FALLBACK_ROLE_RULES;
    } catch (error) {
      console.error('Error loading role access rules:', error);
      return FALLBACK_ROLE_RULES;
    }
  },

  async upsertRoleAccessRule(
    role: string,
    module: string,
    updates: Partial<Pick<RoleAccessRule, 'can_view' | 'can_edit'>>,
  ): Promise<{ data: RoleAccessRule | null; error: any }> {
    if (roleAccessRulesSupported === false) {
      return {
        data: null,
        error: new Error('Controle de acesso dinâmico indisponível até que a tabela role_access_rules seja criada no Supabase.'),
      };
    }

    try {
      const { data, error } = await supabase
        .from('role_access_rules')
        .upsert({
          role,
          module,
          ...updates,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'role,module', ignoreDuplicates: false })
        .select()
        .single();

      return { data, error };
    } catch (error) {
      console.error('Error upserting role access rule:', error);
      return { data: null, error };
    }
  },

  async deleteRoleAccessRule(id: string): Promise<{ error: any }> {
    if (roleAccessRulesSupported === false) {
      return {
        error: new Error('Controle de acesso dinâmico indisponível até que a tabela role_access_rules seja criada no Supabase.'),
      };
    }

    try {
      const { error } = await supabase
        .from('role_access_rules')
        .delete()
        .eq('id', id);

      return { error };
    } catch (error) {
      console.error('Error deleting role access rule:', error);
      return { error };
    }
  },
};
