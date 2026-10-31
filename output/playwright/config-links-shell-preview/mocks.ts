export function useAuth() {
  return {
    role: 'admin',
    user: { id: 'operator-demo', email: 'operador@example.invalid' },
    userProfile: { id: 'operator-demo', username: 'Operador Demonstração', full_name: 'Operador Demonstração' },
    signOut: async () => undefined,
  };
}

export function useConfig() {
  return {
    loading: false,
    loadError: false,
    retryLoad: () => undefined,
    leadStatuses: [],
    leadOrigins: [],
    options: {
      lead_tipo_contratacao: [],
      lead_responsavel: [],
      contract_status: [],
      contract_modalidade: [],
      contract_abrangencia: [],
      contract_acomodacao: [],
      contract_carencia: [],
    },
    accessProfiles: [],
    profilePermissions: [],
    refreshLeadStatuses: async () => undefined,
    refreshLeadOrigins: async () => undefined,
    refreshCategory: async () => undefined,
    refreshAccessProfiles: async () => undefined,
    refreshProfilePermissions: async () => undefined,
    getRoleModulePermission: () => ({ can_view: true, can_edit: true }),
    getAccessProfile: () => null,
  };
}
