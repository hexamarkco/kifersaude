import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { authorizeDashboardUser } from '../_shared/dashboard-auth.ts';
import { generateTextWithRouting } from '../_shared/ai-router.ts';
import { corsHeaders, toTrimmedString } from '../_shared/comm-whatsapp.ts';
import {
  buildStyleExamples,
  buildStyleProfile,
  buildStyleProfileText,
  type MessageRow,
} from '../_shared/comm-whatsapp-transcript.ts';

declare const Deno: {
  env: {
    get: (key: string) => string | undefined;
  };
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};

type RequestBody = {
  conversationId?: string;
};

type SandboxMessageRow = {
  role: 'lead' | 'ai';
  content: string;
};

const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };
const SANDBOX_HISTORY_LIMIT = 100;
const HANDOFF_TAG_REGEX = /\[\[HANDOFF:\s*([^\]]{1,200})\]\]\s*$/i;

const createAdminClient = () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) throw new Error('Credenciais do Supabase nao configuradas.');
  return createClient(supabaseUrl, serviceRoleKey);
};

const SYSTEM_PLAYBOOK = [
  'Voce e a assistente de atendimento da Kifer Saude no WhatsApp, atuando no lugar da corretora especialista em planos de saude.',
  'Esta e uma SIMULACAO interna: a pessoa do outro lado e um funcionario da propria operacao testando como voce se comportaria com um lead real. Trate a conversa exatamente como trataria um lead de verdade — nao quebre o personagem, nao mencione que e uma simulacao.',
  'Cada turno do LEAD que voce ve ja pode ser o resultado de varias mensagens picotadas que a pessoa mandou seguidas — trate tudo isso como uma unica fala antes de responder.',
  '',
  'ROTEIRO DE QUALIFICACAO (siga a ordem, mas adapte-se ao que o lead ja disse):',
  '1. Se for o primeiro contato do lead, cumprimente, se apresente rapidamente e pergunte se o plano e so para a pessoa ou para mais gente da familia.',
  '2. Se for familia: peça a idade de cada pessoa (incluindo quem esta falando).',
  '3. Pergunte a cidade onde mora. So pergunte o BAIRRO tambem se a cidade for Rio de Janeiro (capital) — a rede credenciada varia muito dentro do Rio, entao o bairro importa. Para qualquer outra cidade, o bairro e irrelevante para a cotacao: nao pergunte.',
  '4. Pergunte se ja tem plano de saude hoje (para avaliar aproveitamento de carencia) ou seria a primeira contratacao.',
  '5. Pergunte se tem CNPJ ou MEI (planos empresariais costumam sair mais em conta).',
  '6. So depois de ter idade(s), localizacao e a resposta sobre CNPJ/MEI voce esta pronta para montar a cotacao.',
  '',
  'REGRAS CRITICAS:',
  '- NUNCA repita uma pergunta cuja resposta ja esta no historico da conversa. Leia tudo antes de responder.',
  '- UMA pergunta por mensagem. Nao empilhe varias perguntas na mesma mensagem.',
  '- Se o lead chegar com um pedido especifico e direto (ex: "quero plano so para meu filho de 3 anos"), NAO force o roteiro completo do zero — adapte as perguntas ao que ele realmente precisa. Se ele recusar uma sugestao (ex: upsell para titular adulto), aceite a recusa e continue atendendo o pedido original dele, sem insistir.',
  '- Nunca invente valores de mensalidade, nomes de operadoras, coberturas, prazos ou redes credenciadas. Voce nao tem acesso ao sistema real de cotacao.',
  '- Quando a conversa chegar no ponto de montar/enviar a cotacao com valores reais, OU em qualquer momento que exija julgamento humano (negociacao de desconto, reclamacao, cancelamento, pedido fora do escopo de plano de saude, ou qualquer coisa que voce nao tenha informacao real para responder), responda de forma natural dizendo que vai verificar/retornar, e adicione ao FINAL da mensagem, em uma linha separada, exatamente: [[HANDOFF: motivo curto]] — troque "motivo curto" por uma frase curta explicando por que um humano precisa assumir. Essa tag nunca aparece para o lead, e so um marcador interno.',
  '- Fora dessas situacoes de handoff, NUNCA use a tag.',
  '',
  'ESTILO:',
  '- Escreva como uma pessoa de verdade no WhatsApp: mensagens curtas, diretas, sem parecer roteiro decorado.',
  '- Sem markdown, sem bullets, sem numeracao na sua resposta — texto corrido, como uma mensagem de WhatsApp normal.',
].join('\n');

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Metodo nao permitido' }), { status: 405, headers: jsonHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
    const supabaseAdmin = createAdminClient();

    const authResult = await authorizeDashboardUser({ req, supabaseUrl, supabaseAnonKey, supabaseAdmin });
    if (!authResult.authorized) {
      return new Response(JSON.stringify(authResult.body), { status: authResult.status, headers: jsonHeaders });
    }

    const body = (await req.json().catch(() => ({}))) as RequestBody;
    const conversationId = toTrimmedString(body.conversationId);

    if (!conversationId) {
      return new Response(JSON.stringify({ error: 'Conversa obrigatoria.' }), { status: 400, headers: jsonHeaders });
    }

    const { data: existing, error: existingError } = await supabaseAdmin
      .from('ai_sandbox_conversations')
      .select('id')
      .eq('id', conversationId)
      .maybeSingle();
    if (existingError) throw new Error(`Erro ao carregar conversa: ${existingError.message}`);
    if (!existing) {
      return new Response(JSON.stringify({ error: 'Conversa nao encontrada.' }), { status: 404, headers: jsonHeaders });
    }

    // ---- Load full sandbox history + real style examples in parallel ----

    const [historyResult, styleMessagesResult] = await Promise.all([
      supabaseAdmin
        .from('ai_sandbox_messages')
        .select('role, content')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .limit(SANDBOX_HISTORY_LIMIT),
      supabaseAdmin
        .from('comm_whatsapp_messages')
        .select('id, direction, message_type, delivery_status, text_content, message_at, media_caption, transcription_text')
        .eq('direction', 'outbound')
        .eq('message_type', 'text')
        .neq('delivery_status', 'failed')
        .not('text_content', 'is', null)
        .order('message_at', { ascending: false })
        .limit(120),
    ]);

    if (historyResult.error) throw new Error(`Erro ao carregar historico: ${historyResult.error.message}`);

    const history = (historyResult.data ?? []) as SandboxMessageRow[];
    if (history.length === 0 || history[history.length - 1].role !== 'lead') {
      return new Response(JSON.stringify({ error: 'Nao ha mensagem do lead pendente de resposta.' }), { status: 400, headers: jsonHeaders });
    }

    const transcriptLines = history.map((row) => `${row.role === 'lead' ? 'LEAD' : 'VOCE'}: ${row.content}`);

    const styleMessages = (styleMessagesResult.data ?? []) as MessageRow[];
    const styleProfileText = styleMessagesResult.error ? '' : buildStyleProfileText(buildStyleProfile(styleMessages));
    const styleExamples = styleMessagesResult.error ? [] : buildStyleExamples(styleMessages);

    const systemPrompt = [
      SYSTEM_PLAYBOOK,
      '',
      styleProfileText ? `${styleProfileText}\n` : '',
      styleExamples.length > 0
        ? `EXEMPLOS REAIS DO SEU ESTILO (copie o padrao de escrita, nunca o conteudo):\n${styleExamples.map((text, i) => `${i + 1}. ${text}`).join('\n')}`
        : '',
    ].filter(Boolean).join('\n');

    const userPrompt = [
      '--- CONVERSA ATE AGORA (LEAD = pessoa simulando o cliente, VOCE = suas respostas anteriores) ---',
      transcriptLines.join('\n'),
      '',
      '--- TAREFA ---',
      'Gere a proxima resposta, como VOCE, para a ultima mensagem do LEAD.',
    ].join('\n');

    const result = await generateTextWithRouting({
      supabaseAdmin,
      task: 'autonomous_attendance',
      systemPrompt,
      userPrompt,
      temperature: 0.6,
      maxTokens: 350,
    });

    let replyText = result.text.trim();
    let handoffReason: string | null = null;
    const handoffMatch = replyText.match(HANDOFF_TAG_REGEX);
    if (handoffMatch) {
      handoffReason = handoffMatch[1].trim();
      replyText = replyText.slice(0, handoffMatch.index).trim();
    }

    if (!replyText) throw new Error('A IA nao retornou uma resposta valida.');

    const { error: insertAiError } = await supabaseAdmin
      .from('ai_sandbox_messages')
      .insert({
        conversation_id: conversationId,
        role: 'ai',
        content: replyText,
        handoff_reason: handoffReason,
        provider: result.provider,
        model: result.model,
      });
    if (insertAiError) throw new Error(`Erro ao salvar resposta da IA: ${insertAiError.message}`);

    await supabaseAdmin
      .from('ai_sandbox_conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId);

    return new Response(JSON.stringify({
      success: true,
      conversationId,
      reply: replyText,
      handoffReason,
      provider: result.provider,
      model: result.model,
      fallbackUsed: result.fallbackUsed,
    }), { status: 200, headers: jsonHeaders });
  } catch (error) {
    console.error('[ai-sandbox-chat] erro inesperado', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno ao gerar resposta.' }),
      { status: 500, headers: jsonHeaders },
    );
  }
});
