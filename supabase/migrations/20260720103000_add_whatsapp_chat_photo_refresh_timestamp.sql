alter table if exists public.whatsapp_chats
  add column if not exists photo_refreshed_at timestamptz;
