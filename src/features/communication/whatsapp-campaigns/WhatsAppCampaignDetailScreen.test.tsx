import assert from 'node:assert/strict';
import { act } from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { test, vi } from 'vitest';

import type { CommWhatsAppCampaign } from './commWhatsAppCampaignService';

type CampaignRealtimeHandlers = {
  onCampaign: (campaign: CommWhatsAppCampaign) => void;
  onStatus: (status: string) => void;
};

type MockFunction<Args extends unknown[], Result> = {
  (...args: Args): Result;
  mock: { calls: Args[] };
  mockClear: () => MockFunction<Args, Result>;
  mockImplementation: (implementation: (...args: Args) => Result) => MockFunction<Args, Result>;
  mockResolvedValue: (value: Awaited<Result>) => MockFunction<Args, Result>;
};

const mocks = vi.hoisted(() => ({
  service: {
    getCampaign: vi.fn(),
    listCampaignTargets: vi.fn(),
    getCampaignTargetStatusCounts: vi.fn(),
    getCampaignFailureReasons: vi.fn(),
    getPendingWhatsAppValidationCount: vi.fn(),
    pauseCampaign: vi.fn(),
    resumeCampaign: vi.fn(),
    cancelCampaign: vi.fn(),
    processCampaign: vi.fn(),
  },
  subscribeToCampaignChanges: vi.fn(),
  realtimeHandlers: null as CampaignRealtimeHandlers | null,
}));

vi.mock('./commWhatsAppCampaignService', () => ({
  commWhatsAppCampaignService: mocks.service,
  computeAdmissionIntervalMinutes: vi.fn(() => 1),
  formatAdmissionInterval: vi.fn(() => '1 minuto'),
}));

vi.mock('./campaignRealtime', () => ({
  subscribeToCampaignChanges: mocks.subscribeToCampaignChanges,
}));

import WhatsAppCampaignDetailScreen from './WhatsAppCampaignDetailScreen';

type AsyncServiceMock = MockFunction<unknown[], Promise<unknown>>;

const serviceMocks = mocks.service as unknown as {
  getCampaign: AsyncServiceMock;
  listCampaignTargets: AsyncServiceMock;
  getCampaignTargetStatusCounts: AsyncServiceMock;
  getCampaignFailureReasons: AsyncServiceMock;
  getPendingWhatsAppValidationCount: AsyncServiceMock;
};
const subscribeToCampaignChangesMock = mocks.subscribeToCampaignChanges as unknown as MockFunction<
  [string, CampaignRealtimeHandlers],
  () => void
>;

const campaign: CommWhatsAppCampaign = {
  id: 'campaign-1',
  name: 'Campanha de teste',
  objective: null,
  status: 'running',
  audience_source: 'crm',
  audience_config: {},
  message_text: 'Olá',
  scheduled_at: null,
  pacing_per_minute: 1,
  daily_send_limit: null,
  send_window_start: null,
  send_window_end: null,
  active_weekdays: [],
  stop_on_reply: false,
  create_leads_from_csv: false,
  validate_whatsapp_numbers: false,
  total_targets: 0,
  valid_targets: 0,
  invalid_targets: 0,
  pending_targets: 0,
  sent_targets: 0,
  failed_targets: 0,
  responded_targets: 0,
  stopped_targets: 0,
  last_error: null,
  ab_test_enabled: false,
  ab_split_percent: 50,
  recurrence_rule: 'none',
  recurrence_interval: 1,
  recurrence_end_at: null,
  recurrence_next_run_at: null,
  recurrence_runs_completed: 0,
  created_at: '2026-09-27T12:00:00.000Z',
  updated_at: '2026-09-27T12:00:00.000Z',
};

const waitForText = async (text: string) => {
  const startedAt = Date.now();
  while (!document.body.textContent?.includes(text)) {
    if (Date.now() - startedAt >= 1_000) throw new Error(`Texto não encontrado: ${text}`);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  }
};

const flushLiveRequests = (resolvers: Array<() => void>) => {
  resolvers.splice(0).forEach((resolve) => resolve());
};

test('enfileira uma única atualização quando o realtime chega durante a atualização anterior', async () => {
  serviceMocks.getCampaign.mockResolvedValue(campaign);
  serviceMocks.listCampaignTargets.mockResolvedValue({ targets: [], total: 0 });
  serviceMocks.getCampaignTargetStatusCounts.mockResolvedValue([]);
  serviceMocks.getCampaignFailureReasons.mockResolvedValue([]);
  serviceMocks.getPendingWhatsAppValidationCount.mockResolvedValue(0);
  subscribeToCampaignChangesMock.mockImplementation((_campaignId, handlers) => {
    mocks.realtimeHandlers = handlers;
    return () => {};
  });

  const view = render(
    <MemoryRouter initialEntries={['/disparos/campanhas/campaign-1']}>
      <Routes>
        <Route path="/disparos/campanhas/:campaignId" element={<WhatsAppCampaignDetailScreen />} />
      </Routes>
    </MemoryRouter>,
  );
  await waitForText('Campanha de teste');

  serviceMocks.listCampaignTargets.mockClear();
  serviceMocks.getCampaignTargetStatusCounts.mockClear();
  serviceMocks.getCampaignFailureReasons.mockClear();
  serviceMocks.getPendingWhatsAppValidationCount.mockClear();

  const liveResolvers: Array<() => void> = [];
  serviceMocks.listCampaignTargets.mockImplementation(() => new Promise((resolve) => {
    liveResolvers.push(() => resolve({ targets: [], total: 0 }));
  }));
  serviceMocks.getCampaignTargetStatusCounts.mockImplementation(() => new Promise((resolve) => {
    liveResolvers.push(() => resolve([]));
  }));
  serviceMocks.getCampaignFailureReasons.mockImplementation(() => new Promise((resolve) => {
    liveResolvers.push(() => resolve([]));
  }));
  serviceMocks.getPendingWhatsAppValidationCount.mockImplementation(() => new Promise((resolve) => {
    liveResolvers.push(() => resolve(0));
  }));

  await act(async () => {
    mocks.realtimeHandlers?.onCampaign(campaign);
    await Promise.resolve();
  });
  assert.equal(serviceMocks.listCampaignTargets.mock.calls.length, 1);

  await act(async () => {
    mocks.realtimeHandlers?.onCampaign({ ...campaign, updated_at: '2026-09-27T12:01:00.000Z' });
    await Promise.resolve();
  });
  assert.equal(serviceMocks.listCampaignTargets.mock.calls.length, 1);
  assert.equal(serviceMocks.getCampaignTargetStatusCounts.mock.calls.length, 1);

  await act(async () => {
    flushLiveRequests(liveResolvers);
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  assert.equal(serviceMocks.listCampaignTargets.mock.calls.length, 2);
  assert.equal(serviceMocks.getCampaignTargetStatusCounts.mock.calls.length, 2);

  flushLiveRequests(liveResolvers);
  view.unmount();
});
