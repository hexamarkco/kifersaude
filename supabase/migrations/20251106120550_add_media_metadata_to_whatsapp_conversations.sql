-- Adiciona metadados de mídia para permitir reprodução de diferentes tipos de mensagens do WhatsApp
ALTER TABLE whatsapp_conversations
  ADD COLUMN IF NOT EXISTS media_type text,
  ADD COLUMN IF NOT EXISTS media_mime_type text,
  ADD COLUMN IF NOT EXISTS media_duration_seconds integer,
  ADD COLUMN IF NOT EXISTS media_thumbnail_url text,
  ADD COLUMN IF NOT EXISTS media_caption text,
  ADD COLUMN IF NOT EXISTS media_view_once boolean;

CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_media_type
  ON whatsapp_conversations(media_type);
