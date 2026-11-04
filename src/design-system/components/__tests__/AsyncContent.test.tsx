import assert from 'node:assert/strict';
import { act, useState } from 'react';
import { render } from '@testing-library/react';
import { test, vi } from 'vitest';
import { PanelAdaptiveLoadingFrame } from '../AsyncContent';
import { BlogTabSkeletonList } from '../ApplicationSkeletons';
import { DesignSystemProvider } from '../DesignSystemProvider';
import { AppLoadingBoundary, AppLoadingScreen, LoadingState } from '../LoadingState';
import { LOADING_CYCLE_MS } from '../../useMinimumLoading';
import { PANEL_THEME_STORAGE_KEY } from '../../themePreference';

test('startup keeps the same monogram across fallbacks and completes a cycle before showing the page', async () => {
  vi.useFakeTimers({ toFake: ['performance', 'setTimeout', 'clearTimeout'] });
  function Startup() {
    const [stage, setStage] = useState(0);
    return <>
      <button onClick={() => setStage((current) => current + 1)}>Avançar etapa</button>
      <AppLoadingBoundary>
        {stage < 2
          ? <AppLoadingScreen key={stage} theme="dark" />
          : <PanelAdaptiveLoadingFrame loading={stage === 2} hasContent={false}><p>Painel pronto</p></PanelAdaptiveLoadingFrame>}
      </AppLoadingBoundary>
    </>;
  }
  const view = render(<Startup />);
  try {
    const monogram = view.container.querySelector('.kds-loading-monogram');
    const nextStage = () => act(() => { view.container.querySelector('button')?.click(); });
    const tick = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });
    assert.ok(monogram);
    await tick(300);
    nextStage();
    assert.ok(view.container.querySelector('.kds-loading-monogram') === monogram);
    nextStage();
    assert.ok(view.container.querySelector('.kds-loading-monogram') === monogram);
    nextStage();
    await tick(LOADING_CYCLE_MS - 301);
    assert.ok(view.container.querySelector('.kds-loading-monogram') === monogram);
    assert.ok(view.container.querySelector('[hidden]')?.textContent?.includes('Painel pronto'));
    await tick(1);
    assert.ok(!view.container.querySelector('.kds-loading-monogram'));
    assert.ok(!view.container.querySelector('[hidden]'));
  } finally {
    view.unmount();
    vi.useRealTimers();
  }
});

test('a slow operation continues beyond one cycle and releases as soon as it finishes', async () => {
  vi.useFakeTimers({ toFake: ['performance', 'setTimeout', 'clearTimeout'] });
  function Example() {
    const [active, setActive] = useState(true);
    return <>
      <button onClick={() => setActive(false)}>Concluir</button>
      <LoadingState active={active} />
    </>;
  }
  const view = render(<Example />);
  try {
    await act(async () => { await vi.advanceTimersByTimeAsync(LOADING_CYCLE_MS + 700); });
    assert.ok(view.container.querySelector('.kds-loading-monogram'));
    act(() => { view.container.querySelector('button')?.click(); });
    assert.ok(!view.container.querySelector('.kds-loading-monogram'));
  } finally {
    view.unmount();
    vi.useRealTimers();
  }
});

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
        const loader = view.container.querySelector('[role="status"]')?.closest('.painel-theme');
        assert.ok(loader?.classList.contains(`theme-${expected}`));
      } finally { view.unmount(); }
    }
  } finally {
    if (previous === null) window.localStorage.removeItem(PANEL_THEME_STORAGE_KEY);
    else window.localStorage.setItem(PANEL_THEME_STORAGE_KEY, previous);
  }
});

test('initial loads show the branded indicator without presenting the empty result as loaded', () => {
  const view = render(<PanelAdaptiveLoadingFrame loading hasContent={false} label="Carregando contatos"><div>Nenhum contato</div></PanelAdaptiveLoadingFrame>);
  try {
    assert.equal(view.container.querySelector('[role="status"]')?.textContent, 'Carregando contatos');
    assert.ok(view.container.querySelector('[role="status"] .kds-loading-monogram'));
    assert.ok(!view.container.textContent?.includes('Nenhum contato'));
  } finally { view.unmount(); }
  const loaded = render(<PanelAdaptiveLoadingFrame loading={false} hasContent={false}><div>Nenhum contato</div></PanelAdaptiveLoadingFrame>);
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
