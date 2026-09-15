// @ts-expect-error Deno npm import
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { authorizeDashboardUser } from '../_shared/dashboard-auth.ts';
import { checkCommWhatsAppActionRateLimit } from '../_shared/rate-limit.ts';
import { COMM_WHATSAPP_MODULE, corsHeaders as commCorsHeaders } from '../_shared/comm-whatsapp.ts';
import { mapTenorResults, type TenorMediaMode } from './domain.ts';

declare const Deno: {
  env: { get: (key: string) => string | undefined };
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};

const corsHeaders = { ...commCorsHeaders, 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' };
const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: jsonHeaders });

const createAdminClient = () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) throw new Error('Configuração interna indisponível.');
  return createClient(supabaseUrl, serviceRoleKey);
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'Método não permitido.' });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
    const supabaseAdmin = createAdminClient();
    const authResult = await authorizeDashboardUser({
      req,
      supabaseUrl,
      supabaseAnonKey,
      supabaseAdmin,
      module: COMM_WHATSAPP_MODULE,
      requiredPermission: 'view',
    });

    if (!authResult.authorized) return json(authResult.status, authResult.body);

    const rateLimitAllowed = await checkCommWhatsAppActionRateLimit(
      supabaseAdmin,
      authResult.user.userId,
      'tenor-media-search',
      30,
      60,
    );
    if (!rateLimitAllowed) return json(429, { error: 'Muitas buscas em pouco tempo. Aguarde e tente novamente.' });

    let body: Record<string, unknown>;
    try {
      const parsed: unknown = await req.json();
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return json(400, { error: 'Parâmetros inválidos.' });
      body = parsed as Record<string, unknown>;
    } catch {
      return json(400, { error: 'Parâmetros inválidos.' });
    }

    const query = typeof body.query === 'string' ? body.query.trim() : '';
    const mode = body.mode;
    if (!query || query.length > 100 || (mode !== 'gif' && mode !== 'sticker')) {
      return json(400, { error: 'Busca inválida.' });
    }

    const apiKey = Deno.env.get('TENOR_API_KEY')?.trim();
    if (!apiKey) return json(503, { error: 'Biblioteca de mídia indisponível.' });

    const providerUrl = new URL('https://tenor.googleapis.com/v2/search');
    providerUrl.search = new URLSearchParams({
      q: query,
      key: apiKey,
      client_key: 'tenor_web',
      limit: '24',
      locale: 'pt_BR',
      country: 'BR',
      media_filter: 'basic',
      contentfilter: 'medium',
      ...(mode === 'sticker' ? { searchfilter: 'sticker' } : {}),
    }).toString();

    const providerResponse = await fetch(providerUrl, { headers: { Accept: 'application/json' } });
    if (!providerResponse.ok) return json(502, { error: 'Biblioteca de mídia indisponível.' });
    const providerPayload: unknown = await providerResponse.json();
    const results = providerPayload && typeof providerPayload === 'object' && 'results' in providerPayload
      ? mapTenorResults((providerPayload as { results?: unknown }).results, mode as TenorMediaMode)
      : [];

    return new Response(JSON.stringify({ results }), {
      status: 200,
      headers: { ...jsonHeaders, 'Cache-Control': 'private, max-age=60' },
    });
  } catch {
    console.error('[tenor-media] falha ao consultar biblioteca');
    return json(500, { error: 'Não foi possível consultar a biblioteca de GIFs e figurinhas.' });
  }
});
