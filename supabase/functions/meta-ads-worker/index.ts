import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { isAuthorizedMetaWorker } from './auth.ts';
import { createMetaRepository } from '../_shared/meta-ads/repository.ts';
import { createGraphClient } from '../_shared/meta-ads/graph.ts';
import { isRecord, MetaError, type CapiApproval, type Receipt, type Conversion } from '../_shared/meta-ads/domain.ts';
import { runMetaWorker } from '../_shared/meta-ads/worker.ts';

declare const Deno: { env: { get(key: string): string | undefined }; serve(handler: (req: Request) => Promise<Response>): void };
const env = (key: string) => Deno.env.get(key) ?? '';
const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY');
const repo = createMetaRepository(createClient(env('SUPABASE_URL'), serviceKey,
  { auth: { persistSession: false, autoRefreshToken: false } }), env('META_GRAPH_VERSION'));
const approval: CapiApproval = {
  enabled: env('META_CAPI_ENABLED') === 'true', complianceApproved: env('META_CAPI_COMPLIANCE_APPROVED') === 'true',
  authorizationReference: env('META_CAPI_AUTHORIZATION_REFERENCE'), datasetId: env('META_CAPI_DATASET_ID'),
  qualifiedEvent: env('META_CAPI_QUALIFIED_EVENT'), contractEvent: env('META_CAPI_CONTRACT_EVENT'), token: env('META_CAPI_ACCESS_TOKEN'),
};
Deno.serve(async (req) => {
  if (!isAuthorizedMetaWorker(req, serviceKey, env('META_WORKER_SECRET'))) return Response.json({ error: 'Não autorizado' }, { status: 401 });
  if (req.method !== 'POST') return new Response(null, { status: 405 });
  try {
    await repo.rpc('meta_ads_reconcile');
    const result = await runMetaWorker({
      config: repo.config, approval,
      claimInbound: () => repo.rpc<Receipt | null>('meta_ads_claim', { p_direction: 'inbound' }),
      claimOutbound: () => repo.rpc<Conversion | null>('meta_ads_claim', { p_direction: 'outbound' }),
      retrieve: (id) => createGraphClient(env('META_GRAPH_VERSION'), env('META_PAGE_ACCESS_TOKEN'))(id,
        'id,created_time,form_id,is_organic,ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,field_data'),
      importLead: async (receipt, lead) => {
        const validationOnly = receipt.leadgen_id === env('META_VALIDATION_LEAD_ID');
        await repo.rpc(validationOnly ? 'meta_ads_validate_test_import' : 'meta_ads_import', {
          p_id: receipt.leadgen_id,p_lock: receipt.lock_token,p_lead: lead,
        });
        if (validationOnly) return 'validated_test';
      },
      validateOutbound: (event) => repo.rpc<boolean>('meta_ads_validate_event', { p_id: event.event_id,p_lock: event.lock_token }),
      send: async (dataset, event) => {
        const response = await createGraphClient(env('META_GRAPH_VERSION'), approval.token)(dataset, { data: [event] });
        if (!isRecord(response) || response.events_received !== 1) throw new MetaError('CAPI_NOT_ACKNOWLEDGED', true);
      },
      finish: async (direction, id, lock, error, retrySeconds) => {
        const updated = await repo.rpc<boolean>('meta_ads_finish', { p_direction: direction,p_id: id,p_lock: lock,p_error: error,p_retry_seconds: retrySeconds });
        if (!updated) throw new MetaError('LEASE_LOST');
      },
    });
    return Response.json(result);
  } catch { return Response.json({ error: 'Processamento indisponível; a fila será retomada.' }, { status: 503 }); }
});
