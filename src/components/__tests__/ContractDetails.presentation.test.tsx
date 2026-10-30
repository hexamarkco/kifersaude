import assert from 'node:assert/strict';
import { act } from 'react';
import { test, vi } from 'vitest';
import { render } from '../../testing-library/react';

type ContractDetailsSnapshot = Awaited<ReturnType<typeof import('../../features/contracts').getContractDetailsSnapshot>>;
type SnapshotMock = (() => Promise<ContractDetailsSnapshot>) & {
  mockImplementation: (implementation: () => Promise<ContractDetailsSnapshot>) => SnapshotMock;
  mockReset: () => void;
};

const mocks = vi.hoisted(() => ({
  loadSnapshot: vi.fn(),
}));
const loadSnapshotMock = mocks.loadSnapshot as unknown as SnapshotMock;

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
  let resolveSnapshot!: (value: ContractDetailsSnapshot) => void;
  loadSnapshotMock.mockImplementation(() => new Promise((resolve) => { resolveSnapshot = resolve; }));
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
      resolveSnapshot({
        holders: [{
          id: 'holder-demo',
          contract_id: contract.id,
          nome_completo: 'Contato Demonstração 01',
          cpf: '000.000.000-00',
          data_nascimento: '1985-05-12',
          telefone: '(21) 00000-0000',
          created_at: '2026-10-29T12:00:00.000Z',
          updated_at: '2026-10-29T12:00:00.000Z',
        }],
        dependents: [{
          id: 'dependent-demo',
          contract_id: contract.id,
          holder_id: 'holder-demo',
          nome_completo: 'Dependente de demonstração',
          data_nascimento: '2012-03-01',
          relacao: 'Filho(a)',
          created_at: '2026-10-29T12:00:00.000Z',
          updated_at: '2026-10-29T12:00:00.000Z',
        }],
        interactions: [],
        adjustments: [],
        documents: [],
        documentsError: null,
      });
      await Promise.resolve();
    });

    assert.equal(view.container.querySelector('[role="dialog"]'), null);
    assert.ok(view.container.textContent?.includes('Ficha do contrato'));
    assert.ok(view.container.textContent?.includes('Dados do contrato'));
    assert.ok(view.container.textContent?.includes('Beneficiários'));
    assert.ok(view.container.textContent?.includes('Contato Demonstração 01'));
    assert.ok(view.container.textContent?.includes('Dependente de demonstração'));
    assert.equal(view.container.querySelector('details')?.open, false);
    const edit = [...view.container.querySelectorAll<HTMLButtonElement>('button')].find((button) => button.textContent?.trim() === 'Editar contrato');
    assert.ok(edit);
    assert.equal([...view.container.querySelectorAll('button')].filter((button) => button.textContent?.trim() === 'Editar contrato').length, 1);

    const back = [...view.container.querySelectorAll<HTMLButtonElement>('button')].find((button) => button.textContent?.includes('Gestão de contratos'));
    assert.ok(back);
    await act(async () => { edit.click(); back.click(); });
    assert.deepEqual(calls, ['edit', 'back']);

    const addHolder = [...view.container.querySelectorAll<HTMLButtonElement>('button')].find((button) => button.textContent?.trim() === 'Adicionar titular');
    assert.ok(addHolder);
    await act(async () => { addHolder.click(); });
    assert.equal(view.container.querySelector('[role="dialog"]'), null);
    assert.equal(view.container.querySelector('h1')?.textContent, 'Dados do titular');

    const returnToContract = [...view.container.querySelectorAll<HTMLButtonElement>('button')].find((button) => button.textContent?.includes('Voltar à ficha do contrato'));
    assert.ok(returnToContract);
    await act(async () => { returnToContract.click(); });
    assert.equal(view.container.querySelector('h1')?.textContent, 'Ficha do contrato');
  } finally {
    view.unmount();
    loadSnapshotMock.mockReset();
  }
});
