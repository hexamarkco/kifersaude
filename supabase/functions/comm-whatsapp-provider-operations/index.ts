import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { authorizeDashboardUser } from '../_shared/dashboard-auth.ts';
import { corsHeaders, COMM_WHATSAPP_MODULE } from '../_shared/comm-whatsapp.ts';
import { checkCommWhatsAppActionRateLimit } from '../_shared/rate-limit.ts';
import { createProviderOperationsHandler } from './handler.ts';
import { executeProviderOperation } from './service.ts';

declare const Deno: { env: { get(key: string): string | undefined }; serve(handler: (req: Request) => Promise<Response>): void };

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '');
const headers = { ...corsHeaders, 'Content-Type': 'application/json' };
Deno.serve(createProviderOperationsHandler({
  headers,
  async authorize(req, mutation) {
    const result = await authorizeDashboardUser({
      req, supabaseUrl, supabaseAnonKey: Deno.env.get('SUPABASE_ANON_KEY') || '', supabaseAdmin: admin,
      module: COMM_WHATSAPP_MODULE, requiredPermission: mutation ? 'edit' : 'view',
    });
    return result.authorized ? result.user : Response.json(result.body, { status: result.status, headers });
  },
  rateLimit: (actorId) => checkCommWhatsAppActionRateLimit(admin, actorId, 'whatsapp-provider-operations', 30, 60),
  execute: (actor, body) => executeProviderOperation(admin, actor, body),
}));
