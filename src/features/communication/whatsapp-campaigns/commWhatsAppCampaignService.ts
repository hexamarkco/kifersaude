import { getSupabaseErrorMessage, supabase } from '../../../lib/supabase';

export type CommWhatsAppCampaignStatus = 'draft' | 'scheduled' | 'queued' | 'running' | 'paused' | 'completed' | 'cancelled';
export type CommWhatsAppCampaignAudienceSource = 'crm' | 'csv' | 'manual' | 'mixed';

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
  created_at: string;
  updated_at: string;
};

export type CommWhatsAppCsvTargetDraft = {
  displayName: string;
  phoneNumber: string;
  payload: Record<string, unknown>;
};

export type CommWhatsAppCampaignStepDraft = {
  messageText: string;
  delayAmount: number;
  delayUnit: 'seconds' | 'minutes' | 'hours' | 'days';
};

export type CommWhatsAppCampaignStep = {
  id: string;
  campaign_id: string;
  step_index: number;
  message_text: string;
  delay_amount: number;
  delay_unit: CommWhatsAppCampaignStepDraft['delayUnit'];
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
  sendWindowStart?: string | null;
  sendWindowEnd?: string | null;
  stopOnReply: boolean;
  createLeadsFromCsv: boolean;
  steps: CommWhatsAppCampaignStepDraft[];
  csvTargets?: CommWhatsAppCsvTargetDraft[];
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

const knownCampaignVariables = new Set(['nome', 'primeiro_nome', 'telefone', 'status', 'responsavel']);

const extractTemplateVariables = (steps: CommWhatsAppCampaignStep[]) => {
  const variables = new Set<string>();
  for (const step of steps) {
    for (const match of step.message_text.matchAll(/{{\s*([a-zA-Z0-9_]+)\s*}}/g)) {
      variables.add(match[1]);
    }
  }
  return Array.from(variables).sort();
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
      getCount('comm_whatsapp_ai_intent_suggestions', [{ op: 'eq', column: 'status', value: 'pending' }]),
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
      .select('*, chat:comm_whatsapp_chats(display_name,phone_number), campaign:comm_whatsapp_campaigns(name)')
      .eq('status', 'pending')
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
      message_text: campaign.message_text,
      delay_amount: 0,
      delay_unit: 'minutes' as const,
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
      sample = (sampleRows ?? []).map((lead) => ({
        name: lead.nome_completo || 'Lead sem nome',
        phone: lead.telefone || '',
        status: lead.status,
        responsavel: lead.responsavel,
      }));
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

      sample = (targetRows ?? []).map((target) => ({
        name: target.display_name || target.phone_number || target.phone_digits || 'Contato sem nome',
        phone: target.phone_number || target.phone_digits || '',
      }));
    }

    return {
      campaign,
      steps,
      estimatedTargets,
      materializedTargets: materializedTargetsCount ?? 0,
      sample,
      variables,
      unknownVariables,
      estimatedMinutes: Math.ceil(estimatedTargets / Math.max(campaign.pacing_per_minute || 1, 1)),
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
        send_window_start: input.sendWindowStart || null,
        send_window_end: input.sendWindowEnd || null,
        stop_on_reply: input.stopOnReply,
        create_leads_from_csv: input.createLeadsFromCsv,
        created_by: userId,
      })
      .select('*')
      .single();

    if (error) {
      throw new Error(getSupabaseErrorMessage(error, 'Nao foi possivel criar o disparo.'));
    }

    const createdCampaign = campaign as CommWhatsAppCampaign;
    const csvTargets = (input.csvTargets ?? [])
      .map((target) => ({
        campaign_id: createdCampaign.id,
        phone_number: target.phoneNumber,
        phone_digits: normalizePhoneDigits(target.phoneNumber),
        display_name: target.displayName || null,
        source_kind: 'csv',
        source_payload: target.payload,
      }))
      .filter((target) => target.phone_digits.length > 0);

    if (csvTargets.length > 0) {
      const { error: targetsError } = await supabase
        .from('comm_whatsapp_campaign_targets')
        .insert(csvTargets);

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

    const steps = input.steps
      .map((step, index) => ({
        campaign_id: createdCampaign.id,
        step_index: index,
        message_text: step.messageText.trim(),
        delay_amount: index === 0 ? 0 : Math.max(Math.floor(step.delayAmount || 0), 0),
        delay_unit: step.delayUnit,
      }))
      .filter((step) => step.message_text.length > 0);

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
        send_window_start: input.sendWindowStart || null,
        send_window_end: input.sendWindowEnd || null,
        stop_on_reply: input.stopOnReply,
        create_leads_from_csv: input.createLeadsFromCsv,
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

    const steps = input.steps
      .map((step, index) => ({
        campaign_id: campaignId,
        step_index: index,
        message_text: step.messageText.trim(),
        delay_amount: index === 0 ? 0 : Math.max(Math.floor(step.delayAmount || 0), 0),
        delay_unit: step.delayUnit,
      }))
      .filter((step) => step.message_text.length > 0);

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
};
