import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { generateTextWithRouting } from '../_shared/ai-router.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

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
    return new Response(JSON.stringify({ error: 'Metodo nao permitido' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const payload = (await req.json()) as RewriteRequest;
    const text = normalizeValue(payload.text);
    const tone = normalizeValue(payload.tone) || 'claro';

    if (!text) {
      return new Response(JSON.stringify({ error: 'Texto obrigatorio.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.error('[rewrite-message] Missing Supabase environment variables');
      return new Response(JSON.stringify({ error: 'Configuracao do servidor incompleta.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);
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
      return new Response(JSON.stringify({ error: 'Resposta da IA vazia.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[rewrite-message] Reescrita gerada', {
      provider: rewriteResult.provider,
      model: rewriteResult.model,
      fallbackUsed: rewriteResult.fallbackUsed,
    });

    return new Response(JSON.stringify({ rewrite: rewriteText, provider: rewriteResult.provider, model: rewriteResult.model }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[rewrite-message] Erro inesperado:', error);
    return new Response(JSON.stringify({ error: 'Erro interno ao reescrever.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
