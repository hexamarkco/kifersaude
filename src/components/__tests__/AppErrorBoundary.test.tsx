import assert from 'node:assert/strict';
import { render } from '@testing-library/react';
import { test } from 'vitest';

import AppErrorBoundary from '../AppErrorBoundary';

test('mostra uma recuperação utilizável quando uma tela lança erro', () => {
  const originalConsoleError = console.error;
  console.error = () => undefined;

  try {
    const view = render(
      <AppErrorBoundary>
        <ThrowingComponent />
      </AppErrorBoundary>,
    );

    assert.ok(view.container.querySelector('[role="alert"]'));
    assert.match(view.container.querySelector('h1')?.textContent ?? '', /erro inesperado/i);
    assert.ok(view.container.querySelector('button'));
    view.unmount();
  } finally {
    console.error = originalConsoleError;
  }
});

function ThrowingComponent(): never {
  throw new Error('falha de renderização simulada');
}
