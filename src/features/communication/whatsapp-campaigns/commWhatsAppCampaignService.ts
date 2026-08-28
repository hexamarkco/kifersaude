import { formatGreetingTitle, getGreetingForDate } from '../../../lib/greeting';
import { getSupabaseErrorMessage, supabase } from '../../../lib/supabase';

export type CommWhatsAppCampaignStatus = 'draft' | 'scheduled' | 'queued' | 'running' | 'paused' | 'completed' | 'cancelled';
export type CommWhatsAppCampaignAudienceSource = 'crm' | 'csv' | 'manual' | 'mixed';

export type CommWhatsAppCampaignRecurrenceRule = 'none' | 'daily' | 'weekly' | 'monthly';

export type CommWhatsAppCampaign = {
  id: string;
  name: string;
  objective: string | null;
  status: CommWhatsAppCampaignStatus;
  audience_source: CommWhatsAppCampaignAudienceSource;
  audience_config: Record<string, unknown>;
  message_text: string;
  scheduled_at: string | null;
  pacing_per_minute: number;
  daily_send_limit: number | null;
  send_window_start: string | null;
  send_window_end: string | null;
  stop_on_reply: boolean;
  create_leads_from_csv: boolean;
  total_targets: number;
  valid_targets: number;
  invalid_targets: number;
  pending_targets: number;
  sent_targets: number;
  failed_targets: number;
  responded_targets: number;
  stopped_targets: number;
  last_error: string | null;
  ab_test_enabled: boolean;
  ab_split_percent: number;
  recurrence_rule: CommWhatsAppCampaignRecurrenceRule;
  recurrence_interval: number;
  recurrence_end_at: string | null;
  recurrence_next_run_at: string | null;
  recurrence_runs_completed: number;
  created_at: string;
  updated_at: string;
};

export type CommWhatsAppCsvTargetDraft = {
  displayName: string;
  phoneNumber: string;
  payload: Record<string, unknown>;
};

export type CommWhatsAppCampaignMediaType = 'image' | 'document' | 'video';
export type CommWhatsAppCampaignDelayUnit = 'seconds' | 'minutes' | 'hours' | 'days';
export type CommWhatsAppCampaignStepKind = 'message' | 'status_change';

export type CommWhatsAppCampaignMessageDraft = {
  messageText: string;
  mediaUrl?: string | null;
  mediaType?: CommWhatsAppCampaignMediaType | null;
  mediaFilename?: string | null;
  /** Somente na primeira mensagem do primeiro estagio: texto alternativo da variante B do teste A/B. */
  variantBMessageText?: string;
};

/**
 * Um estagio agrupa um ou mais envios sob o mesmo intervalo de espera desde
 * o estagio anterior - ex: "3 mensagens imediatas" e depois "2 mensagens 24h
 * depois" sao dois estagios. Mesma logica de pacote de mensagens por etapa
 * do construtor de fluxo de automacao, mas sempre linear (sem ramificacao).
 */
export type CommWhatsAppCampaignStageDraft = {
  kind: CommWhatsAppCampaignStepKind;
  delayAmount: number;
  delayUnit: CommWhatsAppCampaignDelayUnit;
  messages: CommWhatsAppCampaignMessageDraft[];
  /** Usado somente quando kind === 'status_change'. */
  statusToSet?: string;
};

export type CommWhatsAppCampaignStep = {
  id: string;
  campaign_id: string;
  step_index: number;
  stage_index: number;
  step_kind: CommWhatsAppCampaignStepKind;
  status_to_set: string | null;
  message_text: string;
  delay_amount: number;
  delay_unit: CommWhatsAppCampaignDelayUnit;
  media_url: string | null;
  media_type: CommWhatsAppCampaignMediaType | null;
  media_filename: string | null;
  variant_label: 'ANY' | 'A' | 'B';
  created_at: string;
  updated_at: string;
};

export type CommWhatsAppCampaignTargetStatus = 'pending' | 'scheduled' | 'sending' | 'sent' | 'responded' | 'stopped' | 'failed' | 'invalid' | 'cancelled';

export type CommWhatsAppCampaignTarget = {
  id: string;
  campaign_id: string;
  lead_id: string | null;
  chat_id: string | null;
  phone_number: string;
  phone_digits: string;
  display_name: string | null;
  source_kind: 'crm' | 'csv' | 'manual';
  source_payload: Record<string, unknown>;
  status: CommWhatsAppCampaignTargetStatus;
  current_step_index: number;
  next_send_at: string | null;
  attempts: number;
  retry_count?: number;
  last_attempt_at: string | null;
  sent_at: string | null;
  responded_at: string | null;
  stopped_at: string | null;
  stopped_reason: string | null;
  error_message: string | null;
  external_message_id: string | null;
  ab_variant: 'A' | 'B' | null;
  created_at: string;
  updated_at: string;
};

export type CreateCampaignInput = {
  name: string;
  objective?: string;
  audienceSource: CommWhatsAppCampaignAudienceSource;
  audienceConfig: Record<string, unknown>;
  messageText: string;
  scheduledAt?: string | null;
  pacingPerMinute: number;
  dailySendLimit?: number | null;
  sendWindowStart?: string | null;
  sendWindowEnd?: string | null;
  stopOnReply: boolean;
  createLeadsFromCsv: boolean;
  stages: CommWhatsAppCampaignStageDraft[];
  csvTargets?: CommWhatsAppCsvTargetDraft[];
  abTestEnabled: boolean;
  abSplitPercent: number;
  recurrenceRule: CommWhatsAppCampaignRecurrenceRule;
  recurrenceInterval: number;
  recurrenceEndAt?: string | null;
};

export type CommWhatsAppCampaignTemplate = {
  id: string;
  name: string;
  stages: CommWhatsAppCampaignStageDraft[];
  created_at: string;
  updated_at: string;
};

export type CampaignStats = {
  total: number;
  drafts: number;
  scheduled: number;
  active: number;
  aiSuggestionsPending: number;
};

export type CampaignWorkerResult = {
  success: boolean;
  campaignId?: string;
  status?: string;
  processed?: number;
  sent?: number;
  failed?: number;
  stopped?: number;
  error?: string;
};

export type CommWhatsAppAiIntentSuggestion = {
  id: string;
  chat_id: string | null;
  message_id: string | null;
  campaign_id: string | null;
  lead_id: string | null;
  phone_digits: string | null;
  intent: 'opt_out' | 'negative_interest' | 'angry_or_complaint' | 'wrong_number' | 'continue_conversation' | 'unclear';
  confidence: number;
  recommended_action: 'suggest_block_whatsapp_campaigns' | 'keep_active' | 'review';
  reason: string | null;
  evidence: string | null;
  status: 'pending' | 'accepted' | 'dismissed';
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  chat?: {
    display_name?: string | null;
    phone_number?: string | null;
  } | null;
  campaign?: {
    name?: string | null;
  } | null;
};

export type CommWhatsAppCampaignPreviewSample = {
  name: string;
  phone: string;
  status?: string | null;
  responsavel?: string | null;
  resolvedMessage: string;
};

export type CommWhatsAppCampaignActivationPreview = {
  campaign: CommWhatsAppCampaign;
  steps: CommWhatsAppCampaignStep[];
  estimatedTargets: number;
  materializedTargets: number;
  sample: CommWhatsAppCampaignPreviewSample[];
  variables: string[];
  unknownVariables: string[];
  estimatedMinutes: number;
};

export type CommWhatsAppCampaignWorkerRun = {
  id: string;
  action: 'activate' | 'process';
  source: 'cron' | 'manual' | 'dashboard' | 'api';
  status: 'running' | 'success' | 'failed';
  campaign_id: string | null;
  processed: number;
  sent: number;
  failed: number;
  stopped: number;
  duration_ms: number | null;
  error_message: string | null;
  started_at: string;
  finished_at: string | null;
  created_at: string;
};

export type CommWhatsAppCampaignWorkerHealth = {
  latestRun: CommWhatsAppCampaignWorkerRun | null;
  latestSuccess: CommWhatsAppCampaignWorkerRun | null;
  latestFailure: CommWhatsAppCampaignWorkerRun | null;
  recentRuns: CommWhatsAppCampaignWorkerRun[];
};

const parseTimeToMinutes = (value: string | null | undefined): number | null => {
  if (!value) return null;
  const match = value.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
};

/**
 * Minutos entre a admissao de cada contato novo, derivado direto de
 * "novos contatos por dia" e da janela de envio (ou 24h corridas sem
 * janela). E so informativo no front - o worker calcula o mesmo valor de
 * verdade na RPC de reserva de despacho.
 */
export const computeAdmissionIntervalMinutes = (
  dailyLimit: number | null | undefined,
  windowStart: string | null | undefined,
  windowEnd: string | null | undefined,
): number | null => {
  if (!dailyLimit || dailyLimit <= 0) return null;

  const start = parseTimeToMinutes(windowStart);
  const end = parseTimeToMinutes(windowEnd);
  let windowMinutes = 24 * 60;
  if (start !== null && end !== null && start !== end) {
    windowMinutes = start < end ? end - start : (24 * 60 - start) + end;
  }

  return Math.max(Math.floor(windowMinutes / dailyLimit), 1);
};

export const formatAdmissionInterval = (minutes: number | null): string => {
  if (minutes === null) return 'Sem limite diario definido';
  if (minutes < 60) return `1 novo contato a cada ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return `1 novo contato a cada ${hours}h${remaining > 0 ? ` ${remaining}min` : ''}`;
};

const normalizePhoneDigits = (value: string) => {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) return digits;
  if (!digits.startsWith('55') && (digits.length === 10 || digits.length === 11)) return `55${digits}`;
  return digits;
};

const getCurrentUserId = async () => {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
};

type CountFilter =
  | { op: 'eq'; column: string; value: string }
  | { op: 'in'; column: string; value: string[] };

const getCount = async (table: string, filters: CountFilter[] = []) => {
  let query = supabase.from(table).select('id', { count: 'exact', head: true });
  for (const filter of filters) {
    query = filter.op === 'eq'
      ? query.eq(filter.column, filter.value)
      : query.in(filter.column, filter.value);
  }

  const { count, error } = await query;
  if (error) {
    throw new Error(getSupabaseErrorMessage(error, 'Nao foi possivel carregar os indicadores dos disparos.'));
  }

  return count ?? 0;
};

const getPendingAiSuggestionCount = async () => {
  const { count, error } = await supabase
    .from('comm_whatsapp_ai_intent_suggestions')
    .select('id,chat:comm_whatsapp_chats!inner(id)', { count: 'exact', head: true })
    .eq('status', 'pending')
    .is('chat.deleted_at', null)
    .is('chat.merged_into_chat_id', null);

  if (error) {
    throw new Error(getSupabaseErrorMessage(error, 'Nao foi possivel carregar as sugestoes pendentes.'));
  }

  return count ?? 0;
};

const getNestedRecord = (value: unknown, key: string): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const nested = (value as Record<string, unknown>)[key];
  return nested && typeof nested === 'object' && !Array.isArray(nested) ? nested as Record<string, unknown> : {};
};

const readStringArrayFilter = (filters: Record<string, unknown>, pluralKey: string, legacyKey: string) => {
  const pluralValue = filters[pluralKey];
  if (Array.isArray(pluralValue)) return pluralValue.filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
  const legacyValue = filters[legacyKey];
  return typeof legacyValue === 'string' && legacyValue.trim() ? [legacyValue.trim()] : [];
};

const knownCampaignVariables = new Set(['nome', 'primeiro_nome', 'telefone', 'status', 'responsavel', 'saudacao', 'saudacao_titulo', 'saudacao_capitalizada']);

const extractTemplateVariables = (steps: CommWhatsAppCampaignStep[]) => {
  const variables = new Set<string>();
  for (const step of steps) {
    for (const match of step.message_text.matchAll(/{{\s*([a-zA-Z0-9_]+)\s*}}/g)) {
      variables.add(match[1]);
    }
  }
  return Array.from(variables).sort();
};

// {{primeiro_nome}} sempre sai so com a inicial maiuscula, independente de
// como o nome esta cadastrado (tudo maiusculo, tudo minusculo, etc.).
const formatFirstNameTitle = (value: string): string => {
  const trimmed = value.trim();
  return trimmed ? `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1).toLowerCase()}` : '';
};

const resolveSampleMessage = (template: string, sample: { name: string; phone: string; status?: string | null; responsavel?: string | null }) => {
  const greeting = getGreetingForDate(new Date());
  const replacements: Record<string, string> = {
    nome: sample.name || '',
    primeiro_nome: formatFirstNameTitle((sample.name || '').split(/\s+/).filter(Boolean)[0] || ''),
    telefone: sample.phone || '',
    status: sample.status || '',
    responsavel: sample.responsavel || '',
    saudacao: greeting,
    saudacao_titulo: formatGreetingTitle(greeting),
    saudacao_capitalizada: formatGreetingTitle(greeting),
  };

  return template.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key: string) => replacements[key] ?? '');
};

type CampaignStepInsertRow = {
  campaign_id: string;
  step_index: number;
  stage_index: number;
  step_kind: CommWhatsAppCampaignStepKind;
  status_to_set: string | null;
  delay_amount: number;
  delay_unit: CommWhatsAppCampaignDelayUnit;
  media_url: string | null;
  media_type: CommWhatsAppCampaignMediaType | null;
  media_filename: string | null;
  message_text: string;
  variant_label: 'ANY' | 'A' | 'B';
};

/**
 * Achata os estagios (cada um com N mensagens ou uma troca de status) em
 * linhas fisicas de `comm_whatsapp_campaign_steps`. A primeira mensagem (ou
 * acao) de cada estagio carrega o intervalo configurado para o estagio; as
 * demais mensagens do mesmo estagio ficam com intervalo zero, ou seja, saem
 * em sequencia logo depois da anterior. O primeiro passo fisico da campanha
 * nunca tem intervalo, mesmo que o estagio tenha um configurado.
 */
const buildStepRows = (campaignId: string, stages: CommWhatsAppCampaignStageDraft[], abTestEnabled: boolean): CampaignStepInsertRow[] => {
  const rows: CampaignStepInsertRow[] = [];
  let stepIndex = 0;

  const resolveDelay = (isFirstInStage: boolean, stage: CommWhatsAppCampaignStageDraft) => (
    stepIndex === 0 ? 0 : (isFirstInStage ? Math.max(Math.floor(stage.delayAmount || 0), 0) : 0)
  );

  stages.forEach((stage, stageIndex) => {
    if (stage.kind === 'status_change') {
      const statusToSet = stage.statusToSet?.trim();
      if (!statusToSet) return;
      rows.push({
        campaign_id: campaignId,
        step_index: stepIndex,
        stage_index: stageIndex,
        step_kind: 'status_change',
        status_to_set: statusToSet,
        message_text: '',
        delay_amount: resolveDelay(true, stage),
        delay_unit: stage.delayUnit,
        media_url: null,
        media_type: null,
        media_filename: null,
        variant_label: 'ANY',
      });
      stepIndex += 1;
      return;
    }

    stage.messages.forEach((message, messageIndex) => {
      const isFirstInStage = messageIndex === 0;
      const base = {
        campaign_id: campaignId,
        step_index: stepIndex,
        stage_index: stageIndex,
        step_kind: 'message' as const,
        status_to_set: null,
        delay_amount: resolveDelay(isFirstInStage, stage),
        delay_unit: stage.delayUnit,
        media_url: message.mediaUrl || null,
        media_type: message.mediaUrl ? message.mediaType || null : null,
        media_filename: message.mediaUrl ? message.mediaFilename || null : null,
      };

      const variantBText = message.variantBMessageText?.trim() || '';
      if (stepIndex === 0 && abTestEnabled && variantBText) {
        rows.push({ ...base, message_text: message.messageText.trim(), variant_label: 'A' });
        rows.push({ ...base, message_text: variantBText, variant_label: 'B' });
      } else {
        rows.push({ ...base, message_text: message.messageText.trim(), variant_label: 'ANY' });
      }
      stepIndex += 1;
    });
  });

  return rows.filter((row) => row.step_kind === 'status_change' || row.message_text.length > 0 || row.media_url);
};

export const commWhatsAppCampaignService = {
  normalizePhoneDigits,

  async listCampaigns(): Promise<CommWhatsAppCampaign[]> {
    const { data, error } = await supabase
      .from('comm_whatsapp_campaigns')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(80);

    if (error) {
      throw new Error(getSupabaseErrorMessage(error, 'Nao foi possivel carregar os disparos do WhatsApp.'));
    }

    return (data ?? []) as CommWhatsAppCampaign[];
  },

  async getCampaign(campaignId: string): Promise<CommWhatsAppCampaign> {
    const { data, error } = await supabase
      .from('comm_whatsapp_campaigns')
      .select('*')
      .eq('id', campaignId)
      .single();

    if (error) {
      throw new Error(getSupabaseErrorMessage(error, 'Nao foi possivel carregar este disparo.'));
    }

    return data as CommWhatsAppCampaign;
  },

  async listCampaignTargets(campaignId: string): Promise<CommWhatsAppCampaignTarget[]> {
    const { data, error } = await supabase
      .from('comm_whatsapp_campaign_targets')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: true })
      .limit(500);

    if (error) {
      throw new Error(getSupabaseErrorMessage(error, 'Nao foi possivel carregar os contatos deste disparo.'));
    }

    return (data ?? []) as CommWhatsAppCampaignTarget[];
  },

  async getStats(): Promise<CampaignStats> {
    const [total, drafts, scheduled, active, aiSuggestionsPending] = await Promise.all([
      getCount('comm_whatsapp_campaigns'),
      getCount('comm_whatsapp_campaigns', [{ op: 'eq', column: 'status', value: 'draft' }]),
      getCount('comm_whatsapp_campaigns', [{ op: 'eq', column: 'status', value: 'scheduled' }]),
      getCount('comm_whatsapp_campaigns', [{ op: 'in', column: 'status', value: ['queued', 'running', 'paused'] }]),
      getPendingAiSuggestionCount(),
    ]);

    return { total, drafts, scheduled, active, aiSuggestionsPending };
  },

  async getWorkerHealth(): Promise<CommWhatsAppCampaignWorkerHealth> {
    const { data, error } = await supabase
      .from('comm_whatsapp_campaign_worker_runs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(12);

    if (error) {
      throw new Error(getSupabaseErrorMessage(error, 'Nao foi possivel carregar a saude do worker de disparos.'));
    }

    const recentRuns = (data ?? []) as CommWhatsAppCampaignWorkerRun[];
    return {
      latestRun: recentRuns[0] ?? null,
      latestSuccess: recentRuns.find((run) => run.status === 'success') ?? null,
      latestFailure: recentRuns.find((run) => run.status === 'failed') ?? null,
      recentRuns,
    };
  },

  async listPendingAiSuggestions(): Promise<CommWhatsAppAiIntentSuggestion[]> {
    const { data, error } = await supabase
      .from('comm_whatsapp_ai_intent_suggestions')
      .select('*, chat:comm_whatsapp_chats!inner(display_name,phone_number), campaign:comm_whatsapp_campaigns(name)')
      .eq('status', 'pending')
      .is('chat.deleted_at', null)
      .is('chat.merged_into_chat_id', null)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      throw new Error(getSupabaseErrorMessage(error, 'Nao foi possivel carregar as sugestoes de IA.'));
    }

    return (data ?? []) as CommWhatsAppAiIntentSuggestion[];
  },

  async listCampaignSteps(campaignId: string): Promise<CommWhatsAppCampaignStep[]> {
    const { data, error } = await supabase
      .from('comm_whatsapp_campaign_steps')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('step_index', { ascending: true });

    if (error) {
      throw new Error(getSupabaseErrorMessage(error, 'Nao foi possivel carregar a sequencia do disparo.'));
    }

    return (data ?? []) as CommWhatsAppCampaignStep[];
  },

  async getActivationPreview(campaignId: string): Promise<CommWhatsAppCampaignActivationPreview> {
    const campaign = await this.getCampaign(campaignId);
    const storedSteps = await this.listCampaignSteps(campaignId);
    const steps = storedSteps.length > 0 ? storedSteps : [{
      id: 'fallback-message',
      campaign_id: campaign.id,
      step_index: 0,
      stage_index: 0,
      step_kind: 'message' as const,
      status_to_set: null,
      message_text: campaign.message_text,
      delay_amount: 0,
      delay_unit: 'minutes' as const,
      media_url: null,
      media_type: null,
      media_filename: null,
      variant_label: 'ANY' as const,
      created_at: campaign.created_at,
      updated_at: campaign.updated_at,
    }];
    const variables = extractTemplateVariables(steps);
    const unknownVariables = variables.filter((variable) => !knownCampaignVariables.has(variable));

    const { count: materializedTargetsCount, error: targetCountError } = await supabase
      .from('comm_whatsapp_campaign_targets')
      .select('id', { count: 'exact', head: true })
      .eq('campaign_id', campaignId);

    if (targetCountError) {
      throw new Error(getSupabaseErrorMessage(targetCountError, 'Nao foi possivel estimar os contatos do disparo.'));
    }

    let estimatedTargets = materializedTargetsCount ?? 0;
    let sample: CommWhatsAppCampaignPreviewSample[] = [];
    const firstMessageStep = steps.find((step) => step.step_kind === 'message' && step.variant_label !== 'B');
    const firstStepTemplate = firstMessageStep?.message_text || '';

    if (campaign.audience_source === 'crm' || campaign.audience_source === 'mixed') {
      const filters = getNestedRecord(campaign.audience_config, 'filters');
      const statuses = readStringArrayFilter(filters, 'statuses', 'status');
      const responsaveis = readStringArrayFilter(filters, 'responsaveis', 'responsavel');

      let countQuery = supabase
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .eq('arquivado', false)
        .not('telefone', 'is', null);
      let sampleQuery = supabase
        .from('leads')
        .select('nome_completo,telefone,status,responsavel')
        .eq('arquivado', false)
        .not('telefone', 'is', null)
        .order('created_at', { ascending: true })
        .limit(5);

      if (statuses.length > 0) {
        countQuery = countQuery.in('status', statuses);
        sampleQuery = sampleQuery.in('status', statuses);
      }

      if (responsaveis.length > 0) {
        countQuery = countQuery.in('responsavel', responsaveis);
        sampleQuery = sampleQuery.in('responsavel', responsaveis);
      }

      const [{ count, error: countError }, { data: sampleRows, error: sampleError }] = await Promise.all([countQuery, sampleQuery]);
      if (countError) throw new Error(getSupabaseErrorMessage(countError, 'Nao foi possivel estimar o publico do CRM.'));
      if (sampleError) throw new Error(getSupabaseErrorMessage(sampleError, 'Nao foi possivel carregar amostra do CRM.'));

      estimatedTargets = count ?? 0;
      sample = (sampleRows ?? []).map((lead) => {
        const entry = {
          name: lead.nome_completo || 'Lead sem nome',
          phone: lead.telefone || '',
          status: lead.status,
          responsavel: lead.responsavel,
        };
        return { ...entry, resolvedMessage: resolveSampleMessage(firstStepTemplate, entry) };
      });
    } else {
      const { data: targetRows, error: targetRowsError } = await supabase
        .from('comm_whatsapp_campaign_targets')
        .select('display_name,phone_number,phone_digits')
        .eq('campaign_id', campaignId)
        .order('created_at', { ascending: true })
        .limit(5);

      if (targetRowsError) {
        throw new Error(getSupabaseErrorMessage(targetRowsError, 'Nao foi possivel carregar amostra dos contatos.'));
      }

      sample = (targetRows ?? []).map((target) => {
        const entry = {
          name: target.display_name || target.phone_number || target.phone_digits || 'Contato sem nome',
          phone: target.phone_number || target.phone_digits || '',
        };
        return { ...entry, resolvedMessage: resolveSampleMessage(firstStepTemplate, entry) };
      });
    }

    // O gargalo real da campanha e o limite diario de admissao de contatos
    // novos, espalhado pelos dias necessarios. Sem limite diario, o unico
    // teto que resta e o de reivindicacao por execucao do worker (a cada
    // minuto), entao usamos isso como estimativa.
    const estimatedMinutes = campaign.daily_send_limit
      ? Math.ceil(estimatedTargets / campaign.daily_send_limit) * 24 * 60
      : Math.ceil(estimatedTargets / 25);

    return {
      campaign,
      steps,
      estimatedTargets,
      materializedTargets: materializedTargetsCount ?? 0,
      sample,
      variables,
      unknownVariables,
      estimatedMinutes,
    };
  },

  async createDraft(input: CreateCampaignInput): Promise<CommWhatsAppCampaign> {
    const userId = await getCurrentUserId();
    const { data: campaign, error } = await supabase
      .from('comm_whatsapp_campaigns')
      .insert({
        name: input.name.trim(),
        objective: input.objective?.trim() || null,
        status: input.scheduledAt ? 'scheduled' : 'draft',
        audience_source: input.audienceSource,
        audience_config: input.audienceConfig,
        message_text: input.messageText.trim(),
        scheduled_at: input.scheduledAt || null,
        pacing_per_minute: input.pacingPerMinute,
        daily_send_limit: input.dailySendLimit ?? null,
        send_window_start: input.sendWindowStart || null,
        send_window_end: input.sendWindowEnd || null,
        stop_on_reply: input.stopOnReply,
        create_leads_from_csv: input.createLeadsFromCsv,
        ab_test_enabled: input.abTestEnabled,
        ab_split_percent: input.abSplitPercent,
        recurrence_rule: input.recurrenceRule,
        recurrence_interval: input.recurrenceInterval,
        recurrence_end_at: input.recurrenceEndAt || null,
        created_by: userId,
      })
      .select('*')
      .single();

    if (error) {
      throw new Error(getSupabaseErrorMessage(error, 'Nao foi possivel criar o disparo.'));
    }

    const createdCampaign = campaign as CommWhatsAppCampaign;
    const csvTargetsWithDuplicates = (input.csvTargets ?? [])
      .map((target) => ({
        campaign_id: createdCampaign.id,
        phone_number: target.phoneNumber,
        phone_digits: normalizePhoneDigits(target.phoneNumber),
        display_name: target.displayName || null,
        source_kind: 'csv',
        source_payload: target.payload,
      }))
      .filter((target) => target.phone_digits.length > 0);

    // O CSV pode trazer o mesmo telefone repetido (em formatos diferentes ou
    // nao). Mantem so a primeira ocorrencia por numero normalizado - o banco
    // tem uma constraint unica (campaign_id, phone_digits) que rejeitaria o
    // insert inteiro se algum duplicado escapasse daqui.
    const seenPhoneDigits = new Set<string>();
    const csvTargets = csvTargetsWithDuplicates.filter((target) => {
      if (seenPhoneDigits.has(target.phone_digits)) return false;
      seenPhoneDigits.add(target.phone_digits);
      return true;
    });

    if (csvTargets.length > 0) {
      const { error: targetsError } = await supabase
        .from('comm_whatsapp_campaign_targets')
        .upsert(csvTargets, { onConflict: 'campaign_id,phone_digits', ignoreDuplicates: true });

      if (targetsError) {
        throw new Error(getSupabaseErrorMessage(targetsError, 'O disparo foi criado, mas os contatos do CSV nao foram salvos.'));
      }

      const { error: updateError } = await supabase
        .from('comm_whatsapp_campaigns')
        .update({
          total_targets: csvTargets.length,
          valid_targets: csvTargets.length,
          pending_targets: csvTargets.length,
        })
        .eq('id', createdCampaign.id);

      if (updateError) {
        throw new Error(getSupabaseErrorMessage(updateError, 'Os contatos foram salvos, mas os contadores nao foram atualizados.'));
      }
    }

    const steps = buildStepRows(createdCampaign.id, input.stages, input.abTestEnabled);

    if (steps.length > 0) {
      const { error: stepsError } = await supabase
        .from('comm_whatsapp_campaign_steps')
        .insert(steps);

      if (stepsError) {
        throw new Error(getSupabaseErrorMessage(stepsError, 'O disparo foi criado, mas a sequencia de mensagens nao foi salva.'));
      }
    }

    return createdCampaign;
  },

  async updateCampaign(campaignId: string, input: CreateCampaignInput): Promise<void> {
    const { error } = await supabase
      .from('comm_whatsapp_campaigns')
      .update({
        name: input.name.trim(),
        objective: input.objective?.trim() || null,
        audience_source: input.audienceSource,
        audience_config: input.audienceConfig,
        message_text: input.messageText.trim(),
        scheduled_at: input.scheduledAt || null,
        pacing_per_minute: input.pacingPerMinute,
        daily_send_limit: input.dailySendLimit ?? null,
        send_window_start: input.sendWindowStart || null,
        send_window_end: input.sendWindowEnd || null,
        stop_on_reply: input.stopOnReply,
        create_leads_from_csv: input.createLeadsFromCsv,
        ab_test_enabled: input.abTestEnabled,
        ab_split_percent: input.abSplitPercent,
        recurrence_rule: input.recurrenceRule,
        recurrence_interval: input.recurrenceInterval,
        recurrence_end_at: input.recurrenceEndAt || null,
      })
      .eq('id', campaignId);

    if (error) {
      throw new Error(getSupabaseErrorMessage(error, 'Nao foi possivel atualizar o disparo.'));
    }

    const { error: deleteStepsError } = await supabase
      .from('comm_whatsapp_campaign_steps')
      .delete()
      .eq('campaign_id', campaignId);

    if (deleteStepsError) {
      throw new Error(getSupabaseErrorMessage(deleteStepsError, 'O disparo foi atualizado, mas a sequencia anterior nao foi removida.'));
    }

    const steps = buildStepRows(campaignId, input.stages, input.abTestEnabled);

    if (steps.length > 0) {
      const { error: stepsError } = await supabase
        .from('comm_whatsapp_campaign_steps')
        .insert(steps);

      if (stepsError) {
        throw new Error(getSupabaseErrorMessage(stepsError, 'O disparo foi atualizado, mas a nova sequencia nao foi salva.'));
      }
    }
  },

  async activateCampaign(campaignId: string): Promise<CampaignWorkerResult> {
    const { data, error } = await supabase.functions.invoke('comm-whatsapp-campaign-worker', {
      body: {
        action: 'activate',
        campaignId,
      },
    });

    if (error) {
      throw new Error(getSupabaseErrorMessage(error, 'Nao foi possivel ativar o disparo.'));
    }

    const payload = (data ?? {}) as CampaignWorkerResult;
    if (payload.error) {
      throw new Error(payload.error);
    }

    return payload;
  },

  async processCampaign(campaignId: string, limit = 25): Promise<CampaignWorkerResult> {
    const { data, error } = await supabase.functions.invoke('comm-whatsapp-campaign-worker', {
      body: {
        action: 'process',
        campaignId,
        limit,
      },
    });

    if (error) {
      throw new Error(getSupabaseErrorMessage(error, 'Nao foi possivel processar o disparo.'));
    }

    const payload = (data ?? {}) as CampaignWorkerResult;
    if (payload.error) {
      throw new Error(payload.error);
    }

    return payload;
  },

  async pauseCampaign(campaignId: string): Promise<void> {
    const { error } = await supabase
      .from('comm_whatsapp_campaigns')
      .update({ status: 'paused', last_error: null })
      .eq('id', campaignId)
      .in('status', ['queued', 'running', 'scheduled']);

    if (error) {
      throw new Error(getSupabaseErrorMessage(error, 'Nao foi possivel pausar o disparo.'));
    }

    await supabase
      .from('comm_whatsapp_campaign_targets')
      .update({ status: 'scheduled', locked_at: null, lock_token: null })
      .eq('campaign_id', campaignId)
      .eq('status', 'sending');
  },

  async resumeCampaign(campaign: CommWhatsAppCampaign): Promise<void> {
    const nextStatus = campaign.scheduled_at && new Date(campaign.scheduled_at).getTime() > Date.now() ? 'scheduled' : 'queued';
    const { error } = await supabase
      .from('comm_whatsapp_campaigns')
      .update({ status: nextStatus, last_error: null })
      .eq('id', campaign.id)
      .eq('status', 'paused');

    if (error) {
      throw new Error(getSupabaseErrorMessage(error, 'Nao foi possivel retomar o disparo.'));
    }
  },

  async cancelCampaign(campaignId: string): Promise<void> {
    const { error } = await supabase
      .from('comm_whatsapp_campaigns')
      .update({ status: 'cancelled', completed_at: new Date().toISOString(), last_error: null })
      .eq('id', campaignId)
      .in('status', ['draft', 'scheduled', 'queued', 'running', 'paused']);

    if (error) {
      throw new Error(getSupabaseErrorMessage(error, 'Nao foi possivel cancelar o disparo.'));
    }

    const { error: targetsError } = await supabase
      .from('comm_whatsapp_campaign_targets')
      .update({ status: 'cancelled', locked_at: null, lock_token: null })
      .eq('campaign_id', campaignId)
      .in('status', ['pending', 'scheduled', 'sending']);

    if (targetsError) {
      throw new Error(getSupabaseErrorMessage(targetsError, 'Disparo cancelado, mas nao foi possivel cancelar todos os contatos pendentes.'));
    }
  },

  async acceptAiSuggestion(suggestion: CommWhatsAppAiIntentSuggestion): Promise<void> {
    const phoneDigits = suggestion.phone_digits?.trim() || '';
    if (!phoneDigits) {
      throw new Error('Sugestao sem telefone para bloquear.');
    }

    const { error: upsertError } = await supabase
      .from('comm_whatsapp_opt_outs')
      .upsert({
        lead_id: suggestion.lead_id,
        phone_digits: phoneDigits,
        phone_number: suggestion.chat?.phone_number ?? phoneDigits,
        status: 'blocked',
        reason: suggestion.reason || suggestion.evidence || 'Bloqueado a partir de sugestao de IA.',
        source: 'ai_suggestion',
        source_campaign_id: suggestion.campaign_id,
        source_chat_id: suggestion.chat_id,
        source_message_id: suggestion.message_id,
        ai_suggestion_id: suggestion.id,
      }, { onConflict: 'phone_digits' });

    if (upsertError) {
      throw new Error(getSupabaseErrorMessage(upsertError, 'Nao foi possivel bloquear este telefone para disparos.'));
    }

    const { error: updateError } = await supabase
      .from('comm_whatsapp_ai_intent_suggestions')
      .update({ status: 'accepted', reviewed_at: new Date().toISOString() })
      .eq('id', suggestion.id);

    if (updateError) {
      throw new Error(getSupabaseErrorMessage(updateError, 'Bloqueio criado, mas nao foi possivel atualizar a sugestao.'));
    }
  },

  async dismissAiSuggestion(suggestionId: string): Promise<void> {
    const { error } = await supabase
      .from('comm_whatsapp_ai_intent_suggestions')
      .update({ status: 'dismissed', reviewed_at: new Date().toISOString() })
      .eq('id', suggestionId);

    if (error) {
      throw new Error(getSupabaseErrorMessage(error, 'Nao foi possivel dispensar a sugestao.'));
    }
  },

  async uploadCampaignMedia(file: File): Promise<{ url: string; type: CommWhatsAppCampaignMediaType; filename: string }> {
    const type: CommWhatsAppCampaignMediaType = file.type.startsWith('image/')
      ? 'image'
      : file.type.startsWith('video/')
        ? 'video'
        : 'document';

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120) || 'arquivo';
    const path = `${crypto.randomUUID()}-${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from('whatsapp-campaign-media')
      .upload(path, file, { contentType: file.type || undefined, upsert: false });

    if (uploadError) {
      throw new Error(getSupabaseErrorMessage(uploadError, 'Nao foi possivel enviar o arquivo de midia.'));
    }

    const { data } = supabase.storage.from('whatsapp-campaign-media').getPublicUrl(path);
    return { url: data.publicUrl, type, filename: file.name };
  },

  async sendTestMessage(campaignId: string, phoneNumber: string, stepIndex: number, variant: 'A' | 'B' = 'A'): Promise<{ phoneDigits: string }> {
    const { data, error } = await supabase.functions.invoke('comm-whatsapp-campaign-worker', {
      body: { action: 'test_send', campaignId, phoneNumber, stepIndex, variant },
    });

    if (error) {
      throw new Error(getSupabaseErrorMessage(error, 'Nao foi possivel enviar a mensagem de teste.'));
    }

    const payload = (data ?? {}) as { error?: string; phoneDigits?: string };
    if (payload.error) {
      throw new Error(payload.error);
    }

    return { phoneDigits: payload.phoneDigits || '' };
  },

  async listTemplates(): Promise<CommWhatsAppCampaignTemplate[]> {
    const { data, error } = await supabase
      .from('comm_whatsapp_campaign_templates')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      throw new Error(getSupabaseErrorMessage(error, 'Nao foi possivel carregar os modelos salvos.'));
    }

    return (data ?? []).map((row) => ({ ...row, stages: row.steps })) as CommWhatsAppCampaignTemplate[];
  },

  async saveTemplate(name: string, stages: CommWhatsAppCampaignStageDraft[]): Promise<CommWhatsAppCampaignTemplate> {
    const userId = await getCurrentUserId();
    // Coluna no banco continua chamada `steps` (jsonb opaco); o formato
    // gravado nela e a lista de estagios.
    const { data, error } = await supabase
      .from('comm_whatsapp_campaign_templates')
      .insert({ name: name.trim(), steps: stages, created_by: userId })
      .select('*')
      .single();

    if (error) {
      throw new Error(getSupabaseErrorMessage(error, 'Nao foi possivel salvar o modelo.'));
    }

    return { ...data, stages: data.steps } as CommWhatsAppCampaignTemplate;
  },

  async deleteTemplate(templateId: string): Promise<void> {
    const { error } = await supabase
      .from('comm_whatsapp_campaign_templates')
      .delete()
      .eq('id', templateId);

    if (error) {
      throw new Error(getSupabaseErrorMessage(error, 'Nao foi possivel remover o modelo.'));
    }
  },
};
