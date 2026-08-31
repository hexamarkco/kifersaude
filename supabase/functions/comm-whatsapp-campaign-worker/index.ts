import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { authorizeDashboardUser, isServiceRoleRequest } from '../_shared/dashboard-auth.ts';
import { generateTextWithRouting } from '../_shared/ai-router.ts';
import {
  buildWhapiDirectChatId,
  checkWhapiContactStatus,
  corsHeaders,
  createWhapiClient,
  ensureCommWhatsAppSettings,
  ensurePrimaryChannel,
  extractWhapiMessageId,
  formatPhoneLabel,
  getCommWhatsAppPhoneLookupKeys,
  getNowIso,
  normalizeCommWhatsAppPhone,
  parseWhapiError,
  persistCommWhatsAppMessage,
  readResponsePayload,
  resolveCommWhatsAppCanonicalChatRoute,
  resolveCommWhatsAppCanonicalChatRouteByUuid,
  resolveWhapiOutboundDeliveryStatus,
  sanitizeWhapiToken,
  toTrimmedString,
  WHAPI_BASE_URL,
} from '../_shared/comm-whatsapp.ts';
import { CampaignTargetLeaseLostError, createLockToken, updateClaimedTarget } from '../_shared/campaign-lock.ts';
import { mapWithConcurrency } from '../_shared/concurrency.ts';

declare const Deno: {
  env: {
    get: (key: string) => string | undefined;
  };
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};

type WorkerAction = 'activate' | 'process' | 'test_send';

type WorkerRequestBody = {
  action?: WorkerAction;
  campaignId?: string;
  limit?: number;
  source?: 'cron' | 'manual' | 'dashboard' | 'api';
  phoneNumber?: string;
  stepIndex?: number;
  variant?: 'A' | 'B';
};

type CampaignRow = {
  id: string;
  name: string;
  status: string;
  audience_source: 'crm' | 'csv' | 'manual' | 'mixed';
  audience_config: Record<string, unknown> | null;
  message_text: string;
  scheduled_at: string | null;
  pacing_per_minute: number;
  daily_send_limit: number | null;
  send_window_start: string | null;
  send_window_end: string | null;
  stop_on_reply: boolean;
  created_by: string | null;
  ab_test_enabled: boolean;
  ab_split_percent: number;
  recurrence_rule: 'none' | 'daily' | 'weekly' | 'monthly';
  recurrence_interval: number;
  recurrence_end_at: string | null;
  recurrence_next_run_at: string | null;
  recurrence_runs_completed: number;
  create_leads_from_csv: boolean;
  active_weekdays: number[];
};

type TargetRow = {
  id: string;
  campaign_id: string;
  lead_id: string | null;
  chat_id: string | null;
  phone_number: string;
  phone_digits: string;
  display_name: string | null;
  source_kind: string;
  status: string;
  current_step_index: number;
  attempts: number;
  retry_count: number;
  locked_at: string | null;
  lock_token: string | null;
  sent_at: string | null;
  responded_at: string | null;
  ab_variant: 'A' | 'B' | null;
};

type CampaignStepRow = {
  id: string;
  campaign_id: string;
  step_index: number;
  stage_index: number;
  step_kind: 'message' | 'status_change';
  status_to_set: string | null;
  message_text: string;
  delay_amount: number;
  delay_unit: 'seconds' | 'minutes' | 'hours' | 'days';
  media_url: string | null;
  media_type: 'image' | 'document' | 'video' | null;
  media_filename: string | null;
  variant_label: 'ANY' | 'A' | 'B';
};

type LeadRow = {
  id: string;
  nome_completo: string | null;
  telefone: string | null;
  status: string | null;
  responsavel: string | null;
  responsavel_id: string | null;
  arquivado: boolean | null;
  ultimo_contato: string | null;
};

type InboundMessageRow = {
  id: string;
  chat_id: string;
  message_type: string;
  text_content: string | null;
  media_caption: string | null;
  transcription_text: string | null;
  message_at: string;
};

type IntentClassification = {
  intent: 'opt_out' | 'negative_interest' | 'angry_or_complaint' | 'wrong_number' | 'continue_conversation' | 'unclear';
  confidence: number;
  recommended_action: 'suggest_block_whatsapp_campaigns' | 'keep_active' | 'review';
  reason: string;
  evidence: string;
};

type WorkerRunSource = NonNullable<WorkerRequestBody['source']>;

type WorkerRunResult = {
  processed?: number;
  sent?: number;
  failed?: number;
  stopped?: number;
};

type CampaignDispatchReservation = {
  result: 'reserved' | 'rate_limited' | 'daily_limited' | 'lease_lost';
  event_id: string | null;
  attempts: number | null;
  retry_at: string | null;
  reason: string | null;
  reserved_at: string | null;
};

const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };
const CRM_TARGET_PAGE_SIZE = 1000;
const CRM_TARGET_INSERT_CHUNK_SIZE = 500;
const OPT_OUT_LOOKUP_CHUNK_SIZE = 500;
const MAX_SEND_ATTEMPTS = 3;
const RETRY_BACKOFF_MINUTES = [5, 30, 120];
const DEFAULT_CAMPAIGN_TIME_ZONE = 'America/Sao_Paulo';
// Quantos alvos reivindicados são enviados em paralelo por invocação. Não muda
// quantos alvos são processados por minuto (isso continua sendo o teto de
// pacing_per_minute/maxLimit já aplicado no claim) — só reduz o tempo de
// parede gasto para processar o mesmo lote, que antes era pago inteiramente
// de forma sequencial (uma chamada HTTP à Whapi de cada vez).
const DEFAULT_CAMPAIGN_SEND_CONCURRENCY = 5;

const getCampaignSendConcurrency = (): number => {
  const raw = Number(Deno.env.get('COMM_WHATSAPP_CAMPAIGN_SEND_CONCURRENCY'));
  return Number.isFinite(raw) && raw >= 1 ? Math.floor(raw) : DEFAULT_CAMPAIGN_SEND_CONCURRENCY;
};

const createAdminClient = () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Credenciais do Supabase nao configuradas.');
  }

  return createClient(supabaseUrl, serviceRoleKey);
};

const createJsonResponse = (payload: unknown, status = 200) => new Response(JSON.stringify(payload), {
  status,
  headers: jsonHeaders,
});

const normalizeRunSource = (value: unknown): WorkerRunSource => {
  return value === 'cron' || value === 'manual' || value === 'dashboard' || value === 'api' ? value : 'manual';
};

async function createWorkerRun(
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  params: { action: WorkerAction; source: WorkerRunSource; campaignId?: string | null },
) {
  const { data, error } = await supabaseAdmin
    .from('comm_whatsapp_campaign_worker_runs')
    .insert({
      action: params.action,
      source: params.source,
      campaign_id: params.campaignId || null,
      status: 'running',
    })
    .select('id,started_at')
    .single();

  if (error) {
    console.error('[comm-whatsapp-campaign-worker] erro ao registrar inicio da execucao', error);
    return null;
  }

  return data as { id: string; started_at: string };
}

async function finishWorkerRun(
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  run: { id: string; started_at: string } | null,
  params: { status: 'success' | 'failed'; result?: WorkerRunResult; errorMessage?: string },
) {
  if (!run) return;
  const finishedAt = new Date();
  const startedAt = new Date(run.started_at);
  const durationMs = Number.isNaN(startedAt.getTime()) ? null : Math.max(0, finishedAt.getTime() - startedAt.getTime());

  const { error } = await supabaseAdmin
    .from('comm_whatsapp_campaign_worker_runs')
    .update({
      status: params.status,
      processed: params.result?.processed ?? 0,
      sent: params.result?.sent ?? 0,
      failed: params.result?.failed ?? 0,
      stopped: params.result?.stopped ?? 0,
      duration_ms: durationMs,
      error_message: params.errorMessage ?? null,
      finished_at: finishedAt.toISOString(),
    })
    .eq('id', run.id);

  if (error) {
    console.error('[comm-whatsapp-campaign-worker] erro ao finalizar registro da execucao', error);
  }
}

const getNestedRecord = (value: unknown, key: string): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const nested = (value as Record<string, unknown>)[key];
  return nested && typeof nested === 'object' && !Array.isArray(nested) ? nested as Record<string, unknown> : {};
};

const toRecord = (value: unknown): Record<string, unknown> => (
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
);

const getOptionalString = (value: unknown) => typeof value === 'string' && value.trim() ? value.trim() : null;

const chunkArray = <T,>(items: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

class CampaignProviderAcceptedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CampaignProviderAcceptedError';
  }
}

const parseTimeOfDayToMinutes = (value: string | null) => {
  if (!value) return null;
  const match = value.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
};

const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// 0 = domingo .. 6 = sabado, mesma convencao de Date.getDay(). Sem
// active_weekdays configurado (nulo/vazio - nao deveria acontecer com o
// NOT NULL DEFAULT da coluna, mas o worker nao deve travar por causa disso),
// trata como "todos os dias" para nao pausar campanhas silenciosamente.
const isWithinActiveWeekday = (campaign: CampaignRow, now: Date, timeZone: string) => {
  const activeWeekdays = campaign.active_weekdays;
  if (!Array.isArray(activeWeekdays) || activeWeekdays.length === 0) return true;

  const weekdayName = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' }).format(now);
  const weekdayIndex = WEEKDAY_NAMES.indexOf(weekdayName);
  if (weekdayIndex === -1) return true;

  return activeWeekdays.includes(weekdayIndex);
};

const isWithinSendWindow = (campaign: CampaignRow, now = new Date()) => {
  const timeZone = Deno.env.get('COMM_WHATSAPP_CAMPAIGN_TIME_ZONE') || DEFAULT_CAMPAIGN_TIME_ZONE;
  if (!isWithinActiveWeekday(campaign, now, timeZone)) return false;

  const start = parseTimeOfDayToMinutes(campaign.send_window_start);
  const end = parseTimeOfDayToMinutes(campaign.send_window_end);
  if (start === null || end === null || start === end) return true;

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const currentHour = Number(parts.find((part) => part.type === 'hour')?.value ?? now.getUTCHours()) % 24;
  const currentMinute = Number(parts.find((part) => part.type === 'minute')?.value ?? now.getUTCMinutes());
  const current = currentHour * 60 + currentMinute;
  if (start < end) return current >= start && current < end;
  return current >= start || current < end;
};

const computeNextRecurrenceRun = (rule: CampaignRow['recurrence_rule'], interval: number, from: Date): string | null => {
  const step = Math.max(Math.floor(interval) || 1, 1);
  const next = new Date(from.getTime());
  if (rule === 'daily') next.setUTCDate(next.getUTCDate() + step);
  else if (rule === 'weekly') next.setUTCDate(next.getUTCDate() + step * 7);
  else if (rule === 'monthly') next.setUTCMonth(next.getUTCMonth() + step);
  else return null;
  return next.toISOString();
};

const getNextRetryAt = (attempts: number) => {
  const retryIndex = Math.max(attempts - 1, 0);
  const minutes = RETRY_BACKOFF_MINUTES[Math.min(retryIndex, RETRY_BACKOFF_MINUTES.length - 1)] ?? 120;
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
};

const INTENTS = new Set(['opt_out', 'negative_interest', 'angry_or_complaint', 'wrong_number', 'continue_conversation', 'unclear']);
const RECOMMENDED_ACTIONS = new Set(['suggest_block_whatsapp_campaigns', 'keep_active', 'review']);

const getDelayMs = (step: CampaignStepRow) => {
  const amount = Math.max(Number(step.delay_amount) || 0, 0);
  if (step.delay_unit === 'seconds') return amount * 1000;
  if (step.delay_unit === 'hours') return amount * 60 * 60 * 1000;
  if (step.delay_unit === 'days') return amount * 24 * 60 * 60 * 1000;
  return amount * 60 * 1000;
};

// Mesma logica de src/lib/greeting.ts, duplicada aqui porque Edge Functions
// (Deno) nao podem importar codigo do bundle do frontend.
const resolveCampaignGreeting = (now = new Date()): string => {
  const timeZone = Deno.env.get('COMM_WHATSAPP_CAMPAIGN_TIME_ZONE') || DEFAULT_CAMPAIGN_TIME_ZONE;
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, hour: '2-digit', hour12: false }).formatToParts(now);
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? now.getUTCHours()) % 24;

  if (hour >= 5 && hour < 12) return 'bom dia';
  if (hour >= 12 && hour < 18) return 'boa tarde';
  return 'boa noite';
};

const formatGreetingTitle = (greeting: string): string => {
  const trimmed = greeting.trim();
  return trimmed ? `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1)}` : '';
};

// {{primeiro_nome}} sempre sai so com a inicial maiuscula, independente de
// como o nome esta cadastrado (tudo maiusculo, tudo minusculo, etc.).
const formatFirstNameTitle = (value: string): string => {
  const trimmed = value.trim();
  return trimmed ? `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1).toLowerCase()}` : '';
};

const resolveMessageText = (template: string, params: { lead?: LeadRow | null; target?: TargetRow | null }) => {
  const lead = params.lead ?? null;
  const target = params.target ?? null;
  const greeting = resolveCampaignGreeting();
  const replacements: Record<string, string> = {
    nome: lead?.nome_completo || target?.display_name || '',
    primeiro_nome: formatFirstNameTitle((lead?.nome_completo || target?.display_name || '').split(/\s+/).filter(Boolean)[0] || ''),
    telefone: lead?.telefone || target?.phone_number || '',
    status: lead?.status || '',
    responsavel: lead?.responsavel || '',
    saudacao: greeting,
    saudacao_titulo: formatGreetingTitle(greeting),
    saudacao_capitalizada: formatGreetingTitle(greeting),
  };

  return template.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key: string) => replacements[key] ?? '');
};

const extractJsonObject = (value: string): Record<string, unknown> => {
  const trimmed = value.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start < 0 || end < start) return {};

  try {
    const parsed = JSON.parse(trimmed.slice(start, end + 1));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
};

const normalizeClassification = (value: Record<string, unknown>): IntentClassification => {
  const rawIntent = toTrimmedString(value.intent);
  const rawAction = toTrimmedString(value.recommended_action);
  const numericConfidence = Number(value.confidence);

  return {
    intent: (INTENTS.has(rawIntent) ? rawIntent : 'unclear') as IntentClassification['intent'],
    confidence: Number.isFinite(numericConfidence) ? Math.min(Math.max(numericConfidence, 0), 1) : 0,
    recommended_action: (RECOMMENDED_ACTIONS.has(rawAction) ? rawAction : 'review') as IntentClassification['recommended_action'],
    reason: toTrimmedString(value.reason).slice(0, 900),
    evidence: toTrimmedString(value.evidence).slice(0, 500),
  };
};

const getInboundMessageText = (message: InboundMessageRow) => (
  toTrimmedString(message.text_content)
  || toTrimmedString(message.media_caption)
  || toTrimmedString(message.transcription_text)
  || `[${message.message_type || 'mensagem sem texto'}]`
);

async function classifyInboundCampaignIntent(params: {
  supabaseAdmin: ReturnType<typeof createAdminClient>;
  campaignId: string;
  targetId: string;
  chatId: string;
  message: InboundMessageRow;
  leadId?: string | null;
  phoneDigits?: string | null;
}) {
  const messageText = getInboundMessageText(params.message);
  if (!messageText || messageText === '[mensagem sem texto]') return null;

  const { data: existingSuggestion, error: existingError } = await params.supabaseAdmin
    .from('comm_whatsapp_ai_intent_suggestions')
    .select('id')
    .eq('message_id', params.message.id)
    .eq('campaign_id', params.campaignId)
    .maybeSingle();

  if (existingError) {
    throw new Error(`Erro ao verificar sugestao IA existente: ${existingError.message}`);
  }

  if (existingSuggestion) return null;

  const systemPrompt = [
    'Voce classifica a intencao de uma resposta recebida no WhatsApp apos uma campanha comercial da Kifer Saude.',
    'A tarefa e decidir se o contato pediu para parar disparos, apenas recusou a oferta, esta irritado, informou numero errado, quer seguir conversa ou esta ambiguo.',
    'Nao bloqueie por simples falta de interesse no produto. Use opt_out apenas quando houver pedido claro para nao receber mais contato, remover numero/lista, parar insistencia, ou equivalente semantico.',
    'Retorne somente JSON valido, sem markdown.',
  ].join('\n');

  const userPrompt = [
    'Mensagem recebida do cliente:',
    messageText,
    '',
    'Classifique com este schema JSON:',
    '{',
    '  "intent": "opt_out | negative_interest | angry_or_complaint | wrong_number | continue_conversation | unclear",',
    '  "confidence": 0.0,',
    '  "recommended_action": "suggest_block_whatsapp_campaigns | keep_active | review",',
    '  "reason": "motivo curto em portugues",',
    '  "evidence": "trecho que sustenta a classificacao"',
    '}',
  ].join('\n');

  try {
    const result = await generateTextWithRouting({
      supabaseAdmin: params.supabaseAdmin,
      task: 'follow_up_generation',
      systemPrompt,
      userPrompt,
      temperature: 0.1,
      maxTokens: 280,
      preferDefaultModel: true,
    });
    const classification = normalizeClassification(extractJsonObject(result.text));

    const shouldSuggest = classification.recommended_action === 'suggest_block_whatsapp_campaigns'
      || classification.intent === 'opt_out'
      || classification.intent === 'wrong_number'
      || classification.intent === 'angry_or_complaint';

    if (!shouldSuggest && classification.confidence < 0.75) return classification;

    const { error: insertError } = await params.supabaseAdmin
      .from('comm_whatsapp_ai_intent_suggestions')
      .insert({
        chat_id: params.chatId,
        message_id: params.message.id,
        campaign_id: params.campaignId,
        lead_id: params.leadId ?? null,
        phone_digits: params.phoneDigits ?? null,
        intent: classification.intent,
        confidence: classification.confidence,
        recommended_action: classification.recommended_action,
        reason: classification.reason,
        evidence: classification.evidence || messageText.slice(0, 500),
        status: 'pending',
      });

    if (insertError) {
      throw new Error(`Erro ao salvar sugestao IA: ${insertError.message}`);
    }

    await insertEvent(params.supabaseAdmin, {
      campaignId: params.campaignId,
      targetId: params.targetId,
      eventType: 'ai_intent_suggested',
      payload: classification,
    });

    return classification;
  } catch (error) {
    console.error('[comm-whatsapp-campaign-worker] erro ao classificar intenção de resposta', error);
    await insertEvent(params.supabaseAdmin, {
      campaignId: params.campaignId,
      targetId: params.targetId,
      eventType: 'ai_intent_classification_failed',
      payload: { error: error instanceof Error ? error.message : 'Erro inesperado' },
    });
    return null;
  }
}

async function authorizeRequest(req: Request, supabaseAdmin: ReturnType<typeof createAdminClient>) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

  if (isServiceRoleRequest(req, serviceRoleKey)) {
    return { authorized: true as const, profileId: null };
  }

  const authResult = await authorizeDashboardUser({
    req,
    supabaseUrl,
    supabaseAnonKey,
    supabaseAdmin,
    module: 'whatsapp-campaigns',
    requiredPermission: 'edit',
  });

  if (!authResult.authorized) {
    return { authorized: false as const, response: createJsonResponse(authResult.body, authResult.status) };
  }

  return { authorized: true as const, profileId: authResult.user.profileId };
}

async function getCampaign(supabaseAdmin: ReturnType<typeof createAdminClient>, campaignId: string): Promise<CampaignRow> {
  const { data, error } = await supabaseAdmin
    .from('comm_whatsapp_campaigns')
    .select('id,name,status,audience_source,audience_config,message_text,scheduled_at,pacing_per_minute,daily_send_limit,send_window_start,send_window_end,stop_on_reply,created_by,ab_test_enabled,ab_split_percent,recurrence_rule,recurrence_interval,recurrence_end_at,recurrence_next_run_at,recurrence_runs_completed,create_leads_from_csv,active_weekdays')
    .eq('id', campaignId)
    .maybeSingle();

  if (error) {
    throw new Error(`Erro ao carregar campanha: ${error.message}`);
  }

  if (!data) {
    throw new Error('Campanha nao encontrada.');
  }

  return data as CampaignRow;
}

async function insertEvent(
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  params: { campaignId: string; targetId?: string | null; eventType: string; payload?: Record<string, unknown>; createdBy?: string | null },
) {
  await supabaseAdmin.from('comm_whatsapp_campaign_events').insert({
    campaign_id: params.campaignId,
    target_id: params.targetId ?? null,
    event_type: params.eventType,
    payload: params.payload ?? {},
    created_by: params.createdBy ?? null,
  });
}

async function createProviderAcceptedPersistenceEvent(
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  params: { campaignId: string; targetId: string; payload: Record<string, unknown> },
) {
  const { data, error } = await supabaseAdmin
    .from('comm_whatsapp_campaign_events')
    .insert({
      campaign_id: params.campaignId,
      target_id: params.targetId,
      event_type: 'target_provider_accepted_persistence_pending',
      payload: params.payload,
    })
    .select('id')
    .single();

  if (error || !data) {
    throw new CampaignProviderAcceptedError(
      error?.message || 'Nao foi possivel registrar o aceite da Whapi para reconciliacao.',
    );
  }

  return data as { id: string };
}

async function resolveCampaignSendStartedEvent(
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  params: { eventId: string; resolution: string; dispatchPermitState?: 'accepted' | 'released' },
) {
  const { data: event, error: eventError } = await supabaseAdmin
    .from('comm_whatsapp_campaign_events')
    .select('payload')
    .eq('id', params.eventId)
    .maybeSingle();

  if (eventError || !event) {
    throw new Error(eventError?.message || 'Marcador de tentativa de envio nao encontrado.');
  }

  const payload = toRecord(event.payload);
  const nextPayload = {
    ...payload,
    ...(payload.resolved_at ? {} : {
      resolved_at: getNowIso(),
      resolution: params.resolution,
    }),
    ...(params.dispatchPermitState ? { dispatch_permit_state: params.dispatchPermitState } : {}),
  };

  if (
    payload.resolved_at
    && (!params.dispatchPermitState || payload.dispatch_permit_state === params.dispatchPermitState)
  ) return;

  const { error } = await supabaseAdmin
    .from('comm_whatsapp_campaign_events')
    .update({
      payload: nextPayload,
    })
    .eq('id', params.eventId);

  if (error) {
    throw new Error(`Erro ao encerrar tentativa de envio da campanha: ${error.message}`);
  }
}

async function reserveCampaignDispatch(
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  params: {
    campaignId: string;
    target: TargetRow;
    payload: Record<string, unknown>;
  },
): Promise<CampaignDispatchReservation> {
  const lockToken = toTrimmedString(params.target.lock_token);
  if (!lockToken) throw new CampaignTargetLeaseLostError();

  const { data, error } = await supabaseAdmin.rpc('reserve_comm_whatsapp_campaign_dispatch', {
    p_campaign_id: params.campaignId,
    p_target_id: params.target.id,
    p_lock_token: lockToken,
    p_payload: params.payload,
  });

  if (error) {
    throw new Error(`Erro ao reservar envio da campanha: ${error.message}`);
  }

  const reservation = (Array.isArray(data) ? data[0] : data) as CampaignDispatchReservation | null;
  if (!reservation) {
    throw new Error('A reserva de envio da campanha nao retornou resultado.');
  }

  return reservation;
}

async function materializeCrmTargets(
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  campaign: CampaignRow,
) {
  const filters = getNestedRecord(campaign.audience_config, 'filters');
  const statuses = Array.isArray(filters.statuses)
    ? filters.statuses.map((value) => toTrimmedString(value)).filter(Boolean)
    : [getOptionalString(filters.status)].filter((value): value is string => Boolean(value));
  const responsaveis = Array.isArray(filters.responsaveis)
    ? filters.responsaveis.map((value) => toTrimmedString(value)).filter(Boolean)
    : [getOptionalString(filters.responsavel)].filter((value): value is string => Boolean(value));
  const lastContactBefore = getOptionalString(filters.last_contact_before);
  const rawRecentCampaignDays = Number(filters.exclude_recent_campaign_days);
  const excludeRecentCampaignDays = Number.isFinite(rawRecentCampaignDays)
    ? Math.min(Math.max(Math.floor(rawRecentCampaignDays), 0), 365)
    : 0;

  const leads: LeadRow[] = [];
  for (let from = 0; ; from += CRM_TARGET_PAGE_SIZE) {
    let query = supabaseAdmin
      .from('leads')
      .select('id,nome_completo,telefone,status,responsavel,responsavel_id,arquivado,ultimo_contato')
      .eq('arquivado', false)
      .not('telefone', 'is', null)
      .order('created_at', { ascending: true })
      .range(from, from + CRM_TARGET_PAGE_SIZE - 1);

    if (statuses.length > 0) {
      query = query.in('status', statuses);
    }

    if (responsaveis.length > 0) {
      query = query.in('responsavel', responsaveis);
    }

    if (lastContactBefore) {
      query = query.lt('ultimo_contato', lastContactBefore);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(`Erro ao carregar leads da campanha: ${error.message}`);
    }

    leads.push(...((data ?? []) as LeadRow[]));
    if (!data || data.length < CRM_TARGET_PAGE_SIZE) break;
  }

  const normalizedRows = leads.flatMap((lead) => {
    const phoneDigits = normalizeCommWhatsAppPhone(lead.telefone);
    if (!phoneDigits) return [];

    return [{
      campaign_id: campaign.id,
      lead_id: lead.id,
      phone_number: lead.telefone || phoneDigits,
      phone_digits: phoneDigits,
      display_name: lead.nome_completo || formatPhoneLabel(phoneDigits),
      source_kind: 'crm',
      source_payload: {
        status: lead.status,
        responsavel: lead.responsavel,
        responsavel_id: lead.responsavel_id,
      },
    }];
  });

  const phoneDigits = Array.from(new Set(normalizedRows.map((row) => row.phone_digits)));
  const blockedPhones = new Set<string>();
  for (const phoneChunk of chunkArray(phoneDigits, OPT_OUT_LOOKUP_CHUNK_SIZE)) {
    const { data: optOutRows, error: optOutError } = await supabaseAdmin
      .from('comm_whatsapp_opt_outs')
      .select('phone_digits')
      .eq('status', 'blocked')
      .in('phone_digits', phoneChunk);

    if (optOutError) {
      throw new Error(`Erro ao consultar bloqueios de disparo: ${optOutError.message}`);
    }

    for (const row of optOutRows ?? []) {
      blockedPhones.add(String(row.phone_digits));
    }
  }

  const validRows = normalizedRows.filter((row) => !blockedPhones.has(row.phone_digits));
  const recentlyContactedPhones = new Set<string>();
  if (excludeRecentCampaignDays > 0) {
    const cutoff = new Date(Date.now() - excludeRecentCampaignDays * 24 * 60 * 60 * 1000).toISOString();
    for (const phoneChunk of chunkArray(validRows.map((row) => row.phone_digits), OPT_OUT_LOOKUP_CHUNK_SIZE)) {
      const { data: recentTargets, error: recentTargetsError } = await supabaseAdmin
        .from('comm_whatsapp_campaign_targets')
        .select('phone_digits')
        .neq('campaign_id', campaign.id)
        .in('phone_digits', phoneChunk)
        .gte('sent_at', cutoff);
      if (recentTargetsError) throw new Error(`Erro ao consultar contatos recentes: ${recentTargetsError.message}`);
      for (const row of recentTargets ?? []) recentlyContactedPhones.add(String(row.phone_digits));
    }
  }
  const eligibleRows = validRows.filter((row) => !recentlyContactedPhones.has(row.phone_digits));

  for (const rowsChunk of chunkArray(eligibleRows, CRM_TARGET_INSERT_CHUNK_SIZE)) {
    const { error: insertError } = await supabaseAdmin
      .from('comm_whatsapp_campaign_targets')
      .upsert(rowsChunk, { onConflict: 'campaign_id,phone_digits', ignoreDuplicates: true });

    if (insertError) {
      throw new Error(`Erro ao criar alvos da campanha: ${insertError.message}`);
    }
  }

  return {
    total: normalizedRows.length,
    valid: eligibleRows.length,
    invalid: normalizedRows.length - eligibleRows.length,
  };
}

async function recomputeCampaignCounters(supabaseAdmin: ReturnType<typeof createAdminClient>, campaignId: string) {
  // Agregado no banco (GROUP BY status) em vez de puxar todas as linhas de
  // alvos pro worker: uma campanha CSV grande (dezenas de milhares de
  // alvos) esbarraria no teto padrao de linhas por resposta do PostgREST e
  // os contadores (e a checagem de "campanha concluida" abaixo) refletiriam
  // so uma fatia arbitraria da campanha em vez do total real.
  const { data, error } = await supabaseAdmin
    .rpc('get_comm_whatsapp_campaign_target_status_counts', { p_campaign_id: campaignId });

  if (error) {
    throw new Error(`Erro ao recalcular contadores da campanha: ${error.message}`);
  }

  const statusRows = (data ?? []) as Array<{ status: string; total_count: number | string; responded_count: number | string }>;
  const totalOf = (statuses: string[]) => statusRows
    .filter((row) => statuses.includes(row.status))
    .reduce((sum, row) => sum + Number(row.total_count), 0);

  const total = statusRows.reduce((sum, row) => sum + Number(row.total_count), 0);
  const invalid = totalOf(['invalid']);
  const failed = totalOf(['failed']);
  const sent = totalOf(['sent']);
  const stopped = totalOf(['stopped', 'cancelled']);
  const pending = totalOf(['pending', 'scheduled', 'sending']);
  const responded = statusRows.reduce(
    (sum, row) => sum + (row.status === 'responded' ? Number(row.total_count) : Number(row.responded_count)),
    0,
  );

  const { error: updateError } = await supabaseAdmin
    .from('comm_whatsapp_campaigns')
    .update({
      total_targets: total,
      valid_targets: total - invalid,
      invalid_targets: invalid,
      pending_targets: pending,
      sent_targets: sent,
      failed_targets: failed,
      responded_targets: responded,
      stopped_targets: stopped,
      completed_at: pending === 0 && total > 0 ? getNowIso() : null,
    })
    .eq('id', campaignId);

  if (updateError) {
    throw new Error(`Erro ao atualizar contadores da campanha: ${updateError.message}`);
  }

  return { total, pending, sent, failed, invalid, responded, stopped };
}

async function activateCampaign(
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  campaignId: string,
  profileId: string | null,
) {
  const campaign = await getCampaign(supabaseAdmin, campaignId);
  // 'completed' so entra aqui via reativacao automatica de recorrencia
  // (reactivateRecurringCampaigns) - o botao "Ativar" da UI nunca oferece
  // essa transicao para uma campanha ja concluida.
  if (!['draft', 'scheduled', 'paused', 'completed'].includes(campaign.status)) {
    throw new Error('Somente campanhas em rascunho, agendadas ou pausadas podem ser ativadas.');
  }

  let materialized = { total: 0, valid: 0, invalid: 0 };
  if (campaign.audience_source === 'crm' || campaign.audience_source === 'mixed') {
    materialized = await materializeCrmTargets(supabaseAdmin, campaign);
  }

  const nextStatus = campaign.scheduled_at && new Date(campaign.scheduled_at).getTime() > Date.now()
    ? 'scheduled'
    : 'queued';

  const { error } = await supabaseAdmin
    .from('comm_whatsapp_campaigns')
    .update({
      status: nextStatus,
      started_at: nextStatus === 'queued' ? getNowIso() : null,
      last_error: null,
    })
    .eq('id', campaign.id);

  if (error) {
    throw new Error(`Erro ao ativar campanha: ${error.message}`);
  }

  const counters = await recomputeCampaignCounters(supabaseAdmin, campaign.id);
  await insertEvent(supabaseAdmin, {
    campaignId: campaign.id,
    eventType: 'campaign_activated',
    payload: { status: nextStatus, materialized, counters },
    createdBy: profileId,
  });

  return { campaignId: campaign.id, status: nextStatus, materialized, counters };
}

async function sendCampaignTestMessage(
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  params: { campaignId: string; phoneNumber: string; stepIndex: number; variant: 'A' | 'B'; profileId: string | null },
) {
  const phoneDigits = normalizeCommWhatsAppPhone(params.phoneNumber);
  const chatId = phoneDigits ? buildWhapiDirectChatId(phoneDigits) : null;
  if (!phoneDigits || !chatId) {
    throw new Error('Informe um telefone valido para o envio de teste.');
  }

  const campaign = await getCampaign(supabaseAdmin, params.campaignId);
  const steps = await getCampaignSteps(supabaseAdmin, campaign, params.variant);
  const step = steps.find((item) => item.step_index === params.stepIndex) ?? steps[0];
  if (!step) {
    throw new Error('Esta campanha ainda nao tem nenhuma mensagem configurada.');
  }
  if (step.step_kind === 'status_change') {
    throw new Error('Esta etapa muda o status do lead e nao envia mensagem, entao nao ha o que testar.');
  }

  const sampleLead: LeadRow = {
    id: 'test-send',
    nome_completo: 'Nome de teste',
    telefone: phoneDigits,
    status: 'Em teste',
    responsavel: 'Voce',
    responsavel_id: null,
    arquivado: false,
    ultimo_contato: null,
  };
  const text = resolveMessageText(step.message_text, { lead: sampleLead, target: null }).trim();
  if (!text && !step.media_url) {
    throw new Error('Esta mensagem esta vazia.');
  }

  const settings = await ensureCommWhatsAppSettings(supabaseAdmin);
  const channel = await ensurePrimaryChannel(supabaseAdmin);
  const token = sanitizeWhapiToken(settings.token);
  if (!settings.enabled) throw new Error('Integracao WhatsApp desabilitada.');
  if (!token) throw new Error('Token da Whapi nao configurado.');

  const chatRoute = await resolveCommWhatsAppCanonicalChatRoute(supabaseAdmin, {
    channelId: channel.id,
    externalChatId: chatId,
  });
  if (chatRoute.identityConflict) {
    throw new Error('Identidade WhatsApp exige revisao manual antes do envio de teste.');
  }

  const dispatchChatId = chatRoute?.externalChatId || chatId;
  const whapi = createWhapiClient(token);
  const response = step.media_url
    ? await sendCampaignMedia(token, dispatchChatId, step, text)
    : await whapi.sendText(dispatchChatId, text);
  const payload = await readResponsePayload(response);

  if (!response.ok || (payload && typeof payload === 'object' && !Array.isArray(payload) && (payload as Record<string, unknown>).sent === false)) {
    throw new Error(parseWhapiError(payload) || 'A Whapi nao confirmou o envio da mensagem de teste.');
  }

  await insertEvent(supabaseAdmin, {
    campaignId: campaign.id,
    eventType: 'test_message_sent',
    payload: { phoneDigits, stepIndex: step.step_index, variant: params.variant },
    createdBy: params.profileId,
  });

  return { phoneDigits, stepIndex: step.step_index, messageText: text };
}

// Uma resposta automatica (ex.: mensagem de ausencia do WhatsApp Business,
// bastante comum) costuma chegar quase instantaneamente apos o envio -
// segundos, tempo insuficiente pra uma pessoa de verdade ler e responder.
// Sem esse intervalo minimo, qualquer auto-reply e tratado como resposta
// genuina e para a sequencia inteira pro contato pra sempre (nao ha caminho
// de retomada - ver stop_on_reply em sendTarget). Exigir esse intervalo
// antes de contar como "respondeu" custa, na pior das hipoteses, 1-2
// mensagens a mais pra quem responde mesmo assim muito rapido - bem melhor
// que interromper a sequencia por causa de um auto-reply.
const MIN_GENUINE_REPLY_DELAY_MS = 20_000;

async function findInboundCampaignChat(
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  target: Pick<TargetRow, 'chat_id' | 'phone_digits' | 'sent_at'>,
) {
  if (!target.sent_at) {
    return null;
  }

  const earliestGenuineReplyAt = new Date(new Date(target.sent_at).getTime() + MIN_GENUINE_REPLY_DELAY_MS).toISOString();

  const canonicalRoute = target.chat_id
    ? await resolveCommWhatsAppCanonicalChatRouteByUuid(supabaseAdmin, target.chat_id)
    : null;
  let query = supabaseAdmin
    .from('comm_whatsapp_chats')
    .select('id,last_message_at,last_message_direction')
    .eq('last_message_direction', 'inbound')
    .gt('last_message_at', earliestGenuineReplyAt)
    .is('merged_into_chat_id', null)
    .is('deleted_at', null)
    .order('last_message_at', { ascending: false })
    .limit(1);

  query = canonicalRoute?.chatId
    ? query.eq('id', canonicalRoute.chatId)
    : query.eq('phone_digits', target.phone_digits);

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw new Error(`Erro ao localizar resposta da campanha: ${error.message}`);
  }

  return data as { id: string; last_message_at: string | null; last_message_direction: string | null } | null;
}

const shouldStopSequenceBeforeStep = (
  step: Pick<CampaignStepRow, 'delay_amount'> | null,
  targetStatus?: string | null,
) => {
  if (targetStatus === 'sent') return true;
  if (!step) return true;
  return Math.max(Number(step.delay_amount) || 0, 0) > 0;
};

async function getCachedCampaignSteps(
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  campaign: CampaignRow,
  cache: Map<string, CampaignStepRow[]>,
) {
  const cached = cache.get(campaign.id);
  if (cached) return cached;
  const steps = await getCampaignSteps(supabaseAdmin, campaign);
  cache.set(campaign.id, steps);
  return steps;
}

async function reconcileResponses(supabaseAdmin: ReturnType<typeof createAdminClient>, campaignId?: string) {
  let query = supabaseAdmin
    .from('comm_whatsapp_campaign_targets')
    .select('id,campaign_id,lead_id,chat_id,phone_digits,sent_at,responded_at,status,current_step_index')
    .in('status', ['sent', 'scheduled'])
    .not('sent_at', 'is', null)
    .limit(500);

  if (campaignId) {
    query = query.eq('campaign_id', campaignId);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Erro ao buscar respostas da campanha: ${error.message}`);
  }

  let responded = 0;
  const stopOnReplyByCampaign = new Map<string, boolean>();
  const campaignById = new Map<string, CampaignRow>();
  const stepsByCampaignId = new Map<string, CampaignStepRow[]>();
  for (const target of data ?? []) {
    const chat = await findInboundCampaignChat(supabaseAdmin, target as Pick<TargetRow, 'chat_id' | 'phone_digits' | 'sent_at'>);

    if (!chat) continue;

    const { data: inboundMessage, error: inboundMessageError } = await supabaseAdmin
      .from('comm_whatsapp_messages')
      .select('id,chat_id,message_type,text_content,media_caption,transcription_text,message_at')
      .eq('chat_id', chat.id)
      .eq('direction', 'inbound')
      .gt('message_at', target.sent_at)
      .order('message_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (inboundMessageError) {
      throw new Error(`Erro ao carregar mensagem inbound da campanha: ${inboundMessageError.message}`);
    }

    const nowIso = getNowIso();
    let stopOnReply = stopOnReplyByCampaign.get(target.campaign_id);
    if (stopOnReply === undefined) {
      const campaign = await getCampaign(supabaseAdmin, target.campaign_id);
      campaignById.set(target.campaign_id, campaign);
      stopOnReply = campaign.stop_on_reply;
      stopOnReplyByCampaign.set(target.campaign_id, stopOnReply);
    }

    const campaign = campaignById.get(target.campaign_id) ?? await getCampaign(supabaseAdmin, target.campaign_id);
    campaignById.set(target.campaign_id, campaign);
    const steps = stopOnReply ? await getCachedCampaignSteps(supabaseAdmin, campaign, stepsByCampaignId) : [];
    const currentStepIndex = Math.max(Number(target.current_step_index) || 0, 0);
    const currentStep = steps.find((item) => item.step_index === currentStepIndex) ?? null;
    const shouldStop = stopOnReply && shouldStopSequenceBeforeStep(currentStep, target.status);

    const responseUpdate = shouldStop
      ? { status: 'responded', responded_at: chat.last_message_at || nowIso, chat_id: chat.id }
      : { responded_at: chat.last_message_at || nowIso, chat_id: chat.id };
    const { data: updatedTarget, error: updateTargetError } = await supabaseAdmin
      .from('comm_whatsapp_campaign_targets')
      .update(responseUpdate)
      .eq('id', target.id)
      .is('responded_at', null)
      .in('status', ['sent', 'scheduled'])
      .select('id')
      .maybeSingle();

    if (updateTargetError) {
      throw new Error(`Erro ao registrar resposta da campanha: ${updateTargetError.message}`);
    }

    if (!updatedTarget) continue;

    if (inboundMessage) {
      await classifyInboundCampaignIntent({
        supabaseAdmin,
        campaignId: target.campaign_id,
        targetId: target.id,
        chatId: chat.id,
        message: inboundMessage as InboundMessageRow,
        leadId: target.lead_id,
        phoneDigits: target.phone_digits,
      });
    }
    responded += 1;
  }

  return responded;
}

async function reconcileAcceptedCampaignPersistences(params: {
  supabaseAdmin: ReturnType<typeof createAdminClient>;
  channelId: string;
  senderPhone: string | null;
  senderName: string | null;
}) {
  const { data, error } = await params.supabaseAdmin
    .from('comm_whatsapp_campaign_events')
    .select('id,campaign_id,target_id,payload')
    .eq('event_type', 'target_provider_accepted_persistence_pending')
    .is('payload->>recovered_at', null)
    .order('created_at', { ascending: true })
    .limit(100);

  if (error) {
    throw new Error(`Erro ao buscar persistencias pendentes de campanhas: ${error.message}`);
  }

  const campaigns = new Map<string, CampaignRow>();
  let recovered = 0;

  for (const event of data ?? []) {
    const payload = toRecord(event.payload);
    if (payload.recovered_at || !event.target_id) continue;

    const externalMessageId = toTrimmedString(payload.externalMessageId);
    const messageText = toTrimmedString(payload.messageText);
    const phoneDigits = normalizeCommWhatsAppPhone(payload.phoneDigits);
    if (!externalMessageId || !messageText || !phoneDigits) continue;

    try {
      let campaign = campaigns.get(event.campaign_id);
      if (!campaign) {
        campaign = await getCampaign(params.supabaseAdmin, event.campaign_id);
        campaigns.set(event.campaign_id, campaign);
      }

      const stepIndex = Math.max(Number(payload.stepIndex) || 0, 0);
      const sentAt = toTrimmedString(payload.sentAt) || getNowIso();
      const deliveryStatus = toTrimmedString(payload.deliveryStatus) || 'sent';
      const externalChatId = toTrimmedString(payload.externalChatId) || buildWhapiDirectChatId(phoneDigits);
      const displayName = toTrimmedString(payload.displayName) || formatPhoneLabel(phoneDigits);
      const persisted = await persistCommWhatsAppMessage(params.supabaseAdmin, {
        channelId: params.channelId,
        externalChatId,
        phoneNumber: phoneDigits,
        displayName,
        pushName: null,
        lastMessageText: messageText,
        lastMessageDirection: 'outbound',
        lastMessageAt: sentAt,
        incrementUnread: false,
        externalMessageId,
        direction: 'outbound',
        messageType: 'text',
        deliveryStatus,
        textContent: messageText,
        createdBy: campaign.created_by,
        source: 'campaign',
        senderPhone: params.senderPhone,
        senderName: params.senderName,
        statusUpdatedAt: sentAt,
        errorMessage: null,
        mediaId: null,
        mediaUrl: null,
        mediaMimeType: null,
        mediaFileName: null,
        mediaSizeBytes: null,
        mediaDurationSeconds: null,
        mediaCaption: null,
        metadata: {
          provider: 'whapi',
          campaign_id: event.campaign_id,
          campaign_target_id: event.target_id,
          campaign_step_index: stepIndex,
          recovered_after_provider_acceptance: true,
        },
      });

      const targetStatus = toTrimmedString(payload.targetStatus);
      const nextStepIndex = Number(payload.nextStepIndex);
      const nextSendAt = toTrimmedString(payload.nextSendAt) || null;
      const shouldFinalizeTarget = (targetStatus === 'scheduled' || targetStatus === 'sent')
        && Number.isFinite(nextStepIndex);

      if (shouldFinalizeTarget) {
        const expectedStepIndex = Math.max(0, Math.floor(nextStepIndex));
        const { data: finalizedTarget, error: finalizeTargetError } = await params.supabaseAdmin
          .from('comm_whatsapp_campaign_targets')
          .update({
            status: targetStatus,
            sent_at: sentAt,
            chat_id: persisted.chatId,
            current_step_index: expectedStepIndex,
            next_send_at: nextSendAt,
            next_retry_at: null,
            external_message_id: externalMessageId,
            error_message: null,
            locked_at: null,
            lock_token: null,
          })
          .eq('id', event.target_id)
          .in('status', ['sending', 'failed'])
          .select('id')
          .maybeSingle();

        if (finalizeTargetError) {
          throw new Error(`Erro ao finalizar alvo recuperado da campanha: ${finalizeTargetError.message}`);
        }

        if (!finalizedTarget) {
          // A prior run may have finalized the target immediately before it
          // crashed. Only accept that state when it matches this exact send.
          const { data: currentTarget, error: currentTargetError } = await params.supabaseAdmin
            .from('comm_whatsapp_campaign_targets')
            .select('status,external_message_id,current_step_index')
            .eq('id', event.target_id)
            .maybeSingle();

          if (currentTargetError) {
            throw new Error(`Erro ao verificar alvo recuperado da campanha: ${currentTargetError.message}`);
          }

          const alreadyFinalized = currentTarget
            && currentTarget.status === targetStatus
            && currentTarget.external_message_id === externalMessageId
            && Number(currentTarget.current_step_index) === expectedStepIndex;
          if (!alreadyFinalized) {
            throw new Error('O alvo recuperado nao foi finalizado e nao corresponde ao envio aceito pela Whapi.');
          }
        }

        if (targetStatus === 'scheduled') {
          await params.supabaseAdmin
            .from('comm_whatsapp_campaigns')
            .update({ status: 'queued', completed_at: null, last_error: null })
            .eq('id', event.campaign_id)
          .eq('status', 'completed');
        }
      } else {
        const { error: updateTargetError } = await params.supabaseAdmin
          .from('comm_whatsapp_campaign_targets')
          .update({ chat_id: persisted.chatId, error_message: null })
          .eq('id', event.target_id)
          .eq('external_message_id', externalMessageId);

        if (updateTargetError) {
          throw new Error(`Erro ao atualizar chat do alvo recuperado da campanha: ${updateTargetError.message}`);
        }
      }

      const recoveredAt = getNowIso();
      const sendStartedEventId = toTrimmedString(payload.sendStartedEventId);
      if (sendStartedEventId) {
        await resolveCampaignSendStartedEvent(params.supabaseAdmin, {
          eventId: sendStartedEventId,
          resolution: 'provider_accepted_recovered',
          dispatchPermitState: 'accepted',
        });
      }

      const { data: recoveredEvent, error: recoverEventError } = await params.supabaseAdmin
        .from('comm_whatsapp_campaign_events')
        .update({
          payload: {
            ...payload,
            recovered_at: recoveredAt,
            last_recovery_error: null,
          },
        })
        .eq('id', event.id)
        .select('id')
        .maybeSingle();

      if (recoverEventError || !recoveredEvent) {
        throw new Error(recoverEventError?.message || 'Nao foi possivel marcar a persistencia aceita como recuperada.');
      }

      await insertEvent(params.supabaseAdmin, {
        campaignId: event.campaign_id,
        targetId: event.target_id,
        eventType: 'target_provider_accepted_persistence_recovered',
        payload: { externalMessageId, recoveredAt },
      });
      recovered += 1;
    } catch (recoveryError) {
      const errorMessage = recoveryError instanceof Error ? recoveryError.message : 'Erro ao recuperar persistencia pendente.';
      await params.supabaseAdmin
        .from('comm_whatsapp_campaign_events')
        .update({
          payload: {
            ...payload,
            last_recovery_error: errorMessage,
            last_recovery_attempt_at: getNowIso(),
          },
        })
        .eq('id', event.id);
      console.error('[comm-whatsapp-campaign-worker] falha ao recuperar mensagem aceita pela Whapi', {
        eventId: event.id,
        error: errorMessage,
      });
    }
  }

  return recovered;
}

async function listTargetsForProcessing(
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  campaign: CampaignRow,
  limit: number,
): Promise<TargetRow[]> {
  const lockToken = createLockToken();
  const { data, error } = await supabaseAdmin.rpc('claim_comm_whatsapp_campaign_targets', {
    p_campaign_id: campaign.id,
    p_limit: limit,
    p_lock_token: lockToken,
  });

  if (error) {
    throw new Error(`Erro ao carregar fila da campanha: ${error.message}`);
  }

  return (data ?? []) as TargetRow[];
}

async function getLeadById(supabaseAdmin: ReturnType<typeof createAdminClient>, leadId: string | null): Promise<LeadRow | null> {
  if (!leadId) return null;
  const { data, error } = await supabaseAdmin
    .from('leads')
    .select('id,nome_completo,telefone,status,responsavel,responsavel_id,arquivado')
    .eq('id', leadId)
    .maybeSingle();

  if (error) {
    throw new Error(`Erro ao carregar lead do alvo: ${error.message}`);
  }

  return (data as LeadRow | null | undefined) ?? null;
}

async function getCampaignSteps(
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  campaign: CampaignRow,
  variant: 'A' | 'B' | null = null,
): Promise<CampaignStepRow[]> {
  const { data, error } = await supabaseAdmin
    .from('comm_whatsapp_campaign_steps')
    .select('id,campaign_id,step_index,stage_index,step_kind,status_to_set,message_text,delay_amount,delay_unit,media_url,media_type,media_filename,variant_label')
    .eq('campaign_id', campaign.id)
    .order('step_index', { ascending: true });

  if (error) {
    throw new Error(`Erro ao carregar etapas da campanha: ${error.message}`);
  }

  const rows = (data ?? []) as CampaignStepRow[];
  if (rows.length === 0) {
    return [{
      id: 'fallback-message',
      campaign_id: campaign.id,
      step_index: 0,
      stage_index: 0,
      step_kind: 'message',
      status_to_set: null,
      message_text: campaign.message_text,
      delay_amount: 0,
      delay_unit: 'minutes',
      media_url: null,
      media_type: null,
      media_filename: null,
      variant_label: 'ANY',
    }];
  }

  // Uma etapa marcada com a variante especifica (A ou B) sobrepoe a versao
  // compartilhada ('ANY') no mesmo indice, permitindo A/B so na mensagem
  // inicial enquanto os follow-ups continuam unicos para as duas variantes.
  const byIndex = new Map<number, CampaignStepRow>();
  for (const step of rows) {
    if (step.variant_label === 'ANY') {
      if (!byIndex.has(step.step_index)) byIndex.set(step.step_index, step);
      continue;
    }
    if (variant && step.variant_label === variant) {
      byIndex.set(step.step_index, step);
    } else if (!byIndex.has(step.step_index)) {
      // Sem variante resolvida ainda: usa a variante A como base neutra.
      if (step.variant_label === 'A') byIndex.set(step.step_index, step);
    }
  }

  return Array.from(byIndex.values()).sort((a, b) => a.step_index - b.step_index);
}

async function releaseTargetAfterFailure(
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  params: { target: TargetRow; status?: 'failed' | 'scheduled'; errorMessage: string; retryable?: boolean },
) {
  const attempts = Math.max(Number(params.target.attempts) || 0, 0);
  const canRetry = Boolean(params.retryable) && attempts < MAX_SEND_ATTEMPTS;
  const nextRetryAt = canRetry ? getNextRetryAt(attempts) : null;

  await updateClaimedTarget(supabaseAdmin, params.target, {
    status: canRetry ? 'scheduled' : (params.status ?? 'failed'),
    error_message: params.errorMessage,
    retry_count: canRetry ? (Number(params.target.retry_count) || 0) + 1 : Number(params.target.retry_count) || 0,
    next_retry_at: nextRetryAt,
    locked_at: null,
    lock_token: null,
    last_attempt_at: getNowIso(),
  });

  return { status: canRetry ? 'retry_scheduled' : (params.status ?? 'failed'), retrying: canRetry, nextRetryAt };
}

async function deferClaimedTargetForDispatchGate(
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  params: { target: TargetRow; retryAt: string; reason: string },
) {
  await updateClaimedTarget(supabaseAdmin, params.target, {
    status: 'scheduled',
    error_message: params.reason,
    next_retry_at: params.retryAt,
    locked_at: null,
    lock_token: null,
  });
}

async function releaseClaimedTarget(
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  target: TargetRow,
  status: 'scheduled' | 'cancelled',
) {
  await updateClaimedTarget(supabaseAdmin, target, { status, locked_at: null, lock_token: null });
}

async function sendCampaignMedia(
  token: string,
  chatId: string,
  step: Pick<CampaignStepRow, 'media_url' | 'media_type' | 'media_filename'>,
  caption: string,
): Promise<Response> {
  if (!step.media_url || !step.media_type) {
    throw new Error('Etapa sem midia valida configurada.');
  }

  const mediaResponse = await fetch(step.media_url, { method: 'GET', headers: { Accept: '*/*' } });
  if (!mediaResponse.ok) {
    throw new Error('Nao foi possivel baixar a midia da campanha para envio.');
  }

  const contentType = mediaResponse.headers.get('content-type') || 'application/octet-stream';
  const bytes = await mediaResponse.arrayBuffer();
  const fileName = step.media_filename || `campanha-midia.${contentType.split('/')[1] || 'bin'}`;
  const file = new File([bytes], fileName, { type: contentType });

  // FormData multipart: sem definir Content-Type manualmente para que o
  // fetch calcule o boundary corretamente (igual ao padrao de envio de
  // documento usado no comm-whatsapp-send).
  const form = new FormData();
  form.append('to', chatId);
  form.append('media', file, fileName);
  if (step.media_type === 'document') form.append('filename', fileName);
  if (caption) form.append('caption', caption);

  return fetch(`${WHAPI_BASE_URL}/messages/${step.media_type}`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${sanitizeWhapiToken(token)}`,
    },
    body: form,
  });
}

const normalizeLeadStatusName = (value: string): string => (
  value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
);

async function resolveLeadStatusId(supabaseAdmin: ReturnType<typeof createAdminClient>, statusName: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin.from('lead_status_config').select('id,nome');
  if (error) {
    throw new Error(`Erro ao carregar configuracao de status de leads: ${error.message}`);
  }

  const target = normalizeLeadStatusName(statusName);
  const match = (data ?? []).find((row) => normalizeLeadStatusName(String(row.nome ?? '')) === target);
  return match?.id ?? null;
}

async function applyCampaignStatusChangeStep(params: {
  supabaseAdmin: ReturnType<typeof createAdminClient>;
  campaign: CampaignRow;
  target: TargetRow;
  step: CampaignStepRow;
  nextStep: CampaignStepRow | null;
  nowIso: string;
}) {
  const { supabaseAdmin, campaign, target, step, nextStep, nowIso } = params;
  const statusToSet = step.status_to_set?.trim();

  if (!statusToSet) {
    await updateClaimedTarget(supabaseAdmin, target, {
      status: 'failed',
      error_message: 'Etapa de mudanca de status sem status configurado.',
      last_attempt_at: nowIso,
      locked_at: null,
      lock_token: null,
    });
    return { status: 'failed' };
  }

  if (!target.lead_id) {
    // Alvo veio de CSV sem lead correspondente no CRM: nao ha o que mudar,
    // apenas registra e segue para a proxima etapa da sequencia.
    await insertEvent(supabaseAdmin, {
      campaignId: campaign.id,
      targetId: target.id,
      eventType: 'status_change_skipped_no_lead',
      payload: { stepIndex: step.step_index, statusToSet },
    });
  } else {
    // leads.status (texto) e apenas um espelho de leads.status_id, mantido
    // por um trigger de sincronizacao (trg_sync_lead_status) que prioriza
    // status_id quando ambos estao presentes no UPDATE. Escrever direto em
    // `status` seria silenciosamente revertido pelo trigger, entao e preciso
    // resolver o nome para o id canonico em lead_status_config primeiro
    // (mesmo padrao usado pela acao "update_status" do fluxo de automacao).
    const statusId = await resolveLeadStatusId(supabaseAdmin, statusToSet);

    if (!statusId) {
      const failureResult = await releaseTargetAfterFailure(supabaseAdmin, {
        target,
        errorMessage: `Status "${statusToSet}" nao encontrado na configuracao de status de leads.`,
        retryable: false,
      });
      await insertEvent(supabaseAdmin, {
        campaignId: campaign.id,
        targetId: target.id,
        eventType: 'target_failed',
        payload: { error: 'status_not_found', statusToSet, stepIndex: step.step_index },
      });
      return { status: failureResult.status, error: 'Status nao encontrado.' };
    }

    const { error: leadUpdateError } = await supabaseAdmin
      .from('leads')
      .update({ status_id: statusId })
      .eq('id', target.lead_id);

    if (leadUpdateError) {
      const failureResult = await releaseTargetAfterFailure(supabaseAdmin, {
        target,
        errorMessage: `Erro ao atualizar status do lead: ${leadUpdateError.message}`,
        retryable: true,
      });
      await insertEvent(supabaseAdmin, {
        campaignId: campaign.id,
        targetId: target.id,
        eventType: failureResult.retrying ? 'target_retry_scheduled' : 'target_failed',
        payload: { error: leadUpdateError.message, stepIndex: step.step_index },
      });
      return { status: failureResult.status, error: leadUpdateError.message };
    }

    await insertEvent(supabaseAdmin, {
      campaignId: campaign.id,
      targetId: target.id,
      eventType: 'status_change_applied',
      payload: { stepIndex: step.step_index, statusToSet, statusId, leadId: target.lead_id },
    });
  }

  const nextSendAt = nextStep ? new Date(Date.now() + getDelayMs(nextStep)).toISOString() : null;
  const targetStatus = nextStep ? 'scheduled' : 'sent';

  await updateClaimedTarget(supabaseAdmin, target, {
    status: targetStatus,
    current_step_index: nextStep ? nextStep.step_index : step.step_index,
    next_send_at: nextSendAt,
    next_retry_at: null,
    error_message: null,
    last_attempt_at: nowIso,
    locked_at: null,
    lock_token: null,
  });

  return { status: targetStatus };
}

type CsvLeadDefaults = {
  origemNome: string;
  origemId: string | null;
  statusNome: string | null;
  statusId: string | null;
  tipoContratacaoValue: string | null;
  tipoContratacaoId: string | null;
  responsavelValue: string | null;
  responsavelId: string | null;
};

const CSV_LEAD_ORIGIN_NAME = 'Disparo';

// `leads.origem`/`tipo_contratacao`/`responsavel`/`status` sao colunas
// legadas NOT NULL com FK por nome/valor para tabelas de configuracao (mesmo
// padrao documentado em supabase/functions/public-lead-submit/index.ts).
// Resolve tudo uma unica vez por lote de processamento, nao por alvo.
// Deriva candidatos de "nome" a partir do perfil do criador da campanha
// (user_profiles.username, e o prefixo do e-mail antes de @/./+), para casar
// contra lead_responsaveis.label - a tabela hoje guarda primeiros nomes reais
// dos vendedores (ex.: "Luiza", "Nick"), nao ha vinculo direto usuario<->responsavel
// em nenhum outro lugar do sistema.
function deriveResponsibleNameCandidates(profile: { email: string | null; username: string | null } | null): string[] {
  if (!profile) return [];
  const candidates = new Set<string>();

  if (profile.username) candidates.add(profile.username);

  const emailLocalPart = profile.email?.split('@')[0] ?? '';
  if (emailLocalPart) {
    candidates.add(emailLocalPart);
    const firstSegment = emailLocalPart.split(/[.+_-]/)[0];
    if (firstSegment) candidates.add(firstSegment);
  }

  return Array.from(candidates);
}

async function resolveCampaignCreatorResponsible(
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  campaign: CampaignRow,
  responsibles: Array<{ id: string; label: string; value: string }>,
): Promise<{ id: string; label: string; value: string } | null> {
  if (!campaign.created_by) return null;

  const { data: profile } = await supabaseAdmin
    .from('user_profiles')
    .select('email,username')
    .eq('id', campaign.created_by)
    .maybeSingle();

  const candidates = deriveResponsibleNameCandidates(profile ?? null).map(normalizeLeadStatusName);
  if (candidates.length === 0) return null;

  return responsibles.find((row) => candidates.includes(normalizeLeadStatusName(row.label))) ?? null;
}

async function resolveCsvLeadDefaults(
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  campaign: CampaignRow,
): Promise<CsvLeadDefaults> {
  let origemRow: { id: string; nome: string } | null = null;
  const { data: existingOrigin } = await supabaseAdmin
    .from('lead_origens')
    .select('id,nome')
    .eq('nome', CSV_LEAD_ORIGIN_NAME)
    .maybeSingle();

  if (existingOrigin) {
    origemRow = existingOrigin;
  } else {
    const { data: createdOrigin } = await supabaseAdmin
      .from('lead_origens')
      .insert({ nome: CSV_LEAD_ORIGIN_NAME, ativo: true })
      .select('id,nome')
      .maybeSingle();
    origemRow = createdOrigin
      ?? (await supabaseAdmin.from('lead_origens').select('id,nome').eq('nome', CSV_LEAD_ORIGIN_NAME).maybeSingle()).data
      ?? null;
  }

  const [{ data: statusRows }, { data: contractTypeRows }, { data: responsibleRows }] = await Promise.all([
    supabaseAdmin.from('lead_status_config').select('id,nome,padrao').eq('ativo', true).order('ordem', { ascending: true }),
    supabaseAdmin.from('lead_tipos_contratacao').select('id,label,value').eq('ativo', true).order('ordem', { ascending: true }),
    supabaseAdmin.from('lead_responsaveis').select('id,label,value').eq('ativo', true).order('ordem', { ascending: true }),
  ]);

  const statuses = statusRows ?? [];
  const defaultStatus = statuses.find((row) => row.padrao) ?? statuses[0] ?? null;

  // O CSV traz empresas que ja possuem plano por outro corretor: prioriza um
  // tipo de contratacao empresarial quando existe, com o mesmo criterio de
  // alias usado em public-lead-submit; senao cai no primeiro ativo.
  const contractTypes = contractTypeRows ?? [];
  const businessAliases = ['cnpj', 'pme', 'empresa', 'empresarial', 'pj', 'coletivo empresarial'];
  const defaultContractType = contractTypes.find((row) => {
    const candidate = normalizeLeadStatusName(`${row.label ?? ''} ${row.value ?? ''}`);
    return businessAliases.some((alias) => candidate.includes(alias));
  }) ?? contractTypes[0] ?? null;

  const responsibles = responsibleRows ?? [];
  const creatorResponsible = await resolveCampaignCreatorResponsible(supabaseAdmin, campaign, responsibles);
  const defaultResponsible = creatorResponsible ?? responsibles[0] ?? null;

  if (!creatorResponsible && defaultResponsible) {
    // Nao foi possivel casar o criador da campanha com nenhum responsavel
    // cadastrado (sem created_by, sem perfil, ou nome sem correspondencia em
    // lead_responsaveis) - registra para o fallback nao passar despercebido.
    await insertEvent(supabaseAdmin, {
      campaignId: campaign.id,
      eventType: 'csv_lead_responsible_fallback',
      payload: { createdBy: campaign.created_by, fallbackResponsavel: defaultResponsible.value },
    });
  }

  return {
    origemNome: origemRow?.nome ?? CSV_LEAD_ORIGIN_NAME,
    origemId: origemRow?.id ?? null,
    statusNome: defaultStatus?.nome ?? null,
    statusId: defaultStatus?.id ?? null,
    tipoContratacaoValue: defaultContractType?.value ?? null,
    tipoContratacaoId: defaultContractType?.id ?? null,
    responsavelValue: defaultResponsible?.value ?? null,
    responsavelId: defaultResponsible?.id ?? null,
  };
}

// `leads.telefone` e gravado sem o codigo do pais (DDD + numero), enquanto os
// alvos de campanha normalizam com o prefixo 55. Mesma convencao usada pela
// resolucao de identidade do WhatsApp (storage_whatsapp_campaign_phone).
function stripBrazilCountryCode(phoneDigits: string): string {
  if ((phoneDigits.length === 12 || phoneDigits.length === 13) && phoneDigits.startsWith('55')) {
    return phoneDigits.slice(2);
  }
  return phoneDigits;
}

async function findLeadIdByPhone(
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  phoneDigits: string,
): Promise<string | null> {
  const lookupKeys = new Set(getCommWhatsAppPhoneLookupKeys(phoneDigits));
  if (lookupKeys.size === 0) return null;

  const searchSuffix = phoneDigits.slice(-8);
  if (!searchSuffix) return null;

  const { data: candidates } = await supabaseAdmin
    .from('leads')
    .select('id,telefone')
    .ilike('telefone', `%${searchSuffix}%`)
    .limit(20);

  const match = (candidates ?? []).find((row) => {
    const candidateKeys = getCommWhatsAppPhoneLookupKeys(row.telefone);
    return candidateKeys.some((key) => lookupKeys.has(key));
  });

  return match?.id ?? null;
}

// Vincula um alvo de campanha vindo de CSV a um lead do CRM: reaproveita um
// lead ja existente com o mesmo telefone (normalizado) ou cria um novo,
// somente quando a campanha tem `create_leads_from_csv` habilitado. So roda
// para alvos sem lead_id ainda - depois de resolvido, fica persistido no
// proprio alvo e nao roda de novo.
async function resolveOrCreateCsvTargetLead(
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  campaign: CampaignRow,
  target: TargetRow,
  defaults: CsvLeadDefaults,
): Promise<string | null> {
  if (target.lead_id) return target.lead_id;
  if (target.source_kind !== 'csv') return null;
  if (!campaign.create_leads_from_csv) return null;

  const phoneDigits = normalizeCommWhatsAppPhone(target.phone_digits || target.phone_number);
  if (!phoneDigits) return null;

  const existingLeadId = await findLeadIdByPhone(supabaseAdmin, phoneDigits);
  const leadId = existingLeadId ?? await (async () => {
    const now = getNowIso();
    const displayName = toTrimmedString(target.display_name) || formatPhoneLabel(phoneDigits);

    const { data: createdLead, error: createLeadError } = await supabaseAdmin
      .from('leads')
      .insert({
        nome_completo: displayName,
        telefone: stripBrazilCountryCode(phoneDigits),
        origem: defaults.origemNome,
        origem_id: defaults.origemId,
        status: defaults.statusNome ?? undefined,
        status_id: defaults.statusId,
        tipo_contratacao: defaults.tipoContratacaoValue ?? undefined,
        tipo_contratacao_id: defaults.tipoContratacaoId,
        responsavel: defaults.responsavelValue ?? undefined,
        responsavel_id: defaults.responsavelId,
        observacoes: `Lead criado automaticamente pelo disparo "${campaign.name}".`,
        data_criacao: now,
        ultimo_contato: now,
        arquivado: false,
        skip_automation: true,
      })
      .select('id')
      .maybeSingle();

    if (createLeadError || !createdLead) {
      console.error('[comm-whatsapp-campaign-worker] falha ao criar lead a partir do CSV', {
        campaignId: campaign.id,
        targetId: target.id,
        error: createLeadError?.message,
      });
      return null;
    }

    return createdLead.id as string;
  })();

  if (!leadId) return null;

  await updateClaimedTarget(supabaseAdmin, target, { lead_id: leadId });
  target.lead_id = leadId;

  await insertEvent(supabaseAdmin, {
    campaignId: campaign.id,
    targetId: target.id,
    eventType: existingLeadId ? 'csv_target_linked_to_lead' : 'csv_target_lead_created',
    payload: { leadId },
  });

  return leadId;
}

async function sendTarget(params: {
  supabaseAdmin: ReturnType<typeof createAdminClient>;
  campaign: CampaignRow;
  target: TargetRow;
  token: string;
  channelId: string;
  senderPhone: string | null;
  senderName: string | null;
  csvLeadDefaults: CsvLeadDefaults | null;
}) {
  const { supabaseAdmin, campaign, target } = params;
  let phoneDigits = normalizeCommWhatsAppPhone(target.phone_digits || target.phone_number);
  const fallbackChatId = buildWhapiDirectChatId(phoneDigits);
  const nowIso = getNowIso();

  if (!phoneDigits || !fallbackChatId) {
    await updateClaimedTarget(supabaseAdmin, target, {
      status: 'invalid',
      error_message: 'Telefone invalido.',
      last_attempt_at: nowIso,
      locked_at: null,
      lock_token: null,
    });
    return { status: 'invalid' };
  }

  if (params.csvLeadDefaults) {
    await resolveOrCreateCsvTargetLead(supabaseAdmin, campaign, target, params.csvLeadDefaults);
  }

  let chatRoute = target.chat_id
    ? await resolveCommWhatsAppCanonicalChatRouteByUuid(supabaseAdmin, target.chat_id)
    : await resolveCommWhatsAppCanonicalChatRoute(supabaseAdmin, {
        channelId: params.channelId,
        externalChatId: fallbackChatId,
      });
  let chatId = chatRoute?.externalChatId || fallbackChatId;
  const targetPhoneKeys = new Set(getCommWhatsAppPhoneLookupKeys(phoneDigits));
  const routedPhoneMatchesTarget = !chatRoute?.phoneNumber
    || getCommWhatsAppPhoneLookupKeys(chatRoute.phoneNumber).some((key) => targetPhoneKeys.has(key));

  if (
    chatRoute?.identityConflict
    || (chatRoute?.leadId && target.lead_id && chatRoute.leadId !== target.lead_id)
    || !routedPhoneMatchesTarget
  ) {
    await updateClaimedTarget(supabaseAdmin, target, {
      status: 'failed',
      error_message: 'Identidade WhatsApp exige revisao manual antes de envios automaticos.',
      last_attempt_at: nowIso,
      locked_at: null,
      lock_token: null,
    });
    return { status: 'failed', reason: 'identity_conflict' };
  }
  phoneDigits = chatRoute?.phoneNumber || phoneDigits;

  const { data: optOut } = await supabaseAdmin
    .from('comm_whatsapp_opt_outs')
    .select('id')
    .eq('phone_digits', phoneDigits)
    .eq('status', 'blocked')
    .maybeSingle();

  if (optOut) {
    await updateClaimedTarget(supabaseAdmin, target, {
      status: 'stopped',
      stopped_at: nowIso,
      stopped_reason: 'opt_out',
      last_attempt_at: nowIso,
      locked_at: null,
      lock_token: null,
    });
    return { status: 'stopped', reason: 'opt_out' };
  }

  const lead = await getLeadById(supabaseAdmin, target.lead_id);

  // Sorteia a variante A/B na primeira tentativa de envio do alvo e persiste,
  // para que os follow-ups do mesmo contato continuem na variante sorteada.
  let abVariant = target.ab_variant;
  if (campaign.ab_test_enabled && !abVariant) {
    abVariant = Math.random() * 100 < campaign.ab_split_percent ? 'B' : 'A';
    await updateClaimedTarget(supabaseAdmin, target, { ab_variant: abVariant });
    target.ab_variant = abVariant;
  }

  const steps = await getCampaignSteps(supabaseAdmin, campaign, abVariant);
  const currentStepIndex = Math.max(Number(target.current_step_index) || 0, 0);
  const step = steps.find((item) => item.step_index === currentStepIndex) ?? steps[currentStepIndex] ?? steps[0];
  const stepPosition = Math.max(steps.findIndex((item) => item.step_index === step.step_index), 0);
  const nextStep = steps[stepPosition + 1] ?? null;

  if (campaign.stop_on_reply && target.sent_at) {
    const replyChat = target.responded_at ? null : await findInboundCampaignChat(supabaseAdmin, target);
    const respondedAt = target.responded_at || replyChat?.last_message_at || null;
    if (respondedAt && shouldStopSequenceBeforeStep(step)) {
      await updateClaimedTarget(supabaseAdmin, target, {
        status: 'responded',
        responded_at: respondedAt,
        chat_id: replyChat?.id || target.chat_id,
        locked_at: null,
        lock_token: null,
      });
      return { status: 'responded' };
    }

    if (replyChat && !target.responded_at) {
      await updateClaimedTarget(supabaseAdmin, target, {
        responded_at: replyChat.last_message_at || nowIso,
        chat_id: replyChat.id,
      });
      target.responded_at = replyChat.last_message_at || nowIso;
      target.chat_id = replyChat.id;
    }
  }

  if (step.step_kind === 'status_change') {
    return applyCampaignStatusChangeStep({ supabaseAdmin, campaign, target, step, nextStep, nowIso });
  }

  const text = resolveMessageText(step.message_text, { lead, target }).trim();
  if (!text && !step.media_url) {
    await updateClaimedTarget(supabaseAdmin, target, {
      status: 'failed',
      error_message: 'Mensagem vazia apos aplicar variaveis.',
      last_attempt_at: nowIso,
      locked_at: null,
      lock_token: null,
    });
    return { status: 'failed' };
  }

  // This transaction serializes the campaign-wide daily cap and pace before
  // it creates the durable marker that protects the provider request.
  const sendStartedPayload = {
    startedAt: nowIso,
    phoneDigits,
    externalChatId: chatId,
    messageText: text,
    stepIndex: step.step_index,
    mediaUrl: step.media_url,
  };
  const dispatchReservation = await reserveCampaignDispatch(supabaseAdmin, {
    campaignId: campaign.id,
    target,
    payload: sendStartedPayload,
  });

  if (dispatchReservation.result === 'lease_lost') {
    throw new CampaignTargetLeaseLostError();
  }

  if (dispatchReservation.result !== 'reserved' || !dispatchReservation.event_id) {
    const retryAt = dispatchReservation.retry_at || new Date(Date.now() + 60 * 1000).toISOString();
    await deferClaimedTargetForDispatchGate(supabaseAdmin, {
      target,
      retryAt,
      reason: dispatchReservation.reason || 'A campanha ainda nao possui um slot de envio disponivel.',
    });
    return { status: 'deferred', retryAt, reason: dispatchReservation.reason };
  }

  target.attempts = Math.max(Number(dispatchReservation.attempts) || 0, 0);
  const sendStartedEvent = { id: dispatchReservation.event_id };

  const dispatchRoute = chatRoute?.chatId
    ? await resolveCommWhatsAppCanonicalChatRouteByUuid(supabaseAdmin, chatRoute.chatId)
    : await resolveCommWhatsAppCanonicalChatRoute(supabaseAdmin, {
        channelId: params.channelId,
        externalChatId: chatId,
      });
  const dispatchPhoneMatchesTarget = !dispatchRoute?.phoneNumber
    || getCommWhatsAppPhoneLookupKeys(dispatchRoute.phoneNumber).some((key) => targetPhoneKeys.has(key));
  if (
    dispatchRoute?.identityConflict
    || (dispatchRoute?.leadId && target.lead_id && dispatchRoute.leadId !== target.lead_id)
    || !dispatchPhoneMatchesTarget
  ) {
    const errorMessage = 'Identidade WhatsApp mudou durante a reserva e exige revisao manual.';
    await resolveCampaignSendStartedEvent(supabaseAdmin, {
      eventId: sendStartedEvent.id,
      resolution: 'identity_changed_before_dispatch',
      dispatchPermitState: 'released',
    });
    await updateClaimedTarget(supabaseAdmin, target, {
      status: 'failed',
      error_message: errorMessage,
      last_attempt_at: nowIso,
      locked_at: null,
      lock_token: null,
    });
    return { status: 'failed', reason: 'identity_conflict' };
  }
  chatRoute = dispatchRoute;
  chatId = dispatchRoute?.externalChatId || chatId;
  phoneDigits = dispatchRoute?.phoneNumber || phoneDigits;

  let response: Response;
  let payload: unknown;
  try {
    const whapi = createWhapiClient(params.token);
    response = step.media_url
      ? await sendCampaignMedia(params.token, chatId, step, text)
      : await whapi.sendText(chatId, text);
    payload = await readResponsePayload(response);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Falha de rede ao enviar mensagem na Whapi.';
    const failureResult = await releaseTargetAfterFailure(supabaseAdmin, {
      target,
      errorMessage,
      // A network failure after request dispatch is ambiguous. Do not retry
      // automatically and risk sending the same campaign step twice.
      retryable: false,
    });
    await insertEvent(supabaseAdmin, {
      campaignId: campaign.id,
      targetId: target.id,
      eventType: 'target_failed_ambiguous_provider_result',
      payload: { error: errorMessage, sendStartedEventId: sendStartedEvent.id },
    });
    return { status: failureResult.status, error: errorMessage };
  }

  if (!response.ok) {
    const errorMessage = parseWhapiError(payload) || 'Falha ao enviar mensagem na Whapi.';
    // A client error is a confirmed provider rejection, except for request
    // timeout, where the provider may still have accepted the message.
    const providerRejectedRequest = response.status >= 400 && response.status < 500 && response.status !== 408;
    if (providerRejectedRequest) {
      await resolveCampaignSendStartedEvent(supabaseAdmin, {
        eventId: sendStartedEvent.id,
        resolution: 'provider_rejected_request',
        dispatchPermitState: 'released',
      });
    }
    const failureResult = await releaseTargetAfterFailure(supabaseAdmin, {
      target,
      errorMessage,
      // Only a confirmed rate limit is retried automatically. Other failures
      // require intervention, and ambiguous requests retain their marker.
      retryable: providerRejectedRequest && response.status === 429,
    });
    await insertEvent(supabaseAdmin, { campaignId: campaign.id, targetId: target.id, eventType: failureResult.retrying ? 'target_retry_scheduled' : 'target_failed', payload: { error: errorMessage, nextRetryAt: failureResult.nextRetryAt, sendStartedEventId: sendStartedEvent.id } });
    return { status: failureResult.status, error: errorMessage };
  }

  if (payload && typeof payload === 'object' && !Array.isArray(payload) && (payload as Record<string, unknown>).sent === false) {
    const errorMessage = parseWhapiError(payload) || 'A Whapi nao confirmou o envio da mensagem.';
    await resolveCampaignSendStartedEvent(supabaseAdmin, {
      eventId: sendStartedEvent.id,
      resolution: 'provider_reported_not_sent',
      dispatchPermitState: 'released',
    });
    const failureResult = await releaseTargetAfterFailure(supabaseAdmin, { target, errorMessage, retryable: false });
    await insertEvent(supabaseAdmin, { campaignId: campaign.id, targetId: target.id, eventType: 'target_failed', payload: { error: errorMessage, sendStartedEventId: sendStartedEvent.id } });
    return { status: failureResult.status, error: errorMessage };
  }

  const externalMessageId = extractWhapiMessageId(payload);
  if (!externalMessageId) {
    const errorMessage = 'A Whapi respondeu com sucesso, mas nao retornou o identificador da mensagem. O alvo exige revisao antes de novo envio.';
    const failureResult = await releaseTargetAfterFailure(supabaseAdmin, { target, errorMessage, retryable: false });
    await insertEvent(supabaseAdmin, { campaignId: campaign.id, targetId: target.id, eventType: 'target_failed_ambiguous_provider_result', payload: { error: errorMessage, sendStartedEventId: sendStartedEvent.id } });
    return { status: failureResult.status, error: errorMessage };
  }

  const deliveryStatus = resolveWhapiOutboundDeliveryStatus(payload, externalMessageId);
  const displayName = chatRoute?.displayName || lead?.nome_completo || target.display_name || formatPhoneLabel(phoneDigits);
  const nextSendAt = nextStep ? new Date(Date.now() + getDelayMs(nextStep)).toISOString() : null;
  const targetStatus = nextStep ? 'scheduled' : 'sent';
  const acceptedPayload = {
    externalMessageId,
    deliveryStatus,
    messageText: text,
    phoneDigits,
    externalChatId: chatId,
    displayName,
    sentAt: nowIso,
    stepIndex: step.step_index,
    targetStatus,
    nextStepIndex: nextStep ? nextStep.step_index : step.step_index,
    nextSendAt,
    sendStartedEventId: sendStartedEvent.id,
  };

  let pendingPersistenceEvent: { id: string };
  try {
    pendingPersistenceEvent = await createProviderAcceptedPersistenceEvent(supabaseAdmin, {
      campaignId: campaign.id,
      targetId: target.id,
      payload: acceptedPayload,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Nao foi possivel registrar o aceite da Whapi.';
    try {
      await updateClaimedTarget(supabaseAdmin, target, {
        status: 'failed',
        error_message: 'Mensagem pode ter sido aceita pela Whapi, mas nao foi possivel registrar a reconciliacao.',
        locked_at: null,
        lock_token: null,
      });
    } catch (checkpointError) {
      throw new CampaignProviderAcceptedError(
        checkpointError instanceof Error ? checkpointError.message : errorMessage,
      );
    }
    throw new CampaignProviderAcceptedError(errorMessage);
  }

  try {
    await resolveCampaignSendStartedEvent(supabaseAdmin, {
      eventId: sendStartedEvent.id,
      resolution: 'provider_accepted_checkpointed',
      dispatchPermitState: 'accepted',
    });
  } catch (error) {
    throw new CampaignProviderAcceptedError(
      error instanceof Error ? error.message : 'Nao foi possivel encerrar a tentativa aceita pela Whapi.',
    );
  }

  let persisted: Awaited<ReturnType<typeof persistCommWhatsAppMessage>>;
  try {
    persisted = await persistCommWhatsAppMessage(supabaseAdmin, {
      channelId: params.channelId,
      externalChatId: chatId,
      phoneNumber: phoneDigits,
      displayName,
      pushName: null,
      lastMessageText: text,
      lastMessageDirection: 'outbound',
      lastMessageAt: nowIso,
      incrementUnread: false,
      externalMessageId,
      direction: 'outbound',
      messageType: 'text',
      deliveryStatus,
      textContent: text,
      createdBy: campaign.created_by,
      source: 'campaign',
      senderPhone: params.senderPhone,
      senderName: params.senderName,
      statusUpdatedAt: nowIso,
      errorMessage: null,
      mediaId: null,
      mediaUrl: null,
      mediaMimeType: null,
      mediaFileName: null,
      mediaSizeBytes: null,
      mediaDurationSeconds: null,
      mediaCaption: null,
      metadata: {
        provider: 'whapi',
        campaign_id: campaign.id,
        campaign_target_id: target.id,
        campaign_step_index: step.step_index,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro ao persistir mensagem aceita pela Whapi.';
    try {
      await updateClaimedTarget(supabaseAdmin, target, {
        status: 'failed',
        error_message: 'Mensagem aceita pela Whapi; persistencia local pendente.',
        locked_at: null,
        lock_token: null,
      });
    } catch (checkpointError) {
      throw new CampaignProviderAcceptedError(
        checkpointError instanceof Error ? checkpointError.message : errorMessage,
      );
    }
    await params.supabaseAdmin
      .from('comm_whatsapp_campaign_events')
      .update({
        payload: {
          ...acceptedPayload,
          error: errorMessage,
          last_recovery_error: errorMessage,
        },
      })
      .eq('id', pendingPersistenceEvent.id);
    return { status: 'failed', externalMessageId, deliveryStatus, persistencePending: true };
  }

  try {
    await updateClaimedTarget(supabaseAdmin, target, {
      status: targetStatus,
      sent_at: nowIso,
      chat_id: persisted.chatId || target.chat_id,
      current_step_index: nextStep ? nextStep.step_index : step.step_index,
      next_send_at: nextSendAt,
      next_retry_at: null,
      external_message_id: externalMessageId,
      error_message: null,
      last_attempt_at: nowIso,
      locked_at: null,
      lock_token: null,
    });
  } catch (checkpointError) {
    throw new CampaignProviderAcceptedError(
      checkpointError instanceof Error ? checkpointError.message : 'Nao foi possivel finalizar o alvo aceito pela Whapi.',
    );
  }

  try {
    await resolveCampaignSendStartedEvent(supabaseAdmin, {
      eventId: sendStartedEvent.id,
      resolution: 'provider_accepted_persisted',
      dispatchPermitState: 'accepted',
    });
  } catch (error) {
    throw new CampaignProviderAcceptedError(
      error instanceof Error ? error.message : 'Nao foi possivel encerrar a tentativa persistida da Whapi.',
    );
  }

  const persistedAt = getNowIso();
  const { data: persistedEvent, error: persistEventError } = await params.supabaseAdmin
    .from('comm_whatsapp_campaign_events')
    .update({
      payload: {
        ...acceptedPayload,
        recovered_at: persistedAt,
        persisted_at: persistedAt,
      },
    })
    .eq('id', pendingPersistenceEvent.id)
    .select('id')
    .maybeSingle();

  if (persistEventError || !persistedEvent) {
    throw new CampaignProviderAcceptedError(
      persistEventError?.message || 'Nao foi possivel concluir o checkpoint da mensagem aceita pela Whapi.',
    );
  }

  await insertEvent(supabaseAdmin, {
    campaignId: campaign.id,
    targetId: target.id,
    eventType: nextStep ? 'target_step_sent' : 'target_sent',
    payload: { externalMessageId, deliveryStatus, stepIndex: step.step_index, nextStepIndex: nextStep?.step_index ?? null, nextSendAt },
  });
  return { status: targetStatus, externalMessageId, deliveryStatus };
}

// Quantos alvos com whatsapp_check_status='pending' este tick tenta checar,
// com quantas checagens simultaneas, e por quanto tempo no maximo. Cada
// checagem e uma chamada individual a Whapi (checkWhapiContactStatus) - nao
// ha endpoint de lote documentado/confirmado, entao evita depender de um
// formato de resposta em lote nao verificado. Concorrencia baixa de
// proposito: uma checagem que falha (rede, rate limit 429 etc.) fica
// 'unknown' e e tentada de novo no proximo tick, NUNCA e tratada como "nao
// tem WhatsApp" - so uma resposta explicita da Whapi confirma isso.
//
// O orcamento de tempo (WHATSAPP_VALIDATION_TIME_BUDGET_MS) e o que
// realmente importa aqui: 300 alvos / 5 simultaneos, se a Whapi estiver
// lenta ou instavel (timeout de 10s por checagem), pode levar minutos -
// tempo suficiente pra estourar o limite de execucao da invocacao e matar o
// tick INTEIRO antes mesmo de chegar no envio de mensagens de verdade, que
// roda depois desta funcao em processCampaigns. Por isso a validacao para
// de pegar novos alvos assim que o orcamento estoura (o resto fica
// 'pending' pro proximo tick) - o envio de mensagens sempre tem que rodar
// todo tick, mesmo se a Whapi estiver reagindo mal as checagens de numero.
const WHATSAPP_VALIDATION_TARGETS_PER_TICK = 300;
const WHATSAPP_VALIDATION_CONCURRENCY = 5;
const WHATSAPP_VALIDATION_TIME_BUDGET_MS = 15_000;

async function validatePendingWhatsAppTargets(
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  token: string,
): Promise<{ checked: number; valid: number; invalid: number; skippedByBudget: number }> {
  const { data, error } = await supabaseAdmin
    .from('comm_whatsapp_campaign_targets')
    .select('id,campaign_id,phone_number,phone_digits')
    .eq('whatsapp_check_status', 'pending')
    .order('created_at', { ascending: true })
    .limit(WHATSAPP_VALIDATION_TARGETS_PER_TICK);

  if (error) {
    console.error('[comm-whatsapp-campaign-worker] erro ao buscar alvos pendentes de validacao no WhatsApp', error);
    return { checked: 0, valid: 0, invalid: 0, skippedByBudget: 0 };
  }

  const targets = (data ?? []) as Array<{ id: string; campaign_id: string; phone_number: string; phone_digits: string }>;
  if (targets.length === 0) return { checked: 0, valid: 0, invalid: 0, skippedByBudget: 0 };

  let validCount = 0;
  let invalidCount = 0;
  let checkedCount = 0;
  let skippedByBudget = 0;
  const nowIso = getNowIso();
  const deadline = Date.now() + WHATSAPP_VALIDATION_TIME_BUDGET_MS;

  await mapWithConcurrency(targets, WHATSAPP_VALIDATION_CONCURRENCY, async (target) => {
    if (Date.now() > deadline) {
      skippedByBudget += 1;
      return;
    }

    const phoneDigits = normalizeCommWhatsAppPhone(target.phone_digits || target.phone_number);

    if (!phoneDigits) {
      checkedCount += 1;
      invalidCount += 1;
      await supabaseAdmin
        .from('comm_whatsapp_campaign_targets')
        .update({ whatsapp_check_status: 'invalid', whatsapp_checked_at: nowIso, status: 'invalid', error_message: 'Telefone invalido.' })
        .eq('id', target.id)
        .eq('whatsapp_check_status', 'pending');
      return;
    }

    const result = await checkWhapiContactStatus({ token, contactId: phoneDigits });
    checkedCount += 1;

    if (result.outcome === 'unknown') {
      // Falha de rede/Whapi ou resposta ambigua: deixa 'pending' pra tentar
      // de novo no proximo tick, nao marca como invalido sem confirmar.
      return;
    }

    if (result.outcome === 'valid') {
      validCount += 1;
      await supabaseAdmin
        .from('comm_whatsapp_campaign_targets')
        .update({ whatsapp_check_status: 'valid', whatsapp_checked_at: nowIso })
        .eq('id', target.id)
        .eq('whatsapp_check_status', 'pending');
    } else {
      invalidCount += 1;
      await supabaseAdmin
        .from('comm_whatsapp_campaign_targets')
        .update({ whatsapp_check_status: 'invalid', whatsapp_checked_at: nowIso, status: 'invalid', error_message: 'Numero nao possui WhatsApp.' })
        .eq('id', target.id)
        .eq('whatsapp_check_status', 'pending');
      await insertEvent(supabaseAdmin, {
        campaignId: target.campaign_id,
        targetId: target.id,
        eventType: 'whatsapp_number_invalid',
        payload: {},
      });
    }
  });

  if (skippedByBudget > 0) {
    console.warn('[comm-whatsapp-campaign-worker] validacao de WhatsApp cortada pelo orcamento de tempo do tick', {
      checked: checkedCount,
      skippedByBudget,
    });
  }

  return { checked: checkedCount, valid: validCount, invalid: invalidCount, skippedByBudget };
}

async function processCampaigns(
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  params: { campaignId?: string; limit?: number },
) {
  const settings = await ensureCommWhatsAppSettings(supabaseAdmin);
  const channel = await ensurePrimaryChannel(supabaseAdmin);
  const token = sanitizeWhapiToken(settings.token);

  if (!settings.enabled) throw new Error('Integracao WhatsApp desabilitada.');
  if (!token) throw new Error('Token da Whapi nao configurado.');

  // Roda independente do status da campanha (inclusive rascunho) - a
  // validacao comeca assim que o CSV e importado, nao so quando a campanha e
  // ativada, pra estar pronta quando o usuario ativar.
  await validatePendingWhatsAppTargets(supabaseAdmin, token).catch((validationError) => {
    console.error('[comm-whatsapp-campaign-worker] validacao de numeros no WhatsApp falhou', validationError);
  });

  await reconcileAcceptedCampaignPersistences({
    supabaseAdmin,
    channelId: channel.id,
    senderPhone: channel.phone_number,
    senderName: channel.connected_user_name,
  });
  await reconcileResponses(supabaseAdmin, params.campaignId);
  await reactivateRecurringCampaigns(supabaseAdmin);

  let query = supabaseAdmin
    .from('comm_whatsapp_campaigns')
    .select('id,name,status,audience_source,audience_config,message_text,scheduled_at,pacing_per_minute,daily_send_limit,send_window_start,send_window_end,stop_on_reply,created_by,ab_test_enabled,ab_split_percent,recurrence_rule,recurrence_interval,recurrence_end_at,recurrence_next_run_at,recurrence_runs_completed,create_leads_from_csv,active_weekdays')
    .in('status', ['queued', 'running', 'scheduled'])
    .order('created_at', { ascending: true })
    .limit(params.campaignId ? 1 : 5);

  if (params.campaignId) {
    query = query.eq('id', params.campaignId);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Erro ao buscar campanhas: ${error.message}`);

  const now = Date.now();
  const campaigns = ((data ?? []) as CampaignRow[]).filter((campaign) => !campaign.scheduled_at || Date.parse(campaign.scheduled_at) <= now);
  const maxLimit = Math.min(Math.max(params.limit ?? 25, 1), 100);
  let processed = 0;
  let sent = 0;
  let failed = 0;
  let stopped = 0;

  for (const campaign of campaigns) {
    if (!isWithinSendWindow(campaign)) {
      await supabaseAdmin.from('comm_whatsapp_campaigns').update({ status: 'scheduled', last_error: null }).eq('id', campaign.id);
      continue;
    }

    await supabaseAdmin.from('comm_whatsapp_campaigns').update({ status: 'running', started_at: getNowIso(), last_error: null }).eq('id', campaign.id);
    // pacing_per_minute so espaca a admissao de contatos novos (reforcado na
    // RPC de reserva de despacho); alvos ja admitidos podem ser reivindicados
    // livremente ate o teto geral da invocacao, sem depender do ritmo.
    const campaignLimit = maxLimit - processed;
    if (campaignLimit <= 0) break;

    const targets = await listTargetsForProcessing(supabaseAdmin, campaign, campaignLimit);

    const csvLeadDefaults = campaign.create_leads_from_csv && targets.some((target) => target.source_kind === 'csv' && !target.lead_id)
      ? await resolveCsvLeadDefaults(supabaseAdmin, campaign)
      : null;

    const processTarget = async (target: TargetRow): Promise<{ status?: string; skipped?: boolean }> => {
      const currentCampaign = await getCampaign(supabaseAdmin, campaign.id);
      if (currentCampaign.status === 'paused' || currentCampaign.status === 'cancelled') {
        await releaseClaimedTarget(supabaseAdmin, target, currentCampaign.status === 'cancelled' ? 'cancelled' : 'scheduled');
        return { skipped: true };
      }

      try {
        return await sendTarget({
          supabaseAdmin,
          campaign,
          target,
          token,
          channelId: channel.id,
          senderPhone: channel.phone_number,
          senderName: channel.connected_user_name,
          csvLeadDefaults,
        });
      } catch (error) {
        if (error instanceof CampaignTargetLeaseLostError) {
          await insertEvent(supabaseAdmin, {
            campaignId: campaign.id,
            targetId: target.id,
            eventType: 'target_lease_lost',
            payload: { error: error.message },
          });
          return { status: 'lease_lost' };
        }

        if (error instanceof CampaignProviderAcceptedError) {
          console.error('[comm-whatsapp-campaign-worker] mensagem aceita pela Whapi sem checkpoint completo', {
            campaignId: campaign.id,
            targetId: target.id,
            error: error.message,
          });
          return { status: 'provider_accepted_unreconciled' };
        }

        const message = error instanceof Error ? error.message : 'Erro inesperado ao enviar mensagem.';
        const result = await releaseTargetAfterFailure(supabaseAdmin, { target, errorMessage: message, retryable: true });
        await insertEvent(supabaseAdmin, { campaignId: campaign.id, targetId: target.id, eventType: result.status === 'retry_scheduled' ? 'target_retry_scheduled' : 'target_failed', payload: { error: message } });
        return result;
      }
    };

    // Processa o lote reivindicado em paralelo (pool limitado) em vez de um por
    // vez: reduz o tempo de parede do lote sem mudar quantos alvos são
    // reivindicados por invocação (esse teto continua vindo de campaignLimit).
    const targetResults = await mapWithConcurrency(targets, getCampaignSendConcurrency(), processTarget);

    for (const result of targetResults) {
      if (result.skipped) continue;
      processed += 1;
      if (result.status === 'sent' || result.status === 'scheduled') sent += 1;
      if (result.status === 'failed' || result.status === 'invalid') failed += 1;
      if (result.status === 'stopped') stopped += 1;
    }

    const counters = await recomputeCampaignCounters(supabaseAdmin, campaign.id);
    if (counters.pending === 0 && counters.total > 0) {
      const completedAt = getNowIso();
      // Agenda a proxima rodada automatica na primeira vez que a campanha
      // termina, se ela tiver recorrencia configurada e ainda nao tiver uma
      // proxima execucao marcada.
      const recurrenceNextRunAt = campaign.recurrence_rule !== 'none' && !campaign.recurrence_next_run_at
        ? computeNextRecurrenceRun(campaign.recurrence_rule, campaign.recurrence_interval, new Date(completedAt))
        : campaign.recurrence_next_run_at;
      await supabaseAdmin
        .from('comm_whatsapp_campaigns')
        .update({
          status: 'completed',
          completed_at: completedAt,
          ...(recurrenceNextRunAt !== campaign.recurrence_next_run_at ? { recurrence_next_run_at: recurrenceNextRunAt } : {}),
        })
        .eq('id', campaign.id);
      await insertEvent(supabaseAdmin, { campaignId: campaign.id, eventType: 'campaign_completed', payload: counters });
    }
  }

  return { processed, sent, failed, stopped };
}

async function reactivateRecurringCampaigns(supabaseAdmin: ReturnType<typeof createAdminClient>) {
  const { data, error } = await supabaseAdmin
    .from('comm_whatsapp_campaigns')
    .select('id,name,status,audience_source,audience_config,message_text,scheduled_at,pacing_per_minute,daily_send_limit,send_window_start,send_window_end,stop_on_reply,created_by,ab_test_enabled,ab_split_percent,recurrence_rule,recurrence_interval,recurrence_end_at,recurrence_next_run_at,recurrence_runs_completed')
    .eq('status', 'completed')
    .neq('recurrence_rule', 'none')
    .not('recurrence_next_run_at', 'is', null)
    .lte('recurrence_next_run_at', getNowIso())
    .in('audience_source', ['crm', 'mixed'])
    .limit(10);

  if (error) {
    throw new Error(`Erro ao buscar campanhas recorrentes: ${error.message}`);
  }

  for (const campaign of (data ?? []) as CampaignRow[]) {
    if (campaign.recurrence_end_at && Date.parse(campaign.recurrence_next_run_at!) > Date.parse(campaign.recurrence_end_at)) {
      // Passou da data limite de recorrencia: encerra sem reativar de novo.
      await supabaseAdmin
        .from('comm_whatsapp_campaigns')
        .update({ recurrence_rule: 'none', recurrence_next_run_at: null })
        .eq('id', campaign.id);
      continue;
    }

    // Remove os alvos da rodada anterior para poder rematerializar o publico
    // de CRM sem colidir com a chave unica (campaign_id, phone_digits).
    const { error: deleteError } = await supabaseAdmin
      .from('comm_whatsapp_campaign_targets')
      .delete()
      .eq('campaign_id', campaign.id);
    if (deleteError) {
      console.error('[comm-whatsapp-campaign-worker] erro ao limpar alvos para nova rodada recorrente', deleteError);
      continue;
    }

    try {
      const activation = await activateCampaign(supabaseAdmin, campaign.id, null);
      const nextRunAt = computeNextRecurrenceRun(campaign.recurrence_rule, campaign.recurrence_interval, new Date(campaign.recurrence_next_run_at!));
      await supabaseAdmin
        .from('comm_whatsapp_campaigns')
        .update({
          recurrence_next_run_at: nextRunAt,
          recurrence_runs_completed: (campaign.recurrence_runs_completed || 0) + 1,
        })
        .eq('id', campaign.id);
      await insertEvent(supabaseAdmin, {
        campaignId: campaign.id,
        eventType: 'campaign_recurrence_triggered',
        payload: { activation, nextRunAt },
      });
    } catch (activationError) {
      const message = activationError instanceof Error ? activationError.message : 'Erro ao reativar campanha recorrente.';
      console.error('[comm-whatsapp-campaign-worker] erro ao reativar campanha recorrente', { campaignId: campaign.id, error: message });
      await supabaseAdmin.from('comm_whatsapp_campaigns').update({ last_error: message }).eq('id', campaign.id);
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return createJsonResponse({ error: 'Metodo nao permitido.' }, 405);
  }

  try {
    const supabaseAdmin = createAdminClient();
    const authorization = await authorizeRequest(req, supabaseAdmin);
    if (!authorization.authorized) return authorization.response;

    const body = (await req.json().catch(() => ({}))) as WorkerRequestBody;
    const action = body.action || 'process';
    const campaignId = toTrimmedString(body.campaignId);
    const source = normalizeRunSource(body.source || (isServiceRoleRequest(req, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '') ? 'cron' : 'dashboard'));

    if (action === 'activate') {
      if (!campaignId) return createJsonResponse({ error: 'Campanha obrigatoria.' }, 400);
      const run = await createWorkerRun(supabaseAdmin, { action, source, campaignId });
      try {
        const result = await activateCampaign(supabaseAdmin, campaignId, authorization.profileId);
        await finishWorkerRun(supabaseAdmin, run, { status: 'success' });
        return createJsonResponse({ success: true, ...result });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Erro interno no worker de campanhas.';
        await finishWorkerRun(supabaseAdmin, run, { status: 'failed', errorMessage: message });
        throw error;
      }
    }

    if (action === 'test_send') {
      if (!campaignId) return createJsonResponse({ error: 'Campanha obrigatoria.' }, 400);
      const phoneNumber = toTrimmedString(body.phoneNumber);
      if (!phoneNumber) return createJsonResponse({ error: 'Informe um telefone para o envio de teste.' }, 400);
      const stepIndex = Number.isFinite(body.stepIndex) ? Math.max(Math.floor(body.stepIndex as number), 0) : 0;
      const variant = body.variant === 'B' ? 'B' : 'A';
      const result = await sendCampaignTestMessage(supabaseAdmin, {
        campaignId,
        phoneNumber,
        stepIndex,
        variant,
        profileId: authorization.profileId,
      });
      return createJsonResponse({ success: true, ...result });
    }

    if (action === 'process') {
      const run = await createWorkerRun(supabaseAdmin, { action, source, campaignId: campaignId || null });
      try {
        const result = await processCampaigns(supabaseAdmin, { campaignId: campaignId || undefined, limit: body.limit });
        await finishWorkerRun(supabaseAdmin, run, { status: 'success', result });
        return createJsonResponse({ success: true, ...result });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Erro interno no worker de campanhas.';
        await finishWorkerRun(supabaseAdmin, run, { status: 'failed', errorMessage: message });
        throw error;
      }
    }

    return createJsonResponse({ error: 'Acao invalida.' }, 400);
  } catch (error) {
    console.error('[comm-whatsapp-campaign-worker] erro inesperado', error);
    return createJsonResponse({ error: error instanceof Error ? error.message : 'Erro interno no worker de campanhas.' }, 500);
  }
});
