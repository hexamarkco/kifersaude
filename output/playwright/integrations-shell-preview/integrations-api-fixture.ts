export async function loadAiProviderModels() {
  return { models: [] };
}

export async function loadWhatsAppChannelState() {
  return {
    channel: { connection_status: 'AUTH', phone_number: null, last_health_check_at: '2026-10-30T14:00:00.000Z' },
    config: {
      tokenConfigured: true,
      webhookUrl: 'https://local.invalid/demo-webhook',
      webhookAuthentication: 'header',
      webhookHeaderName: 'X-Demo-Secret',
      webhookDiagnostics: {
        status: 'receiving_messages',
        lastWebhookAt: '2026-10-30T14:04:00.000Z',
        lastMessageWebhookAt: '2026-10-30T14:04:30.000Z',
        lastInboundMessageAt: '2026-10-30T14:05:00.000Z',
      },
    },
  };
}
