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

type GenerateFollowUpBody = {
  chatId?: string;
  customInstructions?: string;
};

type ChatRow = {
  id: string;
  phone_number: string;
  display_name: string;
  saved_contact_name: string | null;
  push_name: string | null;
  lead_id: string | null;
};

type LeadRow = {
  id: string;
  nome_completo: string;
  telefone: string | null;
  email: string | null;
  cidade: string | null;
  origem: string | null;
  status: string | null;
  responsavel: string | null;
};

type LookupLabelRow = {
  nome?: string | null;
  label?: string | null;
  value?: string | null;
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

type IntegrationSettingRow = {
  settings: Record<string, unknown> | null;
};

type FollowUpLeadContext = {
  nome: string;
  primeiro_nome: string;
};

const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };
const AI_FOLLOW_UP_PROMPT_SLUG = 'ai_follow_up_prompt';
const DEFAULT_SYSTEM_TIMEZONE = 'America/Sao_Paulo';
const MESSAGE_PAGE_SIZE = 1000;
const AUDIO_WITHOUT_TRANSCRIPTION_MARKER = '[Áudio sem transcrição]';

const createAdminClient = () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Credenciais do Supabase nao configuradas.');
  }

  return createClient(supabaseUrl, serviceRoleKey);
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

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

const getDateTimeParts = (date: Date, timeZone: string) => {
  const formatter = new Intl.DateTimeFormat('pt-BR', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';

  return {
    day: read('day'),
    month: read('month'),
    year: read('year'),
    hour: read('hour'),
    minute: read('minute'),
  };
};

const formatTranscriptTimestamp = (value: string, timeZone: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '[--:--, --/--/----]';
  }

  const parts = getDateTimeParts(date, timeZone);
  return `[${parts.hour}:${parts.minute}, ${parts.day}/${parts.month}/${parts.year}]`;
};

const formatDateForPrompt = (date: Date, timeZone: string) => {
  const parts = getDateTimeParts(date, timeZone);
  return `${parts.day}/${parts.month}/${parts.year}`;
};

const formatTimeForPrompt = (date: Date, timeZone: string) => {
  const parts = getDateTimeParts(date, timeZone);
  return `${parts.hour}:${parts.minute}`;
};

const formatDateTimeForPrompt = (date: Date, timeZone: string) => {
  const parts = getDateTimeParts(date, timeZone);
  return `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}`;
};

const getFirstName = (value: string) => value.trim().split(/\s+/)[0] ?? '';

const buildFollowUpLeadContext = (lead: LeadRow | null, chat: ChatRow): FollowUpLeadContext => {
  const nome =
    toTrimmedString(lead?.nome_completo) ||
    toTrimmedString(chat.saved_contact_name) ||
    toTrimmedString(chat.display_name) ||
    toTrimmedString(chat.push_name) ||
    toTrimmedString(chat.phone_number) ||
    'Contato';

  return {
    nome,
    primeiro_nome: getFirstName(nome),
  };
};

const applyFollowUpPromptVariables = (template: string, context: FollowUpLeadContext, timeZone: string) => {
  const now = new Date();
  const replacements: Array<[RegExp, string]> = [
    [/{{\s*nome\s*}}/gi, context.nome],
    [/{{\s*primeiro_nome\s*}}/gi, context.primeiro_nome],
    [/{{\s*data_hoje\s*}}/gi, formatDateForPrompt(now, timeZone)],
    [/{{\s*hora_agora\s*}}/gi, formatTimeForPrompt(now, timeZone)],
    [/{{\s*data_hora_atual_sistema\s*}}/gi, formatDateTimeForPrompt(now, timeZone)],
    [/{{\s*data_hora_atual_brasilia\s*}}/gi, formatDateTimeForPrompt(now, timeZone)],
  ];

  return replacements.reduce((result, [pattern, replacement]) => result.replace(pattern, replacement), template).trim();
};

const normalizeTranscriptText = (value: string) => value.replace(/\s+/g, ' ').trim();

const getUnknownMessageMarker = (messageType: string) => {
  const normalized = messageType.trim().toLowerCase();
  if (!normalized) {
    return '[Mensagem sem conteudo]';
  }

  return `[${normalized}]`;
};

const buildTranscriptContent = (message: MessageRow) => {
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

  if (kind === 'text') {
    return text;
  }

  if (kind === 'image') {
    return caption ? `[Imagem] ${caption}` : '[Imagem]';
  }

  if (kind === 'video') {
    return caption ? `[Video] ${caption}` : '[Video]';
  }

  if (kind === 'document') {
    return caption ? `[Documento] ${caption}` : '[Documento]';
  }

  if (kind === 'audio' || kind === 'voice') {
    return transcription || AUDIO_WITHOUT_TRANSCRIPTION_MARKER;
  }

  if (caption) {
    return caption;
  }

  if (text) {
    return text;
  }

  if (transcription) {
    return transcription;
  }

  return getUnknownMessageMarker(kind);
};

const buildTranscriptLine = (message: MessageRow, leadLabel: string, timeZone: string) => {
  const content = buildTranscriptContent(message);
  if (!content) {
    return null;
  }

  const author = message.direction === 'outbound' ? 'Eu' : leadLabel;
  return `${formatTranscriptTimestamp(message.message_at, timeZone)} ${author}: ${content}`;
};

const loadAllMessagesForChat = async (
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  chatId: string,
) => {
  const messages: MessageRow[] = [];

  for (let pageStart = 0; ; pageStart += MESSAGE_PAGE_SIZE) {
    const { data, error } = await supabaseAdmin
      .from('comm_whatsapp_messages')
      .select('id, direction, message_type, delivery_status, text_content, message_at, media_caption, transcription_text')
      .eq('chat_id', chatId)
      .order('message_at', { ascending: true })
      .order('id', { ascending: true })
      .range(pageStart, pageStart + MESSAGE_PAGE_SIZE - 1);

    if (error) {
      throw new Error(`Erro ao carregar historico do WhatsApp: ${error.message}`);
    }

    const page = (data ?? []) as MessageRow[];
    messages.push(...page);

    if (page.length < MESSAGE_PAGE_SIZE) {
      break;
    }
  }

  return messages;
};

const loadLeadContext = async (
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  leadId: string | null,
): Promise<LeadRow | null> => {
  if (!leadId) {
    return null;
  }

  const { data, error } = await supabaseAdmin
    .from('leads')
    .select('*')
    .eq('id', leadId)
    .maybeSingle();

  if (error) {
    throw new Error(`Erro ao carregar lead vinculado: ${error.message}`);
  }

  if (!isRecord(data)) {
    return null;
  }

  const statusId = toTrimmedString(data.status_id);
  const origemId = toTrimmedString(data.origem_id);
  const responsavelId = toTrimmedString(data.responsavel_id);

  const [statusLookup, origemLookup, responsavelLookup] = await Promise.all([
    !toTrimmedString(data.status) && statusId
      ? supabaseAdmin.from('lead_status_config').select('nome').eq('id', statusId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    !toTrimmedString(data.origem) && origemId
      ? supabaseAdmin.from('lead_origens').select('nome').eq('id', origemId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    !toTrimmedString(data.responsavel) && responsavelId
      ? supabaseAdmin.from('lead_responsaveis').select('label, value').eq('id', responsavelId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (statusLookup.error) {
    throw new Error(`Erro ao carregar label de status do lead: ${statusLookup.error.message}`);
  }

  if (origemLookup.error) {
    throw new Error(`Erro ao carregar label de origem do lead: ${origemLookup.error.message}`);
  }

  if (responsavelLookup.error) {
    throw new Error(`Erro ao carregar label de responsavel do lead: ${responsavelLookup.error.message}`);
  }

  const statusData = (statusLookup.data ?? null) as LookupLabelRow | null;
  const origemData = (origemLookup.data ?? null) as LookupLabelRow | null;
  const responsavelData = (responsavelLookup.data ?? null) as LookupLabelRow | null;

  return {
    id: toTrimmedString(data.id) || leadId,
    nome_completo: toTrimmedString(data.nome_completo),
    telefone: toTrimmedString(data.telefone) || null,
    email: toTrimmedString(data.email) || null,
    cidade: toTrimmedString(data.cidade) || null,
    origem: toTrimmedString(data.origem) || toTrimmedString(origemData?.nome) || null,
    status: toTrimmedString(data.status) || toTrimmedString(statusData?.nome) || null,
    responsavel:
      toTrimmedString(data.responsavel) ||
      toTrimmedString(responsavelData?.label) ||
      toTrimmedString(responsavelData?.value) ||
      null,
  };
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
      requiredPermission: 'view',
    });

    if (!authResult.authorized) {
      return new Response(JSON.stringify(authResult.body), {
        status: authResult.status,
        headers: jsonHeaders,
      });
    }

    const body = (await req.json().catch(() => ({}))) as GenerateFollowUpBody;
    const chatId = toTrimmedString(body.chatId);
    const customInstructions = toTrimmedString(body.customInstructions);

    if (!chatId) {
      return new Response(JSON.stringify({ error: 'Conversa obrigatoria para gerar follow-up.' }), {
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

    const [messages, lead, systemSettingsResult, promptResult] = await Promise.all([
      loadAllMessagesForChat(supabaseAdmin, chat.id),
      loadLeadContext(supabaseAdmin, chat.lead_id),
      supabaseAdmin.from('system_settings').select('company_name, timezone').limit(1).maybeSingle(),
      supabaseAdmin.from('integration_settings').select('settings').eq('slug', AI_FOLLOW_UP_PROMPT_SLUG).maybeSingle(),
    ]);

    if (systemSettingsResult.error) {
      throw new Error(`Erro ao carregar configuracoes do sistema: ${systemSettingsResult.error.message}`);
    }

    if (promptResult.error) {
      throw new Error(`Erro ao carregar prompt de follow-up: ${promptResult.error.message}`);
    }
    const systemSettings = (systemSettingsResult.data ?? null) as SystemSettingsRow | null;
    const promptIntegration = (promptResult.data ?? null) as IntegrationSettingRow | null;
    const systemTimeZone = normalizeSystemTimeZone(systemSettings?.timezone);
    const companyName = toTrimmedString(systemSettings?.company_name) || 'Kifer Saude';
    const leadContext = buildFollowUpLeadContext(lead, chat);
    const transcriptLines = messages
      .map((message) => buildTranscriptLine(message, leadContext.nome, systemTimeZone))
      .filter((line): line is string => Boolean(line));

    if (transcriptLines.length === 0) {
      return new Response(JSON.stringify({ error: 'Nao ha historico util suficiente para gerar follow-up.' }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    const promptSettings = isRecord(promptIntegration?.settings) ? promptIntegration.settings : {};
    const configuredInstructions = applyFollowUpPromptVariables(
      toTrimmedString(promptSettings.instructions),
      leadContext,
      systemTimeZone,
    );

    const now = new Date();
    const systemPrompt = [
      `Voce gera uma unica sugestao de follow-up pronta para envio no WhatsApp da operacao ${companyName}.`,
      'Leia todo o historico antes de responder e respeite a cronologia do transcript.',
      'Considere as datas e horas do transcript como a referencia temporal principal.',
      'Nao invente fatos, promessas, dados, respostas do cliente ou combinados que nao estejam no historico.',
      'Retorne apenas o texto final da mensagem sugerida, sem aspas, sem markdown, sem explicacoes extras e sem listar alternativas.',
      configuredInstructions ? `Instrucoes adicionais da operacao:\n${configuredInstructions}` : '',
      customInstructions ? `Instrucoes personalizadas desta geracao:\n${customInstructions}` : '',
    ]
      .filter(Boolean)
      .join('\n\n');

    const userPrompt = [
      'Contexto do chat:',
      `- Nome do contato: ${leadContext.nome}`,
      `- Telefone: ${toTrimmedString(lead?.telefone) || toTrimmedString(chat.phone_number) || 'Nao informado'}`,
      `- Lead vinculado: ${lead ? 'Sim' : 'Nao'}`,
      `- Status do lead: ${toTrimmedString(lead?.status) || 'Nao informado'}`,
      `- Responsavel: ${toTrimmedString(lead?.responsavel) || 'Nao informado'}`,
      `- Fuso do sistema: ${systemTimeZone}`,
      `- Agora no sistema: ${formatDateTimeForPrompt(now, systemTimeZone)}`,
      '',
      'Historico completo da conversa:',
      transcriptLines.join('\n'),
      '',
      'Tarefa:',
      'Gere a proxima mensagem de follow-up mais adequada para enviar agora neste chat. A mensagem deve soar humana, comercialmente coerente e pronta para copiar e enviar no WhatsApp.',
    ].join('\n');

    const result = await generateTextWithRouting({
      supabaseAdmin,
      task: 'follow_up_generation',
      systemPrompt,
      userPrompt,
      temperature: 0.5,
      maxTokens: 320,
    });

    return new Response(
      JSON.stringify({
        success: true,
        text: result.text.trim(),
        provider: result.provider,
        model: result.model,
        fallback_used: result.fallbackUsed,
      }),
      {
        status: 200,
        headers: jsonHeaders,
      },
    );
  } catch (error) {
    console.error('[comm-whatsapp-generate-follow-up] erro inesperado', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno ao gerar follow-up.' }),
      {
        status: 500,
        headers: jsonHeaders,
      },
    );
  }
});
