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
  buildTranscriptLine,
  getChatLabel,
  getMessageContent,
  normalizeSystemTimeZone,
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

type CritiqueAttendanceBody = {
  chatId?: string;
};

type SystemSettingsRow = {
  company_name: string | null;
  timezone: string | null;
};

type CritiquePayload = {
  resumo: string;
  avaliacao_geral: 'excelente' | 'boa' | 'regular' | 'precisa_melhorar';
  pontos_fortes: string[];
  pontos_de_atencao: string[];
  erros: string[];
};

const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };
const MESSAGE_LOAD_LIMIT = 250;
const SESSION_GAP_MS = 6 * 60 * 60 * 1000;
const MAX_LIST_ITEMS = 8;
const MAX_ITEM_LENGTH = 220;
const MAX_SUMMARY_LENGTH = 600;
const AVALIACAO_OPTIONS: CritiquePayload['avaliacao_geral'][] = ['excelente', 'boa', 'regular', 'precisa_melhorar'];

const createAdminClient = () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) throw new Error('Credenciais do Supabase nao configuradas.');
  return createClient(supabaseUrl, serviceRoleKey);
};

const stripCodeFences = (value: string) => {
  let next = value.trim();
  if (next.startsWith('```')) {
    next = next.replace(/^```[a-zA-Z]*\s*/, '').replace(/```$/, '').trim();
  }
  return next;
};

const toStringList = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  const items: string[] = [];
  for (const entry of value) {
    if (typeof entry !== 'string') continue;
    const trimmed = entry.trim();
    if (!trimmed) continue;
    items.push(trimmed.length > MAX_ITEM_LENGTH ? `${trimmed.slice(0, MAX_ITEM_LENGTH - 1)}…` : trimmed);
    if (items.length >= MAX_LIST_ITEMS) break;
  }
  return items;
};

const parseCritiquePayload = (raw: string): CritiquePayload => {
  const cleaned = stripCodeFences(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error('A IA retornou uma analise em formato invalido.');
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('A IA retornou uma analise em formato invalido.');
  }

  const record = parsed as Record<string, unknown>;
  const resumoRaw = toTrimmedString(record.resumo);
  const resumo = resumoRaw.length > MAX_SUMMARY_LENGTH ? `${resumoRaw.slice(0, MAX_SUMMARY_LENGTH - 1)}…` : resumoRaw;
  const avaliacaoCandidate = toTrimmedString(record.avaliacao_geral).toLowerCase();
  const avaliacao_geral = (AVALIACAO_OPTIONS as string[]).includes(avaliacaoCandidate)
    ? (avaliacaoCandidate as CritiquePayload['avaliacao_geral'])
    : 'regular';

  return {
    resumo: resumo || 'Nenhum resumo retornado pela IA.',
    avaliacao_geral,
    pontos_fortes: toStringList(record.pontos_fortes),
    pontos_de_atencao: toStringList(record.pontos_de_atencao),
    erros: toStringList(record.erros),
  };
};

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

    const body = (await req.json().catch(() => ({}))) as CritiqueAttendanceBody;
    const chatId = toTrimmedString(body.chatId);

    if (!chatId) {
      return new Response(JSON.stringify({ error: 'Conversa obrigatoria para gerar a analise.' }), { status: 400, headers: jsonHeaders });
    }

    const chatRoute = await resolveCommWhatsAppCanonicalChatRouteByUuid(supabaseAdmin, chatId);
    if (!chatRoute?.chatId) {
      return new Response(JSON.stringify({ error: 'Conversa nao encontrada.' }), { status: 404, headers: jsonHeaders });
    }

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

    let leadData: LeadRow | null = null;
    if (chat.lead_id) {
      const { data: leadResult } = await supabaseAdmin
        .from('leads')
        .select('id, nome_completo, status, origem, responsavel, cidade, email')
        .eq('id', chat.lead_id)
        .maybeSingle();
      if (leadResult) leadData = leadResult as LeadRow;
    }

    const [messagesResult, systemSettingsResult] = await Promise.all([
      supabaseAdmin
        .from('comm_whatsapp_messages')
        .select('id, direction, message_type, delivery_status, text_content, message_at, media_caption, transcription_text')
        .eq('chat_id', chat.id)
        .order('message_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(MESSAGE_LOAD_LIMIT),
      supabaseAdmin.from('system_settings').select('company_name, timezone').limit(1).maybeSingle(),
    ]);

    if (messagesResult.error) throw new Error(`Erro ao carregar historico: ${messagesResult.error.message}`);
    if (systemSettingsResult.error) throw new Error(`Erro ao carregar configuracoes: ${systemSettingsResult.error.message}`);

    const systemSettings = (systemSettingsResult.data ?? null) as SystemSettingsRow | null;
    const timeZone = normalizeSystemTimeZone(systemSettings?.timezone);
    const companyName = toTrimmedString(systemSettings?.company_name) || 'Kifer Saude';
    const contactLabel = getChatLabel(chat, leadData);

    const messages = ((messagesResult.data ?? []) as MessageRow[]).slice().reverse();
    if (messages.length === 0) {
      return new Response(JSON.stringify({ error: 'Nao ha historico util suficiente para analisar.' }), { status: 400, headers: jsonHeaders });
    }

    // ---- Detect current attendance session (gap-based) ----

    let sessionStartIndex = 0;
    for (let i = messages.length - 1; i > 0; i -= 1) {
      const gap = new Date(messages[i].message_at).getTime() - new Date(messages[i - 1].message_at).getTime();
      if (gap >= SESSION_GAP_MS) {
        sessionStartIndex = i;
        break;
      }
    }

    const sessionMessages = messages.slice(sessionStartIndex);
    const sessionTranscriptLines = sessionMessages
      .map((message) => buildTranscriptLine(message, contactLabel, timeZone))
      .filter((line): line is string => Boolean(line));

    const hasAgentMessage = sessionMessages.some(
      (message) => message.direction === 'outbound' && Boolean(getMessageContent(message)),
    );

    if (!hasAgentMessage || sessionTranscriptLines.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Nao ha mensagens suas neste atendimento para analisar.' }),
        { status: 400, headers: jsonHeaders },
      );
    }

    const sessionStartedAt = sessionMessages[0].message_at;
    const sessionEndedAt = sessionMessages[sessionMessages.length - 1].message_at;
    const messageCount = sessionMessages.length;

    // ---- Build prompt ----

    const systemPrompt = [
      `Voce e um supervisor de qualidade (QA) que avalia atendimentos de vendas de plano de saude pelo WhatsApp na operacao ${companyName}.`,
      'Sua tarefa e avaliar APENAS o atendente humano, identificado como "VOCE" no historico. Nunca avalie o cliente.',
      'Baseie-se estritamente no historico fornecido. Nunca invente fatos, valores, prazos, documentos ou combinados que nao estejam no historico.',
      'Seja especifico: cite o que realmente foi dito, evite generalidades vagas.',
      'Responda somente em portugues do Brasil.',
      '',
      'Retorne SOMENTE um objeto JSON valido, sem markdown, sem crases, sem comentarios, no formato exato:',
      '{',
      '  "resumo": string (2 a 4 frases sobre o que aconteceu neste atendimento),',
      '  "avaliacao_geral": "excelente" | "boa" | "regular" | "precisa_melhorar",',
      '  "pontos_fortes": string[] (o que o atendente fez bem; lista vazia se nao houver nada a destacar),',
      '  "pontos_de_atencao": string[] (observacoes de melhoria, tom mais construtivo),',
      '  "erros": string[] (erros concretos: informacao errada, demora, pergunta ignorada, oportunidade perdida, tom inadequado; lista vazia se nao houver erros)',
      '}',
      'Cada item das listas deve ser uma frase curta e objetiva.',
    ].join('\n');

    const userPrompt = [
      '--- CONTEXTO DO CONTATO ---',
      `Nome: ${contactLabel}`,
      chat.phone_number ? `Telefone: ${chat.phone_number}` : null,
      leadData?.nome_completo ? `Lead: ${leadData.nome_completo}` : null,
      leadData?.status ? `Status lead: ${leadData.status}` : null,
      '',
      '--- SOBRE ESTA SESSAO ---',
      'Este e um recorte de UM atendimento especifico dentro de um relacionamento mais longo com o cliente.',
      `Inicio: ${sessionStartedAt}`,
      `Fim: ${sessionEndedAt}`,
      `Quantidade de mensagens: ${messageCount}`,
      '',
      '--- HISTORICO DESTE ATENDIMENTO ---',
      sessionTranscriptLines.join('\n'),
      '',
      '--- TAREFA ---',
      'Avalie como o atendente (VOCE) conduziu este atendimento especifico e retorne o JSON no formato pedido.',
    ].filter((line) => line !== null && line !== '').join('\n');

    const result = await generateTextWithRouting({
      supabaseAdmin,
      task: 'attendance_critique',
      systemPrompt,
      userPrompt,
      temperature: 0.3,
      maxTokens: 1100,
    });

    const critiquePayload = parseCritiquePayload(result.text);

    const { data: insertedRow, error: insertError } = await supabaseAdmin
      .from('comm_whatsapp_attendance_critiques')
      .insert({
        chat_id: chat.id,
        generated_by: authResult.user.profileId,
        provider: result.provider,
        model: result.model,
        session_started_at: sessionStartedAt,
        session_ended_at: sessionEndedAt,
        message_count: messageCount,
        critique: critiquePayload,
      })
      .select('id, chat_id, generated_by, generated_at, provider, model, session_started_at, session_ended_at, message_count, critique')
      .single();

    if (insertError) throw new Error(`Erro ao salvar analise: ${insertError.message}`);

    return new Response(JSON.stringify({
      success: true,
      critique: {
        id: insertedRow.id,
        chatId: insertedRow.chat_id,
        generatedBy: insertedRow.generated_by,
        generatedAt: insertedRow.generated_at,
        provider: insertedRow.provider,
        model: insertedRow.model,
        sessionStartedAt: insertedRow.session_started_at,
        sessionEndedAt: insertedRow.session_ended_at,
        messageCount: insertedRow.message_count,
        resumo: critiquePayload.resumo,
        avaliacaoGeral: critiquePayload.avaliacao_geral,
        pontosFortes: critiquePayload.pontos_fortes,
        pontosDeAtencao: critiquePayload.pontos_de_atencao,
        erros: critiquePayload.erros,
      },
    }), { status: 200, headers: jsonHeaders });
  } catch (error) {
    console.error('[comm-whatsapp-critique-attendance] erro inesperado', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno ao gerar analise do atendimento.' }),
      { status: 500, headers: jsonHeaders },
    );
  }
});
