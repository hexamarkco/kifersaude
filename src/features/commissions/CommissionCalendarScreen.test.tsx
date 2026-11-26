import assert from 'node:assert/strict';
import { act } from 'react';
import { test, vi } from 'vitest';
import { render } from '../../testing-library/react';
import type { CommissionContract } from './domain/types';
import { getCommissionDateKey } from './shared/commissionCalendarUtils';

const mocks = vi.hoisted(() => ({
  contracts: [] as CommissionContract[],
}));
vi.mock('./data/commissionRepository', () => ({
  listActiveCommissionContracts: async () => mocks.contracts,
}));

import CommissionCalendarScreen from './CommissionCalendarScreen';

const fixture = (id: string, name: string, owner: string): CommissionContract => ({
  id,
  codigo_contrato: id,
  operadora: 'Amil',
  responsavel: owner,
  razao_social: name,
  nome_fantasia: name,
  previsao_recebimento_comissao: getCommissionDateKey(new Date()),
  comissao_prevista: 1000,
  comissao_recebimento_adiantado: true,
  comissao_parcelas: null,
  mensalidade_total: 500,
  previsao_pagamento_bonificacao: null,
  bonus_por_vida_aplicado: false,
  bonus_por_vida_configuracoes: null,
  bonus_por_vida_valor: 0,
  vidas: 2,
  vidas_elegiveis_bonus: null,
});

const waitForRows = async () => {
  const start = Date.now();
  while (!document.querySelector('.kds-forecast-contract')) {
    if (Date.now() - start > 3000) throw new Error('Previsões não carregadas');
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 16)); });
  }
};

const buttonWithText = (scope: ParentNode, label: string) => {
  const button = [...scope.querySelectorAll<HTMLButtonElement>('button')].find(item => item.textContent?.trim() === label);
  assert.ok(button, label);
  return button;
};

test('a previsão tem campos somente para consulta e abre o contrato autorizado', async () => {
  mocks.contracts = [fixture('CTR-001', 'Empresa A', 'Nick')];
  const opened: string[] = [];
  const view = render(<CommissionCalendarScreen view="forecasts" header={null} onOpenContract={code => opened.push(code)} />);
  try {
    await waitForRows();
    const row = document.querySelector<HTMLButtonElement>('.kds-forecast-contract');
    assert.ok(row);
    await act(async () => row.click());
    const dialog = document.querySelector('.kds-finance-event-dialog');
    assert.ok(dialog);
    assert.ok(dialog.textContent?.includes('Este valor é uma previsão.'));
    const inputs = [...dialog.querySelectorAll<HTMLInputElement>('input')];
    assert.ok(inputs.length >= 6);
    assert.ok(inputs.every(input => input.readOnly));
    assert.ok(inputs.some(input => input.value.includes('CTR-001')));
    assert.ok(![...dialog.querySelectorAll('button')].some(button => button.textContent?.trim() === 'Salvar'));
    await act(async () => buttonWithText(dialog, 'Abrir contrato').click());
    assert.deepEqual(opened, ['CTR-001']);
  } finally { view.unmount(); }
});

test('cancelar o rascunho do filtro mantém as previsões visíveis', async () => {
  mocks.contracts = [fixture('CTR-001', 'Empresa A', 'Nick'), fixture('CTR-002', 'Empresa B', 'Luíza')];
  const view = render(<CommissionCalendarScreen view="forecasts" header={null} />);
  try {
    await waitForRows();
    const filter = document.querySelector<HTMLButtonElement>('.kds-forecast-filter');
    assert.ok(filter);
    await act(async () => filter.click());
    const dialog = document.querySelector('.kds-finance-filter-dialog');
    assert.ok(dialog);
    const owner = dialog.querySelector<HTMLButtonElement>('#forecast-owner');
    assert.ok(owner);
    await act(async () => owner.click());
    const option = [...document.querySelectorAll<HTMLButtonElement>('[role="option"]')].find(item => item.textContent?.trim() === 'Nick');
    assert.ok(option);
    await act(async () => option.click());
    assert.equal(document.querySelectorAll('.kds-forecast-contract').length, 2);
    await act(async () => buttonWithText(dialog, 'Cancelar').click());
    assert.equal(document.querySelector('.kds-finance-filter-dialog'), null);
    assert.equal(document.querySelectorAll('.kds-forecast-contract').length, 2);
    await act(async () => filter.click());
    assert.ok(document.querySelector('#forecast-owner')?.textContent?.includes('Toda a equipe'));
  } finally { view.unmount(); }
});
