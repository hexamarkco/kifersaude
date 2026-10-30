import assert from 'node:assert/strict';
import { act } from 'react';
import { render } from '@testing-library/react';
import { test, vi } from 'vitest';
import type { PublicLinkItem } from '../../../public-content';

const mocks = vi.hoisted(() => {
  const linkItems: PublicLinkItem[] = [];
  return {
    linkItems,
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
      getLinkItems: vi.fn(() => Promise.resolve(linkItems)),
      saveLinkPageSettings: vi.fn(() => Promise.reject(new Error('Falha de rede'))),
      createLinkItem: vi.fn(() => Promise.resolve({ data: null, error: null })),
      updateLinkItem: vi.fn(() => Promise.resolve({ data: null, error: null })),
      deleteLinkItem: vi.fn(() => Promise.resolve({ error: null })),
      reorderLinkItems: vi.fn(() => Promise.resolve({ error: null })),
    },
  };
});

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

  await waitForBodyText('Links públicos');
  const profileDetails = view.container.querySelector('details');
  const profileDisclosure = profileDetails?.querySelector('summary');
  assert.ok(profileDetails);
  assert.ok(profileDisclosure);
  await act(async () => profileDisclosure.click());
  assert.equal(profileDetails.open, true);
  const saveButton = await waitForButtonText('Salvar perfil');

  await act(async () => {
    saveButton.click();
  });

  const restoredButton = await waitForButtonText('Salvar perfil');
  assert.equal(restoredButton.disabled, false);
  view.unmount();
});

test('apresenta links na coleção do design system e filtra nome ou endereço localmente', async () => {
  mocks.linkItems.push(
    {
      id: 'link-whatsapp',
      title: 'Canal WhatsApp',
      url: 'https://wa.me/5521999999999',
      icon: 'whatsapp',
      is_active: true,
      position: 0,
      click_count: 12,
      created_at: '2026-10-25T12:00:00.000Z',
      updated_at: '2026-10-26T12:00:00.000Z',
    },
    {
      id: 'link-site',
      title: 'Site Kifer Saúde',
      url: 'https://kifersaude.com.br',
      icon: 'globe',
      is_active: false,
      position: 1,
      click_count: 4,
      created_at: '2026-10-24T12:00:00.000Z',
      updated_at: '2026-10-27T12:00:00.000Z',
    },
  );

  const view = render(<LinksScreen />);
  await waitForBodyText('Canal WhatsApp');

  assert.equal(view.container.querySelectorAll('.kds-responsive-collection .kds-table-body > tr').length, 2);
  const search = view.container.querySelector<HTMLInputElement>('[aria-label="Buscar links públicos por nome ou endereço"]');
  assert.ok(search);

  const setInputValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  await act(async () => {
    setInputValue?.call(search, 'Kifer');
    search.dispatchEvent(new Event('input', { bubbles: true }));
  });

  assert.equal(view.container.querySelectorAll('.kds-responsive-collection .kds-table-body > tr').length, 1);
  assert.ok(view.container.textContent?.includes('Site Kifer Saúde'));
  assert.ok(!view.container.textContent?.includes('Canal WhatsApp'));
  view.unmount();
});
