import { databaseClient } from '../../../infrastructure/supabase';

import type { CommWhatsAppCampaign } from './commWhatsAppCampaignService';

export type CampaignRealtimeStatus = 'connected' | 'disconnected';

export function subscribeToCampaignListChanges(onChange: () => void): () => void {
  let active = true;
  const channel = databaseClient
    .channel(`comm-whatsapp-campaigns-${crypto.randomUUID()}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'comm_whatsapp_campaigns' }, () => {
      if (active) onChange();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'comm_whatsapp_campaign_worker_runs' }, () => {
      if (active) onChange();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'comm_whatsapp_ai_intent_suggestions' }, () => {
      if (active) onChange();
    })
    .subscribe();

  return () => {
    active = false;
    void databaseClient.removeChannel(channel);
  };
}

export function subscribeToCampaignChanges(
  campaignId: string,
  handlers: {
    onCampaign: (campaign: CommWhatsAppCampaign) => void;
    onStatus: (status: CampaignRealtimeStatus) => void;
  },
): () => void {
  let active = true;
  const channel = databaseClient
    .channel(`comm-whatsapp-campaign-${campaignId}-${crypto.randomUUID()}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'comm_whatsapp_campaigns',
        filter: `id=eq.${campaignId}`,
      },
      (payload) => {
        if (active) handlers.onCampaign(payload.new as CommWhatsAppCampaign);
      },
    )
    .subscribe((status) => {
      if (!active) return;

      if (status === 'SUBSCRIBED') {
        handlers.onStatus('connected');
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        handlers.onStatus('disconnected');
      }
    });

  return () => {
    active = false;
    void databaseClient.removeChannel(channel);
  };
}
