import assert from 'node:assert/strict';
import { act } from 'react';
import { test, vi } from 'vitest';
import { render, screen } from '../../../testing-library/react';

const mocks = vi.hoisted(() => ({
  loadContracts: vi.fn(),
  loadContractDetails: vi.fn(),
  subscribeToContractChanges: vi.fn(() => () => undefined),
}));
const loadContractsMock = mocks.loadContracts as unknown as {
  mockResolvedValue: (value: unknown) => void;
  mockReset: () => void;
};
const subscribeToContractChangesMock = mocks.subscribeToContractChanges as unknown as {
  mockClear: () => void;
};
type ContractDetailsSnapshot = Awaited<ReturnType<typeof import('../../../features/contracts').getContractDetailsSnapshot>>;
const loadContractDetailsMock = mocks.loadContractDetails as unknown as {
  mockImplementation: (implementation: () => Promise<ContractDetailsSnapshot>) => void;
  mockReset: () => void;
};

vi.mock('../data/contractsRepository', async () => {
  const actual = await (vi as typeof vi & { importActual: <T>(path: string) => Promise<T> })
    .importActual<typeof import('../data/contractsRepository')>('../data/contractsRepository');
  return {
    ...actual,
    deleteContract: vi.fn(),
    listContractsSearchSnapshot: mocks.loadContracts,
    subscribeToContractChanges: mocks.subscribeToContractChanges,
  };
});
vi.mock('../data/contractJsonImportRepository', () => ({ createContractRecordsBulk: vi.fn() }));
vi.mock('../../../contexts/AuthContext', () => ({ useAuth: () => ({ role: 'admin' }) }));
vi.mock('../../../contexts/ConfigContext', () => ({
  useConfig: () => ({
    options: {
      contract_status: [{ value: 'Ativo', label: 'Ativo', ativo: true }],
      lead_responsavel: [],
    },
    getRoleModulePermission: () => ({ can_edit: true }),
  }),
}));
vi.mock('../../../components/ContractForm', () => ({ default: () => null }));
vi.mock('../../../features/contracts', async () => {
  const actual = await (vi as typeof vi & { importActual: <T>(path: string) => Promise<T> })
    .importActual<typeof import('../../../features/contracts')>('../../../features/contracts');
  return { ...actual, getContractDetailsSnapshot: mocks.loadContractDetails };
});
vi.mock('../components/HolderImportPreparation', () => ({ default: () => null }));
vi.mock('../components/ContractBulkJsonImportDialog', () => ({ ContractBulkJsonImportDialog: () => null }));
vi.mock('../components/ContractStatusDropdown', () => ({
  default: ({ status }: { status: string }) => <span>{status}</span>,
}));
vi.mock('../hooks/useContractStatus', () => ({
  useContractStatus: () => ({ changeStatus: vi.fn(), savingIds: new Set<string>() }),
}));
vi.mock('../../production', () => ({ useProductionOperators: () => ({ operators: [], error: null }) }));
vi.mock('../../../hooks/usePanelMotion', () => ({
  usePanelMotion: () => ({
    motionEnabled: false,
    sectionDuration: 0,
    sectionStagger: 0,
    revealDistance: 0,
    ease: 'none',
  }),
}));
vi.mock('../../../hooks/useAdaptiveLoading', () => ({ useAdaptiveLoading: () => ({ phase: 'hidden' }) }));
vi.mock('../../../hooks/useConfirmationModal', () => ({
  useConfirmationModal: () => ({ requestConfirmation: vi.fn(), ConfirmationDialog: null }),
}));

import ContractsManagerScreen from '../ContractsManagerScreen';

const contract = {
  id: 'contract-demo',
  codigo_contrato: 'DS-DEMO-01',
  status: 'Ativo',
  modalidade: 'PME',
  operadora: 'Assim Saúde',
  produto_plano: 'Clássico',
  nome_fantasia: 'Empresa Demonstração',
  responsavel: 'Luiza',
  created_at: '2026-10-29T12:00:00.000Z',
  updated_at: '2026-10-29T12:00:00.000Z',
};

test('opening a contract loads the real details drawer over the retained list', async () => {
  loadContractsMock.mockResolvedValue({
    contracts: [contract],
    holdersByContractId: {
      [contract.id]: [{
        id: 'holder-demo',
        contract_id: contract.id,
        nome_completo: 'Contato Demonstração',
      }],
    },
    dependentsByContractId: {},
    failedSources: [],
  });
  let resolveDetails!: (value: ContractDetailsSnapshot) => void;
  loadContractDetailsMock.mockImplementation(() => new Promise((resolve) => { resolveDetails = resolve; }));

  const view = render(<ContractsManagerScreen />);

  try {
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    await screen.findByText('Contato Demonstração');
    const contractButton = view.container.querySelector<HTMLButtonElement>(
      'button[title="Contato Demonstração · DS-DEMO-01"]',
    );
    assert.ok(contractButton);

    await act(async () => { contractButton.click(); });

    const detailsDrawer = document.body.querySelector<HTMLElement>(
      '[role="dialog"][aria-label="Detalhes do contrato"]',
    );
    assert.ok(detailsDrawer);
    assert.ok(detailsDrawer.textContent?.includes('Carregando dados do contrato'));
    assert.equal(view.container.querySelector('h1')?.textContent?.trim(), 'Gestão de contratos');
    assert.ok(view.container.textContent?.includes('Contato Demonstração'));

    await act(async () => {
      resolveDetails({
        holders: [],
        dependents: [],
        interactions: [],
        adjustments: [],
        documents: [],
        documentsError: null,
      });
      await Promise.resolve();
    });

    assert.ok(document.body.querySelector('[role="dialog"][aria-label="Detalhes do contrato"]')?.textContent?.includes('Mais informações do contrato'));
    assert.ok(view.container.querySelector('h1')?.textContent?.trim() === 'Gestão de contratos');
  } finally {
    view.unmount();
    loadContractsMock.mockReset();
    loadContractDetailsMock.mockReset();
    subscribeToContractChangesMock.mockClear();
  }
});
