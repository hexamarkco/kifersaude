/*
  # Facebook Lead Ads integration

  Adds default settings for the Facebook Ads Manager integration so administrators
  can configure tokens and defaults for syncing leads do CRM.
*/

INSERT INTO integration_settings (slug, name, description, settings)
VALUES (
  'facebook_ads_manager',
  'Facebook Lead Ads',
  'Configuração usada para receber leads diretamente do Gerenciador de Anúncios do Facebook.',
  jsonb_build_object(
    'pageAccessToken', '',
    'verifyToken', '',
    'defaultOrigem', 'tráfego pago',
    'defaultTipoContratacao', 'Pessoa Física',
    'defaultResponsavel', 'Luiza'
  )
)
ON CONFLICT (slug) DO NOTHING;
