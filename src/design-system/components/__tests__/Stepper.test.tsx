import assert from 'node:assert/strict';
import { render } from '@testing-library/react';
import { test } from 'vitest';

import { Stepper } from '../Stepper';

test('numbered steps leave the summary to the page without empty labels or a trailing separator', () => {
  const view = render(<Stepper currentStep={0} steps={[{ label: '' }, { label: '' }]} />);
  try {
    assert.equal(view.container.querySelector('.kds-stepper-mobile-summary'), null);
    assert.equal(view.container.querySelector('.kds-stepper-content'), null);
    assert.equal(view.container.querySelector('[aria-current="step"]')?.textContent, '1');
    assert.equal(view.container.querySelectorAll('[role="listitem"]').length, 2);
  } finally {
    view.unmount();
  }
});

test('named steps retain their mobile summary and active step semantics', () => {
  const view = render(<Stepper currentStep={1} steps={[{ label: 'Perfil' }, { label: 'Contato' }]} />);
  try {
    assert.equal(view.container.querySelector('.kds-stepper-mobile-summary')?.textContent, 'Etapa 2 de 2 · Contato');
    assert.equal(view.container.querySelector('[aria-current="step"] .kds-stepper-label')?.textContent, 'Contato');
  } finally {
    view.unmount();
  }
});
