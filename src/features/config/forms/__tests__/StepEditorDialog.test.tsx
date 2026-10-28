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

test('associa erros à pergunta e às opções antes de salvar', () => {
  let saved = false;
  const view = render(<StepEditorDialog open initialStep={null} saving={false} onClose={() => undefined} onSave={() => { saved = true; }} />);
  try {
    const dialog = document.body.querySelector<HTMLElement>('[role="dialog"]')!;
    const save = Array.from(dialog.querySelectorAll('button')).find(button => button.textContent?.trim() === 'Salvar')!;
    const title = dialog.querySelector<HTMLInputElement>('input[placeholder="Ex: Você já tem plano de saúde?"]')!;
    act(() => save.click());
    assert.equal(title.getAttribute('aria-invalid'), 'true');
    assert.equal(document.activeElement, title);
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(title, 'Qual plano?');
      title.dispatchEvent(new Event('input', { bubbles: true }));
    });
    act(() => save.click());
    assert.ok(dialog.textContent?.includes('Adicione ao menos 2 opções.'));
    assert.equal(document.activeElement, dialog.querySelector('input[aria-label="Opção 1"]'));
    assert.equal(saved, false);
  } finally { view.unmount(); }
});
