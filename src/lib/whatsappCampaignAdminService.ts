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
