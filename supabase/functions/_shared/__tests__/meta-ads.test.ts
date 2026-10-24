// @vitest-environment node
import { createHmac, webcrypto } from 'node:crypto';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { buildConversion, canSend, mapGraphLead, parseNotifications, verifySignature,
  MetaError, retryDelay, type MetaConfig, type Receipt, type Conversion, type CapiApproval } from '../meta-ads/domain.ts';
import { createGraphClient } from '../meta-ads/graph.ts';
import { runMetaWorker, type WorkerDependencies } from '../meta-ads/worker.ts';
import { createWebhookHandler } from '../../meta-lead-webhook/handler.ts';
import { createAdminHandler } from '../../meta-ads-admin/handler.ts';

beforeAll(() => { vi.stubGlobal('crypto', webcrypto); });
// Synthetic IDs and reserved 202-555 numbers. Never use campaign/account IDs as fixtures.
const config: MetaConfig = { enabled: true,pageId: '111111111111111',formId: '222222222222222',graphVersion: 'v25.0',commercialField: 'business_profile' };
const receipt: Receipt = { leadgen_id: '999999999999999999',page_id: config.pageId,form_id: config.formId,
  ad_id: '333333333333333',meta_created_at: new Date(Date.now()-86400000).toISOString(),lock_token: 'synthetic-lease',attempts: 1 };
const notification = () => ({ object: 'page',entry: [{ id: config.pageId,changes: [{ field: 'leadgen',value: {
  page_id: config.pageId,form_id: config.formId,leadgen_id: receipt.leadgen_id,ad_id: receipt.ad_id,created_time: Math.floor(Date.parse(receipt.meta_created_at)/1000),
} }] }] });
const graphLead = () => ({ id: receipt.leadgen_id,form_id: config.formId,ad_id: receipt.ad_id,
  campaign_id: '444444444444444',adset_id: '555555555555555',
  field_data: [{ name: 'full_name',values: ['Synthetic Contact'] },{ name: 'phone_number',values: ['+1 202 555 0100'] },
    { name: 'business_profile',values: ['MEI — duas vidas'] },{ name: 'sensitive_unmapped_field',values: ['MUST NEVER LEAVE CRM'] }],
});
const approval: CapiApproval = { enabled: true,complianceApproved: true,authorizationReference: 'synthetic-approval',
  datasetId: '666666666666666',qualifiedEvent: 'QualifiedLead',contractEvent: 'ConvertedLead',token: 'synthetic-token' };
const event: Conversion = { event_id: 'synthetic-event',leadgen_id: receipt.leadgen_id,kind: 'qualified_lead',
  occurred_at: new Date(Date.now()-3600000).toISOString(),meta_created_at: receipt.meta_created_at,
  dataset_id: approval.datasetId,event_name: approval.qualifiedEvent,approval_reference: approval.authorizationReference,lock_token: 'example-event-lease',attempts: 1 };
const sign = (body: string) => `sha256=${createHmac('sha256','example-meta-secret').update(body).digest('hex')}`;
const post = (body: string, signature = sign(body)) => new Request('https://local.invalid/webhook', {
  method: 'POST',body,headers: { 'x-hub-signature-256': signature },
});

describe('Meta webhook', () => {
  it('verifies the exact raw bytes, rejects bad signatures and empty secrets', async () => {
    const body = JSON.stringify(notification());
    expect(await verifySignature(new TextEncoder().encode(body),sign(body),'example-meta-secret')).toBe(true);
    expect(await verifySignature(new TextEncoder().encode(`${body} `),sign(body),'example-meta-secret')).toBe(false);
    expect(await verifySignature(new TextEncoder().encode(body),'sha256=bad','example-meta-secret')).toBe(false);
    expect(await verifySignature(new TextEncoder().encode(body),sign(body),'')).toBe(false);
  });
  it('validates subscribe challenges without giving CRM access', async () => {
    const enqueue = vi.fn();
    const handler = createWebhookHandler({ config: async () => config,secret: 'example-meta-secret',verifyToken: 'example-verify-token',enqueue });
    const response = await handler(new Request('https://local.invalid/?hub.mode=subscribe&hub.verify_token=example-verify-token&hub.challenge=123'));
    expect(response.status).toBe(200); expect(await response.text()).toBe('123');
    expect((await handler(new Request('https://local.invalid/?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=123'))).status).toBe(403);
    expect(enqueue).not.toHaveBeenCalled();
  });
  it('persists before acknowledging, retries DB failure and ignores unrelated origins', async () => {
    const enqueue = vi.fn().mockRejectedValueOnce(new Error('private DB error')).mockResolvedValue(undefined);
    const handler = createWebhookHandler({ config: async () => config,secret: 'example-meta-secret',verifyToken: '',enqueue });
    const body = JSON.stringify(notification());
    expect((await handler(post(body,'sha256=bad'))).status).toBe(403); expect(enqueue).not.toHaveBeenCalled();
    expect((await handler(post(body))).status).toBe(503);
    expect((await handler(post(body))).status).toBe(200);
    expect(enqueue.mock.calls[1][0][0].leadgen_id).toBe(receipt.leadgen_id);
    const unrelated = notification(); unrelated.entry[0].id = '777777777777777';
    expect(parseNotifications(unrelated,config)).toEqual([]);
    const duplicated = notification(); duplicated.entry.push(duplicated.entry[0]);
    expect(parseNotifications(duplicated,config)).toHaveLength(1);
  });
  it('rejects invalid JSON, missing notification fields, numeric IDs and oversize streams', async () => {
    const enqueue = vi.fn();
    const handler = createWebhookHandler({ config: async () => config,secret: 'example-meta-secret',verifyToken: '',enqueue });
    expect((await handler(post('{'))).status).toBe(400);
    const invalid = notification(); Reflect.deleteProperty(invalid.entry[0].changes[0].value,'created_time');
    expect((await handler(post(JSON.stringify(invalid)))).status).toBe(400);
    expect((await handler(post('x'.repeat(262145)))).status).toBe(413);
    expect(enqueue).not.toHaveBeenCalled();
  });
  it('keeps a paused integration retryable and never silently drops accepted leads', async () => {
    const enqueue = vi.fn();
    const handler = createWebhookHandler({ config: async () => ({ ...config,enabled: false }),secret: 'example-meta-secret',verifyToken: '',enqueue });
    expect((await handler(post(JSON.stringify(notification())))).status).toBe(503);
    expect(enqueue).not.toHaveBeenCalled();
  });
});

describe('mapping and Graph transport', () => {
  it('preserves advertising IDs and only the explicitly configured commercial answer', () => {
    const lead = mapGraphLead(graphLead(),receipt,config);
    expect(lead.phone).toBe('12025550100'); expect(lead.campaign_id).toBe('444444444444444');
    expect(lead.commercial_answer).toBe('MEI — duas vidas');
    expect(JSON.stringify(lead)).not.toContain('MUST NEVER');
    expect(mapGraphLead(graphLead(),receipt,{ ...config,commercialField: '' }).commercial_answer).toBeNull();
    expect(mapGraphLead({ ...graphLead(),is_organic: true },receipt,config).traffic_type).toBe('organic');
    const unknown = { ...graphLead(),ad_id: undefined };
    expect(mapGraphLead(unknown,{ ...receipt,ad_id: null },config).traffic_type).toBe('unknown');
    expect(() => mapGraphLead({ ...graphLead(),form_id: '777777777777777' },receipt,config)).toThrow('ORIGIN_MISMATCH');
    expect(() => mapGraphLead({ ...graphLead(),field_data: [] },receipt,config)).toThrow('MISSING_CONTACT_FIELDS');
  });
  it('keeps authorization out of URLs and sanitizes Graph errors with retry classification', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ error: { message: 'sensitive provider content' } }, { status: 429 }));
    const graph = createGraphClient(config.graphVersion,'example-meta-secret-token',fetcher);
    await expect(graph(receipt.leadgen_id,'id,field_data')).rejects.toMatchObject({ code: 'GRAPH_REJECTED',retryable: true });
    const [url, options] = fetcher.mock.calls[0];
    expect(String(url)).not.toContain('example-meta-secret-token');
    expect(options?.headers).toMatchObject({ Authorization: 'Bearer example-meta-secret-token' });
    expect(options?.redirect).toBe('error');
    fetcher.mockResolvedValueOnce(Response.json({ error: { message: 'secret' } }, { status: 403 }));
    await expect(graph(receipt.leadgen_id,'id')).rejects.toMatchObject({ code: 'GRAPH_AUTH',retryable: false });
  });
});

function worker(overrides: Partial<WorkerDependencies> = {}): WorkerDependencies {
  return {
    config: async () => config,approval: { ...approval,enabled: false },
    claimInbound: vi.fn().mockResolvedValueOnce(receipt).mockResolvedValue(null),claimOutbound: vi.fn().mockResolvedValue(null),
    retrieve: vi.fn().mockResolvedValue(graphLead()),importLead: vi.fn().mockResolvedValue(undefined),
    validateOutbound: vi.fn().mockResolvedValue(true),send: vi.fn().mockResolvedValue(undefined),finish: vi.fn().mockResolvedValue(undefined),...overrides,
  };
}
describe('reliable worker and delivery gates', () => {
  it('imports through the CRM transaction with delivery disabled, without claiming CAPI events', async () => {
    const deps = worker(); const result = await runMetaWorker(deps);
    expect(result.imported).toBe(1); expect(result.sent).toBe(0);
    expect(deps.importLead).toHaveBeenCalledOnce(); expect(deps.claimOutbound).not.toHaveBeenCalled(); expect(deps.send).not.toHaveBeenCalled();
  });
  it('retries a temporary failure and stops after the bounded attempt count', async () => {
    const deps = worker({ retrieve: vi.fn().mockRejectedValue(new MetaError('GRAPH_NETWORK',true)) });
    expect((await runMetaWorker(deps)).failed).toBe(1);
    expect(deps.finish).toHaveBeenCalledWith('inbound',receipt.leadgen_id,receipt.lock_token,'GRAPH_NETWORK',expect.any(Number));
    const exhausted = worker({ claimInbound: vi.fn().mockResolvedValueOnce({ ...receipt,attempts: 8 }).mockResolvedValue(null),retrieve: deps.retrieve });
    await runMetaWorker(exhausted);
    expect(exhausted.finish).toHaveBeenCalledWith('inbound',receipt.leadgen_id,receipt.lock_token,'GRAPH_NETWORK',null);
    expect(retryDelay(8,0)).toBeLessThanOrEqual(21600);
  });
  it('requires every approval and sends a stable, minimal CRM payload only for valid signals', async () => {
    expect(canSend({ ...approval,complianceApproved: false })).toBe(false);
    expect(canSend({ ...approval,authorizationReference: '' })).toBe(false);
    expect(() => buildConversion(event,{ ...approval,datasetId: '777777777777777' })).toThrow('CAPI_APPROVAL_REQUIRED');
    expect(() => buildConversion({ ...event,occurred_at: '2001-01-01' },approval)).toThrow('EVENT_TIME_INVALID');
    const payload = buildConversion(event,approval);
    expect(payload).toEqual({ event_name: 'QualifiedLead',event_time: Math.floor(Date.parse(event.occurred_at)/1000),event_id: event.event_id,
      action_source: 'system_generated',user_data: { lead_id: receipt.leadgen_id },custom_data: { event_source: 'crm',lead_event_source: 'Kifer CRM' } });
    expect(Object.keys(payload.user_data)).toEqual(['lead_id']);
    const deps = worker({ approval,claimInbound: vi.fn().mockResolvedValue(null),claimOutbound: vi.fn().mockResolvedValueOnce(event).mockResolvedValue(null) });
    expect((await runMetaWorker(deps)).sent).toBe(1);
    expect(deps.send).toHaveBeenCalledWith(approval.datasetId,payload);
    expect(deps.finish).toHaveBeenCalledWith('outbound',event.event_id,event.lock_token,null,null);
  });
  it('never transmits revoked commercial signals', async () => {
    const deps = worker({ approval,claimInbound: vi.fn().mockResolvedValue(null),claimOutbound: vi.fn().mockResolvedValueOnce(event).mockResolvedValue(null),validateOutbound: async () => false });
    await runMetaWorker(deps); expect(deps.send).not.toHaveBeenCalled();
    expect(deps.finish).toHaveBeenCalledWith('outbound',event.event_id,event.lock_token,'COMMERCIAL_SIGNAL_REVOKED',null);
  });
});

describe('admin HTTP boundary', () => {
  it('rejects unauthenticated/non-admin requests before loading CRM data', async () => {
    const snapshot = vi.fn(); const rpc = vi.fn();
    const handler = createAdminHandler({ authorize: async () => ({ status: 403 }),snapshot,rpc });
    expect((await handler(new Request('https://local.invalid',{ method: 'POST',body: '{"action":"snapshot"}' }))).status).toBe(403);
    expect(snapshot).not.toHaveBeenCalled(); expect(rpc).not.toHaveBeenCalled();
  });
  it('does not offer a delivery enable action and does not report unsuccessful requeue as success', async () => {
    const rpc = vi.fn().mockResolvedValue(false);
    const handler = createAdminHandler({ authorize: async () => ({ actor: 'synthetic-admin' }),snapshot: vi.fn(),rpc });
    const request = (body: unknown) => new Request('https://local.invalid',{ method: 'POST',body: JSON.stringify(body) });
    expect((await handler(request({ action: 'enableCapi' }))).status).toBe(400);
    expect((await handler(request({ action: 'requeue',leadgenId: receipt.leadgen_id }))).status).toBe(409);
  });
});
