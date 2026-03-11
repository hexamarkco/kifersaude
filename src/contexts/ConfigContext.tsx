/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { configService, ConfigCategory } from '../lib/configService';
import { AccessProfile, ConfigOption, LeadOrigem, LeadStatusConfig, ProfilePermission } from '../lib/supabase';
import { getModuleLookupOrder } from '../lib/accessControl';

export type ConfigCategoryMap = Record<ConfigCategory, ConfigOption[]>;

type ConfigContextType = {
  loading: boolean;
  leadStatuses: LeadStatusConfig[];
  leadOrigins: LeadOrigem[];
  options: ConfigCategoryMap;
  accessProfiles: AccessProfile[];
  profilePermissions: ProfilePermission[];
  refreshLeadStatuses: () => Promise<void>;
  refreshLeadOrigins: () => Promise<void>;
  refreshCategory: (category: ConfigCategory) => Promise<void>;
  refreshAccessProfiles: () => Promise<void>;
  refreshProfilePermissions: () => Promise<void>;
  getRoleModulePermission: (role: string | null | undefined, module: string) => { can_view: boolean; can_edit: boolean };
  getAccessProfile: (role: string | null | undefined) => AccessProfile | null;
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
  const [accessProfiles, setAccessProfiles] = useState<AccessProfile[]>([]);
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

  const loadAccessProfiles = async () => {
    const data = await configService.getAccessProfiles();
    setAccessProfiles(data);
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
        loadAccessProfiles(),
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

  const getAccessProfile = useMemo(() => {
    return (role: string | null | undefined) => {
      if (!role) {
        return null;
      }

      return accessProfiles.find((profile) => profile.slug === role) ?? null;
    };
  }, [accessProfiles]);

  const getRoleModulePermission = useMemo(() => {
    return (role: string | null | undefined, module: string) => {
      if (!role) {
        return { can_view: false, can_edit: false };
      }

      const accessProfile = accessProfiles.find((profile) => profile.slug === role);

      if (role === 'admin' || accessProfile?.is_admin) {
        return { can_view: true, can_edit: true };
      }

      const lookupModules = getModuleLookupOrder(module);

      for (const lookupModule of lookupModules) {
        const rule = profilePermissions.find((item) => item.role === role && item.module === lookupModule);
        if (rule) {
          return { can_view: rule.can_view, can_edit: rule.can_edit };
        }
      }

      return { can_view: false, can_edit: false };
    };
  }, [accessProfiles, profilePermissions]);

  const value: ConfigContextType = {
    loading,
    leadStatuses,
    leadOrigins,
    options,
    accessProfiles,
    profilePermissions,
    refreshLeadStatuses: loadLeadStatuses,
    refreshLeadOrigins: loadLeadOrigins,
    refreshCategory: loadCategory,
    refreshAccessProfiles: loadAccessProfiles,
    refreshProfilePermissions: loadProfilePermissions,
    getRoleModulePermission,
    getAccessProfile,
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
