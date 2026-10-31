import { DEFAULT_GENERAL_PREFERENCES } from '../../../src/features/config/general/shared/systemSettingsConfig';
import { refreshFixtures, profiles, permissions } from './access-state';

const stamp = '2026-10-30T12:00:00.000Z';
export const configService = {
  getSystemSettings: async () => ({ id: 'settings-demo', company_name: 'Kifer Saúde', ...DEFAULT_GENERAL_PREFERENCES, created_at: stamp, updated_at: stamp }),
  updateSystemSettings: async () => ({ error: new Error('Escritas bloqueadas nesta prévia sintética.') }),
  createAccessProfile: async (input: { slug: string; name: string; description: string | null; is_admin: boolean }) => {
    const created = { id: `profile-${Date.now()}`, ...input, is_system: false, created_at: stamp, updated_at: stamp };
    profiles.push(created);
    refreshFixtures();
    return { data: created, error: null };
  },
  updateAccessProfile: async (id: string, updates: Partial<(typeof profiles)[number]>) => {
    const index = profiles.findIndex((profile) => profile.id === id);
    if (index < 0) return { data: null, error: new Error('Perfil sintético não encontrado.') };
    profiles[index] = { ...profiles[index], ...updates, updated_at: stamp };
    refreshFixtures();
    return { data: profiles[index], error: null };
  },
  deleteAccessProfile: async (id: string) => {
    const index = profiles.findIndex((profile) => profile.id === id);
    if (index < 0) return { error: new Error('Perfil sintético não encontrado.') };
    profiles.splice(index, 1);
    for (let i = permissions.length - 1; i >= 0; i -= 1) if (permissions[i].role === '01-equipe-comercial') permissions.splice(i, 1);
    refreshFixtures();
    return { error: null };
  },
  upsertProfilePermission: async (role: string, module: string, value: { can_view: boolean; can_edit: boolean }) => {
    const index = permissions.findIndex((permission) => permission.role === role && permission.module === module);
    const permission = { id: `permission-${module}`, role, module, ...value, created_at: stamp, updated_at: stamp };
    if (index < 0) permissions.push(permission);
    else permissions[index] = permission;
    refreshFixtures();
    return { data: permission, error: null };
  },
};
