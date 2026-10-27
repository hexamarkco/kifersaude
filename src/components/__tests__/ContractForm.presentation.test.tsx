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
    const submit = page.container.querySelector('button[type="submit"]'); assert.equal(submit?.getAttribute('form'), 'contract-form');
    const cancel = [...page.container.querySelectorAll('button')].find(button => button.textContent === 'Cancelar');assert.ok(cancel);await act(async () => cancel.click());assert.equal(canceled,1);
  } finally { page.unmount(); }
  const dialog = render(<ContractForm contract={null} onClose={() => undefined} onSave={() => undefined} />);
  try {
    await act(async () => { await Promise.resolve(); });
    const contextual = document.querySelector('[role="dialog"] form#contract-form');assert.ok(contextual);
    assert.equal(contextual.querySelectorAll('input,select,textarea').length,fieldCount);
  } finally { dialog.unmount(); }
});
