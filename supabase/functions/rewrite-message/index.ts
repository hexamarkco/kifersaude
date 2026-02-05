import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

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
    const { data: integration, error: integrationError } = await supabaseAdmin
      .from('integration_settings')
      .select('settings')
      .eq('slug', 'gpt_transcription')
      .maybeSingle();

    if (integrationError) {
      console.error('[rewrite-message] Erro ao carregar integracao GPT:', integrationError);
      return new Response(JSON.stringify({ error: 'Nao foi possivel acessar a configuracao do GPT.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const apiKey = integration?.settings?.apiKey;
    const model = integration?.settings?.textModel || 'gpt-4o-mini';

    if (!apiKey || typeof apiKey !== 'string') {
      return new Response(JSON.stringify({ error: 'Chave de API do GPT nao configurada.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const tonePrompt = TONE_PROMPTS[tone] || TONE_PROMPTS.claro;
    const openAiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'system', content: tonePrompt },
          { role: 'user', content: text },
        ],
      }),
    });

    if (!openAiResponse.ok) {
      const errorText = await openAiResponse.text();
      console.error('[rewrite-message] OpenAI error:', errorText);
      return new Response(JSON.stringify({ error: 'Falha ao reescrever texto.', details: errorText }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const completion = await openAiResponse.json();
    const rewriteText = completion?.choices?.[0]?.message?.content?.trim();

    if (!rewriteText) {
      console.error('[rewrite-message] Resposta inesperada da OpenAI', completion);
      return new Response(JSON.stringify({ error: 'Resposta do GPT vazia.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ rewrite: rewriteText }), {
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
