create table if not exists comm_follow_up_audit_log (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id),
  chat_id text not null,
  sent_at timestamptz not null default now(),
  text_content text not null,
  next_action_title text,
  next_action_due_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_comm_follow_up_audit_log_lead
  on comm_follow_up_audit_log(lead_id, sent_at desc);

alter table comm_follow_up_audit_log enable row level security;

create policy "Usuarios autenticados podem inserir na auditoria"
  on comm_follow_up_audit_log for insert
  to authenticated
  with check (true);

create policy "Usuarios autenticados podem ler auditoria"
  on comm_follow_up_audit_log for select
  to authenticated
  using (true);
