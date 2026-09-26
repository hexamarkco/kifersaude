import assert from 'node:assert/strict';
import { act } from 'react';
import { render } from '@testing-library/react';
import { test } from 'vitest';

import { ContractBulkJsonImportDialog } from '../ContractBulkJsonImportDialog';
import { ContractJsonImportDialog } from '../ContractJsonImportDialog';

const pendingFile = (name: string) => {
  let resolveText!: (value: string) => void;
  const text = new Promise<string>((resolve) => {
    resolveText = resolve;
  });
  const file = new File([''], name, { type: 'application/json' });
  Object.defineProperty(file, 'text', { value: () => text });
  return { file, resolveText, text };
};

const selectFile = (input: HTMLInputElement, file: File) => {
  Object.defineProperty(input, 'files', { configurable: true, value: [file] });
  input.dispatchEvent(new Event('change', { bubbles: true }));
};

test('mantém o diálogo de importação individual aberto durante a validação', async () => {
  let closeCalls = 0;
  const pending = pendingFile('contrato.json');
  const view = render(
    <ContractJsonImportDialog
      onApply={() => undefined}
      onClose={() => { closeCalls += 1; }}
    />,
  );
  const input = document.body.querySelector<HTMLInputElement>('input[type="file"]');
  assert.ok(input);

  act(() => selectFile(input, pending.file));
  const validateButton = Array.from(document.body.querySelectorAll('button')).find((button) => button.textContent?.includes('Validar arquivo'));
  assert.ok(validateButton);
  await act(async () => {
    validateButton.click();
    await Promise.resolve();
  });

  assert.equal(document.body.querySelector('[aria-label="Fechar"]'), null);
  act(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    document.querySelector<HTMLElement>('.kds-dialog-backdrop')?.click();
  });
  assert.equal(closeCalls, 0);

  await act(async () => {
    pending.resolveText(JSON.stringify({ contrato: { codigo_contrato: 'C-1' } }));
    await pending.text;
  });
  view.unmount();
});

test('mantém o diálogo de importação em massa aberto durante a validação', async () => {
  let closeCalls = 0;
  const pending = pendingFile('contratos.json');
  const view = render(
    <ContractBulkJsonImportDialog
      onImport={async () => undefined}
      onClose={() => { closeCalls += 1; }}
    />,
  );
  const input = document.body.querySelector<HTMLInputElement>('input[type="file"]');
  assert.ok(input);

  act(() => selectFile(input, pending.file));
  const validateButton = Array.from(document.body.querySelectorAll('button')).find((button) => button.textContent?.includes('Validar arquivo'));
  assert.ok(validateButton);
  await act(async () => {
    validateButton.click();
    await Promise.resolve();
  });

  assert.equal(document.body.querySelector('[aria-label="Fechar"]'), null);
  act(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    document.querySelector<HTMLElement>('.kds-dialog-backdrop')?.click();
  });
  assert.equal(closeCalls, 0);

  await act(async () => {
    pending.resolveText(JSON.stringify({
      contratos: [{
        codigo_contrato: 'C-1',
        status: 'Ativo',
        modalidade: 'Individual',
        operadora: 'Operadora',
        produto_plano: 'Plano',
        responsavel: 'Luiza',
      }],
    }));
    await pending.text;
  });
  view.unmount();
});
