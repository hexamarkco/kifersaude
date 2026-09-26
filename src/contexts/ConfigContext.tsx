/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  configService,
  type AccessProfile,
  type ConfigCategory,
  type ConfigOption,
  type ProfilePermission,
} from '../features/config';
import type { LeadOrigem, LeadStatusConfig } from '../features/leads';
import { getModuleLookupOrder } from '../lib/accessControl';

export type ConfigCategoryMap = Record<ConfigCategory, ConfigOption[]>;

type ConfigContextType = {
  loading: boolean;
  loadError: boolean;
  retryLoad: () => void;
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
  const [loadError, setLoadError] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const loadRequestIdRef = useRef(0);

  const loadLeadStatuses = async (throwOnError = false, requestId?: number) => {
    const data = await configService.getLeadStatusConfig(throwOnError);
    if (requestId !== undefined && requestId !== loadRequestIdRef.current) return;
    setLeadStatuses(data);
  };

  const loadLeadOrigins = async (throwOnError = false, requestId?: number) => {
    const data = await configService.getLeadOrigens(throwOnError);
    if (requestId !== undefined && requestId !== loadRequestIdRef.current) return;
    setLeadOrigins(data);
  };

  const loadCategory = async (category: ConfigCategory, throwOnError = false, requestId?: number) => {
    const data = await configService.getConfigOptions(category, throwOnError);
    if (requestId !== undefined && requestId !== loadRequestIdRef.current) return;
    setOptions(prev => ({ ...prev, [category]: data }));
  };

  const loadProfilePermissions = async (throwOnError = false, requestId?: number) => {
    const data = await configService.getProfilePermissions(throwOnError);
    if (requestId !== undefined && requestId !== loadRequestIdRef.current) return;
    setProfilePermissions(data);
  };

  const loadAccessProfiles = async (throwOnError = false, requestId?: number) => {
    const data = await configService.getAccessProfiles(throwOnError);
    if (requestId !== undefined && requestId !== loadRequestIdRef.current) return;
    setAccessProfiles(data);
  };

  const retryLoad = useCallback(() => {
    setLoadAttempt((current) => current + 1);
  }, []);

  useEffect(() => {
    let mounted = true;
    const requestId = ++loadRequestIdRef.current;

    const loadAll = async () => {
      setLoading(true);
      setLoadError(false);
      try {
        await Promise.all([
          loadLeadStatuses(true, requestId),
          loadLeadOrigins(true, requestId),
          loadCategory('lead_tipo_contratacao', true, requestId),
          loadCategory('lead_responsavel', true, requestId),
          loadCategory('contract_status', true, requestId),
          loadCategory('contract_modalidade', true, requestId),
          loadCategory('contract_abrangencia', true, requestId),
          loadCategory('contract_acomodacao', true, requestId),
          loadCategory('contract_carencia', true, requestId),
          loadAccessProfiles(true, requestId),
          loadProfilePermissions(true, requestId),
        ]);
      } catch (error) {
        console.error('Erro ao carregar configurações compartilhadas:', error);
        if (mounted && requestId === loadRequestIdRef.current) {
          setLoadError(true);
        }
      } finally {
        if (mounted && requestId === loadRequestIdRef.current) {
          setLoading(false);
        }
      }
    };

    loadAll();

    return () => {
      mounted = false;
      loadRequestIdRef.current += 1;
    };
  }, [loadAttempt]);

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
    loadError,
    retryLoad,
    leadStatuses,
    leadOrigins,
    options,
    accessProfiles,
    profilePermissions,
    refreshLeadStatuses: () => loadLeadStatuses(),
    refreshLeadOrigins: () => loadLeadOrigins(),
    refreshCategory: (category) => loadCategory(category),
    refreshAccessProfiles: () => loadAccessProfiles(),
    refreshProfilePermissions: () => loadProfilePermissions(),
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
