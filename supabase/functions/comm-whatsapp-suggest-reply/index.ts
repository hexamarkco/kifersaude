import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { authorizeDashboardUser } from '../_shared/dashboard-auth.ts';
import { generateTextWithRouting } from '../_shared/ai-router.ts';
import {
  COMM_WHATSAPP_MODULE,
  corsHeaders,
  resolveCommWhatsAppCanonicalChatRouteByUuid,
  toTrimmedString,
} from '../_shared/comm-whatsapp.ts';
import {
  buildStyleExamples,
  buildStyleProfile,
  buildStyleProfileText,
  buildTranscriptLine,
  getChatLabel,
  getMessageContent,
  normalizeSystemTimeZone,
  STYLE_SAMPLE_LIMIT,
  type ChatRow,
  type LeadRow,
  type MessageRow,
} from '../_shared/comm-whatsapp-transcript.ts';

declare const Deno: {
  env: {
    get: (key: string) => string | undefined;
  };
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};

type SuggestReplyBody = {
  chatId?: string;
  composerDraft?: string;
  mode?: string;
};

type SystemSettingsRow = {
  company_name: string | null;
  timezone: string | null;
};

const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };
const CHAT_CONTEXT_LIMIT = 80;
const AI_REPLY_SUGGESTION_SLUG = 'ai_reply_suggestion_prompt';

const createAdminClient = () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) throw new Error('Credenciais do Supabase nao configuradas.');
  return createClient(supabaseUrl, serviceRoleKey);
};

const sanitizeGeneratedText = (value: string) => {
  let next = value.trim();
  if (next.startsWith('```') && next.endsWith('```')) {
    next = next.replace(/^```[a-zA-Z]*\s*/, '').replace(/```$/, '').trim();
  }
  if (
    (next.startsWith('"') && next.endsWith('"'))
    || (next.startsWith("'") && next.endsWith("'"))
    || (next.startsWith('\u201c') && next.endsWith('\u201d'))
  ) {
    next = next.slice(1, -1).trim();
  }
  return next;
};

// ---- Context Extraction ----

const extractConversationContext = (transcriptLines: string[], contactLabel: string) => {
  const fullText = transcriptLines.join('\n').toLowerCase();
  const last10Lines = transcriptLines.slice(-10).join('\n').toLowerCase();

  const productPatterns = [
    /plano\s+de\s+sa[uú]de/i, /plano\s+sa[uú]de/i, /plano\s+ambulatorial/i,
    /plano\s+hospitalar/i, /plano\s+referencia/i, /plano\s+empresarial/i,
    /plano\s+individual/i, /plano\s+familiar/i, /plano\s+ades[aã]o/i,
    /seguro\s+de\s+vida/i, /seguro\s+sa[uú]de/i, /coparticipacao/i,
    /enfermaria/i, /apartamento/i, /acomodacao/i, /carência|carencia/i,
    /mensalidade/i, /valor\s+do\s+plano/i, /preco|preço|valor/i,
    /unimed|bradesco|amil|sulamerica|notre|dame|porto\s+segu/i,
    /hospitais|laboratorio|cobertura/i,
  ];
  const mentionedProducts = productPatterns
    .filter((p) => p.test(fullText))
    .map((p) => p.source)
    .slice(0, 5);

  const lastUserLine = [...transcriptLines].reverse()
    .find((line) => line.includes(contactLabel));
  const lastTopic = lastUserLine
    ? lastUserLine.replace(/\[[\d:,/\s]+\]\s*(?:Cliente|Lead|Pessoa):\s*/i, '').slice(0, 200)
    : null;

  const objectionPatterns = [
    /caro|cara|custar|muito\s+caro|muito\s+alto|pesado|pesada|nao\s+sei|nao\s+tenho/i,
    /preciso\s+pensar|vou\s+ver|deixa\s+eu\s+ver|preciso\s+consultar|vou\s+analisar/i,
    /nao\s+quero|nao\s+estou|sem\s+condicoes|sem\s+condições|nao\s+agora/i,
  ];
  const objections = objectionPatterns
    .filter((p) => p.test(last10Lines))
    .map((p) => p.source)
    .slice(0, 3);

  let stage = 'inicio';
  if (objections.length > 0) stage = 'objeção';
  else if (/proposta|simular|cotar|cotação|cotacao|valor|preco|preço|mensalidade|quanto\s+custa/i.test(fullText)) stage = 'apresentacao_valores';
  else if (/vou\s+levar|quero\s+contratar|fechar|aceitar|vou\s+sim|pode\s+fechar|bora|vamos\s+fechar/i.test(last10Lines)) stage = 'fechamento';
  else if (/documento|enviar\s+documento|preciso\s+de|qual\s+documento|ficha|cadastro|contrato|assin/i.test(last10Lines)) stage = 'documentacao';
  else if (/obrigado|obrigada|so\s+isso|era\s+isso|entendi|valeu|thanks|brigado/i.test(last10Lines)) stage = 'encerramento';
  else if (transcriptLines.length <= 4) stage = 'primeiro_contato';

  return {
    mentionedProducts,
    lastTopic,
    objections,
    stage,
  };
};

// ---- Prompt helpers ----

const buildContextExtractText = (context: {
  mentionedProducts: string[];
  lastTopic: string | null;
  objections: string[];
  stage: string;
}): string => {
  const parts: string[] = ['Contexto extraido da conversa:'];
  parts.push(`- Estagio: ${context.stage}`);
  if (context.mentionedProducts.length > 0) parts.push(`- Produtos/planos mencionados: ${context.mentionedProducts.join(', ')}`);
  if (context.lastTopic) parts.push(`- Ultimo topico do cliente: "${context.lastTopic}"`);
  if (context.objections.length > 0) parts.push(`- Objecoes detectadas: ${context.objections.join(', ')}`);
  return parts.join('\n');
};

// ---- Main handler ----

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Metodo nao permitido' }), { status: 405, headers: jsonHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
    const supabaseAdmin = createAdminClient();

    const authResult = await authorizeDashboardUser({
      req, supabaseUrl, supabaseAnonKey, supabaseAdmin,
      module: COMM_WHATSAPP_MODULE, requiredPermission: 'view',
    });
    if (!authResult.authorized) {
      return new Response(JSON.stringify(authResult.body), { status: authResult.status, headers: jsonHeaders });
    }

    const body = (await req.json().catch(() => ({}))) as SuggestReplyBody;
    const chatId = toTrimmedString(body.chatId);
    const composerDraft = toTrimmedString(body.composerDraft).slice(0, 1800);
    const mode = toTrimmedString(body.mode) === 'complete_draft' || composerDraft ? 'complete_draft' : 'suggest_reply';

    if (!chatId) {
      return new Response(JSON.stringify({ error: 'Conversa obrigatoria para sugerir resposta.' }), { status: 400, headers: jsonHeaders });
    }

    const chatRoute = await resolveCommWhatsAppCanonicalChatRouteByUuid(supabaseAdmin, chatId);
    if (!chatRoute?.chatId) {
      return new Response(JSON.stringify({ error: 'Conversa nao encontrada.' }), { status: 404, headers: jsonHeaders });
    }

    // ---- Load chat ----

    const { data: chatData, error: chatError } = await supabaseAdmin
      .from('comm_whatsapp_chats')
      .select('id, phone_number, display_name, saved_contact_name, push_name, lead_id')
      .eq('id', chatRoute.chatId)
      .maybeSingle();

    if (chatError) throw new Error(`Erro ao localizar conversa: ${chatError.message}`);
    if (!chatData) {
      return new Response(JSON.stringify({ error: 'Conversa nao encontrada.' }), { status: 404, headers: jsonHeaders });
    }

    const chat = chatData as ChatRow;

    // ---- Load lead data if available ----

    let leadData: LeadRow | null = null;
    if (chat.lead_id) {
      const { data: leadResult } = await supabaseAdmin
        .from('leads')
        .select('id, nome_completo, status, origem, responsavel, cidade, email')
        .eq('id', chat.lead_id)
        .maybeSingle();
      if (leadResult) leadData = leadResult as LeadRow;
    }

    // ---- Parallel data loading ----

    const [messagesResult, styleMessagesResult, systemSettingsResult, promptIntegrationResult] = await Promise.all([
      supabaseAdmin
        .from('comm_whatsapp_messages')
        .select('id, direction, message_type, delivery_status, text_content, message_at, media_caption, transcription_text')
        .eq('chat_id', chat.id)
        .order('message_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(CHAT_CONTEXT_LIMIT),
      supabaseAdmin
        .from('comm_whatsapp_messages')
        .select('id, direction, message_type, delivery_status, text_content, message_at, media_caption, transcription_text')
        .eq('direction', 'outbound')
        .eq('message_type', 'text')
        .neq('delivery_status', 'failed')
        .not('text_content', 'is', null)
        .order('message_at', { ascending: false })
        .limit(STYLE_SAMPLE_LIMIT),
      supabaseAdmin.from('system_settings').select('company_name, timezone').limit(1).maybeSingle(),
      supabaseAdmin
        .from('integration_settings')
        .select('settings')
        .eq('slug', AI_REPLY_SUGGESTION_SLUG)
        .maybeSingle(),
    ]);

    if (messagesResult.error) throw new Error(`Erro ao carregar historico: ${messagesResult.error.message}`);
    if (styleMessagesResult.error) throw new Error(`Erro ao carregar exemplos: ${styleMessagesResult.error.message}`);
    if (systemSettingsResult.error) throw new Error(`Erro ao carregar configuracoes: ${systemSettingsResult.error.message}`);

    const systemSettings = (systemSettingsResult.data ?? null) as SystemSettingsRow | null;
    const timeZone = normalizeSystemTimeZone(systemSettings?.timezone);
    const companyName = toTrimmedString(systemSettings?.company_name) || 'Kifer Saude';
    const contactLabel = getChatLabel(chat, leadData);

    // ---- Configurable prompt ----

    const promptIntegration = promptIntegrationResult.data as { settings?: Record<string, unknown> } | null;
    const promptSettings = (promptIntegration?.settings ?? {}) as Record<string, unknown>;
    const configuredInstructions = toTrimmedString(promptSettings.instructions);

    // ---- Build chat transcript ----

    const messages = ((messagesResult.data ?? []) as MessageRow[]).slice().reverse();
    const transcriptLines = messages
      .map((message) => buildTranscriptLine(message, contactLabel, timeZone))
      .filter((line): line is string => Boolean(line));

    if (transcriptLines.length === 0) {
      return new Response(JSON.stringify({ error: 'Nao ha historico util suficiente.' }), { status: 400, headers: jsonHeaders });
    }

    // ---- Style analysis ----

    const styleMessages = ((styleMessagesResult.data ?? []) as MessageRow[]);
    const styleProfile = buildStyleProfile(styleMessages);
    const styleExamples = buildStyleExamples(styleMessages);

    // ---- Context extraction ----

    const conversationContext = extractConversationContext(transcriptLines, contactLabel);
    const lastUsefulMessage = [...messages].reverse().find((message) => Boolean(getMessageContent(message))) ?? null;
    const lastDirection = lastUsefulMessage?.direction ?? null;

    // ---- Build style profile text ----

    const styleProfileText = buildStyleProfileText(styleProfile);
    const contextExtractText = buildContextExtractText(conversationContext);

    // ---- Build prompt ----

    const systemPrompt = [
      `Voce sugere respostas prontas para o WhatsApp da operacao ${companyName}.`,
      'A resposta deve soar NATURAL, como se fosse escrita por um humano — jamais como texto gerado por IA.',
      '',
      'REGRAS DE ESTILO (aprendidas do historico real de mensagens da operacao):',
      styleProfileText,
      '',
      'REGRAS DE CONDUTA:',
      '- MENSAGEM UNICA: retorne UMA unica mensagem pronta para enviar. Sem versoes, sem alternativas, sem marcacao.',
      '- NUNCA use listas, bullets ou checklists para coletar dados. Uma unica pergunta por vez.',
      '- Seja curta e objetiva. Nao antecipe etapas nem faca roteiro completo.',
      '- Use o nome do lead se fizer sentido. Nao force.',
      '- Nao invente valores, coberturas, prazos, documentos ou combinados que nao estejam no historico.',
      '- Se faltar informacao para avancar, faca UMA pergunta objetiva — a mais importante agora.',
      '- Retorne SOMENTE o texto final. Sem markdown, sem aspas, sem titulo, sem explicacao.',
      mode === 'complete_draft'
        ? '- MODE: complete_draft — o usuario ja comecou a digitar. Complete ou refine o rascunho mantendo a intencao original.'
        : '- MODE: suggest_reply — sugira a melhor proxima resposta. Se a ultima for sua, gere acompanhamento natural. Senao, responda ao cliente.',
    ].join('\n');

    const userPrompt = [
      '--- CONTEXTO DO CONTATO ---',
      `Nome: ${contactLabel}`,
      chat.phone_number ? `Telefone: ${chat.phone_number}` : null,
      leadData?.nome_completo ? `Lead: ${leadData.nome_completo}` : null,
      leadData?.status ? `Status lead: ${leadData.status}` : null,
      leadData?.cidade ? `Cidade: ${leadData.cidade}` : null,
      `Ultima mensagem de: ${lastDirection === 'inbound' ? contactLabel : lastDirection === 'outbound' ? 'VOCE' : 'N/A'}`,
      '',
      '--- CONTEXTO EXTRAIDO DA CONVERSA ---',
      contextExtractText,
      '',
      '--- HISTORICO RECENTE DO CHAT ---',
      transcriptLines.join('\n'),
      '',
      styleExamples.length > 0
        ? '--- EXEMPLOS REAIS DO SEU ESTILO (copie o padrao, nao o conteudo) ---\n' + styleExamples.map((text, i) => `${i + 1}. ${text}`).join('\n')
        : null,
      '',
      configuredInstructions
        ? '--- INSTRUCOES PERSONALIZADAS DA OPERACAO ---\n' + configuredInstructions
        : null,
      '',
      composerDraft
        ? '--- RASCUNHO ATUAL ---\n' + composerDraft
        : null,
      '',
      '--- TAREFA ---',
      mode === 'complete_draft'
        ? 'Gere uma versao final refinada que incorpore o rascunho acima. Mantenha o tom e o estilo da operacao.'
        : 'Gere a melhor proxima resposta para este lead. Use os detalhes CONCRETOS do historico. A resposta deve fazer sentido UNICAMENTE para esta conversa.',
    ].filter((line) => line !== null && line !== '').join('\n');

    const result = await generateTextWithRouting({
      supabaseAdmin,
      task: 'follow_up_generation',
      systemPrompt,
      userPrompt,
      temperature: composerDraft ? 0.4 : 0.65,
      maxTokens: 420,
    });

    const text = sanitizeGeneratedText(result.text);
    if (!text) throw new Error('A IA nao retornou uma sugestao valida.');

    return new Response(JSON.stringify({
      success: true,
      text,
      mode,
      provider: result.provider,
      model: result.model,
      fallback_used: result.fallbackUsed,
    }), { status: 200, headers: jsonHeaders });
  } catch (error) {
    console.error('[comm-whatsapp-suggest-reply] erro inesperado', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno ao sugerir resposta.' }),
      { status: 500, headers: jsonHeaders },
    );
  }
});
