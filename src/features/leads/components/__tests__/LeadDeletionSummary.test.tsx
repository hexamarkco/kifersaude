import assert from 'node:assert/strict';
import { render } from '@testing-library/react';
import { test } from 'vitest';

import { LeadDeletionSummary } from '../LeadDeletionSummary';

test('resume o lead e a consequência antes da confirmação de exclusão', () => {
  const { container } = render(<LeadDeletionSummary leadName="Contato de demonstração" />);
  const content = container.textContent ?? '';

  assert.ok(content.includes('A exclusão é permanente e não pode ser desfeita.'));
  assert.ok(content.includes('Registro'));
  assert.ok(content.includes('Contato de demonstração'));
  assert.ok(content.includes('Consequência'));
  assert.ok(content.includes('Exclusão permanente'));
});
