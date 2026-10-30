import assert from 'node:assert/strict';
import { act } from 'react';
import { render } from '@testing-library/react';
import { test } from 'vitest';

import { OperationalStatusSelect } from '../OperationalStatusSelect';

const options = [
  { value: 'active', label: 'Ativo', color: 'var(--success-text)' },
  { value: 'cancelled', label: 'Cancelado', color: 'var(--danger-text)' },
];

test('seletor compacto expõe listbox e devolve foco após selecionar', () => {
  const changes: string[] = [];
  const view = render(
    <OperationalStatusSelect
      value="active"
      options={options}
      onValueChange={(value) => changes.push(value)}
      triggerAriaLabel="Alterar status do contato"
      menuAriaLabel="Status do contato"
    />,
  );

  try {
    const trigger = view.container.querySelector<HTMLButtonElement>(
      '[aria-label="Alterar status do contato"]',
    );
    assert.ok(trigger);
    assert.equal(trigger.getAttribute('aria-haspopup'), 'listbox');
    act(() => (trigger as HTMLButtonElement).click());

    const listbox = document.body.querySelector<HTMLElement>(
      '[role="listbox"][aria-label="Status do contato"]',
    );
    assert.ok(listbox);
    assert.equal(
      listbox.querySelector('[aria-selected="true"]')?.textContent?.trim(),
      'Ativo',
    );
    const cancelled = Array.from(listbox.querySelectorAll<HTMLButtonElement>('[role="option"]'))
      .find((option) => option.textContent?.trim() === 'Cancelado');
    assert.ok(cancelled);
    act(() => cancelled.click());

    assert.deepEqual(changes, ['cancelled']);
    assert.equal(trigger.getAttribute('aria-expanded'), 'false');
    assert.equal(document.activeElement, trigger);
    assert.equal(document.body.querySelector('[role="listbox"][aria-label="Status do contato"]'), null);

    act(() => trigger.click());
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    assert.equal(document.body.querySelector('[role="listbox"][aria-label="Status do contato"]'), null);
    assert.equal(document.activeElement, trigger);
  } finally {
    view.unmount();
  }
});

test('seletor contextual separa o campo auxiliar do listbox de status', () => {
  const view = render(
    <OperationalStatusSelect
      value="active"
      options={options}
      onValueChange={() => undefined}
      triggerAriaLabel="Alterar status do contrato DEMO"
      menuAriaLabel="Status do contrato DEMO"
      menuSize="contextual"
      beforeOptions={<button type="button">Responsável pela venda</button>}
    />,
  );

  try {
    const trigger = view.container.querySelector<HTMLButtonElement>(
      '[aria-label="Alterar status do contrato DEMO"]',
    );
    assert.ok(trigger);
    assert.equal(trigger.getAttribute('aria-haspopup'), 'dialog');
    act(() => (trigger as HTMLButtonElement).click());

    const dialog = document.body.querySelector<HTMLElement>(
      '[role="dialog"][aria-label="Status do contrato DEMO"]',
    );
    assert.ok(dialog);
    assert.ok(dialog.querySelector('button')?.textContent?.includes('Responsável pela venda'));
    assert.ok(dialog.querySelector('[role="listbox"][aria-label="Status disponíveis"]'));
  } finally {
    view.unmount();
  }
});

test('loading desabilita a abertura e anuncia atualização', () => {
  const view = render(
    <OperationalStatusSelect
      value="active"
      options={options}
      onValueChange={() => undefined}
      triggerAriaLabel="Alterar status do lead"
      menuAriaLabel="Status do lead"
      loading
    />,
  );

  const trigger = view.container.querySelector<HTMLButtonElement>(
    '[aria-label="Alterar status do lead"]',
  );
  assert.ok(trigger);
  assert.equal(trigger.disabled, true);
  assert.equal(trigger.getAttribute('aria-busy'), 'true');
  assert.match(trigger.textContent ?? '', /Atualizando/);
  view.unmount();
});
