import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { generateTextWithRouting } from '../_shared/ai-router.ts';
import { authorizeDashboardUser, isServiceRoleRequest } from '../_shared/dashboard-auth.ts';

declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
  env: {
    get: (name: string) => string | undefined;
  };
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey, X-API-Key',
};

const MAX_REWRITE_TEXT_LENGTH = 8000;

const jsonResponse = (body: Record<string, unknown>, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

type RewriteRequest = {
  text?: string;
  tone?: string;
};

const TONE_PROMPTS: Record<string, string> = {
  claro: 'Reescreva de forma clara, correta e objetiva, mantendo o sentido original.',
  formal: 'Reescreva com tom formal e profissional, mantendo o sentido original.',
  amigavel: 'Reescreva com tom amigavel e acolhedor, mantendo o sentido original.',
  curto: 'Reescreva de forma curta e direta, sem perder informacoes importantes.',
  persuasivo: 'Reescreva de forma persuasiva e confiante, mantendo o sentido original.',
};

const SYSTEM_PROMPT = `Voce e um assistente especializado em reescrever mensagens comerciais em PT-BR.
Siga sempre:
- Nao invente informacoes.
- Preserve nomes, numeros, datas, valores e links.
- Entregue apenas o texto final, sem explicacoes.`;

const normalizeValue = (value: unknown): string => {
  if (typeof value === 'string') return value.trim();
  if (value === null || value === undefined) return '';
  try {
    return JSON.stringify(value);
  } catch {
    return '';
  }
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Metodo nao permitido' }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      console.error('[rewrite-message] Missing Supabase environment variables');
      return jsonResponse({ error: 'Configuracao do servidor incompleta.' }, 500);
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

    const serviceRoleCall = isServiceRoleRequest(req, supabaseServiceRoleKey);
    if (!serviceRoleCall) {
      const authResult = await authorizeDashboardUser({
        req,
        supabaseUrl,
        supabaseAnonKey,
        supabaseAdmin,
        module: 'whatsapp',
        requiredPermission: 'view',
      });

      if (!authResult.authorized) {
        return jsonResponse(authResult.body, authResult.status);
      }
    }

    const payload = (await req.json().catch(() => null)) as RewriteRequest | null;
    const text = normalizeValue(payload?.text);
    const tone = normalizeValue(payload?.tone) || 'claro';

    if (!text) {
      return jsonResponse({ error: 'Texto obrigatorio.' }, 400);
    }

    if (text.length > MAX_REWRITE_TEXT_LENGTH) {
      return jsonResponse({ error: 'Texto excede o limite permitido.' }, 400);
    }

    const tonePrompt = TONE_PROMPTS[tone] || TONE_PROMPTS.claro;
    const rewriteResult = await generateTextWithRouting({
      supabaseAdmin,
      task: 'rewrite_message',
      systemPrompt: `${SYSTEM_PROMPT}\n${tonePrompt}`,
      userPrompt: text,
      temperature: 0.4,
      maxTokens: 800,
    });

    const rewriteText = rewriteResult.text.trim();

    if (!rewriteText) {
      console.error('[rewrite-message] Resposta inesperada do provedor de IA', rewriteResult);
      return jsonResponse({ error: 'Resposta da IA vazia.' }, 500);
    }

    console.log('[rewrite-message] Reescrita gerada', {
      provider: rewriteResult.provider,
      model: rewriteResult.model,
      fallbackUsed: rewriteResult.fallbackUsed,
    });

    return jsonResponse({ rewrite: rewriteText, provider: rewriteResult.provider, model: rewriteResult.model }, 200);
  } catch (error) {
    console.error('[rewrite-message] Erro inesperado:', error);
    return jsonResponse({ error: 'Erro interno ao reescrever.' }, 500);
  }
});
