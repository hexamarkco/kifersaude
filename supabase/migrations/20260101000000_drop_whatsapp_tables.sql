-- Remove todas as tabelas e objetos relacionados à antiga integração de WhatsApp
DROP TABLE IF EXISTS whatsapp_chat_preferences CASCADE;
DROP TABLE IF EXISTS whatsapp_chat_peers CASCADE;
DROP TABLE IF EXISTS whatsapp_quick_replies CASCADE;
DROP TABLE IF EXISTS whatsapp_conversations CASCADE;
DROP TABLE IF EXISTS whatsapp_scheduled_messages CASCADE;
DROP TABLE IF EXISTS ai_generated_messages CASCADE;
DROP TABLE IF EXISTS api_integrations CASCADE;

-- Remove quaisquer funções auxiliares relacionadas se ainda existirem
DROP FUNCTION IF EXISTS update_whatsapp_chat_preferences_updated_at() CASCADE;
DROP FUNCTION IF EXISTS update_whatsapp_chat_peers_updated_at() CASCADE;
DROP FUNCTION IF EXISTS update_whatsapp_quick_replies_updated_at() CASCADE;
DROP FUNCTION IF EXISTS update_whatsapp_conversations_updated_at() CASCADE;
DROP FUNCTION IF EXISTS update_ai_generated_messages_updated_at() CASCADE;
DROP FUNCTION IF EXISTS update_api_integrations_updated_at() CASCADE;
