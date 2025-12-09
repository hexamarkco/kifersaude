/*
  # Correção do campo token para Whapi Cloud

  1. Mudanças
    - Garante que o campo apiKey existe nas configurações do WhatsApp
    - Migra o campo token para apiKey se existir
    - Remove campos obsoletos (baseUrl, sessionId) se existirem

  2. Detalhes
    - Atualiza a estrutura da tabela integration_settings para integração WhatsApp
    - Mantém compatibilidade com configurações existentes
    - Prepara para uso consistente da Whapi Cloud API

  3. Notas
    - Esta migração preserva o token existente
    - Remove campos que não são mais necessários para a Whapi Cloud
*/

DO $$
DECLARE
  current_settings jsonb;
  new_settings jsonb;
  token_value text;
BEGIN
  SELECT settings INTO current_settings
  FROM integration_settings
  WHERE slug = 'whatsapp_auto_contact';

  IF current_settings IS NOT NULL THEN
    -- Pega o token de apiKey ou token (retrocompatibilidade)
    token_value := COALESCE(
      current_settings->>'apiKey',
      current_settings->>'token',
      ''
    );

    -- Cria nova estrutura limpa sem campos obsoletos
    new_settings := jsonb_build_object(
      'enabled', COALESCE((current_settings->>'enabled')::boolean, false),
      'apiKey', token_value,
      'token', token_value,
      'statusOnSend', COALESCE(current_settings->>'statusOnSend', 'Contato Inicial'),
      'messageFlow', COALESCE(current_settings->'messageFlow', '[]'::jsonb)
    );

    UPDATE integration_settings
    SET
      settings = new_settings,
      description = 'Configurações da API Whapi Cloud para envio automático de mensagens WhatsApp.',
      updated_at = now()
    WHERE slug = 'whatsapp_auto_contact';

    RAISE NOTICE 'Configurações do WhatsApp atualizadas para usar apiKey. Token: %', 
      CASE WHEN token_value = '' THEN 'não configurado' ELSE 'configurado' END;
  ELSE
    -- Se não existir, cria
    INSERT INTO integration_settings (slug, name, description, settings)
    VALUES (
      'whatsapp_auto_contact',
      'WhatsApp - Automação de Contato',
      'Configurações da API Whapi Cloud para envio automático de mensagens WhatsApp.',
      jsonb_build_object(
        'enabled', false,
        'apiKey', '',
        'token', '',
        'statusOnSend', 'Contato Inicial',
        'messageFlow', '[]'::jsonb
      )
    );

    RAISE NOTICE 'Registro de integração WhatsApp criado.';
  END IF;
END $$;