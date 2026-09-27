import assert from 'node:assert/strict';
import { act } from 'react';
import { render } from '@testing-library/react';
import { test, vi } from 'vitest';

type AsyncMock = {
  mockRejectedValueOnce: (error: unknown) => AsyncMock;
};

const mocks = vi.hoisted(() => ({
  aiConfigService: {
    fetchConfigHistory: vi.fn(() => Promise.resolve({ data: [], error: null })),
    fetchEffectiveModel: vi.fn(() => Promise.resolve({ data: null, error: null })),
    fetchAvailableModels: vi.fn(() => Promise.resolve({ data: [], error: null })),
    fetchProviderModels: vi.fn(() => Promise.resolve({ data: [], error: null })) as unknown as AsyncMock,
    validateModelOverride: vi.fn(() => Promise.resolve({ valid: true })),
    createConfig: vi.fn(() => Promise.resolve({ error: null })) as unknown as AsyncMock,
  },
}));

vi.mock('../../aiConfigService', () => ({
  aiConfigService: mocks.aiConfigService,
}));

import FeatureEditorDrawer from '../FeatureEditorDrawer';

const feature = {
  id: 'feature-1',
  key: 'message.rewrite' as const,
  name: 'Reescrita de mensagem',
  description: null,
  category: 'messaging',
  enabled: true,
  task_type: 'text' as const,
  available_variables: [],
  default_feature_prompt: 'Prompt padrão',
  default_output_instructions: '',
  default_temperature: 0.4,
  default_max_output_tokens: 500,
  created_at: '2026-09-27T00:00:00.000Z',
  active_config: null,
  latest_config: null,
  config_count: 0,
};

const waitForBodyText = async (text: string) => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  const start = Date.now();
  while (!document.body.textContent?.includes(text)) {
    if (Date.now() - start >= 1000) {
      throw new Error(`Unable to find element with text: ${text}`);
    }
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 16));
    });
  }

  const elements = Array.from(document.body.querySelectorAll<HTMLElement>('*'));
  return elements.find((element) => element.textContent?.trim() === text)
    ?? elements.find((element) => element.textContent?.includes(text))
    ?? null;
};

const waitForSelector = async <T extends Element>(selector: string) => {
  const start = Date.now();
  while (true) {
    const element = document.body.querySelector<T>(selector);
    if (element) {
      return element;
    }
    if (Date.now() - start >= 1000) {
      throw new Error(`Unable to find element: ${selector}`);
    }
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 16));
    });
  }
};

test('libera o botão de salvar quando a criação da configuração falha por exceção', async () => {
  mocks.aiConfigService.createConfig.mockRejectedValueOnce(new Error('Falha de rede'));

  const view = render(
    <FeatureEditorDrawer
      feature={feature}
      onClose={() => undefined}
      onSaved={() => undefined}
    />,
  );

  await waitForSelector<HTMLTextAreaElement>('textarea[placeholder="Digite o prompt..."]');
  const saveButton = await waitForBodyText('Criar versão e ativar');
  assert.ok(saveButton instanceof HTMLButtonElement);

  await act(async () => {
    saveButton.click();
  });

  const restoredButton = await waitForBodyText('Criar versão e ativar');
  assert.ok(restoredButton instanceof HTMLButtonElement);
  assert.equal(restoredButton.disabled, false);
  view.unmount();
});

test('encerra o carregamento de modelos e mostra erro quando a consulta rejeita', async () => {
  mocks.aiConfigService.fetchProviderModels.mockRejectedValueOnce(new Error('Modelos indisponíveis'));

  const view = render(
    <FeatureEditorDrawer
      feature={{
        ...feature,
        latest_config: {
          id: 'config-1',
          feature_id: 'feature-1',
          version: 1,
          feature_prompt: 'Prompt atual',
          output_instructions: '',
          temperature: 0.4,
          max_output_tokens: 500,
          provider: 'openai',
          model: 'gpt-4o-mini',
          model_override_enabled: true,
          reasoning_effort: null,
          is_active: true,
          created_by: null,
          created_at: '2026-09-27T00:00:00.000Z',
        },
      }}
      onClose={() => undefined}
      onSaved={() => undefined}
    />,
  );

  await waitForBodyText('Modelos indisponíveis');
  assert.equal(document.body.textContent?.includes('Carregando modelos...'), false);
  view.unmount();
});
