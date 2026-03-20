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

const AI_FOLLOW_UP_PROMPT_SLUG = 'ai_follow_up_prompt';
const BRASILIA_TIMEZONE = 'America/Sao_Paulo';
const MAX_LEAD_NAME_LENGTH = 120;
const MAX_CONVERSATION_HISTORY_LENGTH = 40000;
const MAX_EXTRA_INSTRUCTIONS_LENGTH = 4000;
const MAX_LEAD_CONTEXT_LENGTH = 12000;

const jsonResponse = (body: Record<string, unknown>, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

type FollowUpRequest = {
  leadName?: string;
  conversationHistory?: string;
  leadContext?: Record<string, unknown> | string;
  extraInstructions?: string;
};

const BASE_SYSTEM_PROMPT = `Voce e um assistente de follow-up comercial em portugues do Brasil.
Gere mensagens curtas, personalizadas, humanas e persuasivas.

Sempre siga estas diretrizes:
- Analise todo o historico fornecido para entender perguntas, propostas e respostas, inclusive ausencia delas.
- Adapte o tom ao comportamento do cliente (engajado, frio, indeciso, com objecoes, sumido, etc.).
- Resolva objecoes claras antes de avancar para a venda.
- Espelhe a linguagem do cliente e use copywriting com moderacao.
- Estrutura recomendada: abertura com nome + contexto breve + beneficios objetivos + CTA clara.
- Seja respeitoso e direto; nao use jargoes tecnicos nem textos longos.
- Inclua chamadas praticas como "Me responde por aqui" ou "Podemos retomar de onde paramos".
- Mantenha o foco em solucoes e seguranca do cliente.
- Se nao houver historico, sugira um primeiro contato leve e convidativo.
- Quando fizer sentido, entregue o follow-up em multiplas linhas curtas.
- Cada linha nao vazia sera tratada como uma mensagem separada no WhatsApp.
- Nao use numeracao, bullets, aspas de abertura/fechamento nem observacoes fora da mensagem final.`;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const normalizeValue = (value: unknown): string => {
  if (typeof value === 'string') return value.trim();
  if (value === null || value === undefined) return '';
  try {
    return JSON.stringify(value);
  } catch {
    return '';
  }
};

const formatRuntimeDate = (date: Date, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('pt-BR', {
    timeZone: BRASILIA_TIMEZONE,
    ...options,
  }).format(date);

const extractFirstName = (name: string) => {
  const trimmed = name.trim();
  if (!trimmed) return '';
  return trimmed.split(/\s+/)[0] || '';
};

const buildInstructionVariables = (leadName: string) => {
  const now = new Date();
  const firstName = extractFirstName(leadName);

  return new Map<string, string>([
    ['nome', leadName],
    ['primeiro_nome', firstName],
    ['data_hoje', formatRuntimeDate(now, { day: '2-digit', month: '2-digit', year: 'numeric' })],
    ['hora_agora', formatRuntimeDate(now, { hour: '2-digit', minute: '2-digit', hour12: false })],
    [
      'data_hora_atual_brasilia',
      formatRuntimeDate(now, {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }),
    ],
    ['fuso_horario', 'America/Sao_Paulo'],
    ['cidade_horario', 'Brasilia'],
  ]);
};

const applyInstructionVariables = (text: string, leadName: string) => {
  if (!text.trim()) return '';

  const variables = buildInstructionVariables(leadName);
  return text.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (fullMatch, token) => {
    const resolved = variables.get(String(token).toLowerCase());
    return typeof resolved === 'string' && resolved.trim() ? resolved : fullMatch;
  });
};

const splitFollowUpMessages = (text: string) =>
  text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

const loadCustomInstructions = async (supabaseAdmin: ReturnType<typeof createClient>) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('integration_settings')
      .select('settings')
      .eq('slug', AI_FOLLOW_UP_PROMPT_SLUG)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.warn('[generate-follow-up] Nao foi possivel carregar instrucoes customizadas', error);
      return '';
    }

    const settings = isRecord(data?.settings) ? data.settings : {};
    return typeof settings.instructions === 'string' ? settings.instructions.trim() : '';
  } catch (error) {
    console.warn('[generate-follow-up] Falha ao ler instrucoes customizadas', error);
    return '';
  }
};

const buildSystemPrompt = (customInstructions: string, leadName: string) => {
  if (!customInstructions) {
    return BASE_SYSTEM_PROMPT;
  }

  const resolvedInstructions = applyInstructionVariables(customInstructions, leadName);

  return `${BASE_SYSTEM_PROMPT}

Instrucoes adicionais da operacao:
${resolvedInstructions}`;
};

const buildUserPrompt = (
  payload: Required<Pick<FollowUpRequest, 'leadName' | 'conversationHistory'>> & FollowUpRequest,
) => {
  const leadContext = normalizeValue(payload.leadContext);
  const extraInstructions = normalizeValue(payload.extraInstructions);
  const conversationHistory = payload.conversationHistory || '(sem historico relevante carregado)';

  return `Nome do cliente: ${payload.leadName}

${leadContext ? `Contexto do lead:\n${leadContext}\n\n` : ''}${extraInstructions ? `Orientacoes extras desta geracao:\n${extraInstructions}\n\n` : ''}Historico completo da conversa:
${conversationHistory}

${extraInstructions ? 'Leve em conta as orientacoes extras sem contradizer o historico e sem inventar informacoes nao fornecidas.\n' : ''}Gere apenas o follow-up final pronto para envio.
Se usar mais de uma mensagem, separe cada mensagem com uma quebra de linha.
Nao inclua numeracao, titulos ou comentarios extras.`;
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
      console.error('[generate-follow-up] Missing Supabase environment variables');
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

    const payload = (await req.json().catch(() => null)) as FollowUpRequest | null;
    const leadName = (normalizeValue(payload?.leadName) || 'Cliente').slice(0, MAX_LEAD_NAME_LENGTH);
    const conversationHistory = normalizeValue(payload?.conversationHistory);
    const normalizedExtraInstructions = normalizeValue(payload?.extraInstructions);
    const normalizedLeadContext = normalizeValue(payload?.leadContext);

    if (conversationHistory.length > MAX_CONVERSATION_HISTORY_LENGTH) {
      return jsonResponse({ error: 'Historico da conversa excede o limite permitido.' }, 400);
    }

    if (normalizedExtraInstructions.length > MAX_EXTRA_INSTRUCTIONS_LENGTH) {
      return jsonResponse({ error: 'As instrucoes extras excedem o limite permitido.' }, 400);
    }

    if (normalizedLeadContext.length > MAX_LEAD_CONTEXT_LENGTH) {
      return jsonResponse({ error: 'O contexto do lead excede o limite permitido.' }, 400);
    }

    const customInstructions = await loadCustomInstructions(supabaseAdmin);
    const generationResult = await generateTextWithRouting({
      supabaseAdmin,
      task: 'follow_up_generation',
      systemPrompt: buildSystemPrompt(customInstructions, leadName),
      userPrompt: buildUserPrompt({
        leadName,
        conversationHistory,
        leadContext: normalizedLeadContext,
        extraInstructions: normalizedExtraInstructions,
      }),
      temperature: 0.7,
      maxTokens: 900,
    });

    const followUpText = generationResult.text.trim();

    if (!followUpText) {
      console.error('[generate-follow-up] Resposta inesperada do provedor de IA', generationResult);
      return jsonResponse({ error: 'Resposta da IA vazia.' }, 500);
    }

    console.log('[generate-follow-up] Follow-up gerado', {
      provider: generationResult.provider,
      model: generationResult.model,
      fallbackUsed: generationResult.fallbackUsed,
      hasCustomInstructions: Boolean(customInstructions),
      hasExtraInstructions: Boolean(normalizedExtraInstructions),
    });

    return jsonResponse({
        followUp: followUpText,
        messages: splitFollowUpMessages(followUpText),
        provider: generationResult.provider,
        model: generationResult.model,
      }, 200);
  } catch (error) {
    console.error('[generate-follow-up] Erro inesperado:', error);
    return jsonResponse({ error: 'Erro interno ao gerar follow-up.' }, 500);
  }
});
