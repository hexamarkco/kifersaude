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
  csvTargets?: CommWhatsAppCsvTargetDraft[];
};

export type CampaignStats = {
  total: number;
  drafts: number;
  scheduled: number;
  active: number;
  aiSuggestionsPending: number;
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

    return createdCampaign;
  },
};
