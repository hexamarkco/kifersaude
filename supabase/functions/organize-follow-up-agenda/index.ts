/* eslint-disable @typescript-eslint/no-explicit-any */
// @ts-expect-error Deno npm import
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { authorizeDashboardUser } from '../_shared/dashboard-auth.ts';
import { generateTextWithRouting } from '../_shared/ai-router.ts';
import { corsHeaders, isRecord, toTrimmedString } from '../_shared/comm-whatsapp.ts';

declare const Deno: {
  env: { get: (key: string) => string | undefined };
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};

type OrganizerMode = 'balanced' | 'urgency' | 'minimal_changes';

type OrganizerOptions = {
  dailyLimit: number;
  queueTime: string;
  startDate: string;
  weekdaysOnly: boolean;
  includeOverdue: boolean;
  preserveToday: boolean;
  priorityMode: OrganizerMode;
};

type ReminderRow = {
  id: string;
  contract_id: string | null;
  lead_id: string | null;
  tipo: string | null;
  titulo: string | null;
  descricao: string | null;
  data_lembrete: string;
  lido: boolean;
  prioridade: string | null;
  responsavel: string | null;
  created_at: string | null;
};

type LeadRow = {
  id: string;
  nome_completo: string | null;
  telefone: string | null;
  status: string | null;
  responsavel: string | null;
  ultimo_contato: string | null;
  proximo_retorno: string | null;
};

type ContractRow = {
  id: string;
  lead_id: string | null;
  status: string | null;
  modalidade: string | null;
  operadora: string | null;
  produto_plano: string | null;
};

type ChatRow = {
  id: string;
  lead_id: string | null;
  display_name: string | null;
  saved_contact_name: string | null;
  phone_number: string | null;
  unread_count: number | null;
  manual_unread: boolean | null;
  is_archived: boolean | null;
  last_message_at: string | null;
  last_message_direction: string | null;
  last_message_text: string | null;
};

type Candidate = {
  reminder: ReminderRow;
  lead: LeadRow | null;
  chat: ChatRow | null;
  score: number;
  reasons: string[];
};

type PreviewChange = {
  reminderId: string;
  leadId: string | null;
  leadName: string;
  title: string;
  currentDateTime: string;
  newDateTime: string;
  priority: string;
  score: number;
  reasons: string[];
  changed: boolean;
};

const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };
const DEFAULT_OPTIONS: OrganizerOptions = {
  dailyLimit: 20,
  queueTime: '09:00',
  startDate: new Date().toISOString().slice(0, 10),
  weekdaysOnly: true,
  includeOverdue: true,
  preserveToday: true,
  priorityMode: 'balanced',
};
const MAX_DAILY_LIMIT = 80;
const MAX_CANDIDATES = 500;

const createAdminClient = () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Credenciais do Supabase nao configuradas.');
  }

  return createClient(supabaseUrl, serviceRoleKey);
};

const normalizeDateOnly = (value: unknown) => {
  const text = toTrimmedString(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  return new Date().toISOString().slice(0, 10);
};

const normalizeQueueTime = (value: unknown) => {
  const text = toTrimmedString(value);
  if (/^\d{2}:\d{2}$/.test(text)) return text;
  return DEFAULT_OPTIONS.queueTime;
};

const normalizeMode = (value: unknown): OrganizerMode => {
  const text = toTrimmedString(value);
  if (text === 'urgency' || text === 'minimal_changes' || text === 'balanced') return text;
  return 'balanced';
};

const toBoolean = (value: unknown, fallback: boolean) => (typeof value === 'boolean' ? value : fallback);

const normalizeOptions = (value: unknown): OrganizerOptions => {
  const raw = isRecord(value) ? value : {};
  const dailyLimit = Math.min(
    MAX_DAILY_LIMIT,
    Math.max(1, Number.isFinite(Number(raw.dailyLimit)) ? Math.floor(Number(raw.dailyLimit)) : DEFAULT_OPTIONS.dailyLimit),
  );

  return {
    dailyLimit,
    queueTime: normalizeQueueTime(raw.queueTime),
    startDate: normalizeDateOnly(raw.startDate),
    weekdaysOnly: toBoolean(raw.weekdaysOnly, DEFAULT_OPTIONS.weekdaysOnly),
    includeOverdue: toBoolean(raw.includeOverdue, DEFAULT_OPTIONS.includeOverdue),
    preserveToday: toBoolean(raw.preserveToday, DEFAULT_OPTIONS.preserveToday),
    priorityMode: normalizeMode(raw.priorityMode),
  };
};

const startOfLocalDay = (date: Date) => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

const parseLocalDate = (value: string) => {
  const [year, month, day] = value.split('-').map((item) => Number(item));
  const date = new Date(year, month - 1, day);
  date.setHours(0, 0, 0, 0);
  return Number.isNaN(date.getTime()) ? startOfLocalDay(new Date()) : date;
};

const isWeekend = (date: Date) => date.getDay() === 0 || date.getDay() === 6;

const advanceDay = (date: Date, weekdaysOnly: boolean) => {
  const next = new Date(date);
  do {
    next.setDate(next.getDate() + 1);
  } while (weekdaysOnly && isWeekend(next));
  return next;
};

const formatLocalDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const buildIsoAtLocalTime = (date: Date, queueTime: string) => {
  const [hours, minutes] = queueTime.split(':').map((item) => Number(item));
  const next = new Date(date);
  next.setHours(hours || 0, minutes || 0, 0, 0);
  return next.toISOString();
};

const normalizeText = (value: unknown) => toTrimmedString(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase();

const isFollowUpReminder = (reminder: ReminderRow) => normalizeText(reminder.tipo) === 'follow-up';

const isHotStatus = (status: unknown) => {
  const normalized = normalizeText(status);
  return normalized.includes('proposta')
    || normalized.includes('cotacao')
    || normalized.includes('negociacao')
    || normalized.includes('atendimento')
    || normalized.includes('convertido');
};

const daysBetween = (left: Date, right: Date) => Math.floor((startOfLocalDay(left).getTime() - startOfLocalDay(right).getTime()) / 86400000);

const buildCandidate = (reminder: ReminderRow, lead: LeadRow | null, chat: ChatRow | null, now: Date, options: OrganizerOptions): Candidate => {
  const dueAt = new Date(reminder.data_lembrete);
  const overdueDays = Math.max(0, daysBetween(now, dueAt));
  const lastContactAt = lead?.ultimo_contato || chat?.last_message_at || reminder.created_at || reminder.data_lembrete;
  const idleDays = Math.max(0, daysBetween(now, new Date(lastContactAt)));
  const hasUnread = Number(chat?.unread_count ?? 0) > 0 || chat?.manual_unread === true;
  const hasInbound = normalizeText(chat?.last_message_direction) === 'inbound';
  const priority = normalizeText(reminder.prioridade);
  const reasons: string[] = [];
  let score = 0;

  if (overdueDays > 0) {
    score += 100 + Math.min(overdueDays, 30) * 4;
    reasons.push(`Atrasado ha ${overdueDays} dia(s).`);
  }

  if (priority === 'alta') {
    score += 35;
    reasons.push('Prioridade alta.');
  }

  if (isHotStatus(lead?.status)) {
    score += 30;
    reasons.push(`Status quente: ${lead?.status}.`);
  }

  if (hasUnread) {
    score += 25;
    reasons.push('Chat com nao lidas.');
  } else if (hasInbound) {
    score += 15;
    reasons.push('Ultima mensagem recebida do cliente.');
  }

  if (idleDays >= 3) {
    score += Math.min(idleDays, 20);
    reasons.push(`Sem contato ha ${idleDays} dia(s).`);
  }

  if (chat?.is_archived) {
    score -= 10;
    reasons.push('Chat arquivado, revisar com cuidado.');
  }

  if (options.priorityMode === 'urgency') score += overdueDays > 0 || hasUnread ? 20 : 0;
  if (options.priorityMode === 'minimal_changes') score -= Math.abs(daysBetween(parseLocalDate(options.startDate), dueAt));

  if (reasons.length === 0) reasons.push('Follow-up pendente dentro do criterio configurado.');

  return { reminder, lead, chat, score, reasons };
};

const chunk = <T,>(items: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size));
  return chunks;
};

const fetchByIds = async <T,>(supabaseAdmin: any, table: string, ids: string[], select = '*'): Promise<T[]> => {
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
  if (uniqueIds.length === 0) return [];

  const pages = await Promise.all(chunk(uniqueIds, 100).map(async (batch) => {
    const { data, error } = await supabaseAdmin.from(table).select(select).in('id', batch);
    if (error) throw new Error(`Falha ao carregar ${table}: ${error.message}`);
    return (data ?? []) as T[];
  }));

  return pages.flat();
};

const loadCandidates = async (supabaseAdmin: any, options: OrganizerOptions) => {
  const today = startOfLocalDay(new Date());
  const startDate = parseLocalDate(options.startDate);
  const lowerBound = options.includeOverdue ? null : startDate.toISOString();

  let query = supabaseAdmin
    .from('reminders')
    .select('id, contract_id, lead_id, tipo, titulo, descricao, data_lembrete, lido, prioridade, responsavel, created_at')
    .eq('lido', false)
    .order('data_lembrete', { ascending: true })
    .limit(MAX_CANDIDATES);

  if (lowerBound) query = query.gte('data_lembrete', lowerBound);

  const { data, error } = await query;
  if (error) throw new Error(`Falha ao carregar follow-ups: ${error.message}`);

  const reminders = ((data ?? []) as ReminderRow[])
    .filter(isFollowUpReminder)
    .filter((reminder) => {
      if (!options.preserveToday) return true;
      const dueDay = startOfLocalDay(new Date(reminder.data_lembrete));
      const isToday = dueDay.getTime() === today.getTime();
      const isOverdue = dueDay.getTime() < today.getTime();
      return !isToday || isOverdue;
    });

  const contracts = await fetchByIds<ContractRow>(
    supabaseAdmin,
    'contracts',
    reminders.map((reminder) => reminder.contract_id ?? ''),
    'id, lead_id, status, modalidade, operadora, produto_plano',
  );
  const contractsById = new Map(contracts.map((contract) => [contract.id, contract]));
  const leadIds = Array.from(new Set(reminders.flatMap((reminder) => {
    const leadId = reminder.lead_id || (reminder.contract_id ? contractsById.get(reminder.contract_id)?.lead_id : null);
    return leadId ? [leadId] : [];
  })));
  const leads = await fetchByIds<LeadRow>(
    supabaseAdmin,
    'leads',
    leadIds,
    'id, nome_completo, telefone, status, responsavel, ultimo_contato, proximo_retorno',
  );
  const leadsById = new Map(leads.map((lead) => [lead.id, lead]));

  const chatPages = await Promise.all(chunk(leadIds, 100).map(async (batch) => {
    const { data: chatData, error: chatError } = await supabaseAdmin
      .from('comm_whatsapp_chats')
      .select('id, lead_id, display_name, saved_contact_name, phone_number, unread_count, manual_unread, is_archived, last_message_at, last_message_direction, last_message_text')
      .in('lead_id', batch)
      .order('last_message_at', { ascending: false });
    if (chatError) throw new Error(`Falha ao carregar chats: ${chatError.message}`);
    return (chatData ?? []) as ChatRow[];
  }));
  const chatsByLeadId = new Map<string, ChatRow>();
  chatPages.flat().forEach((chat) => {
    if (chat.lead_id && !chatsByLeadId.has(chat.lead_id)) chatsByLeadId.set(chat.lead_id, chat);
  });

  return reminders.map((reminder) => {
    const leadId = reminder.lead_id || (reminder.contract_id ? contractsById.get(reminder.contract_id)?.lead_id : null) || null;
    const lead = leadId ? leadsById.get(leadId) ?? null : null;
    const chat = leadId ? chatsByLeadId.get(leadId) ?? null : null;
    return buildCandidate(reminder, lead, chat, new Date(), options);
  });
};

const tryAiRankCandidates = async (supabaseAdmin: any, candidates: Candidate[], options: OrganizerOptions) => {
  const compact = candidates.slice(0, 120).map((candidate) => ({
    id: candidate.reminder.id,
    lead: candidate.lead?.nome_completo || candidate.chat?.display_name || candidate.reminder.titulo,
    status: candidate.lead?.status,
    dueAt: candidate.reminder.data_lembrete,
    priority: candidate.reminder.prioridade,
    score: candidate.score,
    reasons: candidate.reasons,
    unread: Number(candidate.chat?.unread_count ?? 0) > 0 || candidate.chat?.manual_unread === true,
    lastDirection: candidate.chat?.last_message_direction,
  }));

  try {
    const result = await generateTextWithRouting({
      supabaseAdmin,
      task: 'follow_up_agenda_organization',
      systemPrompt: [
        'Voce ajuda a priorizar uma fila diaria de follow-ups comerciais de planos de saude.',
        'Use somente os dados enviados. Nao invente clientes, datas ou fatos.',
        'Retorne apenas JSON valido no formato {"rankedIds":["..."],"notes":{"id":"motivo curto"}}.',
        'Priorize atrasados, status comerciais quentes, chats com resposta/nao lidas e follow-ups antigos.',
      ].join('\n'),
      userPrompt: JSON.stringify({ options, candidates: compact }),
      temperature: 0.15,
      maxTokens: 700,
      preferDefaultModel: true,
    });
    const parsed = JSON.parse(result.text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim());
    const rankedIds = Array.isArray(parsed?.rankedIds) ? parsed.rankedIds.filter((id: unknown): id is string => typeof id === 'string') : [];
    const notes = isRecord(parsed?.notes) ? parsed.notes as Record<string, unknown> : {};
    return { rankedIds, notes, provider: result.provider, model: result.model, fallbackUsed: result.fallbackUsed };
  } catch (error) {
    console.error('[organize-follow-up-agenda] IA indisponivel para ranking, usando fallback deterministico', error);
    return { rankedIds: [], notes: {}, provider: null, model: null, fallbackUsed: false };
  }
};

const buildPreview = async (supabaseAdmin: any, options: OrganizerOptions) => {
  const candidates = await loadCandidates(supabaseAdmin, options);
  const deterministic = [...candidates].sort((left, right) => {
    if (right.score !== left.score) return right.score - left.score;
    return new Date(left.reminder.data_lembrete).getTime() - new Date(right.reminder.data_lembrete).getTime();
  });
  const ai = await tryAiRankCandidates(supabaseAdmin, deterministic, options);
  const byId = new Map(deterministic.map((candidate) => [candidate.reminder.id, candidate]));
  const used = new Set<string>();
  const ranked = [
    ...ai.rankedIds.flatMap((id) => {
      const candidate = byId.get(id);
      if (!candidate || used.has(id)) return [];
      used.add(id);
      return [candidate];
    }),
    ...deterministic.filter((candidate) => !used.has(candidate.reminder.id)),
  ];

  let scheduleDate = parseLocalDate(options.startDate);
  while (options.weekdaysOnly && isWeekend(scheduleDate)) scheduleDate = advanceDay(scheduleDate, true);
  let dayCount = 0;
  const changes: PreviewChange[] = ranked.map((candidate) => {
    if (dayCount >= options.dailyLimit) {
      scheduleDate = advanceDay(scheduleDate, options.weekdaysOnly);
      dayCount = 0;
    }
    const newDateTime = buildIsoAtLocalTime(scheduleDate, options.queueTime);
    dayCount += 1;
    const aiNote = toTrimmedString(ai.notes[candidate.reminder.id]);
    const reasons = aiNote ? [aiNote, ...candidate.reasons] : candidate.reasons;
    const leadName = candidate.lead?.nome_completo || candidate.chat?.display_name || candidate.chat?.saved_contact_name || candidate.reminder.titulo || 'Lead sem nome';

    return {
      reminderId: candidate.reminder.id,
      leadId: candidate.lead?.id ?? null,
      leadName,
      title: candidate.reminder.titulo || 'Follow-up',
      currentDateTime: candidate.reminder.data_lembrete,
      newDateTime,
      priority: candidate.reminder.prioridade || 'normal',
      score: Math.round(candidate.score),
      reasons: reasons.slice(0, 4),
      changed: candidate.reminder.data_lembrete !== newDateTime,
    };
  });

  const groupedDays = changes.reduce<Record<string, number>>((acc, change) => {
    const key = formatLocalDate(new Date(change.newDateTime));
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  return {
    options,
    generatedAt: new Date().toISOString(),
    totalCandidates: candidates.length,
    totalChanges: changes.filter((change) => change.changed).length,
    groupedDays,
    changes,
    ai: { provider: ai.provider, model: ai.model, fallback_used: ai.fallbackUsed },
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
      req,
      supabaseUrl,
      supabaseAnonKey,
      supabaseAdmin,
      module: 'agenda',
      requiredPermission: 'edit',
    });

    if (!authResult.authorized) {
      return new Response(JSON.stringify(authResult.body), { status: authResult.status, headers: jsonHeaders });
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const action = toTrimmedString(body.action) || 'preview';
    const options = normalizeOptions(body.options);

    if (action === 'preview') {
      const preview = await buildPreview(supabaseAdmin, options);
      return new Response(JSON.stringify({ success: true, preview }), { status: 200, headers: jsonHeaders });
    }

    if (action === 'apply') {
      const rawChanges = Array.isArray(body.changes) ? body.changes : [];
      const changes = rawChanges.flatMap((item): Array<{ reminderId: string; leadId: string | null; newDateTime: string }> => {
        if (!isRecord(item)) return [];
        const reminderId = toTrimmedString(item.reminderId);
        const leadId = toTrimmedString(item.leadId) || null;
        const newDateTime = toTrimmedString(item.newDateTime);
        if (!reminderId || Number.isNaN(new Date(newDateTime).getTime())) return [];
        return [{ reminderId, leadId, newDateTime }];
      });

      if (changes.length === 0) {
        return new Response(JSON.stringify({ error: 'Nenhuma alteracao valida para aplicar.' }), { status: 400, headers: jsonHeaders });
      }

      const ids = changes.map((change) => change.reminderId);
      const { data: reminders, error } = await supabaseAdmin
        .from('reminders')
        .select('id, lead_id, contract_id, tipo, lido')
        .in('id', ids);
      if (error) throw new Error(`Falha ao validar follow-ups: ${error.message}`);

      const validIds = new Set(((reminders ?? []) as ReminderRow[]).filter((reminder) => !reminder.lido && isFollowUpReminder(reminder)).map((reminder) => reminder.id));
      const validChanges = changes.filter((change) => validIds.has(change.reminderId));

      for (const change of validChanges) {
        const { error: updateError } = await supabaseAdmin
          .from('reminders')
          .update({ data_lembrete: change.newDateTime, ultima_modificacao: new Date().toISOString() })
          .eq('id', change.reminderId)
          .eq('lido', false);
        if (updateError) throw new Error(`Falha ao reagendar follow-up: ${updateError.message}`);
      }

      const affectedLeadIds = Array.from(new Set([
        ...validChanges.flatMap((change) => change.leadId ? [change.leadId] : []),
        ...((reminders ?? []) as ReminderRow[]).flatMap((reminder) => reminder.lead_id ? [reminder.lead_id] : []),
      ]));
      await Promise.all(affectedLeadIds.map(async (leadId) => {
        const { data: nextReminder, error: nextError } = await supabaseAdmin
          .from('reminders')
          .select('data_lembrete')
          .eq('lead_id', leadId)
          .eq('lido', false)
          .gte('data_lembrete', new Date().toISOString())
          .order('data_lembrete', { ascending: true })
          .limit(1)
          .maybeSingle();
        if (nextError) throw new Error(`Falha ao sincronizar proximo retorno: ${nextError.message}`);
        const { error: leadError } = await supabaseAdmin
          .from('leads')
          .update({ proximo_retorno: nextReminder?.data_lembrete ?? null })
          .eq('id', leadId);
        if (leadError) throw new Error(`Falha ao atualizar lead: ${leadError.message}`);
      }));

      return new Response(JSON.stringify({ success: true, applied: validChanges.length, skipped: changes.length - validChanges.length }), { status: 200, headers: jsonHeaders });
    }

    return new Response(JSON.stringify({ error: 'Acao invalida.' }), { status: 400, headers: jsonHeaders });
  } catch (error) {
    console.error('[organize-follow-up-agenda] erro inesperado', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno ao organizar agenda.' }), { status: 500, headers: jsonHeaders });
  }
});
