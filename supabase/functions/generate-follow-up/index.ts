import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

type FollowUpRequest = {
  leadName?: string;
  conversationHistory?: string;
  leadContext?: Record<string, unknown> | string;
};

const DEFAULT_SYSTEM_PROMPT = `Você é um assistente de follow-up comercial em português do Brasil.
Gere mensagens curtas, personalizadas, humanas e persuasivas.

Sempre siga estas diretrizes:
- Analise todo o histórico fornecido para entender perguntas, propostas e respostas (inclusive ausência delas).
- Adapte o tom ao comportamento do cliente (engajado, frio, indeciso, com objeções, sumido, etc.).
- Resolva objeções claras antes de avançar para a venda.
- Espelhe a linguagem do cliente e use PNL, copywriting e gatilhos mentais com moderação.
- Estrutura recomendada: Abertura com nome + contexto breve (quando necessário) + reforço de benefícios objetivos + CTA clara.
- Seja respeitoso e direto; não use jargões técnicos nem textos longos.
- Inclua chamadas à ação práticas como “Me responde por aqui” ou “Podemos retomar de onde paramos”.
- Mantenha o foco em soluções e segurança do cliente, usando imagens mentais quando fizer sentido.
- Se não houver histórico, sugira um primeiro contato leve e convidativo.
`;

const normalizeValue = (value: unknown): string => {
  if (typeof value === 'string') return value.trim();
  if (value === null || value === undefined) return '';
  try {
    return JSON.stringify(value);
  } catch {
    return '';
  }
};

const buildUserPrompt = (payload: Required<Pick<FollowUpRequest, 'leadName' | 'conversationHistory'>> & FollowUpRequest) => {
  const leadContext = normalizeValue(payload.leadContext);

  return `Nome do cliente: ${payload.leadName}\n\n` +
    (leadContext ? `Contexto do lead:\n${leadContext}\n\n` : '') +
    `Histórico completo da conversa:\n${payload.conversationHistory}\n\n` +
    'Gere apenas a mensagem final de follow-up pronta para ser enviada.';
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Método não permitido' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const payload = (await req.json()) as FollowUpRequest;
    const leadName = normalizeValue(payload.leadName);
    const conversationHistory = normalizeValue(payload.conversationHistory);

    if (!leadName || !conversationHistory) {
      return new Response(
        JSON.stringify({ error: 'Parâmetros obrigatórios ausentes: leadName e conversationHistory.' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.error('[generate-follow-up] Missing Supabase environment variables');
      return new Response(
        JSON.stringify({ error: 'Configuração do servidor incompleta.' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);
    const { data: integration, error: integrationError } = await supabaseAdmin
      .from('integration_settings')
      .select('settings')
      .eq('slug', 'gpt_transcription')
      .maybeSingle();

    if (integrationError) {
      console.error('[generate-follow-up] Erro ao carregar integração GPT:', integrationError);
      return new Response(
        JSON.stringify({ error: 'Não foi possível acessar a configuração do GPT.' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    const apiKey = integration?.settings?.apiKey;
    const model = integration?.settings?.textModel || 'gpt-4o-mini';
    const customPrompt = integration?.settings?.followUpPrompt;
    const systemPrompt =
      typeof customPrompt === 'string' && customPrompt.trim() ? customPrompt.trim() : DEFAULT_SYSTEM_PROMPT;

    if (!apiKey || typeof apiKey !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Chave de API do GPT não configurada.' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    const openAiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.7,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: buildUserPrompt({
            leadName,
            conversationHistory,
            leadContext: payload.leadContext,
          }) },
        ],
      }),
    });

    if (!openAiResponse.ok) {
      const errorText = await openAiResponse.text();
      console.error('[generate-follow-up] OpenAI error:', errorText);
      return new Response(
        JSON.stringify({ error: 'Falha ao gerar follow-up.', details: errorText }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    const completion = await openAiResponse.json();
    const followUpText = completion?.choices?.[0]?.message?.content?.trim();

    if (!followUpText) {
      console.error('[generate-follow-up] Resposta inesperada da OpenAI', completion);
      return new Response(
        JSON.stringify({ error: 'Resposta do GPT vazia.' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    return new Response(JSON.stringify({ followUp: followUpText }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[generate-follow-up] Erro inesperado:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno ao gerar follow-up.' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
