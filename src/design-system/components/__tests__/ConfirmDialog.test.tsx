import assert from 'node:assert/strict';
import { act } from 'react';
import { render } from '@testing-library/react';
import { test } from 'vitest';

import { ConfirmDialog } from '../ConfirmDialog';

test('bloqueia o fechamento enquanto a confirmação está em andamento', () => {
  let closeCalls = 0;

  const view = render(
    <ConfirmDialog
      open
      loading
      title="Excluir item"
      onOpenChange={() => { closeCalls += 1; }}
      onConfirm={async () => undefined}
    />,
  );

  const dialog = document.body.querySelector('[role="dialog"]');
  assert.ok(dialog);
  assert.equal(dialog.querySelector('[aria-label="Fechar"]'), null);
  assert.equal(Array.from(dialog.querySelectorAll('button')).find((button) => button.textContent?.includes('Cancelar'))?.disabled, true);
  assert.equal(dialog.querySelector<HTMLButtonElement>('button[data-loading="true"]')?.disabled, true);

  act(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    document.querySelector<HTMLElement>('.kds-dialog-backdrop')?.click();
  });

  assert.equal(closeCalls, 0);
  view.unmount();
});

test('ignora confirmações duplicadas antes da primeira terminar', async () => {
  let resolveConfirm!: () => void;
  let confirmCalls = 0;
  const confirmation = new Promise<void>((resolve) => {
    resolveConfirm = resolve;
  });

  const view = render(
    <ConfirmDialog
      open
      title="Excluir item"
      onOpenChange={() => undefined}
      onConfirm={async () => {
        confirmCalls += 1;
        await confirmation;
      }}
    />,
  );

  const confirmButton = Array.from(document.body.querySelectorAll('button')).find((button) => button.textContent?.includes('Confirmar'));
  assert.ok(confirmButton);

  await act(async () => {
    confirmButton.click();
    await Promise.resolve();
  });
  act(() => confirmButton.click());
  assert.equal(confirmCalls, 1);

  await act(async () => {
    resolveConfirm();
    await confirmation;
  });
  view.unmount();
});
