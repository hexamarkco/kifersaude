import assert from 'node:assert/strict';
import { act } from 'react';
import { render } from '@testing-library/react';
import { test } from 'vitest';

import StepEditorDialog from '../StepEditorDialog';

test('bloqueia edição e fechamento enquanto salva uma pergunta', () => {
  let closeCalls = 0;

  const view = render(
    <StepEditorDialog
      open
      initialStep={null}
      saving
      onClose={() => { closeCalls += 1; }}
      onSave={() => undefined}
    />,
  );

  const dialog = document.body.querySelector('[role="dialog"]');
  assert.ok(dialog);
  assert.equal(dialog.querySelector('[aria-label="Fechar"]'), null);
  assert.equal(dialog.querySelector('input')?.disabled, true);
  assert.equal(dialog.querySelector('textarea')?.disabled, true);
  assert.equal(dialog.querySelector('select')?.disabled, true);
  assert.equal(Array.from(dialog.querySelectorAll('button')).find((button) => button.textContent?.includes('Cancelar'))?.disabled, true);
  assert.equal(Array.from(dialog.querySelectorAll('button')).find((button) => button.textContent?.includes('Salvando'))?.disabled, true);

  act(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  });

  assert.equal(closeCalls, 0);
  view.unmount();
});
