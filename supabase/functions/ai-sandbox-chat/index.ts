import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { authorizeDashboardUser } from '../_shared/dashboard-auth.ts';
import { resolveMcpServiceActor } from '../_shared/mcp-internal-actor.ts';
import { corsHeaders, toTrimmedString } from '../_shared/comm-whatsapp.ts';
import { generateSandboxReply } from '../_shared/ai-sandbox-attendance.ts';

declare const Deno: { env: { get: (key: string) => string | undefined };
  serve: (handler: (req: Request) => Response | Promise<Response>) => void };
type RequestBody = { conversationId?: string; leadName?: string; startWithApproach?: boolean };
const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Método não permitido' }), { status: 405, headers: jsonHeaders });
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    if (!supabaseUrl || !serviceRoleKey) throw new Error('Credenciais do Supabase não configuradas.');
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const serviceActor = await resolveMcpServiceActor(req, supabaseAdmin, serviceRoleKey);
    if (serviceActor.isServiceRole) {
      if (!serviceActor.actorId || !serviceActor.authorized) return new Response(
        JSON.stringify({ error: 'A conexão interna MCP exige um administrador ativo.' }), { status: 403, headers: jsonHeaders });
    } else {
      const auth = await authorizeDashboardUser({ req, supabaseUrl, supabaseAnonKey, supabaseAdmin });
      if (!auth.authorized) return new Response(JSON.stringify(auth.body), { status: auth.status, headers: jsonHeaders });
    }
    const body = await req.json().catch(() => ({})) as RequestBody;
    const conversationId = toTrimmedString(body.conversationId);
    if (!conversationId) return new Response(JSON.stringify({ error: 'Conversa obrigatória.' }), { status: 400, headers: jsonHeaders });
    const existing = await supabaseAdmin.from('ai_sandbox_conversations').select('id').eq('id', conversationId).maybeSingle();
    if (existing.error) throw new Error('Erro ao carregar conversa de teste.');
    if (!existing.data) return new Response(JSON.stringify({ error: 'Conversa não encontrada.' }), { status: 404, headers: jsonHeaders });
    const result = await generateSandboxReply({ client: supabaseAdmin, conversationId,
      leadName: toTrimmedString(body.leadName).slice(0, 120), startWithApproach: body.startWithApproach === true,
      advisorName: Deno.env.get('AUTONOMOUS_ATTENDANCE_V2_ADVISOR_NAME') });
    return new Response(JSON.stringify(result), { status: 200, headers: jsonHeaders });
  } catch (error) {
    console.error('[ai-sandbox-chat] falha ao processar conversa de teste');
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Não foi possível gerar a resposta.' }),
      { status: 500, headers: jsonHeaders });
  }
});
