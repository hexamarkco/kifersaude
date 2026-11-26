import assert from 'node:assert/strict';
import { act } from 'react';
import { test, vi } from 'vitest';
import { render, screen } from '../../../testing-library/react';
import { LOADING_CYCLE_MS } from '../../../design-system/useMinimumLoading';

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
vi.mock('../components/ContractBulkJsonImportDialog', () => ({
  ContractBulkJsonImportDialog: ({ onClose }: { onClose: () => void }) => (
    <div role="dialog" aria-label="Importação de contratos">
      <button type="button" onClick={onClose}>Fechar importação</button>
    </div>
  ),
}));
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
vi.mock('../../../hooks/useConfirmationModal', () => ({
  useConfirmationModal: () => ({ requestConfirmation: vi.fn(), ConfirmationDialog: null }),
}));

import ContractsManagerScreen from '../ContractsManagerScreen';

test('opens the bulk import dialog from the header actions menu', async () => {
  vi.useFakeTimers();
  loadContractsMock.mockResolvedValue({
    contracts: [],
    holdersByContractId: {},
    dependentsByContractId: {},
    failedSources: [],
  });

  const view = render(<ContractsManagerScreen />);

  try {
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(async () => { await vi.advanceTimersByTimeAsync(LOADING_CYCLE_MS); });
    assert.equal(view.container.querySelector('h1')?.textContent, 'Cuidado que vira compromisso.');
    const actionsButton = view.container.querySelector<HTMLButtonElement>('button[aria-label="Mais ações de contratos"]');
    assert.ok(actionsButton);
    await act(async () => { actionsButton.click(); });
    const importButton = [...document.body.querySelectorAll<HTMLButtonElement>('.kds-popover button')].find((button) => button.textContent?.trim() === 'Importar em massa');
    assert.ok(importButton);

    await act(async () => { importButton.click(); });
    assert.ok(document.body.querySelector('[role="dialog"][aria-label="Importação de contratos"]'));

    await act(async () => {
      document.body.querySelector<HTMLButtonElement>('[role="dialog"][aria-label="Importação de contratos"] button')?.click();
    });
    assert.equal(document.body.querySelector('[role="dialog"][aria-label="Importação de contratos"]'), null);
  } finally {
    view.unmount();
    loadContractsMock.mockReset();
    vi.useRealTimers();
  }
});

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
  vi.useFakeTimers();
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
    await act(async () => { await vi.advanceTimersByTimeAsync(LOADING_CYCLE_MS); });
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
    assert.equal(view.container.querySelector('h1')?.textContent?.trim(), 'Cuidado que vira compromisso.');
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

    await act(async () => { await vi.advanceTimersByTimeAsync(LOADING_CYCLE_MS); });
    const loadedDrawer = document.body.querySelector('[role="dialog"][aria-label="Detalhes do contrato"]');
    const tabs = loadedDrawer?.querySelector('[role="tablist"][aria-label="Seções do contrato"]');
    assert.ok(tabs);
    assert.deepEqual([...tabs.querySelectorAll('[role="tab"]')].map((tab) => tab.textContent), ['Resumo', 'Beneficiários', 'Financeiro', 'Histórico', 'Documentos']);
    assert.equal(tabs.querySelector('[aria-selected="true"]')?.textContent, 'Resumo');
    const holdersSection = loadedDrawer?.querySelector<HTMLElement>(`#contract-${contract.id}-holders`);
    assert.ok(holdersSection?.hidden);
    const beneficiaries = [...tabs.querySelectorAll<HTMLButtonElement>('button')].find((tab) => tab.textContent === 'Beneficiários');
    assert.ok(beneficiaries);
    await act(async () => { beneficiaries.click(); });
    assert.equal(holdersSection.hidden, false);
    assert.ok(holdersSection.textContent?.includes('Adicionar titular'));
    const documentsTab = [...tabs.querySelectorAll<HTMLButtonElement>('button')].find((tab) => tab.textContent === 'Documentos');
    assert.ok(documentsTab);
    await act(async () => { documentsTab.click(); });
    assert.equal(holdersSection.hidden, true);
    assert.ok(loadedDrawer?.querySelector('[role="tablist"][aria-label="Categorias de arquivos"]'));
    assert.ok(loadedDrawer?.querySelector('.kds-contract-detail-content'));
    assert.equal(loadedDrawer?.querySelector('.kds-contract-detail-expanded'), null);
    assert.ok(view.container.querySelector('h1')?.textContent?.trim() === 'Cuidado que vira compromisso.');
  } finally {
    view.unmount();
    loadContractsMock.mockReset();
    loadContractDetailsMock.mockReset();
    subscribeToContractChangesMock.mockClear();
    vi.useRealTimers();
  }
});
