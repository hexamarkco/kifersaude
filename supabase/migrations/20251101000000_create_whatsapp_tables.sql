create extension if not exists "pgcrypto";

create table if not exists public.whatsapp_chats (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  chat_name text,
  last_message_at timestamptz,
  last_message_preview text,
  is_group boolean not null default false,
  sender_photo text
);

create table if not exists public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid references public.whatsapp_chats(id) on delete cascade,
  message_id text,
  from_me boolean not null default false,
  status text,
  text text,
  moment timestamptz,
  raw_payload jsonb
);

create index if not exists whatsapp_chats_phone_idx on public.whatsapp_chats (phone);
create index if not exists whatsapp_chats_last_message_at_idx on public.whatsapp_chats (last_message_at desc nulls last);
create index if not exists whatsapp_messages_chat_id_idx on public.whatsapp_messages (chat_id, moment);
