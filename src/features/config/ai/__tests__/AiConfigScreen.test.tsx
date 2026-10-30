import assert from 'node:assert/strict';
import { act } from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  aiConfigService: {
    fetchFeaturesWithConfigs: vi.fn(() => Promise.reject(new Error('Falha de rede'))),
    fetchGlobalConfigs: vi.fn(() => Promise.reject(new Error('Falha de rede'))),
    fetchModelCatalog: vi.fn(() => Promise.resolve({ data: [], error: null })),
    fetchRoutingSettings: vi.fn(() => Promise.resolve({ data: {}, error: null })),
    fetchProviderModels: vi.fn(() => Promise.resolve({ data: [], error: null })),
    fetchEffectiveModel: vi.fn(() => Promise.resolve({ data: null, error: null })),
    deactivateConfig: vi.fn(() => Promise.resolve({ data: true, error: null })),
    activateConfig: vi.fn(() => Promise.resolve({ data: true, error: null })),
    updateGlobalConfig: vi.fn(() => Promise.resolve({ data: null, error: null })),
    createConfig: vi.fn(() => Promise.resolve({ data: null, error: null })),
  },
}));

vi.mock('../aiConfigService', () => ({
  aiConfigService: mocks.aiConfigService,
}));

import AiConfigScreen from '../AiConfigScreen';

const waitForBodyText = async (text: string) => {
  const start = Date.now();
  while (!document.body.textContent?.includes(text)) {
    if (Date.now() - start >= 1000) {
      throw new Error(`Unable to find element with text: ${text}`);
    }
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 16));
    });
  }
};

test('mostra o estado de erro e permite tentar novamente após falha na carga inicial', async () => {
  const view = render(
    <MemoryRouter>
      <AiConfigScreen />
    </MemoryRouter>,
  );

  await waitForBodyText('Não foi possível carregar as funcionalidades');

  const retryButton = Array.from(document.body.querySelectorAll<HTMLButtonElement>('button'))
    .find((button) => button.textContent?.includes('Tentar novamente'));
  assert.ok(retryButton);
  assert.equal(retryButton.disabled, false);

  await act(async () => retryButton.click());
  await waitForBodyText('Não foi possível carregar as funcionalidades');
  view.unmount();
});
