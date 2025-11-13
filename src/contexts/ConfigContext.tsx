import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { configService, ConfigCategory } from '../lib/configService';
import { ConfigOption, LeadOrigem, LeadStatusConfig, ProfilePermission } from '../lib/supabase';

export type ConfigCategoryMap = Record<ConfigCategory, ConfigOption[]>;

type ConfigContextType = {
  loading: boolean;
  leadStatuses: LeadStatusConfig[];
  leadOrigins: LeadOrigem[];
  options: ConfigCategoryMap;
  profilePermissions: ProfilePermission[];
  refreshLeadStatuses: () => Promise<void>;
  refreshLeadOrigins: () => Promise<void>;
  refreshCategory: (category: ConfigCategory) => Promise<void>;
  refreshProfilePermissions: () => Promise<void>;
  getRoleModulePermission: (role: string | null | undefined, module: string) => { can_view: boolean; can_edit: boolean };
};

const DEFAULT_OPTIONS: ConfigCategoryMap = {
  lead_tipo_contratacao: [],
  lead_responsavel: [],
  contract_status: [],
  contract_modalidade: [],
  contract_abrangencia: [],
  contract_acomodacao: [],
  contract_carencia: [],
};

const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

export function ConfigProvider({ children }: { children: React.ReactNode }) {
  const [leadStatuses, setLeadStatuses] = useState<LeadStatusConfig[]>([]);
  const [leadOrigins, setLeadOrigins] = useState<LeadOrigem[]>([]);
  const [options, setOptions] = useState<ConfigCategoryMap>({ ...DEFAULT_OPTIONS });
  const [profilePermissions, setProfilePermissions] = useState<ProfilePermission[]>([]);
  const [loading, setLoading] = useState(true);

  const loadLeadStatuses = async () => {
    const data = await configService.getLeadStatusConfig();
    setLeadStatuses(data);
  };

  const loadLeadOrigins = async () => {
    const data = await configService.getLeadOrigens();
    setLeadOrigins(data);
  };

  const loadCategory = async (category: ConfigCategory) => {
    const data = await configService.getConfigOptions(category);
    setOptions(prev => ({ ...prev, [category]: data }));
  };

  const loadProfilePermissions = async () => {
    const data = await configService.getProfilePermissions();
    setProfilePermissions(data);
  };

  useEffect(() => {
    let mounted = true;

    const loadAll = async () => {
      setLoading(true);
      await Promise.all([
        loadLeadStatuses(),
        loadLeadOrigins(),
        loadCategory('lead_tipo_contratacao'),
        loadCategory('lead_responsavel'),
        loadCategory('contract_status'),
        loadCategory('contract_modalidade'),
        loadCategory('contract_abrangencia'),
        loadCategory('contract_acomodacao'),
        loadCategory('contract_carencia'),
        loadProfilePermissions(),
      ]);
      if (mounted) {
        setLoading(false);
      }
    };

    loadAll();

    return () => {
      mounted = false;
    };
  }, []);

  const getRoleModulePermission = useMemo(() => {
    return (role: string | null | undefined, module: string) => {
      if (!role) {
        return { can_view: false, can_edit: false };
      }

      if (role === 'admin') {
        return { can_view: true, can_edit: true };
      }

      const rule = profilePermissions.find(r => r.role === role && r.module === module);
      if (rule) {
        return { can_view: rule.can_view, can_edit: rule.can_edit };
      }

      return { can_view: false, can_edit: false };
    };
  }, [profilePermissions]);

  const value: ConfigContextType = {
    loading,
    leadStatuses,
    leadOrigins,
    options,
    profilePermissions,
    refreshLeadStatuses: loadLeadStatuses,
    refreshLeadOrigins: loadLeadOrigins,
    refreshCategory: loadCategory,
    refreshProfilePermissions: loadProfilePermissions,
    getRoleModulePermission,
  };

  return <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>;
}

export function useConfig() {
  const context = useContext(ConfigContext);
  if (!context) {
    throw new Error('useConfig must be used within a ConfigProvider');
  }
  return context;
}
