alter table public.whatsapp_chats
  add column if not exists chat_lid text;

create unique index if not exists whatsapp_chats_chat_lid_idx
  on public.whatsapp_chats (chat_lid)
  where chat_lid is not null;
