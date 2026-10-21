import assert from 'node:assert/strict';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { test } from 'vitest';

import { DashboardHeader } from './DashboardHeader';

const props = {
  periodFilter: 'mes-atual' as const,
  customStartDate: '',
  customEndDate: '',
  dashboardOriginFilter: 'Indicação',
  dashboardOwnerFilter: '',
  dashboardOperatorFilter: '',
  dashboardContractTypeFilter: '',
  dashboardStatusFilter: '',
  visibleLeadOrigins: [{ nome: 'Indicação' }],
  responsavelOptions: [{ value: 'owner-1', label: 'Ana' }],
  operatorOptions: ['Amil'],
  contractTypeOptions: [{ value: 'PF', label: 'Pessoa física' }],
  statusOptions: [{ value: 'Contato Inicial', label: 'Contato Inicial' }],
  onPeriodFilterChange: () => undefined,
  onStartDateChange: () => undefined,
  onEndDateChange: () => undefined,
  onOriginFilterChange: () => undefined,
  onOwnerFilterChange: () => undefined,
  onOperatorFilterChange: () => undefined,
  onContractTypeFilterChange: () => undefined,
  onStatusFilterChange: () => undefined,
  isCustomStartInvalid: false,
  isCustomEndInvalid: false,
};

test('mantém período acessível e recolhe filtros avançados com contador de filtros ativos', async () => {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);

  try {
    await act(async () => { root.render(<DashboardHeader {...props} />); });

    const findAdvancedFilterButton = () => Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('Filtros avançados'));
    const advancedButton = findAdvancedFilterButton();
    assert.ok(advancedButton);
    assert.equal(advancedButton.getAttribute('aria-expanded'), 'false');
    assert.equal(container.textContent?.includes('Todas as origens'), false);
    assert.equal(container.textContent?.includes('Indicação'), false);

    await act(async () => { advancedButton.click(); });

    assert.equal(findAdvancedFilterButton()?.getAttribute('aria-expanded'), 'true');
    assert.equal(container.textContent?.includes('Todas as origens'), true);
    assert.equal(container.textContent?.includes('Indicação'), true);
    assert.equal(findAdvancedFilterButton()?.textContent?.includes('1'), true);

    await act(async () => { findAdvancedFilterButton()?.click(); });
    assert.equal(container.textContent?.includes('Todas as origens'), false);
  } finally {
    act(() => root.unmount());
    container.remove();
  }
});
