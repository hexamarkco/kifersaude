/*
  # Agendamentos de mensagens do WhatsApp

  Recria a tabela de agendamentos utilizada pelo painel para armazenar
  mensagens que devem ser enviadas automaticamente em um horário futuro.
*/

create table if not exists public.whatsapp_scheduled_messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.whatsapp_chats(id) on delete cascade,
  phone text not null,
  message text not null,
  scheduled_send_at timestamptz not null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz,
  cancelled_at timestamptz,
  last_error text,
  constraint whatsapp_scheduled_messages_status_check
    check (status in ('pending', 'processing', 'sent', 'failed', 'cancelled'))
);

create index if not exists whatsapp_scheduled_messages_chat_id_idx
  on public.whatsapp_scheduled_messages (chat_id);

create index if not exists whatsapp_scheduled_messages_schedule_idx
  on public.whatsapp_scheduled_messages (scheduled_send_at asc);

alter table public.whatsapp_scheduled_messages enable row level security;

create policy "Usuários autenticados podem gerenciar agendamentos de WhatsApp"
  on public.whatsapp_scheduled_messages
  for all
  to authenticated
  using (true)
  with check (true);
