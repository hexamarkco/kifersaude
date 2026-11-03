import assert from 'node:assert/strict';
import { render } from '@testing-library/react';
import { test } from 'vitest';
import { PanelAdaptiveLoadingFrame } from '../AsyncContent';
import { BlogTabSkeletonList } from '../ApplicationSkeletons';
import { DesignSystemProvider } from '../DesignSystemProvider';
import { AppLoadingScreen } from '../LoadingState';
import { PANEL_THEME_STORAGE_KEY } from '../../themePreference';

test('the app loader uses the saved theme unless a provider or explicit theme takes precedence', () => {
  const previous = window.localStorage.getItem(PANEL_THEME_STORAGE_KEY);
  const cases = [
    { stored: 'dark', expected: 'dark', element: <AppLoadingScreen /> },
    { stored: 'dark', expected: 'light', element: <DesignSystemProvider theme="light"><AppLoadingScreen /></DesignSystemProvider> },
    { stored: 'dark', expected: 'dark', element: <DesignSystemProvider theme="light"><AppLoadingScreen theme="dark" /></DesignSystemProvider> },
    { stored: null, expected: 'light', element: <AppLoadingScreen /> },
  ];

  try {
    for (const { stored, expected, element } of cases) {
      if (stored === null) window.localStorage.removeItem(PANEL_THEME_STORAGE_KEY);
      else window.localStorage.setItem(PANEL_THEME_STORAGE_KEY, stored);
      const view = render(element);
      try {
        const loader = view.container.querySelector('[role="status"]')?.parentElement;
        assert.ok(loader?.classList.contains(`theme-${expected}`));
      } finally { view.unmount(); }
    }
  } finally {
    if (previous === null) window.localStorage.removeItem(PANEL_THEME_STORAGE_KEY);
    else window.localStorage.setItem(PANEL_THEME_STORAGE_KEY, previous);
  }
});

test('long initial loads show the supplied page skeleton without presenting the empty result as loaded', () => {
  const view = render(<PanelAdaptiveLoadingFrame loading phase="skeleton" hasContent={false} skeleton={<div role="status" aria-label="Carregando contatos" />}><div>Nenhum contato</div></PanelAdaptiveLoadingFrame>);
  try {
    assert.equal(view.container.querySelector('[role="status"]')?.getAttribute('aria-label'), 'Carregando contatos');
    assert.ok(!view.container.textContent?.includes('Nenhum contato'));
  } finally { view.unmount(); }
  const loaded = render(<PanelAdaptiveLoadingFrame loading={false} phase="hidden" hasContent={false} skeleton={<div role="status" />}><div>Nenhum contato</div></PanelAdaptiveLoadingFrame>);
  try {
    assert.equal(loaded.container.textContent, 'Nenhum contato');
    assert.equal(loaded.container.querySelector('[role="status"]'), null);
  } finally { loaded.unmount(); }
});

test('blog loading describes itself and supplies table and card layouts', () => {
  const view = render(<BlogTabSkeletonList />);
  try {
    assert.equal(view.container.querySelector('[role="status"]')?.getAttribute('aria-label'), 'Carregando artigos');
    assert.equal(view.container.querySelectorAll('.kds-collection-table tbody tr').length, 4);
    assert.equal(view.container.querySelectorAll('.kds-collection-cards .kds-surface').length, 4);
  } finally { view.unmount(); }
});
