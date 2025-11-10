-- Amplia armazenamento de metadados para diferentes tipos de eventos do WhatsApp
ALTER TABLE whatsapp_conversations
  ADD COLUMN IF NOT EXISTS media_file_name text,
  ADD COLUMN IF NOT EXISTS media_page_count integer,
  ADD COLUMN IF NOT EXISTS media_is_gif boolean,
  ADD COLUMN IF NOT EXISTS notification_type text,
  ADD COLUMN IF NOT EXISTS call_id text,
  ADD COLUMN IF NOT EXISTS waiting_message boolean,
  ADD COLUMN IF NOT EXISTS is_status_reply boolean;
