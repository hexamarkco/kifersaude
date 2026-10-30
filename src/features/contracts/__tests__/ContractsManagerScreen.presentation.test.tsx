import assert from 'node:assert/strict';
import { act } from 'react';
import { test, vi } from 'vitest';
import { render, screen } from '../../../testing-library/react';

const mocks = vi.hoisted(() => ({
  loadContracts: vi.fn(),
  subscribeToContractChanges: vi.fn(() => () => undefined),
}));
const loadContractsMock = mocks.loadContracts as unknown as {
  mockResolvedValue: (value: unknown) => void;
  mockReset: () => void;
};
const subscribeToContractChangesMock = mocks.subscribeToContractChanges as unknown as {
  mockClear: () => void;
};

vi.mock('../data/contractsRepository', () => ({
  deleteContract: vi.fn(),
  listContractsSearchSnapshot: mocks.loadContracts,
  subscribeToContractChanges: mocks.subscribeToContractChanges,
}));
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
vi.mock('../../../components/ContractDetails', () => ({
  default: ({
    presentation,
    contract,
    onClose,
  }: {
    presentation: string;
    contract: { codigo_contrato: string };
    onClose: () => void;
  }) => (
    <div role="dialog" aria-label="Detalhes do contrato" data-contract-presentation={presentation}>
      <span>{contract.codigo_contrato}</span>
      <button type="button" onClick={onClose}>Fechar detalhes</button>
    </div>
  ),
}));
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

test('opening a contract keeps the list behind its details drawer', async () => {
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

    const detailsDrawer = view.container.querySelector('[data-contract-presentation="drawer"]');
    assert.ok(detailsDrawer);
    assert.equal(view.container.querySelector('h1')?.textContent?.trim(), 'Gestão de contratos');
    assert.ok(view.container.textContent?.includes('Contato Demonstração'));
  } finally {
    view.unmount();
    loadContractsMock.mockReset();
    subscribeToContractChangesMock.mockClear();
  }
});
