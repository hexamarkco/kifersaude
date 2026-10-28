const profiles = [
  { id: 'profile-admin', slug: 'admin', name: 'Administrador', is_admin: true },
  { id: 'profile-manager', slug: 'gestor', name: 'Gestor comercial', is_admin: false },
  { id: 'profile-observer', slug: 'observer', name: 'Observador', is_admin: false },
];

export const users = [
  { id: 'demo-admin', username: 'Ana Demonstração', email: 'ana.demonstracao@example.invalid', role: 'admin', created_at: '2026-10-25T10:00:00.000Z' },
  { id: 'demo-manager', username: 'Bruno Exemplo', email: 'bruno.exemplo@example.invalid', role: 'gestor', created_at: '2026-10-24T10:00:00.000Z' },
  { id: 'demo-observer', username: 'Carla Teste', email: 'carla.teste@example.invalid', role: 'observer', created_at: '2026-10-23T10:00:00.000Z' },
];

export const useAuth = () => ({
  user: { id: 'demo-admin' },
  role: 'admin',
  isObserver: false,
  refreshProfile: async () => {},
});

export const useConfig = () => ({
  accessProfiles: profiles,
  profilePermissions: [],
  getRoleModulePermission: () => ({ can_view: true, can_edit: true }),
  refreshAccessProfiles: async () => {},
  refreshProfilePermissions: async () => {},
});

export const listUsers = async () => users;
export const createUser = async () => {};
export const updateUser = async () => {};
export const deleteUser = async () => {};
export const countUsersByRole = async () => 0;

export const toast = { success: () => {}, error: () => {} };
