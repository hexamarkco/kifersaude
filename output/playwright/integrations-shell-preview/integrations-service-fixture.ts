const integrationSettings = {
  whatsapp_auto_contact: { id: 'whatsapp-demo', slug: 'whatsapp_auto_contact', name: 'Automação de WhatsApp', settings: { enabled: false }, created_at: '', updated_at: '' },
  meta_pixel: { id: 'pixel-demo', slug: 'meta_pixel', name: 'Meta Pixel', settings: { pixelId: '1234567890' }, created_at: '', updated_at: '' },
  google_tag_manager: { id: 'gtm-demo', slug: 'google_tag_manager', name: 'Google Tag Manager', settings: { gtmId: 'GTM-DEMO01' }, created_at: '', updated_at: '' },
  ai_provider_openai: { id: 'openai-demo', slug: 'ai_provider_openai', name: 'OpenAI', settings: { enabled: false }, created_at: '', updated_at: '' },
  ai_routing: { id: 'routing-demo', slug: 'ai_routing', name: 'Roteamento de IA', settings: {}, created_at: '', updated_at: '' },
};

export const configService = {
  getIntegrationSetting: async (slug: keyof typeof integrationSettings) => integrationSettings[slug] ?? null,
  getLeadStatusConfig: async () => [],
  createIntegrationSetting: async () => ({ data: null, error: new Error('Escritas bloqueadas nesta prévia sintética.') }),
  updateIntegrationSetting: async () => ({ data: null, error: new Error('Escritas bloqueadas nesta prévia sintética.') }),
};
