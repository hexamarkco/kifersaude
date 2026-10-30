import assert from 'node:assert/strict';
import { act } from 'react';
import { test, vi } from 'vitest';
import { render } from '../../testing-library/react';

const mocks = vi.hoisted(() => ({ config: { leadStatuses: [], options: {} } }));
vi.mock('../../contexts/ConfigContext', () => ({ useConfig: () => mocks.config }));
vi.mock('../../features/config', () => ({ configService: { getOperadoras: async () => [] } }));
vi.mock('../../features/production', () => ({ useProductionOperators: () => ({ operators: [], error: null }) }));
vi.mock('../../features/contracts', async () => {
  const actual = await (vi as typeof vi & { importActual: <T>(path: string) => Promise<T> }).importActual<typeof import('../../features/contracts')>('../../features/contracts');
  return { ...actual, listContractConversionLeads: async () => [], listContractValueAdjustments: async () => [] };
});
import ContractForm from '../ContractForm';

test('contract workspace keeps the same production fields and form submission target as the contextual dialog', async () => {
  let canceled = 0;
  const page = render(<ContractForm presentation="page" contract={null} onClose={() => canceled++} onSave={() => undefined} />);
  let fieldCount = 0;
  try {
    await act(async () => { await Promise.resolve(); });
    const form = page.container.querySelector('form#contract-form'); assert.ok(form);
    fieldCount = form.querySelectorAll('input,select,textarea').length; assert.ok(fieldCount > 10);
    assert.equal(page.container.querySelector('[role="dialog"]'), null);
    assert.ok(page.container.textContent?.includes('Informações do Contrato'));
    assert.deepEqual([...form.querySelectorAll('fieldset > legend > span:not(.kds-tooltip-anchor)')].map(legend => legend.textContent), [
      'Informações do Contrato',
      'Vigência e valores',
      'Comissão e recebimento',
      'Vidas e bonificações',
      'Responsáveis e observações',
    ]);
    const submit = page.container.querySelector('button[type="submit"]'); assert.equal(submit?.getAttribute('form'), 'contract-form');
    const cancel = [...page.container.querySelectorAll('button')].find(button => button.textContent === 'Cancelar');assert.ok(cancel);await act(async () => cancel.click());assert.equal(canceled,1);
  } finally { page.unmount(); }
  const dialog = render(<ContractForm contract={null} onClose={() => undefined} onSave={() => undefined} />);
  try {
    await act(async () => { await Promise.resolve(); });
    const contextual = document.querySelector('[role="dialog"] form#contract-form');assert.ok(contextual);
    assert.equal(contextual.querySelectorAll('input,select,textarea').length,fieldCount);
    assert.equal(contextual.querySelectorAll('fieldset').length, 5);
  } finally { dialog.unmount(); }
});

test('the full-page contract form applies an individual JSON import without saving', async () => {
  let saveCalls = 0;
  const page = render(
    <ContractForm
      presentation="page"
      contract={null}
      onClose={() => undefined}
      onSave={() => { saveCalls += 1; }}
    />,
  );

  try {
    await act(async () => { await Promise.resolve(); });
    const importButton = Array.from(page.container.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('Importar de arquivo'));
    assert.ok(importButton);

    await act(async () => { importButton.click(); });
    assert.ok(document.body.querySelector('[role="dialog"].kds-contract-json-import-dialog'));

    const input = document.body.querySelector<HTMLInputElement>('.kds-contract-json-import-dialog input[type="file"]');
    assert.ok(input);
    const content = JSON.stringify({ contrato: { codigo_contrato: 'C-IMPORTADO-1' } });
    const file = new File([content], 'contrato.json', { type: 'application/json' });
    Object.defineProperty(file, 'text', { value: async () => content });
    Object.defineProperty(input, 'files', { configurable: true, value: [file] });
    await act(async () => {
      input.dispatchEvent(new Event('change', { bubbles: true }));
      await Promise.resolve();
    });

    const validateButton = Array.from(document.body.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('Validar arquivo'));
    assert.ok(validateButton);
    await act(async () => { validateButton.click(); });

    const applyButton = Array.from(document.body.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('Aplicar ao formulário'));
    assert.ok(applyButton);
    await act(async () => { applyButton.click(); });

    assert.equal(document.body.querySelector('[role="dialog"].kds-contract-json-import-dialog'), null);
    const codeInput = page.container.querySelector<HTMLInputElement>('input[placeholder="Informe o código fornecido pela operadora"]');
    assert.equal(codeInput?.value, 'C-IMPORTADO-1');
    assert.equal(saveCalls, 0);
  } finally {
    page.unmount();
  }
});
