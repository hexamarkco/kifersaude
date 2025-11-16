/*
  # Insights automatizados de conversas do WhatsApp

  - Armazena resumos e sentimento gerados por provedores NLP para cada conversa.
  - Indexa por chat e data de criação para facilitar buscas do insight mais recente.
  - Expõe dados com políticas RLS para clientes autenticados.
*/

create table if not exists public.whatsapp_chat_insights (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.whatsapp_chats(id) on delete cascade,
  summary text,
  sentiment text check (sentiment in ('positive', 'neutral', 'negative')),
  created_at timestamptz not null default now()
);

create index if not exists whatsapp_chat_insights_chat_idx
  on public.whatsapp_chat_insights (chat_id, created_at desc);

alter table public.whatsapp_chat_insights enable row level security;

drop policy if exists "Authenticated users can read WhatsApp chat insights" on public.whatsapp_chat_insights;
create policy "Authenticated users can read WhatsApp chat insights"
  on public.whatsapp_chat_insights
  for select
  to authenticated
  using (true);
