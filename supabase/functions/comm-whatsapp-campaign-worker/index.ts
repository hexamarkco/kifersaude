// @ts-expect-error Deno npm import
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { authorizeDashboardUser, isServiceRoleRequest } from '../_shared/dashboard-auth.ts';
import { generateTextWithRouting } from '../_shared/ai-router.ts';
import {
  WHAPI_BASE_URL,
  buildWhapiDirectChatId,
  corsHeaders,
  ensureCommWhatsAppSettings,
  ensurePrimaryChannel,
  extractWhapiMessageId,
  formatPhoneLabel,
  getNowIso,
  normalizeCommWhatsAppPhone,
  parseWhapiError,
  persistCommWhatsAppMessage,
  readResponsePayload,
  resolveWhapiOutboundDeliveryStatus,
  sanitizeWhapiToken,
  toTrimmedString,
} from '../_shared/comm-whatsapp.ts';

declare const Deno: {
  env: {
    get: (key: string) => string | undefined;
  };
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};

type WorkerAction = 'activate' | 'process';

type WorkerRequestBody = {
  action?: WorkerAction;
  campaignId?: string;
  limit?: number;
  source?: 'cron' | 'manual' | 'dashboard' | 'api';
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
  send_window_start: string | null;
  send_window_end: string | null;
  stop_on_reply: boolean;
  created_by: string | null;
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
};

type CampaignStepRow = {
  id: string;
  campaign_id: string;
  step_index: number;
  message_text: string;
  delay_amount: number;
  delay_unit: 'seconds' | 'minutes' | 'hours' | 'days';
};

type LeadRow = {
  id: string;
  nome_completo: string | null;
  telefone: string | null;
  status: string | null;
  responsavel: string | null;
  responsavel_id: string | null;
  arquivado: boolean | null;
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

const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };
const CRM_TARGET_PAGE_SIZE = 1000;
const CRM_TARGET_INSERT_CHUNK_SIZE = 500;
const OPT_OUT_LOOKUP_CHUNK_SIZE = 500;
const MAX_SEND_ATTEMPTS = 3;
const RETRY_BACKOFF_MINUTES = [5, 30, 120];
const DEFAULT_CAMPAIGN_TIME_ZONE = 'America/Sao_Paulo';

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

const getOptionalString = (value: unknown) => typeof value === 'string' && value.trim() ? value.trim() : null;

const chunkArray = <T,>(items: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

const createLockToken = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `campaign-lock-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const parseTimeOfDayToMinutes = (value: string | null) => {
  if (!value) return null;
  const match = value.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
};

const isWithinSendWindow = (campaign: CampaignRow, now = new Date()) => {
  const start = parseTimeOfDayToMinutes(campaign.send_window_start);
  const end = parseTimeOfDayToMinutes(campaign.send_window_end);
  if (start === null || end === null || start === end) return true;

  const timeZone = Deno.env.get('COMM_WHATSAPP_CAMPAIGN_TIME_ZONE') || DEFAULT_CAMPAIGN_TIME_ZONE;
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

const resolveMessageText = (template: string, params: { lead?: LeadRow | null; target?: TargetRow | null }) => {
  const lead = params.lead ?? null;
  const target = params.target ?? null;
  const replacements: Record<string, string> = {
    nome: lead?.nome_completo || target?.display_name || '',
    primeiro_nome: (lead?.nome_completo || target?.display_name || '').split(/\s+/).filter(Boolean)[0] || '',
    telefone: lead?.telefone || target?.phone_number || '',
    status: lead?.status || '',
    responsavel: lead?.responsavel || '',
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
    .select('id,name,status,audience_source,audience_config,message_text,scheduled_at,pacing_per_minute,send_window_start,send_window_end,stop_on_reply,created_by')
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

  const leads: LeadRow[] = [];
  for (let from = 0; ; from += CRM_TARGET_PAGE_SIZE) {
    let query = supabaseAdmin
      .from('leads')
      .select('id,nome_completo,telefone,status,responsavel,responsavel_id,arquivado')
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

  for (const rowsChunk of chunkArray(validRows, CRM_TARGET_INSERT_CHUNK_SIZE)) {
    const { error: insertError } = await supabaseAdmin
      .from('comm_whatsapp_campaign_targets')
      .upsert(rowsChunk, { onConflict: 'campaign_id,phone_digits', ignoreDuplicates: true });

    if (insertError) {
      throw new Error(`Erro ao criar alvos da campanha: ${insertError.message}`);
    }
  }

  return {
    total: normalizedRows.length,
    valid: validRows.length,
    invalid: normalizedRows.length - validRows.length,
  };
}

async function recomputeCampaignCounters(supabaseAdmin: ReturnType<typeof createAdminClient>, campaignId: string) {
  const { data, error } = await supabaseAdmin
    .from('comm_whatsapp_campaign_targets')
    .select('status')
    .eq('campaign_id', campaignId);

  if (error) {
    throw new Error(`Erro ao recalcular contadores da campanha: ${error.message}`);
  }

  const rows = data ?? [];
  const count = (statuses: string[]) => rows.filter((row) => statuses.includes(String(row.status))).length;
  const invalid = count(['invalid']);
  const failed = count(['failed']);
  const sent = count(['sent']);
  const responded = count(['responded']);
  const stopped = count(['stopped', 'cancelled']);
  const pending = count(['pending', 'scheduled', 'sending']);

  const { error: updateError } = await supabaseAdmin
    .from('comm_whatsapp_campaigns')
    .update({
      total_targets: rows.length,
      valid_targets: rows.length - invalid,
      invalid_targets: invalid,
      pending_targets: pending,
      sent_targets: sent,
      failed_targets: failed,
      responded_targets: responded,
      stopped_targets: stopped,
      completed_at: pending === 0 && rows.length > 0 ? getNowIso() : null,
    })
    .eq('id', campaignId);

  if (updateError) {
    throw new Error(`Erro ao atualizar contadores da campanha: ${updateError.message}`);
  }

  return { total: rows.length, pending, sent, failed, invalid, responded, stopped };
}

async function activateCampaign(
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  campaignId: string,
  profileId: string | null,
) {
  const campaign = await getCampaign(supabaseAdmin, campaignId);
  if (!['draft', 'scheduled', 'paused'].includes(campaign.status)) {
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

async function reconcileResponses(supabaseAdmin: ReturnType<typeof createAdminClient>, campaignId?: string) {
  let query = supabaseAdmin
    .from('comm_whatsapp_campaign_targets')
    .select('id,campaign_id,lead_id,phone_digits,sent_at')
    .in('status', ['sent', 'scheduled', 'sending'])
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
  for (const target of data ?? []) {
    const { data: chat } = await supabaseAdmin
      .from('comm_whatsapp_chats')
      .select('id,last_message_at,last_message_direction')
      .eq('phone_digits', target.phone_digits)
      .eq('last_message_direction', 'inbound')
      .gt('last_message_at', target.sent_at)
      .order('last_message_at', { ascending: false })
      .limit(1)
      .maybeSingle();

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
    await supabaseAdmin
      .from('comm_whatsapp_campaign_targets')
      .update({ status: 'responded', responded_at: chat.last_message_at || nowIso, chat_id: chat.id })
      .eq('id', target.id);

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
): Promise<CampaignStepRow[]> {
  const { data, error } = await supabaseAdmin
    .from('comm_whatsapp_campaign_steps')
    .select('id,campaign_id,step_index,message_text,delay_amount,delay_unit')
    .eq('campaign_id', campaign.id)
    .order('step_index', { ascending: true });

  if (error) {
    throw new Error(`Erro ao carregar etapas da campanha: ${error.message}`);
  }

  const steps = (data ?? []) as CampaignStepRow[];
  if (steps.length > 0) return steps;

  return [{
    id: 'fallback-message',
    campaign_id: campaign.id,
    step_index: 0,
    message_text: campaign.message_text,
    delay_amount: 0,
    delay_unit: 'minutes',
  }];
}

async function releaseTargetAfterFailure(
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  params: { target: TargetRow; status?: 'failed' | 'scheduled'; errorMessage: string; retryable?: boolean },
) {
  const attempts = Math.max(Number(params.target.attempts) || 0, 0);
  const canRetry = Boolean(params.retryable) && attempts < MAX_SEND_ATTEMPTS;
  const nextRetryAt = canRetry ? getNextRetryAt(attempts) : null;

  await supabaseAdmin
    .from('comm_whatsapp_campaign_targets')
    .update({
      status: canRetry ? 'scheduled' : (params.status ?? 'failed'),
      error_message: params.errorMessage,
      retry_count: canRetry ? (Number(params.target.retry_count) || 0) + 1 : Number(params.target.retry_count) || 0,
      next_retry_at: nextRetryAt,
      locked_at: null,
      lock_token: null,
      last_attempt_at: getNowIso(),
    })
    .eq('id', params.target.id);

  return { status: canRetry ? 'retry_scheduled' : (params.status ?? 'failed'), retrying: canRetry, nextRetryAt };
}

async function releaseClaimedTarget(
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  target: TargetRow,
  status: 'scheduled' | 'cancelled',
) {
  await supabaseAdmin
    .from('comm_whatsapp_campaign_targets')
    .update({ status, locked_at: null, lock_token: null })
    .eq('id', target.id)
    .eq('status', 'sending');
}

async function sendTarget(params: {
  supabaseAdmin: ReturnType<typeof createAdminClient>;
  campaign: CampaignRow;
  target: TargetRow;
  token: string;
  channelId: string;
  senderPhone: string | null;
  senderName: string | null;
}) {
  const { supabaseAdmin, campaign, target } = params;
  const phoneDigits = normalizeCommWhatsAppPhone(target.phone_digits || target.phone_number);
  const chatId = buildWhapiDirectChatId(phoneDigits);
  const nowIso = getNowIso();

  if (!phoneDigits || !chatId) {
    await supabaseAdmin
      .from('comm_whatsapp_campaign_targets')
      .update({ status: 'invalid', error_message: 'Telefone invalido.', last_attempt_at: nowIso, locked_at: null, lock_token: null })
      .eq('id', target.id);
    return { status: 'invalid' };
  }

  const { data: optOut } = await supabaseAdmin
    .from('comm_whatsapp_opt_outs')
    .select('id')
    .eq('phone_digits', phoneDigits)
    .eq('status', 'blocked')
    .maybeSingle();

  if (optOut) {
    await supabaseAdmin
      .from('comm_whatsapp_campaign_targets')
      .update({ status: 'stopped', stopped_at: nowIso, stopped_reason: 'opt_out', last_attempt_at: nowIso, locked_at: null, lock_token: null })
      .eq('id', target.id);
    return { status: 'stopped', reason: 'opt_out' };
  }

  const lead = await getLeadById(supabaseAdmin, target.lead_id);
  const steps = await getCampaignSteps(supabaseAdmin, campaign);
  const currentStepIndex = Math.max(Number(target.current_step_index) || 0, 0);
  const step = steps.find((item) => item.step_index === currentStepIndex) ?? steps[currentStepIndex] ?? steps[0];
  const stepPosition = Math.max(steps.findIndex((item) => item.step_index === step.step_index), 0);
  const nextStep = steps[stepPosition + 1] ?? null;
  const text = resolveMessageText(step.message_text, { lead, target }).trim();
  if (!text) {
    await supabaseAdmin
      .from('comm_whatsapp_campaign_targets')
      .update({ status: 'failed', error_message: 'Mensagem vazia apos aplicar variaveis.', last_attempt_at: nowIso, locked_at: null, lock_token: null })
      .eq('id', target.id);
    return { status: 'failed' };
  }

  const response = await fetch(`${WHAPI_BASE_URL}/messages/text`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${params.token}`,
    },
    body: JSON.stringify({ to: chatId, body: text }),
  });

  const payload = await readResponsePayload(response);
  if (!response.ok) {
    const errorMessage = parseWhapiError(payload) || 'Falha ao enviar mensagem na Whapi.';
    const failureResult = await releaseTargetAfterFailure(supabaseAdmin, { target, errorMessage, retryable: response.status >= 429 || response.status >= 500 });
    await insertEvent(supabaseAdmin, { campaignId: campaign.id, targetId: target.id, eventType: failureResult.retrying ? 'target_retry_scheduled' : 'target_failed', payload: { error: errorMessage, nextRetryAt: failureResult.nextRetryAt } });
    return { status: failureResult.status, error: errorMessage };
  }

  const externalMessageId = extractWhapiMessageId(payload);
  const deliveryStatus = resolveWhapiOutboundDeliveryStatus(payload, externalMessageId);
  const displayName = lead?.nome_completo || target.display_name || formatPhoneLabel(phoneDigits);
  const persistResult = await persistCommWhatsAppMessage(supabaseAdmin, {
    channelId: params.channelId,
    externalChatId: chatId,
    phoneNumber: phoneDigits,
    displayName,
    pushName: null,
    lastMessageText: text,
    lastMessageDirection: 'outbound',
    lastMessageAt: nowIso,
    incrementUnread: false,
    externalMessageId: externalMessageId || null,
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

  const nextSendAt = nextStep ? new Date(Date.now() + getDelayMs(nextStep)).toISOString() : null;

  await supabaseAdmin
    .from('comm_whatsapp_campaign_targets')
    .update({
      status: nextStep ? 'scheduled' : 'sent',
      sent_at: nowIso,
      chat_id: persistResult.chatId || target.chat_id,
      current_step_index: nextStep ? nextStep.step_index : step.step_index,
      next_send_at: nextSendAt,
      next_retry_at: null,
      external_message_id: externalMessageId || null,
      error_message: null,
      last_attempt_at: nowIso,
      locked_at: null,
      lock_token: null,
    })
    .eq('id', target.id);

  await insertEvent(supabaseAdmin, {
    campaignId: campaign.id,
    targetId: target.id,
    eventType: nextStep ? 'target_step_sent' : 'target_sent',
    payload: { externalMessageId, deliveryStatus, stepIndex: step.step_index, nextStepIndex: nextStep?.step_index ?? null, nextSendAt },
  });
  return { status: nextStep ? 'scheduled' : 'sent', externalMessageId, deliveryStatus };
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

  await reconcileResponses(supabaseAdmin, params.campaignId);

  let query = supabaseAdmin
    .from('comm_whatsapp_campaigns')
    .select('id,name,status,audience_source,audience_config,message_text,scheduled_at,pacing_per_minute,send_window_start,send_window_end,stop_on_reply,created_by')
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
    const campaignLimit = Math.min(Math.max(campaign.pacing_per_minute || 1, 1), maxLimit - processed);
    if (campaignLimit <= 0) break;

    const targets = await listTargetsForProcessing(supabaseAdmin, campaign, campaignLimit);
    for (const target of targets) {
      const currentCampaign = await getCampaign(supabaseAdmin, campaign.id);
      if (currentCampaign.status === 'paused' || currentCampaign.status === 'cancelled') {
        await releaseClaimedTarget(supabaseAdmin, target, currentCampaign.status === 'cancelled' ? 'cancelled' : 'scheduled');
        continue;
      }

      let result: { status?: string };
      try {
        result = await sendTarget({
          supabaseAdmin,
          campaign,
          target,
          token,
          channelId: channel.id,
          senderPhone: channel.phone_number,
          senderName: channel.connected_user_name,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Erro inesperado ao enviar mensagem.';
        result = await releaseTargetAfterFailure(supabaseAdmin, { target, errorMessage: message, retryable: true });
        await insertEvent(supabaseAdmin, { campaignId: campaign.id, targetId: target.id, eventType: result.status === 'retry_scheduled' ? 'target_retry_scheduled' : 'target_failed', payload: { error: message } });
      }
      processed += 1;
      if (result.status === 'sent' || result.status === 'scheduled') sent += 1;
      if (result.status === 'failed' || result.status === 'invalid') failed += 1;
      if (result.status === 'stopped') stopped += 1;
    }

    const counters = await recomputeCampaignCounters(supabaseAdmin, campaign.id);
    if (counters.pending === 0 && counters.total > 0) {
      await supabaseAdmin.from('comm_whatsapp_campaigns').update({ status: 'completed', completed_at: getNowIso() }).eq('id', campaign.id);
      await insertEvent(supabaseAdmin, { campaignId: campaign.id, eventType: 'campaign_completed', payload: counters });
    }
  }

  return { processed, sent, failed, stopped };
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
