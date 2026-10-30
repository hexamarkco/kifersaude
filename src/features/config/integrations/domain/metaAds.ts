export type MetaReviewInput = {
  attributionId: string; eligibleBusiness: boolean; lives: number; regionServed: boolean;
  interestConfirmed: boolean; opportunityId: string | null; contractId: string | null; contractCompleted: boolean;
};
export type MetaAttribution = {
  id: string; lead_id: string; lead_name: string; leadgen_id: string;
  campaign_id: string | null; campaign_name: string | null; adset_id: string | null; adset_name: string | null;
  ad_id: string | null; ad_name: string | null; form_id: string;
  meta_created_at: string; received_at: string; matched_existing: boolean; commercial_answer: string | null;
  traffic_type: 'paid' | 'organic' | 'unknown';
  latest_review: {
    qualified: boolean; eligible_business: boolean; lives: number; region_served: boolean;
    interest_confirmed: boolean; contract_completed: boolean; reviewed_at: string;
    contract_id: string | null; opportunity_id: string | null;
  } | null;
  contracts: { id: string; label: string }[];
  opportunities: { id: string; label: string; status: string }[];
};
export type MetaSnapshot = {
  settings: { enabled: boolean; pageId: string; formId: string; adAccountId: string; commercialField: string };
  serverConfigured: boolean; capiEnabled: boolean; webhookUrl: string;
  received: number; imported: number; pending: number; failed: number;
  eventsHeld: number; eventsPending: number; eventsFailed: number;
  lastReceivedAt: string | null; lastImportedAt: string | null;
  history: { id: string; direction: string; entity_id: string; attempt: number; outcome: string; error_code: string | null; created_at: string }[];
  attributions: MetaAttribution[];
  receipts: { leadgen_id: string; status: string; received_at: string; last_error_code: string | null }[];
  events: { event_id: string; kind: string; status: string; occurred_at: string; last_error_code: string | null }[];
};
export type MetaConnectionState = Pick<MetaSnapshot, 'serverConfigured' | 'failed' | 'lastImportedAt'> & {
  settings: Pick<MetaSnapshot['settings'], 'enabled'>;
};
export function metaConnectionLabel(snapshot: MetaConnectionState): string {
  if (!snapshot.serverConfigured) return 'Configuração do servidor pendente';
  if (!snapshot.settings.enabled) return 'Recebimento pausado';
  if (snapshot.failed) return 'Recebimento precisa de atenção';
  if (!snapshot.lastImportedAt) return 'Aguardando primeiro lead importado';
  return 'Leads recebidos pelo CRM';
}
export function isMetaQualified(input: MetaReviewInput): boolean {
  return input.eligibleBusiness && Number.isInteger(input.lives) && input.lives >= 2 && input.regionServed && input.interestConfirmed;
}
