import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { createMetaRepository } from '../_shared/meta-ads/repository.ts';
import { createWebhookHandler } from './handler.ts';

declare const Deno: { env: { get(key: string): string | undefined }; serve(handler: (req: Request) => Promise<Response>): void };
const repository = createMetaRepository(createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false, autoRefreshToken: false } }), Deno.env.get('META_GRAPH_VERSION') ?? '');
Deno.serve(createWebhookHandler({
  config: repository.config,
  secret: Deno.env.get('META_APP_SECRET') ?? '',
  verifyToken: Deno.env.get('META_WEBHOOK_VERIFY_TOKEN') ?? '',
  enqueue: async (receipts) => { await repository.rpc('meta_ads_enqueue', { p_receipts: receipts }); },
}));
