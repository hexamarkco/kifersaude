import assert from 'node:assert/strict';
import { act } from 'react';
import { test, vi } from 'vitest';
import { render } from '../../testing-library/react';

const mocks = vi.hoisted(() => ({ saveDependent: vi.fn() }));
const saveDependentMock = mocks.saveDependent as unknown as {
  mockReset: () => void;
  mock: { calls: unknown[][] };
};

vi.mock('../../features/contracts', async () => {
  const actual = await (vi as typeof vi & { importActual: <T>(path: string) => Promise<T> })
    .importActual<typeof import('../../features/contracts')>('../../features/contracts');
  return { ...actual, saveContractDependent: mocks.saveDependent };
});

import DependentForm from '../DependentForm';

test('shows inline required-field errors and focuses the first invalid field without saving', async () => {
  saveDependentMock.mockReset();
  const view = render(
    <DependentForm
      contractId="contract-demo"
      holders={[{
        id: 'holder-demo',
        contract_id: 'contract-demo',
        nome_completo: 'Titular demonstração',
        cpf: '',
        data_nascimento: '',
        telefone: '',
        created_at: '2026-10-01T00:00:00.000Z',
        updated_at: '2026-10-01T00:00:00.000Z',
      }]}
      dependent={null}
      selectedHolderId="holder-demo"
      onClose={() => undefined}
      onSave={() => undefined}
    />,
  );

  try {
    const dialog = document.body.querySelector<HTMLElement>('[role="dialog"]');
    assert.ok(dialog);
    const form = dialog.querySelector<HTMLFormElement>('#dependent-form');
    assert.ok(form);

    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    const errors = [...dialog.querySelectorAll('[role="alert"]')].map((element) => element.textContent);
    assert.deepEqual(errors, [
      'Informe o nome completo.',
      'Informe a data de nascimento.',
    ]);

    const invalidControls = [...dialog.querySelectorAll<HTMLElement>('[aria-invalid="true"]')];
    assert.equal(invalidControls.length, 2);
    assert.equal(document.activeElement, invalidControls[0]);
    assert.equal(saveDependentMock.mock.calls.length, 0);
  } finally {
    view.unmount();
    saveDependentMock.mockReset();
  }
});
