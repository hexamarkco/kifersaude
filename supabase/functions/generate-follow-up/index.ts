import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { generateTextWithRouting } from '../_shared/ai-router.ts';

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

const SYSTEM_PROMPT = `Você é um assistente de follow-up comercial em português do Brasil.
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
    const generationResult = await generateTextWithRouting({
      supabaseAdmin,
      task: 'follow_up_generation',
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: buildUserPrompt({
        leadName,
        conversationHistory,
        leadContext: payload.leadContext,
      }),
      temperature: 0.7,
      maxTokens: 900,
    });

    const followUpText = generationResult.text.trim();

    if (!followUpText) {
      console.error('[generate-follow-up] Resposta inesperada do provedor de IA', generationResult);
      return new Response(
          JSON.stringify({ error: 'Resposta da IA vazia.' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    console.log('[generate-follow-up] Follow-up gerado', {
      provider: generationResult.provider,
      model: generationResult.model,
      fallbackUsed: generationResult.fallbackUsed,
    });

    return new Response(
      JSON.stringify({
        followUp: followUpText,
        provider: generationResult.provider,
        model: generationResult.model,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
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
