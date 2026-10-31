import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import '../../../src/index.css';
import { databaseClient } from '../../../src/infrastructure/supabase';
import WhatsAppCampaignDetailScreen from '../../../src/features/communication/whatsapp-campaigns/WhatsAppCampaignDetailScreen';
import {
  commWhatsAppCampaignService,
  type CommWhatsAppCampaign,
  type CommWhatsAppCampaignTargetListItem,
  type CommWhatsAppCampaignTargetStatus,
} from '../../../src/features/communication/whatsapp-campaigns/commWhatsAppCampaignService';

const campaign: CommWhatsAppCampaign = {
  id: 'campaign-demo-001',
  name: 'Campanha de demonstração',
  objective: 'Acompanhar a campanha promocional da demonstração',
  status: 'running',
  audience_source: 'crm',
  audience_config: {},
  message_text: 'Mensagem de demonstração bloqueada para envio.',
  scheduled_at: '2026-10-29T12:00:00.000Z',
  pacing_per_minute: 1,
  daily_send_limit: 30,
  contact_interval_minutes: 30,
  inter_message_interval_minutes: 0,
  send_window_start: '09:00',
  send_window_end: '18:00',
  active_weekdays: [1, 2, 3, 4, 5],
  stop_on_reply: true,
  create_leads_from_csv: false,
  validate_whatsapp_numbers: true,
  total_targets: 18,
  valid_targets: 16,
  invalid_targets: 1,
  pending_targets: 4,
  sent_targets: 9,
  failed_targets: 1,
  responded_targets: 3,
  stopped_targets: 0,
  last_error: null,
  ab_test_enabled: false,
  ab_split_percent: 50,
  recurrence_rule: 'none',
  recurrence_interval: 1,
  recurrence_end_at: null,
  recurrence_next_run_at: null,
  recurrence_runs_completed: 0,
  created_at: '2026-10-28T12:00:00.000Z',
  updated_at: '2026-10-29T12:15:00.000Z',
};

const statuses: CommWhatsAppCampaignTargetStatus[] = [
  'sent', 'responded', 'pending', 'scheduled', 'failed', 'invalid', 'sent', 'pending', 'responded',
  'sent', 'scheduled', 'sent', 'responded', 'sent', 'pending', 'sent', 'sent', 'sent',
];

const targets: CommWhatsAppCampaignTargetListItem[] = statuses.map((status, index) => ({
  id: `target-demo-${String(index + 1).padStart(2, '0')}`,
  phone_number: `+55 (21) 90000-${String(index + 1).padStart(4, '0')}`,
  phone_digits: `552190000${String(index + 1).padStart(4, '0')}`,
  display_name: `Contato de demonstração ${String(index + 1).padStart(2, '0')}`,
  status,
  current_step_index: index % 3,
  next_send_at: ['pending', 'scheduled'].includes(status) ? `2026-10-29T${String(13 + index % 5).padStart(2, '0')}:00:00.000Z` : null,
  last_attempt_at: ['sent', 'responded', 'failed', 'invalid'].includes(status) ? `2026-10-29T${String(8 + index % 5).padStart(2, '0')}:30:00.000Z` : null,
  error_message: status === 'failed' ? 'A mensagem não pôde ser entregue neste momento.' : status === 'invalid' ? 'O número não está disponível no WhatsApp.' : null,
  chat: null,
}));

const statusCounts = [
  { status: 'sent', ab_variant: null, total_count: 8, responded_count: 0 },
  { status: 'responded', ab_variant: null, total_count: 3, responded_count: 3 },
  { status: 'pending', ab_variant: null, total_count: 2, responded_count: 0 },
  { status: 'scheduled', ab_variant: null, total_count: 2, responded_count: 0 },
  { status: 'failed', ab_variant: null, total_count: 1, responded_count: 0 },
  { status: 'invalid', ab_variant: null, total_count: 1, responded_count: 0 },
  { status: 'sending', ab_variant: null, total_count: 1, responded_count: 0 },
];

type TargetListOptions = Parameters<typeof commWhatsAppCampaignService.listCampaignTargets>[1];

Object.assign(commWhatsAppCampaignService, {
  getCampaign: async () => campaign,
  listCampaignTargets: async (_campaignId: string, options: TargetListOptions) => {
    const filtered = targets
      .filter((target) => !options?.status?.length || options.status.includes(target.status))
      .filter((target) => {
        const search = options?.search?.trim().toLocaleLowerCase('pt-BR');
        return !search || `${target.display_name} ${target.phone_number}`.toLocaleLowerCase('pt-BR').includes(search);
      });
    const page = options?.page ?? 0;
    const pageSize = options?.pageSize ?? 10;
    return { targets: filtered.slice(page * pageSize, (page + 1) * pageSize), total: filtered.length };
  },
  getCampaignTargetStatusCounts: async () => statusCounts,
  getCampaignFailureReasons: async () => [
    { error_message: 'A mensagem não pôde ser entregue neste momento.', total_count: 1 },
    { error_message: 'O número não está disponível no WhatsApp.', total_count: 1 },
  ],
  getPendingWhatsAppValidationCount: async () => 2,
  pauseCampaign: async () => { throw new Error('Prévia somente de leitura.'); },
  resumeCampaign: async () => { throw new Error('Prévia somente de leitura.'); },
  cancelCampaign: async () => { throw new Error('Prévia somente de leitura.'); },
  processCampaign: async () => { throw new Error('Prévia somente de leitura.'); },
});

const inertChannel = {
  on() {
    return inertChannel;
  },
  subscribe(callback?: (status: string) => void) {
    queueMicrotask(() => callback?.('SUBSCRIBED'));
    return inertChannel;
  },
  unsubscribe() {
    return Promise.resolve('CLOSED');
  },
};

databaseClient.channel = (() => inertChannel as never) as typeof databaseClient.channel;
databaseClient.removeChannel = async () => 'ok';

const theme = new URLSearchParams(window.location.search).get('theme') === 'dark' ? 'theme-dark' : 'theme-light';

createRoot(document.getElementById('root')!).render(
  <div className={`painel-theme kifer-ds ${theme} comm-terracotta comm-terracotta-campaigns min-h-screen`}>
    <MemoryRouter initialEntries={['/painel/disparos/campaign-demo-001']}>
      <Routes>
        <Route path="/painel/disparos/:campaignId" element={<WhatsAppCampaignDetailScreen />} />
      </Routes>
    </MemoryRouter>
  </div>,
);
