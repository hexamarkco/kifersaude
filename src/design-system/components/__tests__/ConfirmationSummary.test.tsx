import assert from 'node:assert/strict';
import { render } from '@testing-library/react';
import { test } from 'vitest';

import { ConfirmationSummary } from '../ConfirmationSummary';

test('identifica o registro e resume a consequência antes de confirmar', () => {
  const { container } = render(
    <ConfirmationSummary
      warning="A exclusão é permanente."
      items={[
        { label: 'Contrato', value: 'DEMO-001' },
        { label: 'Titular', value: 'Contato de demonstração' },
      ]}
    />,
  );

  const content = container.textContent ?? '';
  assert.ok(content.includes('A exclusão é permanente.'));
  assert.ok(content.includes('Contrato'));
  assert.ok(content.includes('DEMO-001'));
  assert.ok(content.includes('Titular'));
  assert.ok(content.includes('Contato de demonstração'));
  assert.equal(container.querySelectorAll('dl dt').length, 2);
  assert.equal(container.querySelectorAll('dl dd').length, 2);
});
