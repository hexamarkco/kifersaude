import assert from 'node:assert/strict';
import { act, useState } from 'react';
import { render } from '@testing-library/react';
import { test, vi } from 'vitest';
import type { UserProfile } from '../../domain/types';

const mocks = vi.hoisted(() => ({
  users: [] as UserProfile[],
  createCalls: [] as unknown[][],
  updateCalls: [] as unknown[][],
}));

vi.mock('../../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-admin' },
    role: 'admin',
    refreshProfile: async () => {},
  }),
}));

vi.mock('../../../../contexts/ConfigContext', () => ({
  useConfig: () => ({
    accessProfiles: [
      { id: 'profile-admin', slug: 'admin', name: 'Administrador', is_admin: true },
      { id: 'profile-observer', slug: 'observer', name: 'Observador', is_admin: false },
    ],
    getRoleModulePermission: () => ({ can_edit: true }),
  }),
}));

vi.mock('../data/usersRepository', () => ({
  listUsers: async () => mocks.users,
  createUser: async (...input: unknown[]) => { mocks.createCalls.push(input); },
  updateUser: async (...input: unknown[]) => { mocks.updateCalls.push(input); },
  deleteUser: async () => {},
}));

vi.mock('../../../../hooks/useConfirmationModal', () => ({
  useConfirmationModal: () => ({ requestConfirmation: async () => false, ConfirmationDialog: null }),
}));

vi.mock('../../../../lib/toast', () => ({
  toast: { error: () => {}, success: () => {} },
}));

import UsersScreen from '../UsersScreen';

function UsersScreenHarness() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  return <>
    <button type="button" onClick={() => setCreateDialogOpen(true)}>Novo usuário</button>
    <UsersScreen createDialogOpen={createDialogOpen} onCreateDialogOpenChange={setCreateDialogOpen} />
  </>;
}

const user = (id: string, username: string, role: string): UserProfile => ({
  id,
  username,
  email: `${username.toLocaleLowerCase('pt-BR').replace(/\s/g, '.')}@exemplo.invalid`,
  role,
  created_at: '2026-10-25T10:00:00.000Z',
});

const reset = () => {
  mocks.users = [
    user('user-admin', 'Ana Demonstração', 'admin'),
    user('user-observer', 'Bruno Exemplo', 'observer'),
  ];
  mocks.createCalls = [];
  mocks.updateCalls = [];
};

const setInputValue = async (input: HTMLInputElement, value: string) => {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
};

test('remove o cabeçalho duplicado e mantém busca e contagem de usuários', async () => {
  reset();
  const view = render(<UsersScreen createDialogOpen={false} onCreateDialogOpenChange={() => {}} />);
  try {
    await act(async () => {});
    assert.equal(view.container.querySelectorAll('h2').length, 0);
    assert.equal(view.container.querySelector('[role="status"]')?.textContent, '2 usuários');

    const search = view.container.querySelector<HTMLInputElement>('input[placeholder="Buscar por usuário, e-mail ou perfil"]');
    assert.ok(search);
    await setInputValue(search, 'bruno');

    assert.match(view.container.textContent ?? '', /@Bruno Exemplo/);
    assert.doesNotMatch(view.container.textContent ?? '', /@Ana Demonstração/);
    assert.equal(view.container.querySelector('[role="status"]')?.textContent, '1 usuário');
  } finally {
    view.unmount();
  }
});

test('distingue uma busca sem resultados de uma lista realmente vazia', async () => {
  reset();
  const view = render(<UsersScreen createDialogOpen={false} onCreateDialogOpenChange={() => {}} />);
  try {
    await act(async () => {});
    const search = view.container.querySelector<HTMLInputElement>('input[placeholder="Buscar por usuário, e-mail ou perfil"]');
    assert.ok(search);
    await setInputValue(search, 'consulta-inexistente');

    assert.match(view.container.textContent ?? '', /Nenhum usuário encontrado para esta busca\./);
    assert.doesNotMatch(view.container.textContent ?? '', /Nenhum usuário cadastrado/);
  } finally {
    view.unmount();
  }
});

test('abrir e cancelar os formulários não cria nem altera usuários', async () => {
  reset();
  const view = render(<UsersScreenHarness />);
  try {
    await act(async () => {});

    const createButton = [...view.container.querySelectorAll('button')].find((button) => button.textContent?.includes('Novo usuário'));
    assert.ok(createButton);
    await act(async () => createButton.click());
    assert.match(document.body.textContent ?? '', /Crie um novo usuário e associe a um perfil dinâmico de acesso\./);
    const createDialog = document.body.querySelector('[role="dialog"]');
    assert.ok(createDialog);
    const cancelCreate = [...createDialog.querySelectorAll('button')].find((button) => button.textContent?.trim() === 'Cancelar');
    assert.ok(cancelCreate);
    await act(async () => cancelCreate.click());
    assert.equal(document.body.querySelector('[role="dialog"]'), null);

    const editButton = [...view.container.querySelectorAll('button')].find((button) => button.getAttribute('aria-label') === 'Editar Ana Demonstração');
    assert.ok(editButton);
    await act(async () => editButton.click());
    assert.match(document.body.textContent ?? '', /Atualize os dados e o perfil de acesso do usuário\./);
    const editDialog = document.body.querySelector('[role="dialog"]');
    assert.ok(editDialog);
    const cancelEdit = [...editDialog.querySelectorAll('button')].find((button) => button.textContent?.trim() === 'Cancelar');
    assert.ok(cancelEdit);
    await act(async () => cancelEdit.click());

    assert.equal(mocks.createCalls.length, 0);
    assert.equal(mocks.updateCalls.length, 0);
  } finally {
    view.unmount();
  }
});
