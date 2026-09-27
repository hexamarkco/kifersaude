import assert from 'node:assert/strict';
import { act } from 'react';
import { render } from '@testing-library/react';
import { test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  linksService: {
    getLinkPageSettings: vi.fn(() => Promise.resolve({
      id: 'settings-1',
      title: 'Kifer Saúde',
      subtitle: null,
      bio: null,
      avatar_url: null,
      is_verified: false,
      is_published: true,
      created_at: '2026-09-27T00:00:00.000Z',
      updated_at: '2026-09-27T00:00:00.000Z',
    })),
    getLinkItems: vi.fn(() => Promise.resolve([])),
    saveLinkPageSettings: vi.fn(() => Promise.reject(new Error('Falha de rede'))),
    createLinkItem: vi.fn(() => Promise.resolve({ data: null, error: null })),
    updateLinkItem: vi.fn(() => Promise.resolve({ data: null, error: null })),
    deleteLinkItem: vi.fn(() => Promise.resolve({ error: null })),
    reorderLinkItems: vi.fn(() => Promise.resolve({ error: null })),
  },
}));

vi.mock('../../../../lib/linksService', () => ({
  linksService: mocks.linksService,
}));

vi.mock('../../../../lib/imageUploadService', () => ({
  uploadLinkPageImage: vi.fn(() => Promise.resolve({ success: true, url: 'https://example.com/avatar.png' })),
}));

import LinksScreen from '../LinksScreen';

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

test('libera o salvamento do perfil quando a chamada de rede rejeita', async () => {
  const view = render(<LinksScreen />);

  await waitForBodyText('Perfil da página');
  const saveButton = await waitForButtonText('Salvar perfil');

  await act(async () => {
    saveButton.click();
  });

  const restoredButton = await waitForButtonText('Salvar perfil');
  assert.equal(restoredButton.disabled, false);
  view.unmount();
});
