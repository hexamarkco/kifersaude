export function useAuth() {
  return {
    role: 'admin', isAdmin: true, isObserver: false, loading: false,
    user: { id: 'operator-demo', email: 'operador@example.invalid' },
    userProfile: { id: 'operator-demo', username: 'Operador Demonstração', full_name: 'Operador Demonstração', role: 'admin' },
    signIn: async () => ({ error: null }), signUp: async () => ({ error: null }),
    signOut: async () => undefined, refreshProfile: async () => undefined,
  };
}
export function useConfig() { return { getRoleModulePermission: () => ({ can_view: true, can_edit: true }) }; }
