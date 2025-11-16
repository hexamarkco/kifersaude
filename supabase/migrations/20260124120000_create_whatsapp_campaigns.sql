/*
  # WhatsApp campaigns orchestration

  Estrutura tabelas para campanhas, passos e público alvo com RLS liberal.
*/

create table if not exists whatsapp_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  status text not null default 'draft' check (status in ('draft','scheduled','running','paused','completed','cancelled')),
  audience_filter jsonb not null default '{}'::jsonb,
  metrics jsonb not null default '{}'::jsonb,
  starts_at timestamptz,
  completed_at timestamptz,
  created_by uuid references user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists whatsapp_campaign_steps (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references whatsapp_campaigns(id) on delete cascade,
  name text not null,
  step_type text not null check (step_type in ('message','attachment','wait_condition')),
  order_index integer not null default 0,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists whatsapp_campaign_targets (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references whatsapp_campaigns(id) on delete cascade,
  chat_id uuid references whatsapp_chats(id) on delete set null,
  lead_id uuid references leads(id) on delete set null,
  phone text not null,
  status text not null default 'pending' check (status in ('pending','in_progress','waiting','paused','completed','failed')),
  current_step_index integer not null default 0,
  wait_until timestamptz,
  condition_state jsonb,
  metadata jsonb not null default '{}'::jsonb,
  last_execution_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_whatsapp_campaigns_status on whatsapp_campaigns(status);
create index if not exists idx_whatsapp_campaign_steps_campaign on whatsapp_campaign_steps(campaign_id, order_index);
create index if not exists idx_whatsapp_campaign_targets_campaign on whatsapp_campaign_targets(campaign_id);
create index if not exists idx_whatsapp_campaign_targets_status on whatsapp_campaign_targets(status);

alter table whatsapp_campaign_steps
  add constraint whatsapp_campaign_steps_order_unique unique (campaign_id, order_index);

alter table whatsapp_campaign_targets
  add constraint whatsapp_campaign_targets_lead_unique unique (campaign_id, lead_id);

alter table whatsapp_campaign_targets
  add constraint whatsapp_campaign_targets_phone_unique unique (campaign_id, phone);

alter table whatsapp_campaigns enable row level security;
alter table whatsapp_campaign_steps enable row level security;
alter table whatsapp_campaign_targets enable row level security;

create policy "Usuários autenticados gerenciam campanhas"
  on whatsapp_campaigns for all
  to authenticated
  using (true)
  with check (true);

create policy "Usuários autenticados gerenciam passos"
  on whatsapp_campaign_steps for all
  to authenticated
  using (true)
  with check (true);

create policy "Usuários autenticados gerenciam público"
  on whatsapp_campaign_targets for all
  to authenticated
  using (true)
  with check (true);
