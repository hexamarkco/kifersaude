import assert from 'node:assert/strict';
import { act } from 'react';
import { render } from '@testing-library/react';
import { test, vi } from 'vitest';
import type { AccessProfile, ProfilePermission } from '../../domain/types';
import { ACCESS_MODULES } from '../../../../lib/accessControl';

const mocks = vi.hoisted(() => ({
  profiles: [] as AccessProfile[],
  permissions: [] as ProfilePermission[],
  permissionCalls: [] as unknown[][],
  deletedIds: [] as string[],
  errors: [] as string[],
  successes: [] as string[],
  userCount: 0,
  failPermission: false,
  failProfile: false,
  loadError: false,
}));

vi.mock('../../../../contexts/ConfigContext', () => ({
  useConfig: () => ({
    accessProfiles: mocks.profiles, profilePermissions: mocks.permissions,
    refreshAccessProfiles: async () => {}, refreshProfilePermissions: async () => {},
    loading: false, loadError: mocks.loadError, retryLoad: () => {},
  }),
}));
vi.mock('../../data/configService', () => ({
  configService: {
    createAccessProfile: async (input: Pick<AccessProfile, 'name' | 'slug' | 'is_admin' | 'description'>) => {
      if (mocks.failProfile) return { data: null, error: new Error('Falha simulada') };
      const created = { ...input, id: 'created-profile', is_system: false, created_at: '', updated_at: '' };
      mocks.profiles = [...mocks.profiles, created];
      return { data: created, error: null };
    },
    upsertProfilePermission: async (...args: unknown[]) => {
      mocks.permissionCalls.push(args);
      return { data: mocks.failPermission ? null : { id: 'permission' }, error: mocks.failPermission ? new Error('Falha simulada') : null };
    },
    deleteAccessProfile: async (id: string) => { mocks.deletedIds.push(id); return { error: null }; },
  },
}));
vi.mock('../../users/data/usersRepository', () => ({ countUsersByRole: async () => mocks.userCount }));
vi.mock('../../../../hooks/useConfirmationModal', () => ({
  useConfirmationModal: () => ({ requestConfirmation: async () => true, ConfirmationDialog: null }),
}));
vi.mock('../../../../lib/toast', () => ({
  toast: { error: (message: string) => mocks.errors.push(message), success: (message: string) => mocks.successes.push(message) },
}));

import AccessControlManagerScreen from '../AccessControlManagerScreen';

const profile = (number: number, admin = false): AccessProfile => ({
  id: `profile-${number}`, slug: `perfil-${number}`, name: `Perfil ${String(number).padStart(3, '0')}`,
  description: 'Equipe comercial', is_admin: admin, is_system: admin,
  created_at: '', updated_at: '',
});

const reset = (profiles: AccessProfile[]) => {
  mocks.profiles = profiles;
  mocks.permissions = [];
  mocks.permissionCalls = [];
  mocks.deletedIds = [];
  mocks.errors = [];
  mocks.successes = [];
  mocks.userCount = 0;
  mocks.failPermission = false;
  mocks.failProfile = false;
  mocks.loadError = false;
};

const changeInput = async (input: HTMLInputElement, value: string) => {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
};

const changePermission = async (container: HTMLElement, area: string, value: string) => {
  const trigger = container.querySelector<HTMLButtonElement>(`button[aria-label="Acesso a ${area}"]`);
  const select = trigger?.closest('li')?.querySelector('select');
  assert.ok(select);
  await act(async () => { select.value = value; select.dispatchEvent(new Event('change', { bubbles: true })); });
};

test('mantém uma única lista de permissões com muitos perfis e salva apenas no perfil escolhido', async () => {
  reset(Array.from({ length: 80 }, (_, index) => profile(index + 1)));
  const view = render(<AccessControlManagerScreen />);
  try {
    assert.equal(view.container.querySelectorAll('select').length, ACCESS_MODULES.length);
    assert.equal(view.container.querySelector('table'), null);
    const search = view.container.querySelector<HTMLInputElement>('input[aria-label="Buscar perfil"]');
    assert.ok(search);
    await changeInput(search, 'Perfil 080');
    const choices = view.container.querySelectorAll<HTMLButtonElement>('nav[aria-label="Perfis de acesso"] button');
    assert.equal(choices.length, 1);
    await act(async () => choices[0].click());
    assert.equal(view.container.querySelector('#selected-profile-title')?.textContent, 'Perfil 080');
    await changePermission(view.container, 'Leads', 'edit');
    assert.deepEqual(mocks.permissionCalls, [['perfil-80', 'leads', { can_view: true, can_edit: true }]]);
    assert.equal(mocks.errors.length, 0);
  } finally { view.unmount(); }
});

test('retirar o acesso também retira edição e visualizar mantém o perfil sem edição', async () => {
  reset([profile(1)]);
  mocks.permissions = [{ id: 'p1', role: 'perfil-1', module: 'leads', can_view: true, can_edit: true, created_at: '', updated_at: '' }];
  const view = render(<AccessControlManagerScreen />);
  try {
    await changePermission(view.container, 'Leads', 'none');
    await changePermission(view.container, 'Contratos', 'view');
    assert.deepEqual(mocks.permissionCalls, [
      ['perfil-1', 'leads', { can_view: false, can_edit: false }],
      ['perfil-1', 'contracts', { can_view: true, can_edit: false }],
    ]);
  } finally { view.unmount(); }
});

test('administrador padrão mantém acesso total fixo e não oferece edição ou exclusão do perfil', () => {
  reset([profile(1, true)]);
  const view = render(<AccessControlManagerScreen />);
  try {
    const selects = Array.from(view.container.querySelectorAll('select'));
    assert.equal(selects.length, ACCESS_MODULES.length);
    assert.ok(selects.every((select) => select.disabled && select.value === 'edit'));
    assert.equal(Array.from(view.container.querySelectorAll('button')).some((button) => button.textContent?.includes('Editar perfil') || button.textContent?.trim() === 'Excluir'), false);
  } finally { view.unmount(); }
});

test('falha ao salvar libera os controles e mantém a permissão anterior', async () => {
  reset([profile(1)]);
  mocks.failPermission = true;
  const view = render(<AccessControlManagerScreen />);
  try {
    await changePermission(view.container, 'Leads', 'edit');
    assert.equal(mocks.errors.length, 1);
    assert.equal(mocks.successes.length, 0);
    assert.ok(Array.from(view.container.querySelectorAll('select')).every((select) => !select.disabled));
    const trigger = view.container.querySelector<HTMLButtonElement>('button[aria-label="Acesso a Leads"]');
    assert.ok(trigger?.textContent?.includes('Sem acesso'));
  } finally { view.unmount(); }
});

test('impede excluir perfil vinculado a usuários', async () => {
  reset([profile(1)]);
  mocks.userCount = 2;
  const view = render(<AccessControlManagerScreen />);
  try {
    const remove = Array.from(view.container.querySelectorAll('button')).find((button) => button.textContent?.trim() === 'Excluir');
    assert.ok(remove);
    await act(async () => remove.click());
    assert.deepEqual(mocks.deletedIds, []);
    assert.ok(mocks.errors[0]?.includes('vinculado a usuários'));
  } finally { view.unmount(); }
});

test('falha de carregamento bloqueia alterações e não apresenta ausência de perfis como confirmação', () => {
  reset([]);
  mocks.loadError = true;
  const view = render(<AccessControlManagerScreen />);
  try {
    assert.ok(view.container.textContent?.includes('Não foi possível carregar todos os acessos'));
    assert.equal(view.container.textContent?.includes('Nenhum perfil cadastrado'), false);
    const create = Array.from(view.container.querySelectorAll('button')).find((button) => button.textContent?.includes('Novo perfil'));
    assert.ok(create?.disabled);
  } finally { view.unmount(); }
});

test('cria perfil pelo diálogo e abre suas permissões; uma falha permite tentar novamente', async () => {
  reset([profile(1)]);
  mocks.failProfile = true;
  const view = render(<AccessControlManagerScreen />);
  try {
    const create = Array.from(view.container.querySelectorAll('button')).find((button) => button.textContent?.includes('Novo perfil'));
    assert.ok(create);
    await act(async () => create.click());
    const dialog = document.querySelector('[role="dialog"]');
    const name = dialog?.querySelector<HTMLInputElement>('input[placeholder="Ex.: Equipe comercial"]');
    const form = dialog?.querySelector('form');
    assert.ok(name);
    assert.ok(form);
    await changeInput(name, 'Equipe regional');
    await act(async () => { form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
    assert.equal(mocks.successes.length, 0);
    assert.equal(mocks.errors.length, 1);
    assert.ok(document.querySelector('[role="dialog"]'));
    assert.equal(form.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled, false);
    mocks.failProfile = false;
    await act(async () => { form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
    assert.equal(document.querySelector('[role="dialog"]'), null);
    assert.equal(view.container.querySelector('#selected-profile-title')?.textContent, 'Equipe regional');
    assert.equal(mocks.profiles[mocks.profiles.length - 1]?.slug, 'equipe-regional');
    await changePermission(view.container, 'Leads', 'view');
    assert.deepEqual(mocks.permissionCalls[0], ['equipe-regional', 'leads', { can_view: true, can_edit: false }]);
  } finally { view.unmount(); }
});
