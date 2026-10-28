import assert from 'node:assert/strict';
import { render } from '@testing-library/react';
import { test } from 'vitest';
import { PanelAdaptiveLoadingFrame } from '../AsyncContent';

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
