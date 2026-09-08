import { databaseClient } from '../../../../infrastructure/supabase';
import type { AiProvider } from '../shared/integrationsSettings';

export type WebhookDiagnosticStatus =
  | 'error'
  | 'message_event_missing'
  | 'receiving_messages'
  | 'waiting_first_event';

export type ChannelAdminState = {
  channel: {
    connection_status?: string | null;
    phone_number?: string | null;
    last_health_check_at?: string | null;
  };
  config: {
    tokenConfigured?: boolean;
    webhookUrl?: string;
    webhookAuthentication?: 'header' | 'legacy_query';
    webhookHeaderName?: string | null;
    webhookDiagnostics?: {
      status?: WebhookDiagnosticStatus;
      lastWebhookAt?: string | null;
      lastMessageWebhookAt?: string | null;
      lastInboundMessageAt?: string | null;
      lastError?: string | null;
    };
  };
};

export async function loadAiProviderModels(provider: AiProvider): Promise<unknown> {
  const { data, error } = await databaseClient.functions.invoke('list-ai-models', {
    body: { provider },
  });
  if (error) throw new Error(error.message || 'Não foi possível carregar os modelos.');
  return data;
}

export async function loadWhatsAppChannelState(
  action: 'getConfig' | 'refreshHealth',
): Promise<ChannelAdminState> {
  const { data, error } = await databaseClient.functions.invoke('comm-whatsapp-admin', {
    body: { action },
  });
  if (error) throw error;
  return (data ?? {}) as ChannelAdminState;
}
