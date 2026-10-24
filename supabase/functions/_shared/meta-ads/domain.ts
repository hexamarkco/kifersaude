// Provider IDs stay strings: Meta IDs can exceed JavaScript's safe integer range.
export type Receipt = {
  leadgen_id: string; page_id: string; form_id: string; ad_id: string | null;
  meta_created_at: string; lock_token?: string; attempts?: number;
};
export type MetaConfig = {
  enabled: boolean; pageId: string; formId: string; graphVersion: string;
  commercialField: string;
};
export class MetaError extends Error {
  constructor(readonly code: string, readonly retryable = false) { super(code); }
}
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
export const metaId = (value: unknown): string | null =>
  typeof value === 'string' && /^\d{1,32}$/.test(value) ? value : null;

export function parseNotifications(payload: unknown, config: MetaConfig): Receipt[] {
  if (!isRecord(payload) || payload.object !== 'page' || !Array.isArray(payload.entry)) {
    throw new MetaError('INVALID_NOTIFICATION');
  }
  const receipts = new Map<string, Receipt>();
  for (const entry of payload.entry) {
    if (!isRecord(entry) || entry.id !== config.pageId || !Array.isArray(entry.changes)) continue;
    for (const change of entry.changes) {
      if (!isRecord(change) || change.field !== 'leadgen') continue;
      const v = change.value;
      if (!isRecord(v) || v.page_id !== config.pageId || v.form_id !== config.formId) continue;
      const id = metaId(v.leadgen_id);
      const time = typeof v.created_time === 'number' ? v.created_time : NaN;
      if (!id || !Number.isSafeInteger(time) || time <= 0 || time > Date.now() / 1000 + 300) {
        throw new MetaError('INVALID_NOTIFICATION');
      }
      receipts.set(id, {
        leadgen_id: id, page_id: config.pageId, form_id: config.formId,
        ad_id: metaId(v.ad_id), meta_created_at: new Date(time * 1000).toISOString(),
      });
    }
  }
  return [...receipts.values()];
}

export async function verifySignature(body: Uint8Array, signature: string | null, secret: string): Promise<boolean> {
  if (!secret || !signature || !/^sha256=[a-f\d]{64}$/i.test(signature)) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  const bytes = new Uint8Array(signature.slice(7).match(/../g)!.map((hex) => parseInt(hex, 16)));
  return crypto.subtle.verify('HMAC', key, bytes, new Uint8Array(body));
}

export type ImportedLead = {
  name: string; phone: string; commercial_answer: string | null;
  ad_id: string | null;
  traffic_type: 'paid' | 'organic' | 'unknown';
  campaign_id: string | null; campaign_name: string | null;
  adset_id: string | null; adset_name: string | null; ad_name: string | null;
};
const label = (value: unknown) => typeof value === 'string' ? value.slice(0, 300) : null;
export function mapGraphLead(payload: unknown, receipt: Receipt, config: MetaConfig): ImportedLead {
  if (!isRecord(payload) || payload.id !== receipt.leadgen_id || payload.form_id !== receipt.form_id ||
    !Array.isArray(payload.field_data) || (payload.ad_id && receipt.ad_id && payload.ad_id !== receipt.ad_id)) {
    throw new MetaError('ORIGIN_MISMATCH');
  }
  const fields = payload.field_data;
  const field = (key: string): string => {
    const row = fields.find((item: unknown) => isRecord(item) && item.name === key);
    return isRecord(row) && Array.isArray(row.values) && typeof row.values[0] === 'string' ? row.values[0].trim() : '';
  };
  const name = field('full_name') || [field('first_name'), field('last_name')].filter(Boolean).join(' ');
  const rawPhone = field('phone_number');
  let phone = rawPhone.replace(/\D/g, '');
  if (!rawPhone.startsWith('+') && (phone.length === 10 || phone.length === 11)) phone = `55${phone}`;
  if (!name || name.length > 200 || !/^\d{10,15}$/.test(phone)) throw new MetaError('MISSING_CONTACT_FIELDS');
  return {
    name, phone, ad_id: metaId(payload.ad_id), commercial_answer: config.commercialField ? field(config.commercialField).slice(0, 500) || null : null,
    traffic_type: payload.is_organic === true ? 'organic' : metaId(payload.ad_id) || receipt.ad_id ? 'paid' : 'unknown',
    campaign_id: metaId(payload.campaign_id), campaign_name: label(payload.campaign_name),
    adset_id: metaId(payload.adset_id), adset_name: label(payload.adset_name), ad_name: label(payload.ad_name),
  };
}

export type Conversion = {
  event_id: string; leadgen_id: string; kind: 'qualified_lead' | 'contract_completed';
  occurred_at: string; meta_created_at: string; event_name: string; dataset_id: string;
  lock_token: string; attempts: number;
  approval_reference: string;
};
export type CapiApproval = {
  enabled: boolean; complianceApproved: boolean; authorizationReference: string;
  datasetId: string; qualifiedEvent: string; contractEvent: string; token: string;
};
export function canSend(approval: CapiApproval): boolean {
  return approval.enabled && approval.complianceApproved && Boolean(approval.authorizationReference.trim()) &&
    Boolean(metaId(approval.datasetId)) && Boolean(approval.token) &&
    /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(approval.qualifiedEvent) &&
    /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(approval.contractEvent) && approval.qualifiedEvent !== approval.contractEvent;
}
export function buildConversion(event: Conversion, approval: CapiApproval, now = Date.now()) {
  if (!canSend(approval) || event.dataset_id !== approval.datasetId || event.approval_reference !== approval.authorizationReference ||
    event.event_name !== (event.kind === 'qualified_lead' ? approval.qualifiedEvent : approval.contractEvent)) {
    throw new MetaError('CAPI_APPROVAL_REQUIRED');
  }
  const time = Date.parse(event.occurred_at);
  const created = Date.parse(event.meta_created_at);
  if (!Number.isFinite(time) || !Number.isFinite(created) || time < created || time > now || now - time >= 7 * 86400000) {
    throw new MetaError('EVENT_TIME_INVALID');
  }
  if (!metaId(event.leadgen_id)) throw new MetaError('ORIGIN_MISMATCH');
  // An explicit allowlist: never spread a CRM record into a Meta request.
  return {
    event_name: event.event_name, event_time: Math.floor(time / 1000), event_id: event.event_id,
    action_source: 'system_generated', user_data: { lead_id: event.leadgen_id },
    custom_data: { event_source: 'crm', lead_event_source: 'Kifer CRM' },
  };
}

export function retryDelay(attempt: number, random = Math.random()): number {
  return Math.min(21600, 30 * 2 ** Math.min(attempt, 10)) + Math.floor(random * 30);
}
