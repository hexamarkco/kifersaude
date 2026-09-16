import { authorizeDashboardUser } from '../_shared/dashboard-auth.ts';
import { createSupabaseAdminClient } from '../_shared/supabase-admin.ts';
import { corsHeaders } from '../_shared/comm-whatsapp.ts';
import { handleContractHolderImportRequest } from './service.ts';

declare const Deno: {
  env: { get: (key: string) => string | undefined };
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};

const responseHeaders = {
  ...corsHeaders,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': `${corsHeaders['Access-Control-Allow-Headers']}, X-Idempotency-Key`,
  'Content-Type': 'application/json',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: responseHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
    const supabaseAdmin = createSupabaseAdminClient();
    const authorization = await authorizeDashboardUser({
      req,
      supabaseUrl,
      supabaseAnonKey,
      supabaseAdmin,
      module: 'contracts',
      requiredPermission: 'edit',
    });

    if (!authorization.authorized) {
      return new Response(JSON.stringify(authorization.body), {
        status: authorization.status,
        headers: responseHeaders,
      });
    }

    return await handleContractHolderImportRequest({
      req,
      supabaseAdmin,
      actor: { userId: authorization.user.userId, role: authorization.user.role },
      headers: responseHeaders,
    });
  } catch {
    return new Response(JSON.stringify({
      success: false,
      error_code: 'INTERNAL_ERROR',
      message: 'Não foi possível preparar o titular para importação.',
    }), { status: 500, headers: responseHeaders });
  }
});
