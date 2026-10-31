import type { MetaSnapshot } from '../../../src/features/config/integrations/domain/metaAds';

const errorScenario = new URLSearchParams(window.location.search).get('scenario') === 'errors';

const snapshot: MetaSnapshot = {
  settings: { enabled: true, pageId: 'page-demo', formId: 'form-demo', adAccountId: 'account-demo', commercialField: '' },
  serverConfigured: true,
  capiEnabled: false,
  webhookUrl: 'https://local.invalid/meta-lead-webhook',
  received: 9,
  imported: 8,
  pending: 0,
  failed: errorScenario ? 1 : 0,
  eventsHeld: 0,
  eventsPending: 0,
  eventsFailed: errorScenario ? 1 : 0,
  lastReceivedAt: '2026-10-30T14:01:00.000Z',
  lastImportedAt: '2026-10-30T14:02:00.000Z',
  history: [{
    id: 'history-demo-001',
    direction: 'inbound',
    entity_id: 'leadgen-demo-001',
    attempt: 1,
    outcome: 'success',
    error_code: null,
    created_at: '2026-10-30T14:02:00.000Z',
  }],
  attributions: [{
    id: 'attribution-demo-001',
    lead_id: 'lead-demo-001',
    lead_name: 'Contato de demonstração',
    leadgen_id: 'leadgen-demo-001',
    campaign_id: 'campaign-demo-001',
    campaign_name: 'Campanha de demonstração',
    adset_id: 'adset-demo-001',
    adset_name: 'Público de demonstração',
    ad_id: 'ad-demo-001',
    ad_name: 'Anúncio demonstrativo',
    form_id: 'form-demo-001',
    meta_created_at: '2026-10-30T14:00:00.000Z',
    received_at: '2026-10-30T14:01:00.000Z',
    matched_existing: false,
    commercial_answer: 'Tenho interesse em um plano empresarial.',
    traffic_type: 'paid',
    latest_review: null,
    contracts: [{ id: 'contract-demo-001', label: 'Contrato de demonstração' }],
    opportunities: [{ id: 'opportunity-demo-001', label: 'Oportunidade de demonstração', status: 'Proposta enviada' }],
  }],
  receipts: errorScenario ? [{
    leadgen_id: 'leadgen-error-demo-001',
    status: 'dead',
    received_at: '2026-10-30T13:59:00.000Z',
    last_error_code: 'GRAPH_AUTH',
  }] : [],
  events: errorScenario ? [{
    event_id: 'event-error-demo-001',
    kind: 'qualified_lead',
    status: 'dead',
    occurred_at: '2026-10-30T13:58:00.000Z',
    last_error_code: 'GRAPH_AUTH',
  }] : [],
};

export async function loadMetaAds(query = '') {
  const normalized = query.trim().toLocaleLowerCase('pt-BR');
  if (!normalized) return snapshot;
  return {
    ...snapshot,
    attributions: snapshot.attributions.filter((item) =>
      `${item.lead_name} ${item.leadgen_id} ${item.lead_id}`.toLocaleLowerCase('pt-BR').includes(normalized),
    ),
  };
}

export async function loadMetaHistory() {
  return [];
}

export async function saveMetaReview() {
  throw new Error('Escritas bloqueadas nesta prévia sintética.');
}

export async function requeueMetaReceipt() {
  throw new Error('Escritas bloqueadas nesta prévia sintética.');
}

export async function requeueMetaEvent() {
  throw new Error('Escritas bloqueadas nesta prévia sintética.');
}
