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
    const filterDialog = document.querySelector('[aria-label="Filtros avançados do dashboard"]');
    assert.equal(filterDialog?.getAttribute('role'), 'dialog');
    assert.equal(filterDialog?.id, 'dashboard-advanced-filters');
    assert.ok(document.querySelector('.kds-dialog-backdrop'));
    assert.equal(filterDialog?.textContent?.includes('Todos os responsáveis'), true);
    assert.equal(filterDialog?.textContent?.includes('Indicação'), true);
    assert.equal(findAdvancedFilterButton()?.textContent?.includes('1'), true);

    await act(async () => { findAdvancedFilterButton()?.click(); });
    assert.equal(document.querySelector('[aria-label="Filtros avançados do dashboard"]'), null);
  } finally {
    act(() => root.unmount());
    container.remove();
  }
});

test('apresenta filtros em drawer modal no mobile e fecha com Escape', async () => {
  const originalWidth = window.innerWidth;
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);

  try {
    await act(async () => { root.render(<DashboardHeader {...props} />); });
    const trigger = Array.from(container.querySelectorAll('button'))
      .find((button) => button.getAttribute('aria-label') === 'Filtros avançados');
    assert.ok(trigger);

    trigger.focus();
    await act(async () => { trigger.click(); });

    const filterDialog = document.querySelector('[aria-label="Filtros avançados do dashboard"]');
    assert.equal(filterDialog?.getAttribute('aria-modal'), 'true');
    assert.equal(filterDialog?.classList.contains('kds-drawer'), true);
    assert.equal(filterDialog?.textContent?.includes('Todos os estágios'), true);

    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    assert.equal(document.querySelector('[aria-label="Filtros avançados do dashboard"]'), null);
    assert.equal(document.activeElement, trigger);
  } finally {
    act(() => root.unmount());
    container.remove();
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalWidth });
  }
});

test('aplica a seleção de período somente após confirmar no diálogo', async () => {
  let selectedPeriod = '';
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);

  try {
    await act(async () => {
      root.render(<DashboardHeader {...props} onPeriodFilterChange={(value) => { selectedPeriod = value; }} />);
    });

    const trigger = Array.from(container.querySelectorAll('button'))
      .find((button) => button.getAttribute('aria-label') === 'Período: Este mês');
    assert.ok(trigger);
    trigger.focus();
    await act(async () => { trigger.click(); });

    const periodDialog = document.querySelector('[aria-label="Período do dashboard"]');
    assert.equal(periodDialog?.getAttribute('role'), 'dialog');
    assert.equal(periodDialog?.textContent?.includes('Últimos 7 dias'), true);
    assert.equal(periodDialog?.textContent?.includes('Mês anterior'), true);

    const lastThirtyDays = periodDialog?.querySelector<HTMLInputElement>('input[type="radio"][value="30d"]');
    assert.ok(lastThirtyDays);
    const lastThirtyDaysLabel = periodDialog?.querySelector<HTMLLabelElement>('label.kds-dashboard-period-option input[value="30d"]')?.closest('label');
    assert.ok(lastThirtyDaysLabel);
    await act(async () => { lastThirtyDaysLabel.click(); });
    assert.equal(selectedPeriod, '');

    const apply = Array.from(periodDialog?.querySelectorAll('button') ?? [])
      .find((button) => button.textContent?.includes('Aplicar filtros'));
    assert.ok(apply);
    await act(async () => { apply.click(); });

    assert.equal(selectedPeriod, '30d');
    assert.equal(document.querySelector('[aria-label="Período do dashboard"]'), null);
  } finally {
    act(() => root.unmount());
    container.remove();
  }
});

test('divide o período personalizado em seleção e datas e não aplica intervalos incompletos', async () => {
  let selectedPeriod = '';
  const originalWidth = window.innerWidth;
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);

  try {
    await act(async () => {
      root.render(<DashboardHeader {...props} onPeriodFilterChange={(value) => { selectedPeriod = value; }} />);
    });

    const trigger = Array.from(container.querySelectorAll('button'))
      .find((button) => button.getAttribute('aria-label') === 'Período: Este mês');
    assert.ok(trigger);
    trigger.focus();
    await act(async () => { trigger.click(); });

    const periodDrawer = document.querySelector('[aria-label="Período do dashboard"]');
    assert.equal(periodDrawer?.classList.contains('kds-drawer'), true);
    const customOption = periodDrawer?.querySelector<HTMLInputElement>('input[type="radio"][value="personalizado"]');
    assert.ok(customOption);
    const customOptionLabel = customOption.closest('label');
    assert.ok(customOptionLabel);
    await act(async () => { customOptionLabel.click(); });

    assert.equal(periodDrawer?.textContent?.includes('Data inicial do intervalo.'), true);
    assert.equal(periodDrawer?.querySelector('[aria-label="Data inicial do período"]') !== null, true);
    const apply = Array.from(periodDrawer?.querySelectorAll('button') ?? [])
      .find((button) => button.textContent?.includes('Aplicar filtros'));
    assert.equal(apply?.disabled, true);

    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    assert.equal(selectedPeriod, '');
    assert.equal(document.querySelector('[aria-label="Período do dashboard"]'), null);
    assert.equal(document.activeElement, trigger);
  } finally {
    act(() => root.unmount());
    container.remove();
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalWidth });
  }
});
