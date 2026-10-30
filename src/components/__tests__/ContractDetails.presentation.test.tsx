import assert from 'node:assert/strict';
import { act } from 'react';
import { test, vi } from 'vitest';
import { render } from '../../testing-library/react';

const mocks = vi.hoisted(() => ({
  loadSnapshot: vi.fn(),
}));

vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ role: 'admin' }) }));
vi.mock('../../contexts/ConfigContext', () => ({ useConfig: () => ({ getRoleModulePermission: () => ({ can_edit: true }) }) }));
vi.mock('../../features/contracts', async () => {
  const actual = await (vi as typeof vi & { importActual: <T>(path: string) => Promise<T> }).importActual<typeof import('../../features/contracts')>('../../features/contracts');
  return { ...actual, getContractDetailsSnapshot: mocks.loadSnapshot };
});

import ContractDetails from '../ContractDetails';

const contract = {
  id: 'contract-demo',
  codigo_contrato: '413780',
  status: 'Ativo',
  modalidade: 'PME',
  operadora: 'Assim Saúde',
  produto_plano: 'Clássico',
  responsavel: 'Luiza',
  created_at: '2026-10-29T12:00:00.000Z',
  updated_at: '2026-10-29T12:00:00.000Z',
};

test('contract details page keeps loading in-page and exposes header actions after loading', async () => {
  let resolveSnapshot!: (value: {
    holders: never[];
    dependents: never[];
    interactions: never[];
    adjustments: never[];
    documents: never[];
    documentsError: null;
  }) => void;
  mocks.loadSnapshot.mockImplementation(() => new Promise((resolve) => { resolveSnapshot = resolve; }));
  const calls: string[] = [];
  const view = render(
    <ContractDetails
      presentation="page"
      contract={contract}
      onClose={() => calls.push('back')}
      onUpdate={() => undefined}
      onEdit={() => calls.push('edit')}
      onDelete={() => { calls.push('delete'); return Promise.resolve(); }}
    />,
  );

  try {
    assert.equal(view.container.querySelector('[role="dialog"]'), null);
    assert.ok(view.container.querySelector('[aria-busy="true"]'));
    assert.ok(view.container.textContent?.includes('Carregando dados do contrato'));

    await act(async () => {
      resolveSnapshot({ holders: [], dependents: [], interactions: [], adjustments: [], documents: [], documentsError: null });
      await Promise.resolve();
    });

    assert.equal(view.container.querySelector('[role="dialog"]'), null);
    assert.ok(view.container.textContent?.includes('Ficha do contrato 413780'));
    const edit = [...view.container.querySelectorAll<HTMLButtonElement>('button')].find((button) => button.textContent?.trim() === 'Editar contrato');
    assert.ok(edit);
    assert.equal([...view.container.querySelectorAll('button')].filter((button) => button.textContent?.trim() === 'Editar contrato').length, 1);

    const back = [...view.container.querySelectorAll<HTMLButtonElement>('button')].find((button) => button.textContent?.includes('Gestão de contratos'));
    assert.ok(back);
    await act(async () => { edit.click(); back.click(); });
    assert.deepEqual(calls, ['edit', 'back']);
  } finally {
    view.unmount();
    mocks.loadSnapshot.mockReset();
  }
});
