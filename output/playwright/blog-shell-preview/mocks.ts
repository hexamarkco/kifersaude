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
    getRoleModulePermission: () => ({ can_view: true, can_edit: true }),
  };
}
