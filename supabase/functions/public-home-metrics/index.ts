// @ts-nocheck
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey, X-API-Key',
  'Cache-Control': 'public, max-age=300, s-maxage=600',
};

const jsonResponse = (body: Record<string, unknown>, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });

const formatCount = (value: number, plus = false) => {
  const normalized = Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
  const prefix = plus ? '+' : '';
  return `${prefix}${new Intl.NumberFormat('pt-BR').format(normalized)}`;
};

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing.');
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);

    const [leadsCountResult, operatorsCountResult, quotesThisMonthResult] = await Promise.all([
      supabaseAdmin.from('leads').select('id', { count: 'exact', head: true }).eq('arquivado', false),
      supabaseAdmin.from('operadoras').select('id', { count: 'exact', head: true }).eq('ativo', true),
      supabaseAdmin
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .eq('arquivado', false)
        .gte('data_criacao', monthStart.toISOString()),
    ]);

    if (leadsCountResult.error) {
      throw new Error(`Erro ao contar leads: ${leadsCountResult.error.message}`);
    }

    if (operatorsCountResult.error) {
      throw new Error(`Erro ao contar operadoras: ${operatorsCountResult.error.message}`);
    }

    if (quotesThisMonthResult.error) {
      throw new Error(`Erro ao contar cotacoes do mes: ${quotesThisMonthResult.error.message}`);
    }

    const totalLeads = leadsCountResult.count ?? 0;
    const activeOperators = operatorsCountResult.count ?? 0;
    const quotesThisMonth = quotesThisMonthResult.count ?? 0;

    return jsonResponse(
      {
        metrics: [
          {
            value: formatCount(totalLeads, true),
            label: 'clientes atendidos',
            detail: 'base historica acompanhada pela operacao comercial',
          },
          {
            value: formatCount(activeOperators),
            label: 'operadoras comparadas',
            detail: 'catalogo parceiro ativo na consultoria',
          },
          {
            value: formatCount(quotesThisMonth, true),
            label: 'cotacoes novas no mes',
            detail: 'movimento comercial atual registrado no CRM',
          },
        ],
        generatedAt: new Date().toISOString(),
      },
      200,
    );
  } catch (error) {
    console.error('[public-home-metrics] unexpected error', error);
    return jsonResponse({ error: error instanceof Error ? error.message : 'Unexpected error' }, 500);
  }
});
