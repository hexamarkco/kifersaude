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
      onChange={onChange}
    />,
  );

  const trigger = view.container.querySelector<HTMLButtonElement>('[aria-label="Alterar status do contrato CON-001: Ativo"]');
  assert.ok(trigger);
  assert.ok(trigger.classList.contains('kds-op-status-badge'));
  assert.ok(trigger.classList.contains('kds-op-status-trigger'));
  assert.equal(trigger.classList.contains('kds-button'), false);

  act(() => trigger.click());
  assert.ok(document.body.querySelector('[role="dialog"][aria-label="Status do contrato CON-001"]'));
  const cancelledOption = Array.from(document.body.querySelectorAll<HTMLButtonElement>('[role="option"]')).find((option) => option.textContent?.trim() === 'Cancelado');
  assert.ok(cancelledOption);
  act(() => cancelledOption.click());
  assert.equal(changedStatuses[0], 'Cancelado');
});
