// @ts-expect-error Deno npm import
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { authorizeDashboardUser } from '../_shared/dashboard-auth.ts';
import { generateTextWithRouting } from '../_shared/ai-router.ts';
import { COMM_WHATSAPP_MODULE, corsHeaders, toTrimmedString } from '../_shared/comm-whatsapp.ts';

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

type ChatRow = {
  id: string;
  phone_number: string | null;
  display_name: string | null;
  saved_contact_name: string | null;
  push_name: string | null;
  lead_id: string | null;
};

type MessageRow = {
  id: string;
  direction: 'inbound' | 'outbound' | 'system';
  message_type: string;
  delivery_status: string;
  text_content: string | null;
  message_at: string;
  media_caption: string | null;
  transcription_text: string | null;
};

type SystemSettingsRow = {
  company_name: string | null;
  timezone: string | null;
};

const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };
const DEFAULT_SYSTEM_TIMEZONE = 'America/Sao_Paulo';
const CHAT_CONTEXT_LIMIT = 80;
const STYLE_EXAMPLES_LIMIT = 40;
const AUDIO_WITHOUT_TRANSCRIPTION_MARKER = '[Audio sem transcricao]';

const createAdminClient = () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Credenciais do Supabase nao configuradas.');
  }

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
    || (next.startsWith('“') && next.endsWith('”'))
  ) {
    next = next.slice(1, -1).trim();
  }

  return next;
};

const normalizeSystemTimeZone = (value: unknown) => {
  const candidate = toTrimmedString(value);
  if (!candidate) {
    return DEFAULT_SYSTEM_TIMEZONE;
  }

  try {
    new Intl.DateTimeFormat('pt-BR', { timeZone: candidate }).format(new Date());
    return candidate;
  } catch {
    return DEFAULT_SYSTEM_TIMEZONE;
  }
};

const formatTimestamp = (value: string, timeZone: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '[--:--, --/--/----]';
  }

  const parts = new Intl.DateTimeFormat('pt-BR', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';

  return `[${read('hour')}:${read('minute')}, ${read('day')}/${read('month')}/${read('year')}]`;
};

const normalizeTranscriptText = (value: string) => value.replace(/\s+/g, ' ').trim();

const getMessageContent = (message: MessageRow) => {
  if (message.direction === 'system') {
    return '';
  }

  if (message.direction === 'outbound' && message.delivery_status.trim().toLowerCase() === 'failed') {
    return '';
  }

  const text = normalizeTranscriptText(toTrimmedString(message.text_content));
  const caption = normalizeTranscriptText(toTrimmedString(message.media_caption));
  const transcription = normalizeTranscriptText(toTrimmedString(message.transcription_text));
  const kind = message.message_type.trim().toLowerCase();

  if (kind === 'text') return text;
  if (kind === 'image') return caption ? `[Imagem] ${caption}` : '[Imagem]';
  if (kind === 'video' || kind === 'gif' || kind === 'short') return caption ? `[Video] ${caption}` : '[Video]';
  if (kind === 'document') return caption ? `[Documento] ${caption}` : '[Documento]';
  if (kind === 'audio' || kind === 'voice') return transcription || AUDIO_WITHOUT_TRANSCRIPTION_MARKER;
  if (caption) return caption;
  if (text) return text;
  if (transcription) return transcription;

  return `[${kind || 'mensagem sem texto'}]`;
};

const buildTranscriptLine = (message: MessageRow, contactLabel: string, timeZone: string) => {
  const content = getMessageContent(message);
  if (!content) {
    return null;
  }

  const author = message.direction === 'outbound' ? 'Kifer Saude' : contactLabel;
  return `${formatTimestamp(message.message_at, timeZone)} ${author}: ${content}`;
};

const getChatLabel = (chat: ChatRow) => (
  toTrimmedString(chat.saved_contact_name)
  || toTrimmedString(chat.display_name)
  || toTrimmedString(chat.push_name)
  || toTrimmedString(chat.phone_number)
  || 'Cliente'
);

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
      requiredPermission: 'view',
    });

    if (!authResult.authorized) {
      return new Response(JSON.stringify(authResult.body), {
        status: authResult.status,
        headers: jsonHeaders,
      });
    }

    const body = (await req.json().catch(() => ({}))) as SuggestReplyBody;
    const chatId = toTrimmedString(body.chatId);
    const composerDraft = toTrimmedString(body.composerDraft).slice(0, 1800);
    const mode = toTrimmedString(body.mode) === 'complete_draft' || composerDraft ? 'complete_draft' : 'suggest_reply';

    if (!chatId) {
      return new Response(JSON.stringify({ error: 'Conversa obrigatoria para sugerir resposta.' }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    const { data: chatData, error: chatError } = await supabaseAdmin
      .from('comm_whatsapp_chats')
      .select('id, phone_number, display_name, saved_contact_name, push_name, lead_id')
      .eq('id', chatId)
      .maybeSingle();

    if (chatError) {
      throw new Error(`Erro ao localizar conversa do WhatsApp: ${chatError.message}`);
    }

    if (!chatData) {
      return new Response(JSON.stringify({ error: 'Conversa do WhatsApp nao encontrada.' }), {
        status: 404,
        headers: jsonHeaders,
      });
    }

    const chat = chatData as ChatRow;
    const [messagesResult, styleExamplesResult, systemSettingsResult] = await Promise.all([
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
        .limit(STYLE_EXAMPLES_LIMIT),
      supabaseAdmin.from('system_settings').select('company_name, timezone').limit(1).maybeSingle(),
    ]);

    if (messagesResult.error) {
      throw new Error(`Erro ao carregar historico do chat: ${messagesResult.error.message}`);
    }

    if (styleExamplesResult.error) {
      throw new Error(`Erro ao carregar exemplos do atendimento: ${styleExamplesResult.error.message}`);
    }

    if (systemSettingsResult.error) {
      throw new Error(`Erro ao carregar configuracoes do sistema: ${systemSettingsResult.error.message}`);
    }

    const systemSettings = (systemSettingsResult.data ?? null) as SystemSettingsRow | null;
    const timeZone = normalizeSystemTimeZone(systemSettings?.timezone);
    const companyName = toTrimmedString(systemSettings?.company_name) || 'Kifer Saude';
    const contactLabel = getChatLabel(chat);
    const messages = ((messagesResult.data ?? []) as MessageRow[]).slice().reverse();
    const transcriptLines = messages
      .map((message) => buildTranscriptLine(message, contactLabel, timeZone))
      .filter((line): line is string => Boolean(line));

    if (transcriptLines.length === 0) {
      return new Response(JSON.stringify({ error: 'Nao ha historico util suficiente para sugerir resposta.' }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    const styleExamples = ((styleExamplesResult.data ?? []) as MessageRow[])
      .map((message) => normalizeTranscriptText(toTrimmedString(message.text_content)))
      .filter(Boolean)
      .filter((text) => text.length >= 12 && text.length <= 900)
      .slice(0, 18);

    const lastUsefulMessage = [...messages].reverse().find((message) => Boolean(getMessageContent(message))) ?? null;
    const lastDirection = lastUsefulMessage?.direction ?? null;

    const systemPrompt = [
      `Voce sugere respostas prontas para o WhatsApp da operacao ${companyName}.`,
      'Use como base o historico do chat atual e o padrao real das mensagens enviadas pela operacao.',
      'A resposta deve soar humana, consultiva, natural e coerente com o jeito da Kifer Saude escrever.',
      'Nao invente valores, coberturas, prazos, documentos, promessas, combinados ou dados que nao estejam no contexto.',
      'Se faltar alguma informacao para avancar, faca uma pergunta objetiva.',
      'Retorne somente uma mensagem final pronta para colar no composer, sem markdown, sem aspas, sem titulo e sem explicacoes.',
      mode === 'complete_draft'
        ? 'O usuario ja comecou a digitar. Complete ou refine mantendo a intencao do rascunho, sem ignorar o texto dele.'
        : 'Sugira a melhor proxima resposta para enviar agora. Se a ultima mensagem for da operacao, sugira continuidade apenas se fizer sentido; caso contrario, gere uma mensagem curta de acompanhamento.',
    ].join('\n');

    const userPrompt = [
      'Contexto do contato:',
      `- Nome exibido: ${contactLabel}`,
      `- Telefone: ${toTrimmedString(chat.phone_number) || 'Nao informado'}`,
      `- Ultima direcao util: ${lastDirection === 'inbound' ? 'cliente' : lastDirection === 'outbound' ? 'operacao' : 'nao identificada'}`,
      '',
      'Historico recente do chat:',
      transcriptLines.join('\n'),
      '',
      styleExamples.length > 0 ? 'Exemplos reais do jeito da operacao escrever:' : '',
      styleExamples.length > 0 ? styleExamples.map((text, index) => `${index + 1}. ${text}`).join('\n') : '',
      composerDraft ? '' : '',
      composerDraft ? 'Rascunho atual no composer:' : '',
      composerDraft || '',
      '',
      'Tarefa:',
      mode === 'complete_draft'
        ? 'Gere uma versao final da mensagem considerando o rascunho atual e o contexto.'
        : 'Gere a proxima resposta mais adequada para este chat.',
    ].filter((line) => line !== '').join('\n');

    const result = await generateTextWithRouting({
      supabaseAdmin,
      task: 'follow_up_generation',
      systemPrompt,
      userPrompt,
      temperature: composerDraft ? 0.35 : 0.5,
      maxTokens: 360,
    });

    const text = sanitizeGeneratedText(result.text);
    if (!text) {
      throw new Error('A IA nao retornou uma sugestao valida.');
    }

    return new Response(JSON.stringify({
      success: true,
      text,
      mode,
      provider: result.provider,
      model: result.model,
      fallback_used: result.fallbackUsed,
    }), {
      status: 200,
      headers: jsonHeaders,
    });
  } catch (error) {
    console.error('[comm-whatsapp-suggest-reply] erro inesperado', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno ao sugerir resposta.' }),
      {
        status: 500,
        headers: jsonHeaders,
      },
    );
  }
});
