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

test('libera a tela e permite tentar novamente quando a carga inicial falha por exceção', async () => {
  const view = render(
    <MemoryRouter>
      <AiConfigScreen />
    </MemoryRouter>,
  );

  await waitForBodyText('Nenhuma funcionalidade encontrada.');

  const refreshButton = document.body.querySelector<HTMLButtonElement>(
    'button[aria-label="Atualizar configurações de IA"]',
  );
  assert.ok(refreshButton);
  assert.equal(refreshButton.disabled, false);
  view.unmount();
});
