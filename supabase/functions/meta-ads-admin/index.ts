import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { authorizeDashboardUser } from '../_shared/dashboard-auth.ts';
import { canSend, isRecord } from '../_shared/meta-ads/domain.ts';
import { createMetaRepository } from '../_shared/meta-ads/repository.ts';
import { createAdminHandler } from './handler.ts';

declare const Deno: { env: { get(key: string): string | undefined }; serve(handler: (req: Request) => Promise<Response>): void };
const env = (key: string) => Deno.env.get(key) ?? '';
const supabaseAdmin = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'),
  { auth: { persistSession: false, autoRefreshToken: false } });
const repo = createMetaRepository(supabaseAdmin, env('META_GRAPH_VERSION'));
Deno.serve(createAdminHandler({
  authorize: async (req) => {
    const auth = await authorizeDashboardUser({ req,supabaseAdmin,supabaseUrl: env('SUPABASE_URL'),supabaseAnonKey: env('SUPABASE_ANON_KEY') });
    if (!auth.authorized) return { status: auth.status };
    return auth.user.role === 'admin' ? { actor: auth.user.userId } : { status: 403 };
  },
  rpc: repo.rpc,
  snapshot: async (actor, search) => {
    const snapshot = await repo.rpc<unknown>('meta_ads_snapshot', { p_actor: actor,p_search: search });
    if (!isRecord(snapshot)) throw new Error('Invalid snapshot');
    return {
      ...snapshot,
      serverConfigured: Boolean(env('META_APP_SECRET') && env('META_WEBHOOK_VERIFY_TOKEN') && env('META_PAGE_ACCESS_TOKEN') && /^v\d+\.0$/.test(env('META_GRAPH_VERSION'))),
      capiEnabled: canSend({
        enabled: env('META_CAPI_ENABLED') === 'true', complianceApproved: env('META_CAPI_COMPLIANCE_APPROVED') === 'true',
        authorizationReference: env('META_CAPI_AUTHORIZATION_REFERENCE'), datasetId: env('META_CAPI_DATASET_ID'),
        qualifiedEvent: env('META_CAPI_QUALIFIED_EVENT'), contractEvent: env('META_CAPI_CONTRACT_EVENT'), token: env('META_CAPI_ACCESS_TOKEN'),
      }),
      webhookUrl: `${env('SUPABASE_URL')}/functions/v1/meta-lead-webhook`,
    };
  },
}));
