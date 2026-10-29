import assert from 'node:assert/strict';
import { act } from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { test, vi } from 'vitest';

import type { CampaignStats, CommWhatsAppCampaign } from './commWhatsAppCampaignService';

const mocks = vi.hoisted(() => ({
  service: {
    listCampaigns: vi.fn(),
    getStats: vi.fn(),
    listPendingAiSuggestions: vi.fn(),
    getWorkerHealth: vi.fn(),
    listTemplates: vi.fn(),
    normalizePhoneDigits: vi.fn((value: unknown) => typeof value === 'string' ? value.replace(/\D/g, '') : ''),
  },
  subscribeToCampaignListChanges: vi.fn(),
}));

vi.mock('../../../contexts/ConfigContext', () => ({
  useConfig: () => ({ leadStatuses: [], options: {} }),
}));

vi.mock('./commWhatsAppCampaignService', () => ({
  commWhatsAppCampaignService: mocks.service,
  computeContactIntervalMinutes: vi.fn(() => 1),
  formatContactInterval: vi.fn(() => '1 minuto'),
}));

vi.mock('./campaignRealtime', () => ({
  subscribeToCampaignListChanges: mocks.subscribeToCampaignListChanges,
}));

import WhatsAppCampaignsScreen from './WhatsAppCampaignsScreen';

type MockFunction<Args extends unknown[], Result> = {
  (...args: Args): Result;
  mock: { calls: Args[] };
  mockClear: () => MockFunction<Args, Result>;
  mockReset: () => MockFunction<Args, Result>;
  mockResolvedValue: (value: Awaited<Result>) => MockFunction<Args, Result>;
  mockReturnValue: (value: Result) => MockFunction<Args, Result>;
};

const serviceMocks = mocks.service as unknown as {
  listCampaigns: MockFunction<[], Promise<CommWhatsAppCampaign[]>>;
  getStats: MockFunction<[], Promise<CampaignStats>>;
  listPendingAiSuggestions: MockFunction<[], Promise<unknown[]>>;
  getWorkerHealth: MockFunction<[], Promise<unknown>>;
  listTemplates: MockFunction<[], Promise<unknown[]>>;
  normalizePhoneDigits: MockFunction<[string], string>;
};
const subscribeToCampaignListChangesMock = mocks.subscribeToCampaignListChanges as unknown as MockFunction<
  [() => void],
  () => void
>;

const createCampaign = (index: number): CommWhatsAppCampaign => ({
  id: `campaign-${index}`,
  name: `Campanha ${index}`,
  objective: null,
  status: 'draft',
  audience_source: 'crm',
  audience_config: {},
  message_text: `Mensagem de teste ${index}`,
  scheduled_at: null,
  pacing_per_minute: 12,
  daily_send_limit: null,
  contact_interval_minutes: null,
  inter_message_interval_minutes: 0,
  send_window_start: null,
  send_window_end: null,
  active_weekdays: [1, 2, 3, 4, 5],
  stop_on_reply: false,
  create_leads_from_csv: false,
  validate_whatsapp_numbers: true,
  total_targets: 240 + index,
  valid_targets: 240 + index,
  invalid_targets: 0,
  pending_targets: 240 + index,
  sent_targets: index,
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
  created_at: '2026-10-25T12:00:00.000Z',
  updated_at: '2026-10-25T12:00:00.000Z',
});

const renderCampaigns = () => render(
  <MemoryRouter initialEntries={['/painel/disparos']}>
    <Routes>
      <Route path="/painel/disparos" element={<WhatsAppCampaignsScreen />} />
      <Route path="/painel/disparos/:id" element={<p>Detalhes da campanha</p>} />
    </Routes>
  </MemoryRouter>,
);

const settleCampaignLoading = async () => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
};

const setupMocks = () => {
  serviceMocks.listCampaigns.mockReset();
  serviceMocks.getStats.mockReset();
  serviceMocks.listPendingAiSuggestions.mockReset();
  serviceMocks.getWorkerHealth.mockReset();
  serviceMocks.listTemplates.mockReset();
  serviceMocks.normalizePhoneDigits.mockClear();
  subscribeToCampaignListChangesMock.mockReset();

  serviceMocks.getStats.mockResolvedValue({
    total: 11,
    drafts: 11,
    scheduled: 0,
    active: 0,
    aiSuggestionsPending: 0,
  } satisfies CampaignStats);
  serviceMocks.listPendingAiSuggestions.mockResolvedValue([]);
  serviceMocks.getWorkerHealth.mockResolvedValue({ latestRun: null, latestSuccess: null, latestFailure: null, recentRuns: [] });
  serviceMocks.listTemplates.mockResolvedValue([]);
  subscribeToCampaignListChangesMock.mockReturnValue(() => {});
};

test('apresenta as campanhas em tabela paginada e navega pelo menu compartilhado de ações', async () => {
  setupMocks();
  serviceMocks.listCampaigns.mockResolvedValue(Array.from({ length: 11 }, (_, index) => createCampaign(index + 1)));
  const view = renderCampaigns();
  await settleCampaignLoading();

  assert.ok(view.container.querySelector('button[aria-label="Informações sobre envios automáticos"]'));
  assert.ok(view.container.querySelector('button[aria-label="Informações sobre esta seção"]'));

  const rows = () => Array.from(view.container.querySelectorAll<HTMLTableRowElement>('tbody tr'));
  assert.equal(rows().length, 10);
  assert.match(rows()[0].textContent ?? '', /Campanha 1/);
  assert.doesNotMatch(rows().map((row) => row.textContent).join(' '), /Campanha 11/);

  const nextPage = view.container.querySelector<HTMLButtonElement>('[aria-label="Próxima página"]');
  assert.ok(nextPage);
  act(() => nextPage.click());
  assert.equal(rows().length, 1);
  assert.match(rows()[0].textContent ?? '', /Campanha 11/);

  const previousPage = view.container.querySelector<HTMLButtonElement>('[aria-label="Pagina anterior"]');
  assert.ok(previousPage);
  act(() => previousPage.click());
  const actionTrigger = Array.from(view.container.querySelectorAll<HTMLButtonElement>('[aria-haspopup="menu"]'))
    .find((button) => button.getAttribute('aria-label')?.includes('campanha 1'));
  assert.ok(actionTrigger);
  act(() => actionTrigger.click());

  const detailsAction = Array.from(document.body.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'))
    .find((button) => button.textContent?.trim() === 'Ver detalhes');
  assert.ok(detailsAction);
  act(() => detailsAction.click());
  assert.match(document.body.textContent ?? '', /Detalhes da campanha/);
});
