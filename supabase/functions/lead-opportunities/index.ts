import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { authorizeDashboardUser } from '../_shared/dashboard-auth.ts';
import { createLeadOpportunitiesHandler } from './handler.ts';

declare const Deno: { env: { get(key: string): string | undefined }; serve(handler: (req: Request) => Promise<Response>): void };
const env = (key: string) => Deno.env.get(key) ?? '';
const supabaseAdmin = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { persistSession: false, autoRefreshToken: false },
});

Deno.serve(createLeadOpportunitiesHandler({
  authorize: async (req) => {
    const auth = await authorizeDashboardUser({
      req, supabaseAdmin, supabaseUrl: env('SUPABASE_URL'), supabaseAnonKey: env('SUPABASE_ANON_KEY'), module: 'leads',
    });
    if (!auth.authorized) return { status: auth.status };
    return auth.user.role === 'admin' ? { actorId: auth.user.userId } : { status: 403 };
  },
  rpc: async (name, args) => {
    const { data, error } = await supabaseAdmin.rpc(name, args);
    if (error) throw error;
    return data;
  },
}));
