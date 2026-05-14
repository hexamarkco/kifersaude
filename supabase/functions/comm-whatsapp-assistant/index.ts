/* eslint-disable @typescript-eslint/no-explicit-any */
// @ts-expect-error Deno npm import
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { authorizeDashboardUser } from '../_shared/dashboard-auth.ts';
import { generateTextWithRouting } from '../_shared/ai-router.ts';
import { COMM_WHATSAPP_MODULE, corsHeaders, isRecord, toTrimmedString } from '../_shared/comm-whatsapp.ts';

declare const Deno: {
  env: {
    get: (key: string) => string | undefined;
  };
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};

type AssistantScope = 'free' | 'inbox' | 'chat' | 'system';

type AssistantRequestBody = {
  prompt?: string;
  chatId?: string;
  scope?: string;
  composerDraft?: string;
};

type AssistantAction = {
  id: string;
  type: 'draft_message' | 'schedule_follow_up' | 'review_lead' | 'open_dashboard' | 'manual';
  title: string;
  description: string;
  requires_confirmation: boolean;
  payload: Record<string, unknown> | null;
};

type NormalizedAssistantResponse = {
  answer: string;
  clarification: string | null;
  confidence: 'low' | 'medium' | 'high';
  action_plan: AssistantAction[];
  suggested_message: string | null;
};

const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };
const MAX_PROMPT_LENGTH = 4000;
const MAX_COMPOSER_DRAFT_LENGTH = 2500;
const MAX_SUGGESTED_MESSAGE_LENGTH = 3500;
const MAX_ACTIONS = 5;
const VALID_ACTION_TYPES = new Set<AssistantAction['type']>([
  'draft_message',
  'schedule_follow_up',
  'review_lead',
  'open_dashboard',
  'manual',
]);

const createAdminClient = () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Credenciais do Supabase nao configuradas.');
  }

  return createClient(supabaseUrl, serviceRoleKey);
};

const normalizeScope = (value: string, hasChatId: boolean): AssistantScope => {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'free' || normalized === 'chat' || normalized === 'inbox' || normalized === 'system') {
    return normalized;
  }

  return hasChatId ? 'chat' : 'free';
};

const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const clampText = (value: string, maxLength: number) => {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength).trimEnd()}...`;
};

const toNullableText = (value: unknown, maxLength = 1200): string | null => {
  const text = toTrimmedString(value);
  return text ? clampText(text, maxLength) : null;
};

const countRows = async (query: any, fallbackLabel: string): Promise<number> => {
  const { count, error } = await query;
  if (error) {
    throw new Error(`${fallbackLabel}: ${error.message}`);
  }

  return count ?? 0;
};

const extractMessageText = (message: Record<string, unknown>) => {
  const text = toTrimmedString(message.text_content);
  if (text) return text;

  const caption = toTrimmedString(message.media_caption);
  if (caption) return caption;

  const transcription = toTrimmedString(message.transcription_text);
  if (transcription) return `[Transcricao] ${transcription}`;

  return `[${toTrimmedString(message.message_type) || 'mensagem sem texto'}]`;
};

const normalizeRecentMessage = (message: Record<string, unknown>) => ({
  id: toTrimmedString(message.id),
  direction: toTrimmedString(message.direction),
  type: toTrimmedString(message.message_type),
  status: toTrimmedString(message.delivery_status),
  at: toTrimmedString(message.message_at),
  text: clampText(extractMessageText(message), 900),
});

const normalizeRecentChat = (chat: Record<string, unknown>) => ({
  id: toTrimmedString(chat.id),
  displayName: toTrimmedString(chat.display_name) || toTrimmedString(chat.saved_contact_name) || toTrimmedString(chat.phone_number),
  phone: toTrimmedString(chat.phone_number),
  leadId: toNullableText(chat.lead_id, 80),
  leadStatus: toNullableText(chat.lead_status, 120),
  unreadCount: typeof chat.unread_count === 'number' ? chat.unread_count : 0,
  manualUnread: chat.manual_unread === true,
  archived: chat.is_archived === true,
  muted: chat.is_muted === true,
  pinned: chat.is_pinned === true,
  lastMessageAt: toNullableText(chat.last_message_at, 80),
  lastMessageDirection: toNullableText(chat.last_message_direction, 40),
  lastMessageStatus: toNullableText(chat.last_message_delivery_status, 80),
  lastMessageText: toNullableText(chat.last_message_text, 500),
});

const loadSystemSettings = async (supabaseAdmin: any) => {
  const { data, error } = await supabaseAdmin
    .from('system_settings')
    .select('company_name, timezone')
    .limit(1)
    .maybeSingle();

  if (error) {
    return { company_name: 'Kifer Saude', timezone: 'America/Sao_Paulo' };
  }

  return {
    company_name: toTrimmedString(data?.company_name) || 'Kifer Saude',
    timezone: toTrimmedString(data?.timezone) || 'America/Sao_Paulo',
  };
};

const loadOperationalState = async (supabaseAdmin: any) => {
  const [channelResult, integrationResult] = await Promise.all([
    supabaseAdmin
      .from('comm_whatsapp_channels')
      .select('id, slug, name, enabled, connection_status, health_status, phone_number, connected_user_name, last_health_check_at, last_webhook_received_at, last_error, health_snapshot, limits_snapshot, updated_at')
      .eq('slug', 'primary')
      .maybeSingle(),
    supabaseAdmin
      .from('integration_settings')
      .select('settings')
      .eq('slug', 'whatsapp_auto_contact')
      .maybeSingle(),
  ]);

  if (channelResult.error) {
    throw new Error(`Falha ao carregar canal WhatsApp: ${channelResult.error.message}`);
  }

  const settings = isRecord(integrationResult.data?.settings) ? integrationResult.data.settings : {};
  const token = toTrimmedString(settings.token) || toTrimmedString(settings.apiKey);

  return {
    channel: channelResult.data ?? null,
    configEnabled: String(settings.enabled ?? '').toLowerCase() === 'true' || settings.enabled === true,
    tokenConfigured: token.length > 0,
  };
};

const loadInboxSummary = async (supabaseAdmin: any) => {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [
    totalChats,
    activeChats,
    unreadChats,
    unlinkedChats,
    inbound24h,
    outbound24h,
    failedOutbound24h,
    pendingOutbound,
    recentChatsResult,
  ] = await Promise.all([
    countRows(supabaseAdmin.from('comm_whatsapp_chats').select('*', { count: 'exact', head: true }), 'Falha ao contar chats'),
    countRows(supabaseAdmin.from('comm_whatsapp_chats').select('*', { count: 'exact', head: true }).eq('is_archived', false), 'Falha ao contar chats ativos'),
    countRows(supabaseAdmin.from('comm_whatsapp_chats').select('*', { count: 'exact', head: true }).or('unread_count.gt.0,manual_unread.eq.true'), 'Falha ao contar nao lidas'),
    countRows(supabaseAdmin.from('comm_whatsapp_chats').select('*', { count: 'exact', head: true }).eq('is_archived', false).is('lead_id', null), 'Falha ao contar chats sem lead'),
    countRows(supabaseAdmin.from('comm_whatsapp_messages').select('*', { count: 'exact', head: true }).eq('direction', 'inbound').gte('message_at', since24h), 'Falha ao contar inbound 24h'),
    countRows(supabaseAdmin.from('comm_whatsapp_messages').select('*', { count: 'exact', head: true }).eq('direction', 'outbound').gte('message_at', since24h), 'Falha ao contar outbound 24h'),
    countRows(supabaseAdmin.from('comm_whatsapp_messages').select('*', { count: 'exact', head: true }).eq('direction', 'outbound').in('delivery_status', ['failed', 'error']).gte('message_at', since24h), 'Falha ao contar falhas 24h'),
    countRows(supabaseAdmin.from('comm_whatsapp_messages').select('*', { count: 'exact', head: true }).eq('direction', 'outbound').in('delivery_status', ['pending', 'queued', 'sending']), 'Falha ao contar envios pendentes'),
    supabaseAdmin
      .from('comm_whatsapp_chats')
      .select('id, display_name, saved_contact_name, phone_number, lead_id, unread_count, manual_unread, is_archived, is_muted, is_pinned, last_message_at, last_message_direction, last_message_text')
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .order('updated_at', { ascending: false })
      .limit(12),
  ]);

  if (recentChatsResult.error) {
    throw new Error(`Falha ao carregar conversas recentes: ${recentChatsResult.error.message}`);
  }

  return {
    totalChats,
    activeChats,
    unreadChats,
    unlinkedChats,
    inbound24h,
    outbound24h,
    failedOutbound24h,
    pendingOutbound,
    recentChats: ((recentChatsResult.data ?? []) as Record<string, unknown>[]).map(normalizeRecentChat),
  };
};

const loadSelectedChatContext = async (supabaseAdmin: any, chatId: string) => {
  if (!chatId) {
    return {
      chat: null,
      messages: [],
      lead: null,
      contracts: [],
      reminders: [],
    };
  }

  const chatQuery = supabaseAdmin
    .from('comm_whatsapp_chats')
    .select('id, channel_id, external_chat_id, phone_number, phone_digits, display_name, saved_contact_name, push_name, lead_id, unread_count, manual_unread, is_archived, is_muted, is_pinned, status, last_message_text, last_message_direction, last_message_at, created_at, updated_at')
    .limit(1);

  const { data: chatRows, error: chatError } = isUuid(chatId)
    ? await chatQuery.eq('id', chatId)
    : await chatQuery.eq('external_chat_id', chatId);

  if (chatError) {
    throw new Error(`Falha ao carregar conversa selecionada: ${chatError.message}`);
  }

  const chat = ((chatRows ?? []) as Record<string, unknown>[])[0] ?? null;
  if (!chat) {
    return {
      chat: null,
      messages: [],
      lead: null,
      contracts: [],
      reminders: [],
    };
  }

  const leadId = toTrimmedString(chat.lead_id);
  const [messagesResult, leadResult, contractsResult, remindersResult] = await Promise.all([
    supabaseAdmin
      .from('comm_whatsapp_messages')
      .select('id, direction, message_type, delivery_status, text_content, message_at, media_caption, transcription_text, error_message')
      .eq('chat_id', chat.id)
      .order('message_at', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(80),
    leadId
      ? supabaseAdmin
          .from('leads')
          .select('*')
          .eq('id', leadId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    leadId
      ? supabaseAdmin
          .from('contracts')
          .select('id, codigo_contrato, status, modalidade, operadora, produto_plano, mensalidade_total, data_inicio, responsavel, observacoes_internas, created_at, updated_at')
          .eq('lead_id', leadId)
          .order('updated_at', { ascending: false })
          .limit(12)
      : Promise.resolve({ data: [], error: null }),
    leadId
      ? supabaseAdmin
          .from('reminders')
          .select('id, tipo, titulo, descricao, data_lembrete, lido, prioridade, created_at')
          .eq('lead_id', leadId)
          .eq('lido', false)
          .order('data_lembrete', { ascending: true })
          .limit(10)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (messagesResult.error) throw new Error(`Falha ao carregar mensagens: ${messagesResult.error.message}`);
  if (leadResult.error) throw new Error(`Falha ao carregar lead: ${leadResult.error.message}`);
  if (contractsResult.error) throw new Error(`Falha ao carregar contratos: ${contractsResult.error.message}`);
  if (remindersResult.error) throw new Error(`Falha ao carregar lembretes: ${remindersResult.error.message}`);

  const messages = ((messagesResult.data ?? []) as Record<string, unknown>[])
    .reverse()
    .map(normalizeRecentMessage);
  const latestMessageStatus = messages[messages.length - 1]?.status ?? null;

  return {
    chat: normalizeRecentChat({ ...chat, last_message_delivery_status: latestMessageStatus }),
    messages,
    lead: leadResult.data ?? null,
    contracts: contractsResult.data ?? [],
    reminders: remindersResult.data ?? [],
  };
};

const extractJsonObject = (value: string): Record<string, unknown> | null => {
  const trimmed = value.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim();

  try {
    const parsed = JSON.parse(trimmed);
    return isRecord(parsed) ? parsed : null;
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start < 0 || end <= start) {
      return null;
    }

    try {
      const parsed = JSON.parse(trimmed.slice(start, end + 1));
      return isRecord(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
};

const normalizeConfidence = (value: unknown): NormalizedAssistantResponse['confidence'] => {
  const normalized = toTrimmedString(value).toLowerCase();
  if (normalized === 'low' || normalized === 'medium' || normalized === 'high') {
    return normalized;
  }

  return 'medium';
};

const normalizeActionPlan = (value: unknown): AssistantAction[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.slice(0, MAX_ACTIONS).flatMap((item, index): AssistantAction[] => {
    if (!isRecord(item)) {
      return [];
    }

    const rawType = toTrimmedString(item.type).toLowerCase() as AssistantAction['type'];
    const type = VALID_ACTION_TYPES.has(rawType) ? rawType : 'manual';
    const title = toTrimmedString(item.title) || `Ação ${index + 1}`;
    const description = toTrimmedString(item.description) || title;
    const payload = isRecord(item.payload) ? item.payload : null;

    return [{
      id: toTrimmedString(item.id) || `action-${index + 1}`,
      type,
      title: clampText(title, 120),
      description: clampText(description, 700),
      requires_confirmation: true,
      payload,
    }];
  });
};

const normalizeAssistantResponse = (rawText: string): NormalizedAssistantResponse => {
  const parsed = extractJsonObject(rawText);

  if (!parsed) {
    return {
      answer: rawText.trim(),
      clarification: null,
      confidence: 'medium',
      action_plan: [],
      suggested_message: null,
    };
  }

  const answer = toTrimmedString(parsed.answer) || toTrimmedString(parsed.resposta) || rawText.trim();
  const suggestedMessage = toNullableText(parsed.suggested_message ?? parsed.suggestedMessage, MAX_SUGGESTED_MESSAGE_LENGTH);

  return {
    answer: clampText(answer, 5000),
    clarification: toNullableText(parsed.clarification ?? parsed.pergunta, 1000),
    confidence: normalizeConfidence(parsed.confidence),
    action_plan: normalizeActionPlan(parsed.action_plan ?? parsed.actionPlan),
    suggested_message: suggestedMessage,
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

    const body = (await req.json().catch(() => ({}))) as AssistantRequestBody;
    const prompt = clampText(toTrimmedString(body.prompt), MAX_PROMPT_LENGTH);
    const chatId = toTrimmedString(body.chatId);
    const scope = normalizeScope(toTrimmedString(body.scope), Boolean(chatId));
    const composerDraft = clampText(toTrimmedString(body.composerDraft), MAX_COMPOSER_DRAFT_LENGTH);

    if (!prompt) {
      return new Response(JSON.stringify({ error: 'Digite uma pergunta ou pedido para o R.A.V.I.' }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    const shouldLoadSelectedChat = scope === 'chat' && Boolean(chatId);
    const [systemSettings, operationalState, inboxSummary, selectedChatContext] = await Promise.all([
      loadSystemSettings(supabaseAdmin),
      loadOperationalState(supabaseAdmin),
      loadInboxSummary(supabaseAdmin),
      shouldLoadSelectedChat ? loadSelectedChatContext(supabaseAdmin, chatId) : loadSelectedChatContext(supabaseAdmin, ''),
    ]);

    const context = {
      now: new Date().toISOString(),
      system: systemSettings,
      operator: {
        profileId: authResult.user.profileId,
        role: authResult.user.role,
        canEditWhatsApp: authResult.user.canEditModule,
      },
      request: {
        scope,
        prompt,
        chatId: shouldLoadSelectedChat ? chatId : null,
        composerDraft: composerDraft || null,
        note: scope === 'free'
          ? 'Modo livre: nao assuma que o chat aberto e o assunto, salvo se o pedido mencionar claramente esta conversa ou este cliente.'
          : null,
      },
      operationalState,
      inboxSummary,
      selectedChat: selectedChatContext,
    };

    const systemPrompt = [
      'Voce e o R.A.V.I., assistente operacional de IA do WhatsApp Inbox da Kifer Saude.',
      'Seu papel e analisar contexto real do inbox, conversar com o operador, identificar riscos, orientar proximos passos e sugerir textos ou planos acionaveis.',
      'Voce nao esta preso ao chat aberto. No modo free, trate a pergunta como livre: pode ser sobre sistema, CRM, multiplos contatos, agenda, contratos, operacao ou WhatsApp em geral.',
      'Use selectedChat apenas quando request.scope for chat. Se scope for free/inbox/system, nao baseie a resposta na conversa aberta.',
      'Se o operador pedir acoes sobre multiplos contatos, responda com plano, criterios e proximos passos confirmaveis; nao invente dados nao enviados.',
      'Use somente os dados enviados no contexto. Se faltar informacao para concluir, diga exatamente o que falta e use clarification.',
      'Nunca diga que executou, alterou, enviou, arquivou, agendou ou vinculou algo. Voce pode apenas sugerir a acao e indicar que precisa de confirmacao humana.',
      'Toda acao de escrita, envio, agenda, mudanca de status, vinculo de lead, arquivamento ou exclusao deve aparecer com requires_confirmation true.',
      'Quando sugerir mensagem para WhatsApp, deixe suggested_message com texto pronto para o composer, sem markdown e sem aspas. Nao envie a mensagem.',
      'Responda em portugues do Brasil, com tom direto, consultivo e operacional.',
      'Retorne exclusivamente JSON valido no formato: {"answer":"...","clarification":null,"confidence":"low|medium|high","action_plan":[{"id":"...","type":"draft_message|schedule_follow_up|review_lead|open_dashboard|manual","title":"...","description":"...","requires_confirmation":true,"payload":{}}],"suggested_message":null}.',
    ].join('\n\n');

    const userPrompt = [
      'Pedido do operador:',
      prompt,
      '',
      'Contexto operacional em JSON:',
      JSON.stringify(context, null, 2),
    ].join('\n');

    const result = await generateTextWithRouting({
      supabaseAdmin,
      task: 'whatsapp_assistant',
      systemPrompt,
      userPrompt,
      temperature: 0.25,
      maxTokens: 1400,
    });

    const normalized = normalizeAssistantResponse(result.text);

    return new Response(JSON.stringify({
      success: true,
      ...normalized,
      provider: result.provider,
      model: result.model,
      fallback_used: result.fallbackUsed,
      context_summary: {
        scope,
        chatLoaded: Boolean(selectedChatContext.chat),
        messagesLoaded: selectedChatContext.messages.length,
        leadLoaded: Boolean(selectedChatContext.lead),
        contractsLoaded: Array.isArray(selectedChatContext.contracts) ? selectedChatContext.contracts.length : 0,
        remindersLoaded: Array.isArray(selectedChatContext.reminders) ? selectedChatContext.reminders.length : 0,
        recentChatsLoaded: inboxSummary.recentChats.length,
      },
    }), {
      status: 200,
      headers: jsonHeaders,
    });
  } catch (error) {
    console.error('[comm-whatsapp-assistant] erro inesperado', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno ao consultar o R.A.V.I.' }),
      {
        status: 500,
        headers: jsonHeaders,
      },
    );
  }
});
