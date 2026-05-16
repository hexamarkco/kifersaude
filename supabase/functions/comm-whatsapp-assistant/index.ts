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

type AssistantSearchPlan = {
  query: string;
  terms: string[];
  requiredTerms: string[];
  optionalTerms: string[];
  direction: 'inbound' | 'outbound' | null;
  since: string | null;
  periodLabel: string | null;
  includeHistoricalConversations: boolean;
  includeQuotes: boolean;
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
  externalChatId: toNullableText(chat.external_chat_id, 140),
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

const normalizeSearchText = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9\s]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const SEARCH_STOP_WORDS = new Set([
  'a', 'agora', 'algum', 'alguma', 'algumas', 'alguns', 'as', 'ate', 'buscar', 'busque', 'chat', 'chats', 'cliente', 'clientes', 'com', 'contato',
  'contatos', 'conversa', 'conversar', 'conversaram', 'conversei', 'conversou', 'conversas', 'cotacao', 'cotacoes', 'da', 'das', 'de', 'do', 'dos',
  'essa', 'esse', 'esta', 'este', 'eu', 'falei', 'falaram', 'falou', 'historico', 'inbox', 'lead', 'leads', 'liste', 'listar', 'localize', 'localizar',
  'mande', 'mandei', 'me', 'mencionei', 'mencionaram', 'mencionou', 'mensagem', 'mensagens', 'mostra', 'mostrar', 'mostre', 'na', 'nas', 'no', 'nos',
  'o', 'operadora', 'operadoras', 'operador', 'orcamento', 'orcamentos', 'os', 'para', 'pediu', 'pediram', 'por', 'procure', 'procurar', 'proposta',
  'propostas', 'quais', 'qual', 'que', 'quem', 'ravi', 'recebeu', 'receberam', 'recente', 'recentemente', 'semana', 'sobre', 'todos', 'todas', 'traga',
  'trataram', 'tratou', 'ultima', 'ultimas', 'ultimo', 'ultimos', 'um', 'uma', 'whatsapp', 'pois', 'porque', 'pra', 'fechar', 'dando', 'oferecendo',
]);

const SEARCH_TIME_WORDS = new Set(['hoje', 'ontem', 'recentemente', 'recente', 'semana', 'mes', 'mês', 'dia', 'dias', 'ultimos', 'últimos', 'ultimas', 'últimas']);

const SEARCH_ACTION_PATTERN = /\b(buscar|busque|liste|listar|mostre|mostrar|procure|procurar|localize|localizar|traga|falei|falou|falaram|conversei|conversou|conversaram|mencionei|mencionou|mencionaram|comentei|comentou|comentaram|tratei|tratou|trataram|mandei|enviou|enviei|recebeu|receberam|pediu|pediram|cotacao|cotacoes|or[cç]amento|or[cç]amentos|proposta|propostas)\b/;
const SEARCH_AUDIENCE_PATTERN = /\b(quem|quais|qual|lead|leads|cliente|clientes|contato|contatos|chat|chats|conversa|conversas)\b/;
const QUOTE_SEARCH_PATTERN = /\b(cotacao|cotacoes|or[cç]amento|or[cç]amentos|proposta|propostas|plano|planos|operadora|operadoras|seguradora|seguradoras)\b/;
const OUTBOUND_INTENT_PATTERN = /\b(mandei|enviei|falei|conversei|acionei|disparei|encaminhei|envia|enviar|mande|mandar)\b/;
const INBOUND_INTENT_PATTERN = /\b(recebi|pediram|pediu|perguntaram|perguntou|responderam|respondeu)\b/;

const splitTopicTerms = (topic: string) => Array.from(new Set(
  topic
    .split(/\s+(?:ou|e)\s+|[,;|/]+/i)
    .map((term) => term.trim())
    .filter((term) => term.length >= 3),
));

const cleanSearchCandidate = (value: string) => value
  .replace(/^r\.?a\.?v\.?i\.?\s*,?\s*/i, '')
  .replace(/[?.!]+$/g, '')
  .replace(/\b(?:pois|porque|ja que|já que|para quem|pra quem|com desconto|dando|oferecendo|esta|está|ta|tá)\b.*$/i, '')
  .replace(/\b(?:no|na|nos|nas)?\s*(?:historico|whatsapp|inbox|mensagens?)\b.*$/i, '')
  .replace(/\b(?:hoje|ontem|recentemente|essa semana|esta semana|ultimos dias|últimos dias|esse mes|este mes|este mês|esse mês)\b/gi, '')
  .replace(/\s+/g, ' ')
  .trim();

const extractQuotedTerms = (value: string) => Array.from(value.matchAll(/["']([^"']{3,80})["']/g))
  .map((match) => cleanSearchCandidate(match[1]))
  .filter(Boolean);

const extractConnectorTerms = (value: string) => {
  const terms: string[] = [];
  const patterns = [
    /\b(?:sobre|contendo|mencionando|relacionad[oa]s?\s+a|referente\s+a)\s+([^?.!,;]{3,120})/gi,
    /\b(?:cotacao|cotacoes|or[cç]amento|or[cç]amentos|proposta|propostas|plano|planos)\s+(?:de|da|do|para|com)?\s*([^?.!,;]{3,120})/gi,
    /\b(?:falei|conversei|tratei|mencionei|enviei|mandei|receberam|recebeu|pediram|pediu)\s+(?:sobre|de|da|do|com|para)?\s*([^?.!,;]{3,120})/gi,
  ];

  patterns.forEach((pattern) => {
    for (const match of value.matchAll(pattern)) {
      const candidate = cleanSearchCandidate(match[1]);
      if (candidate) terms.push(candidate);
    }
  });

  return terms;
};

const extractResidualTerms = (value: string) => {
  const words = value
    .replace(/^r\.?a\.?v\.?i\.?\s*,?\s*/i, '')
    .replace(/[?.!,;:()[\]{}]/g, ' ')
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean)
    .filter((word) => {
      const normalized = normalizeSearchText(word);
      return normalized.length >= 3 && !SEARCH_STOP_WORDS.has(normalized) && !SEARCH_TIME_WORDS.has(normalized);
    });

  return words.length > 0 ? [words.join(' '), ...words] : [];
};

const buildSearchTerms = (prompt: string) => {
  const terms = [
    ...extractQuotedTerms(prompt),
    ...extractConnectorTerms(prompt),
    ...extractResidualTerms(prompt),
  ];

  return Array.from(new Map(
    terms
      .flatMap((term) => [term, ...splitTopicTerms(term)])
      .map((term) => cleanSearchCandidate(term))
      .filter((term) => normalizeSearchText(term).length >= 3)
      .filter((term) => normalizeSearchText(term).split(' ').length <= 8)
      .map((term) => [normalizeSearchText(term), term] as const),
  ).values()).slice(0, 8);
};

const inferSearchDirection = (normalizedPrompt: string): 'inbound' | 'outbound' | null => {
  if (OUTBOUND_INTENT_PATTERN.test(normalizedPrompt)) return 'outbound';
  if (INBOUND_INTENT_PATTERN.test(normalizedPrompt)) return 'inbound';
  return null;
};

const inferSearchPeriod = (normalizedPrompt: string) => {
  const now = Date.now();
  if (/\b(hoje)\b/.test(normalizedPrompt)) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return { since: today.toISOString(), label: 'hoje' };
  }
  if (/\b(ultimos 7 dias|ultimas 7 dias|7 dias|essa semana|esta semana|semana|recentemente|esses dias|estes dias)\b/.test(normalizedPrompt)) {
    return { since: new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString(), label: 'ultimos_7_dias' };
  }
  if (/\b(mes|mês|esse mes|este mes|esse mês|este mês)\b/.test(normalizedPrompt)) {
    return { since: new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString(), label: 'ultimos_30_dias' };
  }
  return { since: null, label: null };
};

const isWeakSearchTerm = (term: string) => {
  const normalized = normalizeSearchText(term);
  return normalized.length < 3
    || SEARCH_STOP_WORDS.has(normalized)
    || /^(seguro|seguros|desconto|mensalidade|primeira|75|22|05|plano|planos|cotacao|cotacoes|proposta|propostas)$/.test(normalized);
};

const buildRequiredAndOptionalTerms = (terms: string[]) => {
  const strongTerms = terms.filter((term) => !isWeakSearchTerm(term));
  const phraseTerms = strongTerms.filter((term) => normalizeSearchText(term).split(' ').length > 1);
  const requiredTerms = (phraseTerms.length > 0 ? phraseTerms : strongTerms).slice(0, 3);
  const requiredKeys = new Set(requiredTerms.map(normalizeSearchText));
  const optionalTerms = terms
    .filter((term) => !requiredKeys.has(normalizeSearchText(term)))
    .filter((term) => !isWeakSearchTerm(term))
    .slice(0, 8);

  return { requiredTerms, optionalTerms };
};

const analyzeAssistantSearchPlan = (prompt: string): AssistantSearchPlan | null => {
  const normalizedPrompt = normalizeSearchText(prompt);
  const hasAudienceIntent = SEARCH_AUDIENCE_PATTERN.test(normalizedPrompt);
  const hasActionIntent = SEARCH_ACTION_PATTERN.test(normalizedPrompt);
  const hasQuoteIntent = QUOTE_SEARCH_PATTERN.test(normalizedPrompt);

  if (!hasActionIntent && !hasAudienceIntent && !hasQuoteIntent) {
    return null;
  }

  const terms = buildSearchTerms(prompt);
  if (terms.length === 0) {
    return null;
  }

  const { requiredTerms, optionalTerms } = buildRequiredAndOptionalTerms(terms);
  if (requiredTerms.length === 0) {
    return null;
  }

  const direction = inferSearchDirection(normalizedPrompt);
  const period = inferSearchPeriod(normalizedPrompt);

  return {
    query: requiredTerms[0],
    terms,
    requiredTerms,
    optionalTerms,
    direction,
    since: period.since,
    periodLabel: period.label,
    includeHistoricalConversations: hasAudienceIntent || hasActionIntent,
    includeQuotes: hasQuoteIntent,
  };
};

const normalizeHistoricalSearchResult = (row: Record<string, unknown>) => {
  const chat = isRecord(row.chat) ? row.chat : {};
  const lead = isRecord(row.lead) ? row.lead : null;
  const rawSnippets = Array.isArray(row.snippets) ? row.snippets : [];

  return {
    chat: normalizeRecentChat(chat),
    lead: lead ? {
      id: toTrimmedString(lead.id),
      name: toNullableText(lead.nome_completo, 180),
      phone: toNullableText(lead.telefone, 80),
      status: toNullableText(lead.status_nome ?? lead.status_value, 120),
      owner: toNullableText(lead.responsavel_label ?? lead.responsavel_value, 120),
    } : null,
    latestMessageAt: toNullableText(row.latest_message_at, 80),
    matchCount: typeof row.match_count === 'number' ? row.match_count : 0,
    snippets: rawSnippets.slice(0, 3).flatMap((snippet) => {
      if (!isRecord(snippet)) return [];
      return [{
        id: toTrimmedString(snippet.messageId),
        direction: toTrimmedString(snippet.direction),
        type: toTrimmedString(snippet.type),
        at: toTrimmedString(snippet.at),
        text: clampText(toTrimmedString(snippet.text), 500),
        matchedRequiredTerm: snippet.matchedRequiredTerm === true,
        optionalMatchCount: typeof snippet.optionalMatchCount === 'number' ? snippet.optionalMatchCount : 0,
      }];
    }),
  };
};

const normalizeQuoteSearchResult = (row: Record<string, unknown>) => {
  const quote = isRecord(row.quote) ? row.quote : {};
  const lead = isRecord(row.lead) ? row.lead : null;
  const rawItems = Array.isArray(row.items) ? row.items : [];

  return {
    quote: {
      id: toTrimmedString(quote.id),
      name: toNullableText(quote.nome, 220),
      modality: toNullableText(quote.modalidade, 40),
      totalLives: typeof quote.total_vidas === 'number' ? quote.total_vidas : 0,
      leadId: toNullableText(quote.lead_id, 80),
      updatedAt: toNullableText(quote.updated_at, 80),
    },
    lead: lead ? {
      id: toTrimmedString(lead.id),
      name: toNullableText(lead.nome_completo, 180),
      phone: toNullableText(lead.telefone, 80),
      status: toNullableText(lead.status_nome ?? lead.status_value, 120),
      owner: toNullableText(lead.responsavel_label ?? lead.responsavel_value, 120),
    } : null,
    latestItemAt: toNullableText(row.latest_item_at, 80),
    matchCount: typeof row.match_count === 'number' ? row.match_count : 0,
    items: rawItems.slice(0, 5).flatMap((item) => {
      if (!isRecord(item)) return [];
      return [{
        id: toTrimmedString(item.id),
        operator: toNullableText(item.operadora, 180),
        title: toNullableText(item.titulo, 260),
        subtitle: toNullableText(item.subtitulo, 260),
        line: toNullableText(item.linha, 180),
        table: toNullableText(item.tabela, 180),
        monthlyTotal: typeof item.mensalidade_total === 'number' ? item.mensalidade_total : null,
        createdAt: toNullableText(item.created_at, 80),
      }];
    }),
  };
};

const incrementGroup = (groups: Record<string, number>, rawKey: unknown) => {
  const key = toTrimmedString(rawKey) || 'Nao informado';
  groups[key] = (groups[key] ?? 0) + 1;
};

const buildAssistantInsights = (
  historicalConversationSearch: { triggered: boolean; query: string | null; terms: string[]; results: ReturnType<typeof normalizeHistoricalSearchResult>[] },
  cotadorQuoteSearch: { triggered: boolean; query: string | null; terms: string[]; results: ReturnType<typeof normalizeQuoteSearchResult>[] },
) => {
  const byStatus: Record<string, number> = {};
  const byOwner: Record<string, number> = {};
  const bySource: Record<string, number> = {};
  const byOperatorOrProduct: Record<string, number> = {};
  const seenLeadIds = new Set<string>();
  const duplicateLeadIds = new Set<string>();
  const discardedTargets: Array<Record<string, unknown>> = [];

  const targets = historicalConversationSearch.results.flatMap((result) => {
    const leadId = result.lead?.id || result.chat.leadId || null;
    const evidence = result.snippets
      .filter((snippet) => snippet.matchedRequiredTerm === true && Boolean(snippet.text))
      .slice(0, 2)
      .map((snippet) => ({
        at: snippet.at,
        direction: snippet.direction,
        text: clampText(snippet.text, 220),
        matchedRequiredTerm: true,
        optionalMatchCount: snippet.optionalMatchCount,
      }));

    const baseTarget = {
      id: result.chat.id,
      source: 'whatsapp',
      chatId: result.chat.id,
      externalChatId: result.chat.externalChatId,
      leadId,
      displayName: result.lead?.name || result.chat.displayName || result.chat.phone,
      phone: result.lead?.phone || result.chat.phone,
      status: result.lead?.status || result.chat.leadStatus,
      owner: result.lead?.owner,
      archived: result.chat.archived,
      latestAt: result.latestMessageAt,
      evidence,
    };

    if (!result.chat.externalChatId) {
      discardedTargets.push({ ...baseTarget, discardReason: 'Sem identificador externo do WhatsApp para envio seguro.' });
      return [];
    }

    if (evidence.length === 0) {
      discardedTargets.push({ ...baseTarget, discardReason: 'Sem evidencia do termo obrigatorio retornada pela busca.' });
      return [];
    }

    if (leadId) {
      if (seenLeadIds.has(leadId)) duplicateLeadIds.add(leadId);
      seenLeadIds.add(leadId);
    }

    incrementGroup(byStatus, result.lead?.status || result.chat.leadStatus || 'Sem status');
    incrementGroup(byOwner, result.lead?.owner || 'Sem responsavel');
    incrementGroup(bySource, 'WhatsApp');

    return [baseTarget];
  });

  cotadorQuoteSearch.results.forEach((result) => {
    const leadId = result.lead?.id || result.quote.leadId || null;
    if (leadId) {
      if (seenLeadIds.has(leadId)) duplicateLeadIds.add(leadId);
      seenLeadIds.add(leadId);
    }

    incrementGroup(byStatus, result.lead?.status || 'Sem status');
    incrementGroup(byOwner, result.lead?.owner || 'Sem responsavel');
    incrementGroup(bySource, 'Cotador');
    result.items.forEach((item) => incrementGroup(byOperatorOrProduct, item.operator || item.title || 'Sem operadora/produto'));
  });

  const hotTargets = targets.filter((target) => {
    const status = normalizeSearchText(target.status || '');
    return status.includes('proposta') || status.includes('convertido') || status.includes('atendimento') || status.includes('negociacao');
  });

  return {
    generatedAt: new Date().toISOString(),
    query: historicalConversationSearch.query || cotadorQuoteSearch.query,
    terms: Array.from(new Set([...historicalConversationSearch.terms, ...cotadorQuoteSearch.terms])),
    sources: [
      historicalConversationSearch.triggered ? { name: 'WhatsApp', type: 'conversation_history', results: historicalConversationSearch.results.length } : null,
      cotadorQuoteSearch.triggered ? { name: 'Cotador', type: 'saved_quotes', results: cotadorQuoteSearch.results.length } : null,
    ].filter(Boolean),
    totals: {
      whatsappConversations: historicalConversationSearch.results.length,
      cotadorQuotes: cotadorQuoteSearch.results.length,
      actionableTargets: targets.length,
      validatedTargets: targets.length,
      discardedTargets: discardedTargets.length,
      duplicateLeadCount: duplicateLeadIds.size,
      hotLeadCount: hotTargets.length,
    },
    groups: {
      byStatus,
      byOwner,
      bySource,
      byOperatorOrProduct,
    },
    targets,
    validatedTargets: targets,
    discardedTargets,
    flags: {
      hasMultipleTargets: targets.length > 1,
      hasArchivedChats: targets.some((target) => target.archived),
      hasDuplicateLeads: duplicateLeadIds.size > 0,
      hasDiscardedTargets: discardedTargets.length > 0,
      incomplete: false,
      incompleteReason: null,
    },
    audit: {
      searchedWhatsApp: historicalConversationSearch.triggered,
      searchedCotador: cotadorQuoteSearch.triggered,
      requiredTerms: historicalConversationSearch.terms.length > 0 ? historicalConversationSearch.terms : cotadorQuoteSearch.terms,
      resultLimitPerSource: 25,
      validatedTargetCount: targets.length,
      discardedTargetCount: discardedTargets.length,
      note: 'Resultados limitados, compactados e exigindo evidencia do termo principal para operacao segura no inbox.',
    },
  };
};

const buildAssistantPlan = (
  scope: AssistantScope,
  searchPlan: AssistantSearchPlan | null,
  assistantInsights: ReturnType<typeof buildAssistantInsights>,
  selectedChatContext: { chat: ReturnType<typeof normalizeRecentChat> | null; messages: ReturnType<typeof normalizeRecentMessage>[] },
) => {
  const searchedWhatsApp = assistantInsights.audit.searchedWhatsApp === true;
  const searchedCotador = assistantInsights.audit.searchedCotador === true;
  const validatedTargetCount = assistantInsights.validatedTargets.length;
  const discardedTargetCount = assistantInsights.discardedTargets.length;
  const hasSelectedChatContext = Boolean(selectedChatContext.chat);
  const intent = searchedWhatsApp && searchedCotador
    ? 'cross_source_search'
    : searchedWhatsApp
      ? 'historical_conversation_search'
      : searchedCotador
        ? 'quote_search'
        : scope === 'chat' && hasSelectedChatContext
          ? 'selected_chat_analysis'
          : scope === 'inbox'
            ? 'inbox_operational_analysis'
            : 'general_operational_support';
  const actionMode = validatedTargetCount > 1
    ? 'bulk_select_confirm'
    : validatedTargetCount === 1
      ? 'single_target_confirm'
      : 'answer_only';
  const confidenceReasons = [
    searchedWhatsApp || searchedCotador ? 'Busca estruturada executada antes da resposta do modelo.' : 'Resposta baseada no contexto operacional carregado.',
    searchPlan?.requiredTerms.length ? 'Termos obrigatorios definidos para evitar falsos positivos.' : 'Sem termo obrigatorio aplicavel ao pedido.',
    validatedTargetCount > 0 ? `${validatedTargetCount} alvo(s) com evidencia acionavel.` : 'Nenhum alvo acionavel validado.',
    discardedTargetCount > 0 ? `${discardedTargetCount} resultado(s) descartado(s) por seguranca.` : 'Nenhum resultado descartado por seguranca.',
  ];

  return {
    generatedAt: new Date().toISOString(),
    intent,
    scope,
    actionMode,
    sources: assistantInsights.sources.flatMap((source) => (source ? [{
      name: source.name,
      type: source.type,
      status: 'loaded',
      results: source.results,
    }] : [])),
    criteria: {
      query: searchPlan?.query ?? null,
      requiredTerms: searchPlan?.requiredTerms ?? [],
      optionalTerms: searchPlan?.optionalTerms ?? [],
      direction: searchPlan?.direction ?? null,
      periodLabel: searchPlan?.periodLabel ?? null,
      requiresEvidence: searchedWhatsApp,
    },
    safetyChecks: {
      requiresHumanConfirmation: actionMode !== 'answer_only',
      blocksTargetsWithoutEvidence: true,
      blocksTargetsWithoutExternalChatId: true,
      composerRestrictedToCurrentChat: true,
    },
    counts: {
      validatedTargets: validatedTargetCount,
      discardedTargets: discardedTargetCount,
      selectedChatMessages: selectedChatContext.messages.length,
    },
    confidenceReasons,
    nextStep: actionMode === 'bulk_select_confirm'
      ? 'Selecionar contatos validados e confirmar disparo antes de qualquer envio.'
      : actionMode === 'single_target_confirm'
        ? 'Revisar o alvo validado e confirmar a acao sugerida.'
        : 'Responder ao operador sem executar acao de escrita.',
  };
};

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

const loadHistoricalConversationSearch = async (supabaseAdmin: any, searchPlan: AssistantSearchPlan | null) => {
  if (!searchPlan?.includeHistoricalConversations) {
    return {
      triggered: false,
      query: null,
      terms: [],
      results: [],
    };
  }

  const { data, error } = await supabaseAdmin.rpc('comm_whatsapp_search_leads_by_conversation_topic', {
    p_search: searchPlan.query,
    p_terms: searchPlan.terms,
    p_required_terms: searchPlan.requiredTerms,
    p_optional_terms: searchPlan.optionalTerms,
    p_direction: searchPlan.direction,
    p_since: searchPlan.since,
    p_limit: 25,
  });

  if (error) {
    throw new Error(`Falha ao buscar historico de conversas: ${error.message}`);
  }

  const results = ((Array.isArray(data) ? data : []) as Record<string, unknown>[])
    .map(normalizeHistoricalSearchResult);

  return {
    triggered: true,
    query: searchPlan.query,
    terms: searchPlan.terms,
    results,
  };
};

const loadCotadorQuoteSearch = async (supabaseAdmin: any, searchPlan: AssistantSearchPlan | null) => {
  if (!searchPlan?.includeQuotes) {
    return {
      triggered: false,
      query: null,
      terms: [],
      results: [],
    };
  }

  const { data, error } = await supabaseAdmin.rpc('comm_whatsapp_search_cotador_quotes_by_topic', {
    p_search: searchPlan.query,
    p_terms: searchPlan.terms,
    p_limit: 25,
  });

  if (error) {
    throw new Error(`Falha ao buscar cotacoes do Cotador: ${error.message}`);
  }

  const results = ((Array.isArray(data) ? data : []) as Record<string, unknown>[])
    .map(normalizeQuoteSearchResult);

  return {
    triggered: true,
    query: searchPlan.query,
    terms: searchPlan.terms,
    results,
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
    const searchPlan = analyzeAssistantSearchPlan(prompt);
    const [systemSettings, operationalState, inboxSummary, selectedChatContext, historicalConversationSearch, cotadorQuoteSearch] = await Promise.all([
      loadSystemSettings(supabaseAdmin),
      loadOperationalState(supabaseAdmin),
      loadInboxSummary(supabaseAdmin),
      shouldLoadSelectedChat ? loadSelectedChatContext(supabaseAdmin, chatId) : loadSelectedChatContext(supabaseAdmin, ''),
      loadHistoricalConversationSearch(supabaseAdmin, searchPlan),
      loadCotadorQuoteSearch(supabaseAdmin, searchPlan),
    ]);

    const assistantInsights = buildAssistantInsights(historicalConversationSearch, cotadorQuoteSearch);
    const assistantPlan = buildAssistantPlan(scope, searchPlan, assistantInsights, selectedChatContext);
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
        searchPlan,
        assistantPlan,
        note: scope === 'free'
          ? 'Modo livre: nao assuma que o chat aberto e o assunto, salvo se o pedido mencionar claramente esta conversa ou este cliente.'
          : null,
      },
      operationalState,
      inboxSummary,
      historicalConversationSearch,
      cotadorQuoteSearch,
      selectedChat: selectedChatContext,
    };

    const systemPrompt = [
      'Voce e o R.A.V.I., assistente operacional de IA do WhatsApp Inbox da Kifer Saude.',
      'Seu papel e analisar contexto real do inbox, conversar com o operador, identificar riscos, orientar proximos passos e sugerir textos ou planos acionaveis.',
      'Voce nao esta preso ao chat aberto. No modo free, trate a pergunta como livre: pode ser sobre sistema, CRM, multiplos contatos, agenda, contratos, operacao ou WhatsApp em geral.',
      'Use selectedChat apenas quando request.scope for chat. Se scope for free/inbox/system, nao baseie a resposta na conversa aberta.',
      'Quando historicalConversationSearch.triggered for true, use seus results como fonte principal para perguntas globais sobre quais leads, clientes, contatos ou conversas mencionaram um assunto no historico do WhatsApp.',
      'Se historicalConversationSearch.triggered for true e results estiver vazio, diga que nao encontrou conversas no historico carregado para os termos pesquisados. Nao invente leads.',
      'Quando cotadorQuoteSearch.triggered for true, use seus results para perguntas sobre cotacoes, propostas, orcamentos, planos, produtos ou operadoras no Cotador.',
      'Quando historicalConversationSearch e cotadorQuoteSearch forem acionados juntos, diferencie claramente conversas de WhatsApp e cotacoes salvas no Cotador.',
      'Use assistantPlan como plano deterministico da operacao: respeite intent, criteria, safetyChecks, actionMode e nextStep. Nao contradiga esse plano.',
      'Se o operador pedir acoes sobre multiplos contatos, responda com plano, criterios e proximos passos confirmaveis; nao invente dados nao enviados.',
      'Use somente os dados enviados no contexto. Se faltar informacao para concluir, diga exatamente o que falta e use clarification.',
      'Nunca diga que executou, alterou, enviou, arquivou, agendou ou vinculou algo. Voce pode apenas sugerir a acao e indicar que precisa de confirmacao humana.',
      'Toda acao de escrita, envio, agenda, mudanca de status, vinculo de lead, arquivamento ou exclusao deve aparecer com requires_confirmation true.',
      'Quando sugerir mensagem para WhatsApp, deixe suggested_message com texto pronto para o composer, sem markdown e sem aspas. Nao envie a mensagem.',
      'Quando houver uma mensagem pronta para acionar contatos, inclua tambem uma action_plan do tipo draft_message com payload.message contendo exatamente o texto sugerido.',
      'Se assistantInsights.flags.hasMultipleTargets for true, trate a mensagem como modelo para disparo selecionavel em massa, nao como mensagem para o composer do chat atual.',
      'Para disparo em massa, inclua payload.bulkEligible true e payload.message no draft_message. Nao diga que enviou; diga que os contatos precisam ser selecionados e confirmados.',
      'Quando a resposta mencionar leads, chats, cotacoes ou contatos que merecem revisao, inclua actions do tipo review_lead ou open_dashboard com payload contendo ids disponiveis no contexto; se nao houver id, use uma action manual descritiva.',
      'Quando sugerir follow-up ou agenda, inclua action do tipo schedule_follow_up com payload contendo leadId, chatId, title, reason e suggestedDateTime quando esses dados existirem.',
      'Responda em portugues do Brasil, com tom direto, consultivo e operacional.',
      'Retorne exclusivamente JSON valido no formato: {"answer":"...","clarification":null,"confidence":"low|medium|high","action_plan":[{"id":"...","type":"draft_message|schedule_follow_up|review_lead|open_dashboard|manual","title":"...","description":"...","requires_confirmation":true,"payload":{}}],"suggested_message":null}.',
    ].join('\n\n');

    const userPrompt = [
      'Pedido do operador:',
      prompt,
      '',
      'Contexto operacional em JSON:',
      JSON.stringify(context, null, 2),
      '',
      'Insights estruturados ja calculados:',
      JSON.stringify(assistantInsights, null, 2),
      '',
      'Plano deterministico da operacao:',
      JSON.stringify(assistantPlan, null, 2),
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
      assistant_plan: assistantPlan,
      assistant_insights: assistantInsights,
      context_summary: {
        scope,
        chatLoaded: Boolean(selectedChatContext.chat),
        messagesLoaded: selectedChatContext.messages.length,
        leadLoaded: Boolean(selectedChatContext.lead),
        contractsLoaded: Array.isArray(selectedChatContext.contracts) ? selectedChatContext.contracts.length : 0,
        remindersLoaded: Array.isArray(selectedChatContext.reminders) ? selectedChatContext.reminders.length : 0,
        recentChatsLoaded: inboxSummary.recentChats.length,
        historicalSearchTriggered: historicalConversationSearch.triggered,
        historicalSearchResultsLoaded: historicalConversationSearch.results.length,
        quoteSearchTriggered: cotadorQuoteSearch.triggered,
        quoteSearchResultsLoaded: cotadorQuoteSearch.results.length,
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
