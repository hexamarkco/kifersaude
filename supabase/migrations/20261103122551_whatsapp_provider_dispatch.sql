create table public.whatsapp_transport_state (
  singleton boolean primary key default true check (singleton),
  provider text not null default 'whapi' check (provider in ('whapi', 'zapi')),
  instance_id text,
  revision integer not null default 0,
  changed_at timestamptz not null default now()
);
insert into public.whatsapp_transport_state default values;

create table public.whatsapp_transport_attempts (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('whapi', 'zapi')),
  operation_key text unique,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  uncertain boolean not null default false,
  result jsonb
);

create index whatsapp_transport_open_attempts
  on public.whatsapp_transport_attempts (started_at) where finished_at is null;

create table public.whatsapp_transport_switches (
  revision integer primary key,
  previous_provider text not null,
  provider text not null,
  actor_id uuid not null,
  phone text not null,
  instance_id text,
  transfer_pending boolean not null default false,
  changed_at timestamptz not null default now()
);

create table public.whatsapp_transport_diagnostics (
  provider text primary key check (provider in ('whapi', 'zapi')),
  instance_id text,
  last_webhook_at timestamptz,
  last_inbound_at timestamptz,
  checked_at timestamptz,
  phone text,
  connected boolean,
  error text
);

create table public.whatsapp_transport_identity_review (
  external_message_id text primary key,
  channel_id uuid not null references public.comm_whatsapp_channels(id),
  phone text,
  lid text,
  occurred_at timestamptz not null,
  reason text not null check (reason in ('unverified_identity', 'identity_conflict'))
);

alter table public.whatsapp_transport_state enable row level security;
alter table public.whatsapp_transport_attempts enable row level security;
alter table public.whatsapp_transport_switches enable row level security;
alter table public.whatsapp_transport_diagnostics enable row level security;
alter table public.whatsapp_transport_identity_review enable row level security;
revoke all on public.whatsapp_transport_state, public.whatsapp_transport_attempts,
  public.whatsapp_transport_switches, public.whatsapp_transport_diagnostics,
  public.whatsapp_transport_identity_review from public, anon, authenticated;
grant select, insert, update on public.whatsapp_transport_state, public.whatsapp_transport_attempts,
  public.whatsapp_transport_switches, public.whatsapp_transport_diagnostics,
  public.whatsapp_transport_identity_review to service_role;
grant delete on public.whatsapp_transport_attempts to service_role;

create function public.whatsapp_transport_begin(
  p_revision integer, p_provider text, p_operation_key text default null
) returns jsonb language plpgsql set search_path = '' as $$
declare
  current_state public.whatsapp_transport_state;
  attempt public.whatsapp_transport_attempts;
begin
  select * into strict current_state from public.whatsapp_transport_state where singleton for update;
  if current_state.revision <> p_revision or current_state.provider <> p_provider then
    return jsonb_build_object('state', 'changed');
  end if;
  if p_operation_key is not null then
    select * into attempt from public.whatsapp_transport_attempts where operation_key = p_operation_key;
    if found then
      if attempt.provider <> p_provider or attempt.result is null then
        return jsonb_build_object('state', 'uncertain');
      end if;
      return jsonb_build_object('state', 'recorded', 'result', attempt.result);
    end if;
  end if;
  insert into public.whatsapp_transport_attempts (provider, operation_key)
    values (p_provider, p_operation_key) returning * into attempt;
  return jsonb_build_object('state', 'started', 'id', attempt.id);
end;
$$;

create function public.whatsapp_transport_switch(
  p_revision integer, p_provider text, p_actor_id uuid, p_phone text,
  p_instance_id text default null, p_transfer_pending boolean default false
) returns integer language plpgsql set search_path = '' as $$
declare
  current_state public.whatsapp_transport_state;
begin
  select * into strict current_state from public.whatsapp_transport_state where singleton for update;
  if current_state.revision <> p_revision then
    raise exception 'O provedor mudou. Atualize a tela e verifique novamente.';
  end if;
  if current_state.provider = p_provider then
    return current_state.revision;
  end if;
  if p_provider = 'zapi' and (p_instance_id is null or p_instance_id !~ '^[A-Za-z0-9_.-]{1,128}$') then
    raise exception 'A instância da Z-API precisa ser confirmada.';
  end if;
  lock table public.comm_whatsapp_send_requests, public.comm_whatsapp_campaigns,
    public.comm_whatsapp_campaign_step_dispatches, public.comm_whatsapp_scheduled_messages,
    public.comm_whatsapp_scheduled_sequences, public.comm_whatsapp_scheduled_sequence_steps, public.ai_autonomous_reply_jobs,
    public.auto_contact_flow_jobs in share mode nowait;
  if not exists (
    select 1 from public.comm_whatsapp_channels
    where slug = 'primary' and phone_number = p_phone
  ) then
    raise exception 'O número confirmado precisa ser o mesmo do canal principal.';
  end if;
  if exists (select 1 from public.whatsapp_transport_attempts where finished_at is null and not uncertain
        and started_at > now() - interval '5 minutes')
    or exists (select 1 from public.comm_whatsapp_send_requests where status = 'sending'
        and updated_at > now() - interval '5 minutes')
    or exists (select 1 from public.comm_whatsapp_campaign_step_dispatches where status = 'sending')
    or exists (select 1 from public.comm_whatsapp_scheduled_messages where status = 'sending')
    or exists (select 1 from public.comm_whatsapp_scheduled_sequence_steps where status = 'processing')
    or exists (select 1 from public.ai_autonomous_reply_jobs where status = 'processing')
    or exists (select 1 from public.auto_contact_flow_jobs where status = 'processing') then
    raise exception 'Há envios ou automações em andamento. Aguarde a conclusão da tentativa antes de trocar.';
  end if;
  if not p_transfer_pending and (
    exists (select 1 from public.whatsapp_transport_attempts where finished_at is null and (uncertain or operation_key is not null))
    or exists (select 1 from public.comm_whatsapp_send_requests where status = 'sending')
    or exists (select 1 from public.comm_whatsapp_campaigns where status in ('queued', 'scheduled', 'running', 'paused'))
    or exists (select 1 from public.comm_whatsapp_campaign_step_dispatches where status = 'uncertain')
    or exists (select 1 from public.comm_whatsapp_scheduled_messages where status = 'scheduled'
        or (status = 'failed' and next_retry_at is not null))
    or exists (select 1 from public.comm_whatsapp_scheduled_sequences where status in ('scheduled', 'running', 'paused'))
    or exists (select 1 from public.ai_autonomous_reply_jobs where status = 'pending')
    or exists (select 1 from public.auto_contact_flow_jobs where status in ('pending', 'scheduled'))) then
    raise exception 'Há envios, campanhas ou automações pendentes. Conclua ou revise as filas antes da troca.';
  end if;
  -- Preserve legacy reservations that may predate the dispatch ledger.
  insert into public.whatsapp_transport_attempts (provider, operation_key, uncertain)
    select current_state.provider, 'inbox:' || channel_id || ':' || client_request_id, true
    from public.comm_whatsapp_send_requests where status = 'sending'
    on conflict (operation_key) do nothing;
  update public.whatsapp_transport_state
    set provider = p_provider, instance_id = p_instance_id, revision = current_state.revision + 1, changed_at = now()
    where singleton;
  insert into public.whatsapp_transport_switches (revision, previous_provider, provider, actor_id, phone, instance_id, transfer_pending)
    values (current_state.revision + 1, current_state.provider, p_provider, p_actor_id, p_phone, p_instance_id, p_transfer_pending);
  return current_state.revision + 1;
end;
$$;

revoke execute on function public.whatsapp_transport_begin(integer, text, text),
  public.whatsapp_transport_switch(integer, text, uuid, text, text, boolean) from public, anon, authenticated;
grant execute on function public.whatsapp_transport_begin(integer, text, text),
  public.whatsapp_transport_switch(integer, text, uuid, text, text, boolean) to service_role;
