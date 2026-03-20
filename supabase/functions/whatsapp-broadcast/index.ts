import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import {
  clampCompletedCampaignStepIndex,
  getCampaignIdsReadyToAutoStart,
  isCampaignTargetReadyForProcessing,
  normalizePhoneForCampaign,
  resolveCampaignTemplateText,
  WHATSAPP_CAMPAIGN_PROCESSING_LEASE_MS,
} from '../../../src/lib/whatsappCampaignUtils.ts';

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
};

type CampaignStepType = 'text' | 'image' | 'video' | 'audio' | 'document';

type CampaignFlowStep = {
  id: string;
  type: CampaignStepType;
  order: number;
  text?: string;
  mediaUrl?: string;
  caption?: string;
  filename?: string;
};

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
  lead?: {
    nome_completo?: string | null;
    telefone?: string | null;
    email?: string | null;
    status?: string | null;
    origem?: string | null;
    cidade?: string | null;
    responsavel?: string | null;
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

const getBearerToken = (authHeader: string | null): string | null => {
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
};

const getUserManagementId = (user: Record<string, unknown> | null | undefined): string | null => {
  if (!user) return null;

  const userMetadata =
    user.user_metadata && typeof user.user_metadata === 'object'
      ? (user.user_metadata as Record<string, unknown>)
      : null;
  const appMetadata =
    user.app_metadata && typeof user.app_metadata === 'object'
      ? (user.app_metadata as Record<string, unknown>)
      : null;

  const candidates: unknown[] = [
    userMetadata?.user_management_id,
    userMetadata?.user_management_user_id,
    userMetadata?.user_id,
    appMetadata?.user_management_id,
    appMetadata?.user_id,
    user.id,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }

  return null;
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

const normalizeCampaignStepType = (value: unknown): CampaignStepType => {
  if (value === 'image' || value === 'video' || value === 'audio' || value === 'document') {
    return value;
  }
  return 'text';
};

const normalizeCampaignFlowSteps = (flowSteps: unknown, fallbackMessage: string): CampaignFlowStep[] => {
  if (!Array.isArray(flowSteps)) {
    const fallback = fallbackMessage.trim();
    if (!fallback) {
      return [];
    }

    return [
      {
        id: 'step-1',
        type: 'text',
        order: 0,
        text: fallback,
      },
    ];
  }

  const parsed: CampaignFlowStep[] = [];

  flowSteps.forEach((item, index) => {
    if (!item || typeof item !== 'object') {
      return;
    }

    const row = item as Record<string, unknown>;
    const type = normalizeCampaignStepType(row.type);

    parsed.push({
      id: typeof row.id === 'string' && row.id.trim() ? row.id : `step-${index + 1}`,
      type,
      order: typeof row.order === 'number' ? row.order : index,
      text: typeof row.text === 'string' ? row.text : undefined,
      mediaUrl: typeof row.mediaUrl === 'string' ? row.mediaUrl : undefined,
      caption: typeof row.caption === 'string' ? row.caption : undefined,
      filename: typeof row.filename === 'string' ? row.filename : undefined,
    });
  });

  parsed.sort((left, right) => left.order - right.order);

  if (parsed.length === 0) {
    const fallback = fallbackMessage.trim();
    if (!fallback) {
      return [];
    }
    return [
      {
        id: 'step-1',
        type: 'text',
        order: 0,
        text: fallback,
      },
    ];
  }

  return parsed;
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

const isServiceRoleRequest = (req: Request, serviceRoleKey: string): boolean => {
  const expected = serviceRoleKey.trim();
  if (!expected) {
    return false;
  }

  const bearerToken = getBearerToken(req.headers.get('Authorization'));
  if (bearerToken && bearerToken.trim() === expected) {
    return true;
  }

  const apikey = req.headers.get('apikey')?.trim() || req.headers.get('x-api-key')?.trim() || '';
  return apikey === expected;
};

const authorizeAdminUser = async ({
  req,
  supabaseUrl,
  supabaseAnonKey,
  supabaseAdmin,
}: {
  req: Request;
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseAdmin: ReturnType<typeof createClient>;
}): Promise<{ authorized: true } | { authorized: false; response: Response }> => {
  const bearerToken = getBearerToken(req.headers.get('Authorization'));

  if (!bearerToken) {
    return {
      authorized: false,
      response: jsonResponse({ success: false, error: 'Nao autenticado' }, 401),
    };
  }

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${bearerToken}`,
      },
    },
  });

  const {
    data: { user },
    error: userError,
  } = await authClient.auth.getUser();

  if (userError || !user) {
    return {
      authorized: false,
      response: jsonResponse({ success: false, error: 'Token de autenticacao invalido' }, 401),
    };
  }

  const profileId = getUserManagementId(user as unknown as Record<string, unknown>);
  if (!profileId) {
    return {
      authorized: false,
      response: jsonResponse({ success: false, error: 'Perfil do usuario nao encontrado' }, 403),
    };
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('user_profiles')
    .select('role')
    .eq('id', profileId)
    .maybeSingle();

  if (profileError) {
    return {
      authorized: false,
      response: jsonResponse({ success: false, error: 'Erro ao validar permissao de usuario' }, 500),
    };
  }

  if (!profile || profile.role !== 'admin') {
    return {
      authorized: false,
      response: jsonResponse({ success: false, error: 'Permissao insuficiente' }, 403),
    };
  }

  return { authorized: true };
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
    .lt('processing_expires_at', nowIso)
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
) => {
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
    })
    .eq('id', targetId)
    .eq('status', 'processing');

  if (error) {
    throw new Error(`Erro ao salvar progresso do alvo: ${error.message}`);
  }
};

const updateTargetResult = async (
  supabaseAdmin: ReturnType<typeof createClient>,
  targetId: string,
  status: TargetStatus,
  errorMessage: string | null,
  markAsSent = false,
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
    })
    .eq('id', targetId);

  if (error) {
    throw new Error(`Erro ao atualizar status do alvo: ${error.message}`);
  }
};

const recomputeCampaignCounters = async (supabaseAdmin: ReturnType<typeof createClient>, campaignId: string): Promise<void> => {
  const { data: targetRows, error: targetError } = await supabaseAdmin
    .from('whatsapp_campaign_targets')
    .select('status')
    .eq('campaign_id', campaignId);

  if (targetError) {
    throw new Error(`Erro ao recalcular contadores da campanha: ${targetError.message}`);
  }

  const rows = (targetRows ?? []) as Array<{ status: TargetStatus }>;
  const totalTargets = rows.length;
  const pendingTargets = rows.filter((row) => row.status === 'pending' || row.status === 'processing').length;
  const sentTargets = rows.filter((row) => row.status === 'sent').length;
  const failedTargets = rows.filter((row) => row.status === 'failed').length;
  const invalidTargets = rows.filter((row) => row.status === 'invalid').length;

  const { data: campaignData, error: campaignError } = await supabaseAdmin
    .from('whatsapp_campaigns')
    .select('status')
    .eq('id', campaignId)
    .maybeSingle();

  if (campaignError) {
    throw new Error(`Erro ao consultar campanha para atualizar contadores: ${campaignError.message}`);
  }

  const updates: Record<string, unknown> = {
    total_targets: totalTargets,
    pending_targets: pendingTargets,
    sent_targets: sentTargets,
    failed_targets: failedTargets,
    invalid_targets: invalidTargets,
  };

  const campaignStatus = campaignData?.status as CampaignStatus | undefined;
  if (pendingTargets === 0 && campaignStatus === 'running') {
    updates.status = 'completed';
    updates.completed_at = new Date().toISOString();
  }

  const { error: updateError } = await supabaseAdmin
    .from('whatsapp_campaigns')
    .update(updates)
    .eq('id', campaignId);

  if (updateError) {
    throw new Error(`Erro ao atualizar campanha com novos contadores: ${updateError.message}`);
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
  const scanLimit = Math.min(Math.max(limit * 5, limit), 200);
  let query = supabaseAdmin
    .from('whatsapp_campaign_targets')
    .select('id, campaign_id, lead_id, phone, raw_phone, display_name, chat_id, source_payload, status, attempts, error_message, last_attempt_at, processing_started_at, processing_expires_at, last_completed_step_index, last_completed_step_id, last_sent_step_at, lead:leads(nome_completo, telefone, email, status, origem, cidade, responsavel), campaign:whatsapp_campaigns!inner(id, status, message, flow_steps, scheduled_at)')
    .in('status', ['pending', 'processing'])
    .order('created_at', { ascending: true })
    .limit(scanLimit);

  if (campaignId) {
    query = query.eq('campaign_id', campaignId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Erro ao carregar alvos pendentes da campanha: ${error.message}`);
  }

  const rows = (data ?? []) as TargetRecord[];
  return rows
    .filter((row) => row.campaign?.status === 'running')
    .filter((row) => isCampaignTargetReadyForProcessing(row))
    .slice(0, limit);
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

    const campaignSteps = normalizeCampaignFlowSteps(target.campaign?.flow_steps, target.campaign?.message ?? '');
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

      for (let stepIndex = lastCompletedStepIndex + 1; stepIndex < campaignSteps.length; stepIndex += 1) {
        const step = campaignSteps[stepIndex];
        await sendCampaignStep({
          token,
          to: recipient,
          step,
          lead: target.lead ?? null,
          sourcePayload: target.source_payload ?? null,
        });

        await persistTargetStepProgress(supabaseAdmin, target.id, stepIndex, step.id);
      }

      await updateTargetResult(supabaseAdmin, target.id, 'sent', null, true);
      summary.sent += 1;
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
    const authResult = await authorizeAdminUser({
      req,
      supabaseUrl,
      supabaseAnonKey,
      supabaseAdmin,
    });

    if (!authResult.authorized) {
      return authResult.response;
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
