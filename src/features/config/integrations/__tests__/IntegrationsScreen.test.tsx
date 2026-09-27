import assert from 'node:assert/strict';
import { act } from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  configService: {
    getIntegrationSetting: vi.fn(() => Promise.resolve(null)),
    createIntegrationSetting: vi.fn(() => Promise.reject(new Error('Falha de rede'))),
    updateIntegrationSetting: vi.fn(() => Promise.resolve({ data: null, error: null })),
  },
  loadAiProviderModels: vi.fn(() => Promise.resolve({ models: [] })),
}));

vi.mock('../../data/configService', () => ({
  configService: mocks.configService,
}));

vi.mock('../data/integrationsApi', () => ({
  loadAiProviderModels: mocks.loadAiProviderModels,
}));

import IntegrationsScreen from '../IntegrationsScreen';

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

const waitForButtonText = async (text: string) => {
  const start = Date.now();
  while (true) {
    const button = Array.from(document.body.querySelectorAll<HTMLButtonElement>('button'))
      .find((candidate) => candidate.textContent?.trim() === text);
    if (button) return button;
    if (Date.now() - start >= 1000) {
      throw new Error(`Unable to find button with text: ${text}`);
    }
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 16));
    });
  }
};

test('libera o salvamento do provedor quando a chamada de integração rejeita', async () => {
  const view = render(
    <MemoryRouter>
      <IntegrationsScreen />
    </MemoryRouter>,
  );

  await waitForBodyText('Integração de IA');
  const saveButton = await waitForButtonText('Salvar OpenAI');

  await act(async () => {
    saveButton.click();
  });

  const restoredButton = await waitForButtonText('Salvar OpenAI');
  assert.equal(restoredButton.disabled, false);
  view.unmount();
});
