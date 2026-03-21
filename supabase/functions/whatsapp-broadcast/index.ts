import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { authorizeDashboardUser, isServiceRoleRequest } from '../_shared/dashboard-auth.ts';
import {
  clampCompletedCampaignStepIndex,
  getCampaignIdsReadyToAutoStart,
  isCampaignTargetReadyForProcessing,
  normalizePhoneForCampaign,
  resolveCampaignTemplateText,
  WHATSAPP_CAMPAIGN_PROCESSING_LEASE_MS,
} from '../../../src/lib/whatsappCampaignUtils.ts';
import {
  getWhatsAppCampaignStepDelayMs,
  matchesWhatsAppCampaignConditionGroup,
  normalizeWhatsAppCampaignFlowSteps,
} from '../../../src/lib/whatsappCampaignFlow.ts';
import type { WhatsAppCampaignFlowStep as CampaignFlowStep } from '../../../src/types/whatsappCampaigns.ts';

declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
  env: {
    get: (name: string) => string | undefined;
  };
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey, X-API-Key',
};

const WHAPI_BASE_URL = 'https://gate.whapi.cloud';
const BRASILIA_TIMEZONE = 'America/Sao_Paulo';

type CampaignStatus = 'draft' | 'running' | 'paused' | 'completed' | 'cancelled';
type TargetStatus = 'pending' | 'processing' | 'sent' | 'failed' | 'invalid' | 'cancelled';

type CampaignRecord = {
  id: string;
  status: CampaignStatus;
  message: string;
  flow_steps: unknown;
  scheduled_at: string | null;
  started_at?: string | null;
};

type CampaignStepType = CampaignFlowStep['type'];

type TargetRecord = {
  id: string;
  campaign_id: string;
  lead_id: string | null;
  phone: string;
  raw_phone: string | null;
  display_name: string | null;
  chat_id: string | null;
  source_payload: Record<string, unknown> | null;
  status: TargetStatus;
  attempts: number | null;
  error_message?: string | null;
  last_attempt_at?: string | null;
  processing_started_at?: string | null;
  processing_expires_at?: string | null;
  last_completed_step_index?: number | null;
  last_completed_step_id?: string | null;
  last_sent_step_at?: string | null;
  next_step_due_at?: string | null;
  created_at?: string | null;
  lead?: {
    nome_completo?: string | null;
    telefone?: string | null;
    email?: string | null;
    status?: string | null;
    origem?: string | null;
    cidade?: string | null;
    responsavel?: string | null;
    canal?: string | null;
  } | null;
  campaign: CampaignRecord | null;
};

type ProcessSummary = {
  processed: number;
  sent: number;
  failed: number;
  invalid: number;
  skipped: number;
  campaignsTouched: number;
};

const jsonResponse = (body: Record<string, unknown>, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const getProcessingLeaseExpiryIso = (baseDate: Date = new Date()): string =>
  new Date(baseDate.getTime() + WHATSAPP_CAMPAIGN_PROCESSING_LEASE_MS).toISOString();

const toErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
};

const sanitizeWhapiToken = (rawToken: string): string => rawToken.replace(/^Bearer\s+/i, '').trim();

const normalizeChatId = (value: string): string => {
  if (!value) return '';
  const trimmed = value.trim();
  if (!trimmed) return '';

  if (/@c\.us$/i.test(trimmed)) {
    return trimmed.replace(/@c\.us$/i, '@s.whatsapp.net');
  }

  return trimmed;
};

const parseWhapiError = (payload: unknown): string => {
  if (typeof payload === 'string') {
    return payload;
  }

  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;

    if (typeof record.error === 'string') {
      return record.error;
    }

    if (record.error && typeof record.error === 'object') {
      const nested = record.error as Record<string, unknown>;
      if (typeof nested.message === 'string') {
        return nested.message;
      }
    }

    if (typeof record.message === 'string') {
      return record.message;
    }

    if (typeof record.details === 'string') {
      return record.details;
    }
  }

  try {
    return JSON.stringify(payload);
  } catch {
    return 'Erro ao processar resposta da Whapi.';
  }
};

const isInvalidRecipientError = (message: string): boolean => {
  const normalized = message.toLowerCase();
  return (
    normalized.includes('nao possui whatsapp') ||
    normalized.includes('não possui whatsapp') ||
    normalized.includes('recipient not found') ||
    normalized.includes('recipient does not exist') ||
    normalized.includes('invalid') ||
    normalized.includes('invalido') ||
    normalized.includes('inválido') ||
    normalized.includes('does not exist') ||
    normalized.includes('not on whatsapp') ||
    normalized.includes('chat not found') ||
    normalized.includes('invalid chatid')
  );
};

const loadWhapiToken = async (supabaseAdmin: ReturnType<typeof createClient>): Promise<string> => {
  const { data, error } = await supabaseAdmin
    .from('integration_settings')
    .select('settings')
    .eq('slug', 'whatsapp_auto_contact')
    .maybeSingle();

  if (error) {
    throw new Error(`Erro ao carregar configuracao do WhatsApp: ${error.message}`);
  }

  const settings = data?.settings && typeof data.settings === 'object' ? (data.settings as Record<string, unknown>) : {};
  const tokenValue =
    typeof settings.apiKey === 'string'
      ? settings.apiKey
      : typeof settings.token === 'string'
        ? settings.token
        : '';
  const token = sanitizeWhapiToken(tokenValue);

  if (!token) {
    throw new Error('Token da Whapi Cloud nao configurado.');
  }

  return token;
};

const resolveWhapiRecipient = async ({
  token,
  chatId,
  phone,
}: {
  token: string;
  chatId: string | null;
  phone: string;
}): Promise<string> => {
  const normalizedChatId = chatId ? normalizeChatId(chatId) : '';
  if (normalizedChatId && normalizedChatId.includes('@')) {
    return normalizedChatId;
  }

  const normalizedPhone = normalizePhoneForCampaign(phone);
  if (!normalizedPhone) {
    throw new Error('Numero de telefone ausente ou invalido.');
  }

  const response = await fetch(`${WHAPI_BASE_URL}/contacts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
    body: JSON.stringify({
      contacts: [normalizedPhone],
      force_check: false,
    }),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(parseWhapiError(payload));
  }

  const payload = (await response.json().catch(() => ({}))) as {
    contacts?: Array<{ status?: string; wa_id?: string }>;
  };

  const contact = payload.contacts?.[0];
  if (!contact || contact.status !== 'valid' || !contact.wa_id) {
    throw new Error('Numero nao possui WhatsApp ou esta invalido.');
  }

  return normalizeChatId(contact.wa_id);
};

const sendWhapiRequest = async ({ token, endpoint, body }: { token: string; endpoint: string; body: Record<string, unknown> }): Promise<void> => {
  const response = await fetch(`${WHAPI_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(parseWhapiError(payload));
  }
};

const sendCampaignStep = async ({
  token,
  to,
  step,
  lead,
  sourcePayload,
}: {
  token: string;
  to: string;
  step: CampaignFlowStep;
  lead?: TargetRecord['lead'] | null;
  sourcePayload?: Record<string, unknown> | null;
}): Promise<void> => {
  if (step.type === 'text') {
    const body = resolveCampaignTemplateText(step.text || '', {
      lead: lead ?? undefined,
      payload: sourcePayload ?? undefined,
      timeZone: BRASILIA_TIMEZONE,
    }).trim();
    if (!body) {
      throw new Error('Etapa de texto sem conteudo.');
    }

    await sendWhapiRequest({
      token,
      endpoint: '/messages/text',
      body: {
        to,
        body,
      },
    });
    return;
  }

  const mediaUrl = (step.mediaUrl || '').trim();
  if (!mediaUrl) {
    throw new Error(`Etapa ${step.type} sem URL de midia.`);
  }

  const endpointMap: Record<Exclude<CampaignStepType, 'text'>, string> = {
    image: '/messages/image',
    video: '/messages/video',
    audio: '/messages/audio',
    document: '/messages/document',
  };

  const payload: Record<string, unknown> = {
    to,
    media: mediaUrl,
  };

  const caption = resolveCampaignTemplateText(step.caption || '', {
    lead: lead ?? undefined,
    payload: sourcePayload ?? undefined,
    timeZone: BRASILIA_TIMEZONE,
  }).trim();
  if (caption && (step.type === 'image' || step.type === 'video' || step.type === 'document')) {
    payload.caption = caption;
  }

  if (step.type === 'document') {
    const filename = (step.filename || '').trim();
    if (filename) {
      payload.filename = filename;
    }
  }

  await sendWhapiRequest({
    token,
    endpoint: endpointMap[step.type],
    body: payload,
  });
};

const getTimestampMs = (value: string | null | undefined): number => {
  if (!value) {
    return Number.NaN;
  }

  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? Number.NaN : parsed;
};

const getCampaignStepReferenceIso = (target: TargetRecord): string | null =>
  target.last_sent_step_at ?? target.campaign?.started_at ?? target.created_at ?? null;

const computeCampaignStepDueAt = (step: CampaignFlowStep, referenceIso: string | null, now: Date): string | null => {
  const delayMs = getWhatsAppCampaignStepDelayMs(step);
  if (delayMs <= 0) {
    return null;
  }

  const referenceMs = getTimestampMs(referenceIso);
  const baseMs = Number.isNaN(referenceMs) ? now.getTime() : referenceMs;
  return new Date(baseMs + delayMs).toISOString();
};

const normalizeTargetChatId = (target: TargetRecord, recipient?: string | null): string => {
  const resolvedRecipient = typeof recipient === 'string' && recipient.trim() ? normalizeChatId(recipient) : '';
  if (resolvedRecipient) {
    return resolvedRecipient;
  }

  const normalizedChatId = target.chat_id ? normalizeChatId(target.chat_id) : '';
  if (normalizedChatId) {
    return normalizedChatId;
  }

  const normalizedPhone = normalizePhoneForCampaign(target.phone);
  return normalizedPhone ? `${normalizedPhone}@s.whatsapp.net` : '';
};

const loadConversationState = async (
  supabaseAdmin: ReturnType<typeof createClient>,
  target: TargetRecord,
  lastSentStepAt: string | null,
  recipient?: string | null,
) => {
  const chatId = normalizeTargetChatId(target, recipient);
  if (!chatId) {
    return {
      hasInbound: false,
      hasInboundSinceLastStep: false,
      lastInboundAt: null,
    };
  }

  const { data, error } = await supabaseAdmin
    .from('whatsapp_messages')
    .select('timestamp, created_at')
    .eq('chat_id', chatId)
    .eq('direction', 'inbound')
    .order('timestamp', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Erro ao carregar respostas do contato: ${error.message}`);
  }

  const lastInboundAt = data?.timestamp ?? data?.created_at ?? null;
  const lastInboundMs = getTimestampMs(lastInboundAt);
  const referenceMs = getTimestampMs(lastSentStepAt ?? target.created_at ?? null);

  return {
    hasInbound: !Number.isNaN(lastInboundMs),
    hasInboundSinceLastStep:
      !Number.isNaN(lastInboundMs) && (Number.isNaN(referenceMs) || lastInboundMs > referenceMs),
    lastInboundAt,
  };
};

const claimTarget = async (
  supabaseAdmin: ReturnType<typeof createClient>,
  target: TargetRecord,
): Promise<boolean> => {
  const now = new Date();
  const nowIso = now.toISOString();
  const processingExpiresAt = getProcessingLeaseExpiryIso(now);
  const currentAttempts = Number.isFinite(target.attempts) ? Number(target.attempts) : 0;

  const baseClaimPayload = {
    status: 'processing',
    attempts: currentAttempts + 1,
    last_attempt_at: nowIso,
    processing_started_at: nowIso,
    processing_expires_at: processingExpiresAt,
    next_step_due_at: null,
  };

  const claimPending = async () => {
    const { data, error } = await supabaseAdmin
      .from('whatsapp_campaign_targets')
      .update(baseClaimPayload)
      .eq('id', target.id)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle();

    if (error) {
      throw new Error(`Erro ao bloquear alvo para processamento: ${error.message}`);
    }

    return Boolean(data?.id);
  };

  if (target.status === 'pending') {
    return claimPending();
  }

  if (target.status !== 'processing' || !isCampaignTargetReadyForProcessing(target, now)) {
    return false;
  }

  const { data, error } = await supabaseAdmin
    .from('whatsapp_campaign_targets')
    .update(baseClaimPayload)
    .eq('id', target.id)
    .eq('status', 'processing')
    .lte('processing_expires_at', nowIso)
    .select('id')
    .maybeSingle();

  if (error) {
    throw new Error(`Erro ao recuperar alvo travado para processamento: ${error.message}`);
  }

  if (data?.id) {
    return true;
  }

  const staleProcessingFallbackIso = new Date(now.getTime() - WHATSAPP_CAMPAIGN_PROCESSING_LEASE_MS).toISOString();
  const { data: fallbackData, error: fallbackError } = await supabaseAdmin
    .from('whatsapp_campaign_targets')
    .update(baseClaimPayload)
    .eq('id', target.id)
    .eq('status', 'processing')
    .is('processing_expires_at', null)
    .or(`last_attempt_at.is.null,last_attempt_at.lt.${staleProcessingFallbackIso}`)
    .select('id')
    .maybeSingle();

  if (fallbackError) {
    throw new Error(`Erro ao recuperar alvo travado sem lease: ${fallbackError.message}`);
  }

  return Boolean(fallbackData?.id);
};

const persistTargetStepProgress = async (
  supabaseAdmin: ReturnType<typeof createClient>,
  targetId: string,
  stepIndex: number,
  stepId: string,
  recipient: string,
): Promise<string> => {
  const now = new Date();
  const nowIso = now.toISOString();

  const { error } = await supabaseAdmin
    .from('whatsapp_campaign_targets')
    .update({
      last_completed_step_index: stepIndex,
      last_completed_step_id: stepId,
      last_sent_step_at: nowIso,
      last_attempt_at: nowIso,
      processing_started_at: nowIso,
      processing_expires_at: getProcessingLeaseExpiryIso(now),
      error_message: null,
      next_step_due_at: null,
      chat_id: recipient,
    })
    .eq('id', targetId)
    .eq('status', 'processing');

  if (error) {
    throw new Error(`Erro ao salvar progresso do alvo: ${error.message}`);
  }

  return nowIso;
};

const scheduleTargetNextStep = async (
  supabaseAdmin: ReturnType<typeof createClient>,
  targetId: string,
  dueAt: string,
  recipient: string,
) => {
  const nowIso = new Date().toISOString();

  const { error } = await supabaseAdmin
    .from('whatsapp_campaign_targets')
    .update({
      status: 'pending',
      last_attempt_at: nowIso,
      processing_started_at: null,
      processing_expires_at: null,
      error_message: null,
      next_step_due_at: dueAt,
      chat_id: recipient,
    })
    .eq('id', targetId)
    .eq('status', 'processing');

  if (error) {
    throw new Error(`Erro ao agendar proxima etapa do alvo: ${error.message}`);
  }
};

const updateTargetResult = async (
  supabaseAdmin: ReturnType<typeof createClient>,
  targetId: string,
  status: TargetStatus,
  errorMessage: string | null,
  markAsSent = false,
  extraUpdates: Record<string, unknown> = {},
) => {
  const nowIso = new Date().toISOString();

  const { error } = await supabaseAdmin
    .from('whatsapp_campaign_targets')
    .update({
      status,
      error_message: errorMessage,
      last_attempt_at: nowIso,
      sent_at: markAsSent ? nowIso : null,
      processing_started_at: null,
      processing_expires_at: null,
      next_step_due_at: null,
      ...extraUpdates,
    })
    .eq('id', targetId);

  if (error) {
    throw new Error(`Erro ao atualizar status do alvo: ${error.message}`);
  }
};

const recomputeCampaignCounters = async (supabaseAdmin: ReturnType<typeof createClient>, campaignId: string): Promise<void> => {
  const { error } = await supabaseAdmin.rpc('recompute_whatsapp_campaign_counters', {
    p_campaign_id: campaignId,
  });

  if (error) {
    throw new Error(`Erro ao recalcular contadores da campanha: ${error.message}`);
  }
};

const startScheduledCampaigns = async (
  supabaseAdmin: ReturnType<typeof createClient>,
  campaignId: string | null,
): Promise<string[]> => {
  let query = supabaseAdmin
    .from('whatsapp_campaigns')
    .select('id, status, scheduled_at')
    .eq('status', 'draft')
    .not('scheduled_at', 'is', null);

  if (campaignId) {
    query = query.eq('id', campaignId);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Erro ao carregar campanhas agendadas: ${error.message}`);
  }

  const readyIds = getCampaignIdsReadyToAutoStart(
    ((data ?? []) as Array<{ id: string; status: CampaignStatus; scheduled_at: string | null }>),
    new Date(),
  );

  if (readyIds.length === 0) {
    return [];
  }

  const nowIso = new Date().toISOString();
  const { error: updateError } = await supabaseAdmin
    .from('whatsapp_campaigns')
    .update({
      status: 'running',
      started_at: nowIso,
      completed_at: null,
      last_error: null,
    })
    .in('id', readyIds);

  if (updateError) {
    throw new Error(`Erro ao iniciar campanhas agendadas: ${updateError.message}`);
  }

  return readyIds;
};

const loadProcessableTargets = async (
  supabaseAdmin: ReturnType<typeof createClient>,
  campaignId: string | null,
  limit: number,
): Promise<TargetRecord[]> => {
  const pageSize = Math.min(Math.max(limit * 5, limit), 200);
  const maxPages = 20;
  const collected: TargetRecord[] = [];
  let offset = 0;

  for (let page = 0; page < maxPages && collected.length < limit; page += 1) {
    let query = supabaseAdmin
      .from('whatsapp_campaign_targets')
      .select('id, campaign_id, lead_id, phone, raw_phone, display_name, chat_id, source_payload, status, attempts, error_message, last_attempt_at, processing_started_at, processing_expires_at, last_completed_step_index, last_completed_step_id, last_sent_step_at, next_step_due_at, created_at, lead:leads(nome_completo, telefone, email, status, origem, cidade, responsavel, canal), campaign:whatsapp_campaigns!inner(id, status, message, flow_steps, scheduled_at, started_at)')
      .in('status', ['pending', 'processing'])
      .order('next_step_due_at', { ascending: true, nullsFirst: true })
      .order('created_at', { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (campaignId) {
      query = query.eq('campaign_id', campaignId);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Erro ao carregar alvos pendentes da campanha: ${error.message}`);
    }

    const rows = (data ?? []) as TargetRecord[];
    if (rows.length === 0) {
      break;
    }

    rows
      .filter((row) => row.campaign?.status === 'running')
      .filter((row) => isCampaignTargetReadyForProcessing(row))
      .forEach((row) => {
        if (collected.length < limit) {
          collected.push(row);
        }
      });

    if (rows.length < pageSize) {
      break;
    }

    offset += pageSize;
  }

  return collected;
};

const processCampaignTargets = async ({
  supabaseAdmin,
  token,
  campaignId,
  limit,
}: {
  supabaseAdmin: ReturnType<typeof createClient>;
  token: string;
  campaignId: string | null;
  limit: number;
}): Promise<ProcessSummary> => {
  const summary: ProcessSummary = {
    processed: 0,
    sent: 0,
    failed: 0,
    invalid: 0,
    skipped: 0,
    campaignsTouched: 0,
  };

  const startedCampaignIds = await startScheduledCampaigns(supabaseAdmin, campaignId);

  const targets = await loadProcessableTargets(supabaseAdmin, campaignId, limit);
  if (targets.length === 0) {
    for (const startedCampaignId of startedCampaignIds) {
      await recomputeCampaignCounters(supabaseAdmin, startedCampaignId);
    }
    return summary;
  }

  const touchedCampaignIds = new Set<string>();
  startedCampaignIds.forEach((startedCampaignId) => touchedCampaignIds.add(startedCampaignId));

  for (const target of targets) {
    touchedCampaignIds.add(target.campaign_id);

    const claimed = await claimTarget(supabaseAdmin, target);
    if (!claimed) {
      summary.skipped += 1;
      continue;
    }

    const campaignSteps = normalizeWhatsAppCampaignFlowSteps(target.campaign?.flow_steps, target.campaign?.message ?? '');
    if (campaignSteps.length === 0) {
      await updateTargetResult(supabaseAdmin, target.id, 'failed', 'Fluxo da campanha vazio.', false);
      summary.failed += 1;
      summary.processed += 1;
      continue;
    }

    const lastCompletedStepIndex = clampCompletedCampaignStepIndex(target.last_completed_step_index, campaignSteps.length);

    try {
      const recipient = await resolveWhapiRecipient({
        token,
        chatId: target.chat_id,
        phone: target.phone,
      });

      let currentLastCompletedStepIndex = lastCompletedStepIndex;
      let currentLastSentStepAt = target.last_sent_step_at ?? null;
      let skippedSteps = 0;
      let lastSkippedReason: string | null = null;
      let scheduledFutureStep = false;
      const normalizedRecipient = normalizeTargetChatId(target, recipient);

      for (let stepIndex = lastCompletedStepIndex + 1; stepIndex < campaignSteps.length; stepIndex += 1) {
        const step = campaignSteps[stepIndex];

        const dueAt = computeCampaignStepDueAt(
          step,
          currentLastSentStepAt ?? getCampaignStepReferenceIso(target),
          new Date(),
        );

        if (dueAt) {
          const dueAtMs = getTimestampMs(dueAt);
          if (!Number.isNaN(dueAtMs) && dueAtMs > Date.now()) {
            await scheduleTargetNextStep(supabaseAdmin, target.id, dueAt, normalizedRecipient);
            scheduledFutureStep = true;
            summary.processed += 1;
            break;
          }
        }

        const conversationState = await loadConversationState(
          supabaseAdmin,
          target,
          currentLastSentStepAt,
          normalizedRecipient,
        );

        const matchesConditions = matchesWhatsAppCampaignConditionGroup(step.conditions, step.conditionLogic, {
          lead: target.lead ?? null,
          payload: target.source_payload ?? null,
          conversation: conversationState,
          campaign: {
            lastSentStepAt: currentLastSentStepAt,
          },
          target: {
            createdAt: target.created_at ?? null,
            attempts: target.attempts ?? null,
            lastCompletedStepIndex: currentLastCompletedStepIndex,
          },
          now: new Date(),
        });

        if (!matchesConditions) {
          skippedSteps += 1;
          lastSkippedReason = `Etapa ${stepIndex + 1} ignorada porque as condicoes nao foram atendidas.`;
          continue;
        }

        await sendCampaignStep({
          token,
          to: normalizedRecipient,
          step,
          lead: target.lead ?? null,
          sourcePayload: target.source_payload ?? null,
        });

        currentLastSentStepAt = await persistTargetStepProgress(
          supabaseAdmin,
          target.id,
          stepIndex,
          step.id,
          normalizedRecipient,
        );
        currentLastCompletedStepIndex = stepIndex;
      }

      if (scheduledFutureStep) {
        continue;
      }

      const shouldMarkAsSent = currentLastCompletedStepIndex >= 0;
      const terminalMessage = skippedSteps > 0 ? lastSkippedReason ?? 'Algumas etapas foram ignoradas por condicao.' : null;

      await updateTargetResult(
        supabaseAdmin,
        target.id,
        shouldMarkAsSent ? 'sent' : 'cancelled',
        terminalMessage,
        shouldMarkAsSent,
        { chat_id: normalizedRecipient },
      );

      if (shouldMarkAsSent) {
        summary.sent += 1;
      }
      summary.processed += 1;
    } catch (error) {
      const message = toErrorMessage(error);
      const isInvalid = isInvalidRecipientError(message);

      await updateTargetResult(
        supabaseAdmin,
        target.id,
        isInvalid ? 'invalid' : 'failed',
        message,
        false,
        {},
      );

      if (isInvalid) {
        summary.invalid += 1;
      } else {
        summary.failed += 1;
      }
      summary.processed += 1;
    }
  }

  for (const touchedCampaignId of touchedCampaignIds) {
    await recomputeCampaignCounters(supabaseAdmin, touchedCampaignId);
  }

  summary.campaignsTouched = touchedCampaignIds.size;
  return summary;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ success: false, error: 'Metodo nao permitido' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return jsonResponse({ success: false, error: 'Variaveis de ambiente ausentes no servidor' }, 500);
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

  const serviceRoleCall = isServiceRoleRequest(req, supabaseServiceRoleKey);
  if (!serviceRoleCall) {
    const authResult = await authorizeDashboardUser({
      req,
      supabaseUrl,
      supabaseAnonKey,
      supabaseAdmin,
      module: 'whatsapp',
      requiredPermission: 'edit',
    });

    if (!authResult.authorized) {
      return jsonResponse({ success: false, error: authResult.body.error }, authResult.status);
    }
  }

  try {
    const bodyText = await req.text();
    const payload = (bodyText ? JSON.parse(bodyText) : {}) as Record<string, unknown>;

    const action =
      (typeof payload.action === 'string' ? payload.action : null) ||
      new URL(req.url).searchParams.get('action') ||
      'process';

    if (action !== 'process') {
      return jsonResponse({ success: false, error: 'Acao nao suportada' }, 400);
    }

    const rawLimit = typeof payload.limit === 'number' ? payload.limit : Number(payload.limit);
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(Math.trunc(rawLimit), 1), 200) : 40;
    const campaignId = typeof payload.campaignId === 'string' && payload.campaignId.trim() ? payload.campaignId.trim() : null;

    const token = await loadWhapiToken(supabaseAdmin);
    const summary = await processCampaignTargets({
      supabaseAdmin,
      token,
      campaignId,
      limit,
    });

    return jsonResponse({
      success: true,
      processed: summary.processed,
      sent: summary.sent,
      failed: summary.failed,
      invalid: summary.invalid,
      skipped: summary.skipped,
      campaignsTouched: summary.campaignsTouched,
    });
  } catch (error) {
    const message = toErrorMessage(error);
    console.error('[whatsapp-broadcast] erro:', error);
    return jsonResponse({ success: false, error: message }, 500);
  }
});
