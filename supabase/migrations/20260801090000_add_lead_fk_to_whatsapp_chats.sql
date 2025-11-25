alter table if exists public.whatsapp_chats
  add column if not exists lead_id uuid references public.leads(id) on delete set null;

create index if not exists whatsapp_chats_lead_id_idx on public.whatsapp_chats (lead_id);
