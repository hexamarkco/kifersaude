import { fetchAllPages, supabase } from './supabase';
import type {
  WhatsAppCampaign,
  WhatsAppCampaignAudienceSource,
  WhatsAppCampaignFlowStep,
} from '../types/whatsappCampaigns';

export type CreateWhatsAppCampaignCsvTargetInput = {
  normalizedPhone: string;
  rawPhone: string | null;
  displayName: string;
  chatId: string | null;
  sourcePayload: Record<string, string>;
  existingLeadId: string | null;
  needsLeadCreation: boolean;
};

export type CreateWhatsAppCampaignInput = {
  name: string;
  message: string;
  flowSteps: WhatsAppCampaignFlowStep[];
  audienceSource: WhatsAppCampaignAudienceSource;
  audienceFilter: Record<string, unknown>;
  audienceConfig: Record<string, unknown>;
  scheduledAt: string | null;
  csvTargets?: CreateWhatsAppCampaignCsvTargetInput[];
};

type CreateWhatsAppCampaignCsvTargetRpcInput = {
  normalized_phone: string;
  raw_phone: string | null;
  display_name: string;
  chat_id: string | null;
  source_payload: Record<string, string>;
  existing_lead_id: string | null;
  needs_lead_creation: boolean;
};

export type WhatsAppCampaignAudiencePreviewLead = {
  id: string;
  nome_completo: string;
  telefone: string;
  status_id: string | null;
  responsavel_id: string | null;
  origem_id: string | null;
  canal?: string | null;
};

export type WhatsAppCampaignAudiencePreview = {
  totalTargets: number;
  sampleTargets: WhatsAppCampaignAudiencePreviewLead[];
};

const WHATSAPP_CANAIS_RPC = 'list_whatsapp_campaign_canais';

let shouldUseDirectCanalFallback = false;

const isMissingListWhatsAppCampaignCanaisRpcError = (error: unknown) => {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const code = 'code' in error && typeof error.code === 'string' ? error.code : '';
  const message = 'message' in error && typeof error.message === 'string' ? error.message : '';
  const details = 'details' in error && typeof error.details === 'string' ? error.details : '';
  const hint = 'hint' in error && typeof error.hint === 'string' ? error.hint : '';
  const status = 'status' in error && typeof error.status === 'number' ? error.status : null;
  const combinedMessage = `${message} ${details} ${hint}`.toLowerCase();

  return code === 'PGRST202'
    || status === 404
    || (combinedMessage.includes(WHATSAPP_CANAIS_RPC) && combinedMessage.includes('schema cache'))
    || (combinedMessage.includes(WHATSAPP_CANAIS_RPC) && combinedMessage.includes('could not find'));
};

async function listWhatsAppCampaignCanaisDirect(): Promise<string[]> {
  const rows = await fetchAllPages<{ canal: string | null }>(async (from, to) => {
    const response = await supabase
      .from('leads')
      .select('canal')
      .eq('arquivado', false)
      .range(from, to);

    return {
      data: response.data as Array<{ canal: string | null }> | null,
      error: response.error,
    };
  }, 1000);

  return Array.from(
    new Set(
      rows
        .map((row) => (typeof row.canal === 'string' ? row.canal.trim() : ''))
        .filter(Boolean),
    ),
  );
}

const ensureCampaignResult = (data: unknown, fallbackMessage: string): WhatsAppCampaign => {
  if (Array.isArray(data)) {
    if (data[0] && typeof data[0] === 'object') {
      return data[0] as WhatsAppCampaign;
    }

    throw new Error(fallbackMessage);
  }

  if (!data || typeof data !== 'object') {
    throw new Error(fallbackMessage);
  }

  return data as WhatsAppCampaign;
};

const mapCsvTargetInputToRpc = (
  target: CreateWhatsAppCampaignCsvTargetInput,
): CreateWhatsAppCampaignCsvTargetRpcInput => ({
  normalized_phone: target.normalizedPhone,
  raw_phone: target.rawPhone,
  display_name: target.displayName,
  chat_id: target.chatId,
  source_payload: target.sourcePayload,
  existing_lead_id: target.existingLeadId,
  needs_lead_creation: target.needsLeadCreation,
});

export async function createWhatsAppCampaignAtomic(input: CreateWhatsAppCampaignInput): Promise<WhatsAppCampaign> {
  const { data, error } = await supabase.rpc('create_whatsapp_campaign_atomic', {
    p_name: input.name,
    p_message: input.message,
    p_flow_steps: input.flowSteps,
    p_audience_source: input.audienceSource,
    p_audience_filter: input.audienceFilter,
    p_audience_config: input.audienceConfig,
    p_scheduled_at: input.scheduledAt,
    p_csv_targets: (input.csvTargets ?? []).map(mapCsvTargetInputToRpc),
  });

  if (error) {
    throw error;
  }

  return ensureCampaignResult(data, 'Nao foi possivel criar a campanha do WhatsApp.');
}

export async function cancelWhatsAppCampaignAtomic(campaignId: string, reason: string): Promise<WhatsAppCampaign> {
  const { data, error } = await supabase.rpc('cancel_whatsapp_campaign_atomic', {
    p_campaign_id: campaignId,
    p_reason: reason,
  });

  if (error) {
    throw error;
  }

  return ensureCampaignResult(data, 'Nao foi possivel cancelar a campanha do WhatsApp.');
}

export async function recomputeWhatsAppCampaignCounters(campaignId: string): Promise<WhatsAppCampaign> {
  const { data, error } = await supabase.rpc('recompute_whatsapp_campaign_counters', {
    p_campaign_id: campaignId,
  });

  if (error) {
    throw error;
  }

  return ensureCampaignResult(data, 'Nao foi possivel recalcular os contadores da campanha do WhatsApp.');
}

export async function previewWhatsAppCampaignAudience(
  audienceFilter: Record<string, unknown>,
  limit = 80,
): Promise<WhatsAppCampaignAudiencePreview> {
  const { data, error } = await supabase.rpc('preview_whatsapp_campaign_audience', {
    p_audience_filter: audienceFilter,
    p_limit: limit,
  });

  if (error) {
    throw error;
  }

  const payload = data && typeof data === 'object' ? (data as Record<string, unknown>) : null;
  if (!payload) {
    throw new Error('Nao foi possivel gerar o preview do publico da campanha.');
  }

  return {
    totalTargets: typeof payload.total_targets === 'number' ? payload.total_targets : 0,
    sampleTargets: Array.isArray(payload.sample_targets)
      ? (payload.sample_targets as WhatsAppCampaignAudiencePreviewLead[])
      : [],
  };
}

export async function listWhatsAppCampaignCanais(): Promise<string[]> {
  if (shouldUseDirectCanalFallback) {
    return listWhatsAppCampaignCanaisDirect();
  }

  const { data, error } = await supabase.rpc('list_whatsapp_campaign_canais');

  if (error) {
    if (isMissingListWhatsAppCampaignCanaisRpcError(error)) {
      shouldUseDirectCanalFallback = true;
      return listWhatsAppCampaignCanaisDirect();
    }

    throw error;
  }

  return Array.isArray(data)
    ? data
        .map((item) => (item && typeof item === 'object' && typeof (item as { canal?: unknown }).canal === 'string' ? (item as { canal: string }).canal.trim() : ''))
        .filter(Boolean)
    : [];
}
