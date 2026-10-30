import assert from 'node:assert/strict';
import { act } from 'react';
import { render } from '@testing-library/react';
import { test, vi } from 'vitest';
import type { MetaSnapshot } from '../../domain/metaAds';
import type { ChannelAdminState } from '../../data/integrationsApi';

const mockState = vi.hoisted(() => ({
  whatsapp: null as unknown,
  meta: null as unknown,
  metaFailures: 0,
  whatsappCalls: 0,
  metaCalls: 0,
  lastWhatsAppAction: '',
}));

vi.mock('../../data/integrationsApi', () => ({
  loadWhatsAppChannelState: (action: string) => {
    mockState.whatsappCalls += 1;
    mockState.lastWhatsAppAction = action;
    return Promise.resolve(mockState.whatsapp);
  },
}));

vi.mock('../../data/metaAdsApi', () => ({
  loadMetaAds: () => {
    mockState.metaCalls += 1;
    if (mockState.metaFailures > 0) {
      mockState.metaFailures -= 1;
      return Promise.reject(new Error('Falha sintética'));
    }
    return Promise.resolve(mockState.meta);
  },
}));

import IntegrationsOverview from '../IntegrationsOverview';

const whatsappState = (): ChannelAdminState => ({
  channel: {
    connection_status: 'AUTH',
    phone_number: '+5521999999999',
    last_health_check_at: '2026-10-30T14:00:00.000Z',
  },
  config: {
    tokenConfigured: true,
    webhookDiagnostics: {
      status: 'receiving_messages',
      lastInboundMessageAt: '2026-10-30T14:05:00.000Z',
    },
  },
});

const metaSnapshot = (): MetaSnapshot => ({
  settings: { enabled: true, pageId: 'page-demo', formId: 'form-demo', adAccountId: 'account-demo', commercialField: '' },
  serverConfigured: true,
  capiEnabled: false,
  webhookUrl: 'https://local.invalid/meta-lead-webhook',
  received: 4,
  imported: 3,
  pending: 0,
  failed: 0,
  eventsHeld: 0,
  eventsPending: 0,
  eventsFailed: 0,
  lastReceivedAt: '2026-10-30T14:01:00.000Z',
  lastImportedAt: '2026-10-30T14:02:00.000Z',
  history: [],
  attributions: [],
  receipts: [],
  events: [],
});

const renderOverview = (onOpen: (section: string) => void = () => undefined) => render(
  <IntegrationsOverview
    onOpen={onOpen}
    trackingLoading={false}
    trackingError={false}
    pixelConfigured
    gtmConfigured
  />,
);

const waitForUi = () => act(async () => {
  await new Promise((resolve) => setTimeout(resolve, 0));
});

test('mostra estados vindos dos serviços e abre a configuração selecionada', async () => {
  mockState.whatsapp = whatsappState();
  mockState.meta = metaSnapshot();
  mockState.metaFailures = 0;
  mockState.whatsappCalls = 0;
  mockState.metaCalls = 0;
  mockState.lastWhatsAppAction = '';
  let openedSection = '';
  const view = renderOverview((section) => { openedSection = section; });

  await waitForUi();
  const content = view.container.textContent ?? '';
  assert.ok(content.includes('Conectado'));
  assert.ok(content.includes('Ativo'));
  assert.ok(content.includes('Configurado'));
  assert.ok(content.includes('Recebendo mensagens'));
  assert.ok(content.includes('Sem pendências'));
  assert.equal(mockState.lastWhatsAppAction, 'getConfig');
  assert.equal(mockState.metaCalls, 1);

  const whatsappButton = view.container.querySelector<HTMLButtonElement>('button[aria-label="Abrir configuração: WhatsApp"]');
  assert.ok(whatsappButton);
  act(() => whatsappButton.click());
  assert.equal(openedSection, 'whatsapp');
  view.unmount();
});

test('preserva o restante do resumo e oferece nova consulta se um serviço falhar', async () => {
  mockState.whatsapp = whatsappState();
  mockState.meta = metaSnapshot();
  mockState.metaFailures = 1;
  mockState.whatsappCalls = 0;
  mockState.metaCalls = 0;
  mockState.lastWhatsAppAction = '';
  const view = renderOverview();

  await waitForUi();
  assert.ok(view.container.textContent?.includes('Não foi possível consultar todas as integrações.'));
  assert.ok(view.container.textContent?.includes('Conectado'));
  assert.ok(view.container.textContent?.includes('Não verificado'));
  const retryButton = Array.from(view.container.querySelectorAll<HTMLButtonElement>('button'))
    .find((button) => button.textContent?.includes('Tentar novamente'));
  assert.ok(retryButton);
  await act(async () => {
    retryButton.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  assert.equal(mockState.metaCalls, 2);
  assert.ok(view.container.textContent?.includes('Ativo'));
  view.unmount();
});
