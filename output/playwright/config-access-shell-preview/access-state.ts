import { useSyncExternalStore } from 'react';
import type { AccessProfile, ProfilePermission } from '../../../src/features/config/domain/types';

const stamp = '2026-10-30T12:00:00.000Z';
export const profiles: AccessProfile[] = [
  { id: 'profile-sales', slug: '01-equipe-comercial', name: 'Equipe comercial', description: 'Acompanhamento de leads e contratos em atendimento.', is_system: false, is_admin: false, created_at: stamp, updated_at: stamp },
  { id: 'profile-admin', slug: '99-administrador', name: 'Administrador', description: 'Acesso integral à operação do CRM.', is_system: true, is_admin: true, created_at: stamp, updated_at: stamp },
];
export const permissions: ProfilePermission[] = [
  { id: 'permission-leads', role: '01-equipe-comercial', module: 'leads', can_view: true, can_edit: true, created_at: stamp, updated_at: stamp },
  { id: 'permission-dashboard', role: '01-equipe-comercial', module: 'dashboard', can_view: true, can_edit: false, created_at: stamp, updated_at: stamp },
  { id: 'permission-contracts', role: '01-equipe-comercial', module: 'contracts', can_view: true, can_edit: true, created_at: stamp, updated_at: stamp },
];
let revision = 0;
const listeners = new Set<() => void>();
const notify = () => { revision += 1; listeners.forEach((listener) => listener()); };
const subscribe = (listener: () => void) => { listeners.add(listener); return () => listeners.delete(listener); };
export const useFixtureRevision = () => useSyncExternalStore(subscribe, () => revision, () => revision);
export const refreshFixtures = notify;
