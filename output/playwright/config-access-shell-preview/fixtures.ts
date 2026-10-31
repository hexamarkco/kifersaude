import { refreshFixtures, useFixtureRevision, profiles, permissions } from './access-state';

export function useAuth() {
  return {
    role: 'admin',
    user: { id: 'operator-demo', email: 'operador@example.invalid' },
    userProfile: { id: 'operator-demo', username: 'Operador Demonstração', full_name: 'Operador Demonstração' },
    signOut: async () => undefined,
  };
}

export function useConfig() {
  useFixtureRevision();
  return {
    loading: false,
    loadError: false,
    retryLoad: () => undefined,
    leadStatuses: [],
    leadOrigins: [],
    options: { lead_tipo_contratacao: [], lead_responsavel: [], contract_status: [], contract_modalidade: [], contract_abrangencia: [], contract_acomodacao: [], contract_carencia: [] },
    accessProfiles: [...profiles],
    profilePermissions: [...permissions],
    refreshLeadStatuses: async () => undefined,
    refreshLeadOrigins: async () => undefined,
    refreshCategory: async () => undefined,
    refreshAccessProfiles: async () => refreshFixtures(),
    refreshProfilePermissions: async () => refreshFixtures(),
    getRoleModulePermission: () => ({ can_view: true, can_edit: true }),
    getAccessProfile: () => null,
  };
}
