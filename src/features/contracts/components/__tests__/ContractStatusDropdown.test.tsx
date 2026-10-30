import assert from 'node:assert/strict';
import { act } from 'react';
import { render } from '@testing-library/react';
import { test } from 'vitest';

import ContractStatusDropdown from '../ContractStatusDropdown';

test('seletor de status usa o badge operacional e mantém a seleção interativa', () => {
  const changedStatuses: string[] = [];
  const onChange = async (nextStatus: string) => {
    changedStatuses.push(nextStatus);
  };
  const view = render(
    <ContractStatusDropdown
      status="Ativo"
      code="CON-001"
      tone="success"
      canEdit
      saving={false}
      options={[
        { value: 'Ativo', label: 'Ativo' },
        { value: 'Cancelado', label: 'Cancelado' },
      ]}
      getOptionTone={(value) => value === 'Ativo' ? 'success' : 'danger'}
      onChange={onChange}
    />,
  );

  const trigger = view.container.querySelector<HTMLButtonElement>('[aria-label="Alterar status do contrato CON-001: Ativo"]');
  assert.ok(trigger);
  assert.ok(trigger.classList.contains('kds-op-status-badge'));
  assert.ok(trigger.classList.contains('kds-op-status-trigger'));
  assert.equal(trigger.classList.contains('kds-button'), false);

  act(() => trigger.click());
  assert.ok(document.body.querySelector('[role="listbox"][aria-label="Status do contrato CON-001"]'));
  const cancelledOption = Array.from(document.body.querySelectorAll<HTMLButtonElement>('[role="option"]')).find((option) => option.textContent?.trim() === 'Cancelado');
  assert.ok(cancelledOption);
  assert.ok(cancelledOption.querySelector('.kds-op-status-dot-only'));
  act(() => cancelledOption.click());
  assert.equal(changedStatuses[0], 'Cancelado');
});

test('permite escolher responsável e envia a seleção com o status', () => {
  const calls: Array<[string, string | undefined]> = [];
  const view = render(<ContractStatusDropdown status="Em análise" code="DEMO" tone="info" canEdit saving={false}
    options={[{ value: 'Ativo', label: 'Ativo' }]} operators={[{ user_id: 'demo', display_name: 'Operador demonstração', active: true }]}
    onChange={async (status, operator) => { calls.push([status, operator]); }} />);
  try {
    act(() => view.container.querySelector<HTMLButtonElement>('button')!.click());
    const label = Array.from(document.body.querySelectorAll<HTMLLabelElement>('label')).find(item => item.textContent?.trim() === 'Responsável pela venda');
    const select = label?.htmlFor ? document.getElementById(label.htmlFor) : null;
    assert.ok(select);
    assert.ok(select instanceof HTMLButtonElement);
    act(() => select.click());
    const operator = Array.from(document.body.querySelectorAll<HTMLButtonElement>('[role="option"]')).find(option => option.textContent?.includes('Operador demonstração'));
    assert.ok(operator);
    act(() => operator.click());
    const status = Array.from(document.body.querySelectorAll<HTMLButtonElement>('[role="option"]')).find(option => option.textContent?.trim() === 'Ativo');
    assert.ok(status);
    act(() => status.click());
    assert.deepEqual(calls, [['Ativo', 'demo']]);
  } finally { view.unmount(); }
});
