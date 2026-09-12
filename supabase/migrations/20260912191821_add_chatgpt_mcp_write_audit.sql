create table if not exists public.mcp_action_audit_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  tool_name text not null,
  action_type text not null,
  actor text not null,
  actor_id text null,
  lead_id uuid null references public.leads(id) on delete set null,
  chat_id uuid null references public.comm_whatsapp_chats(id) on delete set null,
  contract_id uuid null references public.contracts(id) on delete set null,
  request_payload jsonb not null default '{}'::jsonb,
  result_payload jsonb not null default '{}'::jsonb,
  success boolean not null,
  error_message text null,
  client_request_id text null,
  source text not null default 'chatgpt_mcp'
);

create index if not exists mcp_action_audit_log_created_at_idx on public.mcp_action_audit_log (created_at desc);
create index if not exists mcp_action_audit_log_actor_id_idx on public.mcp_action_audit_log (actor_id, created_at desc);
create index if not exists mcp_action_audit_log_lead_id_idx on public.mcp_action_audit_log (lead_id, created_at desc);
create index if not exists mcp_action_audit_log_client_request_id_idx on public.mcp_action_audit_log (client_request_id) where client_request_id is not null;

alter table public.mcp_action_audit_log enable row level security;
revoke all on table public.mcp_action_audit_log from public, anon, authenticated;
grant all on table public.mcp_action_audit_log to service_role;
