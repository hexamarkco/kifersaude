import { supabase } from './supabase';
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

export async function createWhatsAppCampaignAtomic(input: CreateWhatsAppCampaignInput): Promise<WhatsAppCampaign> {
  const { data, error } = await supabase.rpc('create_whatsapp_campaign_atomic', {
    p_name: input.name,
    p_message: input.message,
    p_flow_steps: input.flowSteps,
    p_audience_source: input.audienceSource,
    p_audience_filter: input.audienceFilter,
    p_audience_config: input.audienceConfig,
    p_scheduled_at: input.scheduledAt,
    p_csv_targets: input.csvTargets ?? [],
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
