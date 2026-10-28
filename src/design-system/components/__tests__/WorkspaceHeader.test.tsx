import assert from 'node:assert/strict';
import { act } from 'react';
import { render } from '@testing-library/react';
import { test } from 'vitest';

import { WorkspaceHeader } from '../WorkspaceHeader';

test('fornece a marca mobile e um acionador de navegação acessível', () => {
  let toggleCalls = 0;
  const props = {
    title: 'Gestão de contratos',
    username: 'Operador Demonstração',
    theme: 'light' as const,
    mobileMenuOpen: false,
    onToggleMobileMenu: () => { toggleCalls += 1; },
    onNavigateHome: () => undefined,
    onToggleTheme: () => undefined,
  };
  const view = render(<WorkspaceHeader {...props} />);

  assert.ok(document.body.querySelector('[aria-label="Kifer Saúde"]'));
  const openButton = document.body.querySelector<HTMLButtonElement>('[aria-label="Abrir menu"]');
  assert.ok(openButton);
  assert.equal(openButton.getAttribute('aria-controls'), 'painel-navigation');
  assert.equal(openButton.getAttribute('aria-expanded'), 'false');

  act(() => openButton.click());
  assert.equal(toggleCalls, 1);

  view.unmount();
  const expandedView = render(<WorkspaceHeader {...props} mobileMenuOpen />);
  const closeButton = document.body.querySelector<HTMLButtonElement>('[aria-label="Fechar menu"]');
  assert.ok(closeButton);
  assert.equal(closeButton.getAttribute('aria-expanded'), 'true');
  assert.ok(document.body.textContent?.includes('Gestão de contratos'));
  expandedView.unmount();
});
