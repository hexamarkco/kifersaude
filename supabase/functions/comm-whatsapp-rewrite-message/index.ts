// @ts-expect-error Deno npm import
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.57.4';
import { authorizeDashboardUser } from '../_shared/dashboard-auth.ts';
import { generateTextWithRouting } from '../_shared/ai-router.ts';
import { COMM_WHATSAPP_MODULE, corsHeaders, toTrimmedString } from '../_shared/comm-whatsapp.ts';

declare const Deno: {
  env: {
    get: (key: string) => string | undefined;
  };
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};

type RewriteTone = 'grammar' | 'professional' | 'friendly' | 'shorter' | 'assertive' | 'adapt_context';

type RewriteMessageBody = {
  message?: string;
  chatId?: string | null;
  tone?: string;
  customInstructions?: string;
};

const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };

const createAdminClient = () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Credenciais do Supabase nao configuradas.');
  }

  return createClient(supabaseUrl, serviceRoleKey);
};

const isRewriteTone = (value: string): value is RewriteTone =>
  value === 'grammar' || value === 'professional' || value === 'friendly' || value === 'shorter' || value === 'assertive' || value === 'adapt_context';

const getToneInstruction = (tone: RewriteTone) => {
  switch (tone) {
    case 'professional':
      return 'Deixe a mensagem mais profissional, clara e bem estruturada, sem soar fria ou robotica.';
    case 'friendly':
      return 'Deixe a mensagem mais amigavel, calorosa e natural, sem perder clareza.';
    case 'shorter':
      return 'Deixe a mensagem mais curta, objetiva e facil de ler, preservando os pontos essenciais.';
    case 'assertive':
      return 'Deixe a mensagem mais objetiva e confiante, sem ficar agressiva ou rispida.';
    case 'adapt_context':
      return 'Adapte a mensagem ao contexto recente da conversa: ajuste singular/plural, nomes, referencias, combinados e momento atual. Use apenas fatos confirmados no historico. Se o contexto nao justificar mudanca, preserve a mensagem quase igual e corrija apenas clareza.';
    case 'grammar':
    default:
      return 'Corrija gramatica, ortografia, pontuacao e clareza, mantendo o mesmo sentido e o tom original.';
  }
};

async function loadConversationContext(supabaseAdmin: SupabaseClient, chatId: string) {
  const normalizedChatId = toTrimmedString(chatId);
  if (!normalizedChatId) {
    return '';
  }

  const { data, error } = await supabaseAdmin
    .from('comm_whatsapp_messages')
    .select('direction,message_type,delivery_status,text_content,media_caption,transcription_text,message_at,sender_name')
    .eq('chat_id', normalizedChatId)
    .neq('delivery_status', 'deleted')
    .order('message_at', { ascending: false })
    .limit(24);

  if (error) {
    throw new Error(`Erro ao carregar contexto da conversa: ${error.message}`);
  }

  return (data ?? [])
    .reverse()
    .map((message) => {
      const direction = toTrimmedString(message.direction) === 'outbound' ? 'Atendente' : 'Cliente';
      const author = toTrimmedString(message.sender_name) || direction;
      const content = toTrimmedString(message.text_content)
        || toTrimmedString(message.media_caption)
        || toTrimmedString(message.transcription_text)
        || `[${toTrimmedString(message.message_type) || 'midia'}]`;
      return `${message.message_at ?? ''} ${author}: ${content}`.trim();
    })
    .filter(Boolean)
    .join('\n');
}

const sanitizeGeneratedText = (value: string) => {
  let next = value.trim();

  if (next.startsWith('```') && next.endsWith('```')) {
    next = next.replace(/^```[a-zA-Z]*\s*/, '').replace(/```$/, '').trim();
  }

  if (
    (next.startsWith('"') && next.endsWith('"'))
    || (next.startsWith("'") && next.endsWith("'"))
    || (next.startsWith('“') && next.endsWith('”'))
  ) {
    next = next.slice(1, -1).trim();
  }

  return next;
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Metodo nao permitido' }), {
      status: 405,
      headers: jsonHeaders,
    });
  }

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
      requiredPermission: 'edit',
    });

    if (!authResult.authorized) {
      return new Response(JSON.stringify(authResult.body), {
        status: authResult.status,
        headers: jsonHeaders,
      });
    }

    const body = (await req.json().catch(() => ({}))) as RewriteMessageBody;
    const message = String(body.message ?? '');
    const trimmedMessage = message.trim();
    const customInstructions = toTrimmedString(body.customInstructions);
    const chatId = toTrimmedString(body.chatId);
    const toneCandidate = toTrimmedString(body.tone).toLowerCase();
    const tone = isRewriteTone(toneCandidate) ? toneCandidate : 'grammar';

    if (!trimmedMessage) {
      return new Response(JSON.stringify({ error: 'Digite uma mensagem para reescrever.' }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    const conversationContext = tone === 'adapt_context' ? await loadConversationContext(supabaseAdmin, chatId) : '';

    const systemPrompt = [
      'Voce reescreve mensagens para envio no WhatsApp.',
      'Retorne apenas a mensagem final pronta para enviar, sem aspas, sem markdown, sem titulos e sem explicacoes.',
      'Preserve a intencao, fatos, datas, numeros, valores, nomes, links, emojis relevantes, placeholders {{variavel}} e quebras de linha uteis.',
      'Nao invente informacoes novas, nao mude combinados e nao remova contexto importante sem necessidade.',
      'Mantenha o idioma original da mensagem, salvo se as instrucoes pedirem o contrario.',
      getToneInstruction(tone),
      conversationContext ? `Contexto recente da conversa para adaptar a mensagem:\n${conversationContext}` : '',
      customInstructions ? `Instrucoes extras desta reescrita:\n${customInstructions}` : '',
    ]
      .filter(Boolean)
      .join('\n\n');

    const userPrompt = [
      'Mensagem original:',
      trimmedMessage,
      '',
      'Tarefa:',
      tone === 'adapt_context'
        ? 'Adapte a mensagem acima ao contexto recente da conversa, sem inventar informacoes e mantendo o texto pronto para colar no composer do WhatsApp.'
        : 'Reescreva a mensagem acima seguindo as instrucoes do sistema e mantendo o texto pronto para colar no composer do WhatsApp.',
    ].join('\n');

    const result = await generateTextWithRouting({
      supabaseAdmin,
      task: 'rewrite_message',
      systemPrompt,
      userPrompt,
      temperature: tone === 'grammar' || tone === 'adapt_context' ? 0.2 : 0.45,
      maxTokens: 420,
    });

    const rewrittenText = sanitizeGeneratedText(result.text);
    if (!rewrittenText) {
      throw new Error('A IA nao retornou uma reescrita valida.');
    }

    return new Response(JSON.stringify({
      success: true,
      text: rewrittenText,
      provider: result.provider,
      model: result.model,
      fallback_used: result.fallbackUsed,
    }), {
      status: 200,
      headers: jsonHeaders,
    });
  } catch (error) {
    console.error('[comm-whatsapp-rewrite-message] erro inesperado', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno ao reescrever mensagem.' }),
      {
        status: 500,
        headers: jsonHeaders,
      },
    );
  }
});
