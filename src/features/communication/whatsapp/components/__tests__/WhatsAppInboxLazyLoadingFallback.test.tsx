import assert from 'node:assert/strict';
import { act, lazy, Suspense, type ReactElement } from 'react';
import { test } from 'vitest';

import { render } from '../../../../../testing-library/react';
import { WhatsAppInboxLazyLoadingFallback } from '../WhatsAppInboxLazyLoadingFallback';

test('mantém o Inbox visível e interativo enquanto o chunk da janela carrega', async () => {
  type DialogModule = { default: () => ReactElement };
  let resolveDialog!: (module: DialogModule) => void;
  const dialogModule = new Promise<DialogModule>((resolve) => { resolveDialog = resolve; });
  const LazyDialog = lazy(() => dialogModule);

  const view = render(
    <>
      <main data-testid="inbox">Conversa aberta</main>
      <Suspense fallback={<WhatsAppInboxLazyLoadingFallback />}>
        <LazyDialog />
      </Suspense>
    </>,
  );

  try {
    assert.equal(view.container.querySelector('[data-testid="inbox"]')?.textContent, 'Conversa aberta');
    const status = view.container.querySelector('[role="status"]');
    assert.ok(status);
    assert.equal(status.textContent, 'Abrindo janela');
    assert.ok(status.parentElement?.classList.contains('pointer-events-none'));
    assert.equal(view.container.querySelector('.kds-dialog-overlay'), null);

    await act(async () => {
      resolveDialog({ default: () => <div>Janela carregada</div> });
      await dialogModule;
    });

    assert.ok(view.container.textContent?.includes('Janela carregada'));
    assert.equal(view.container.querySelector('[role="status"]'), null);
  } finally {
    view.unmount();
  }
});
