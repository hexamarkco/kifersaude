alter table if exists public.reminders
  add column if not exists push_notified_at timestamptz;

alter table if exists public.leads
  add column if not exists push_notified_at timestamptz;

create table if not exists public.web_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  raw_subscription jsonb not null,
  expiration_time timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  last_success_at timestamptz,
  last_failure_at timestamptz,
  failure_reason text,
  is_revoked boolean not null default false,
  last_ack_at timestamptz
);

create or replace function public.set_web_push_subscription_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create trigger set_web_push_subscription_updated_at
before update on public.web_push_subscriptions
for each row
execute function public.set_web_push_subscription_updated_at();

alter table public.web_push_subscriptions enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'web_push_subscriptions'
      and policyname = 'Usuários gerenciam suas assinaturas'
  ) then
    create policy "Usuários gerenciam suas assinaturas" on public.web_push_subscriptions
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

comment on table public.web_push_subscriptions is 'Armazena subscriptions de Web Push (VAPID) para cada usuário autenticado.';

create or replace function public.dispatch_web_push_event(event_name text, payload jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_url text := current_setting('app.settings.push_notifications_function_url', true);
  response record;
  request_body text := jsonb_build_object('action', event_name, 'record', payload)::text;
begin
  if target_url is null or btrim(target_url) = '' then
    raise notice 'URL da função push-notifications não configurada (app.settings.push_notifications_function_url).';
    return;
  end if;

  select *
  into response
  from supabase_functions.http_request(
    target_url,
    'POST',
    jsonb_build_object('Content-Type', 'application/json'),
    request_body
  );

  if response.status >= 400 then
    raise warning 'push-notifications respondeu com status %: %', response.status, response.body;
  end if;
exception
  when others then
    raise warning 'Falha ao enviar evento de push (%): %', event_name, sqlerrm;
end;
$$;

create or replace function public.notify_web_push_lead()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.dispatch_web_push_event('lead.created', row_to_json(new)::jsonb);
  return new;
end;
$$;

create trigger tr_web_push_lead_insert
after insert on public.leads
for each row
execute function public.notify_web_push_lead();

create or replace function public.notify_web_push_reminder()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.lido then
    return new;
  end if;

  perform public.dispatch_web_push_event('reminder.due', row_to_json(new)::jsonb);
  return new;
end;
$$;

create trigger tr_web_push_reminder_due
after insert or update on public.reminders
for each row
when (new.lido = false and new.data_lembrete <= timezone('utc', now()))
execute function public.notify_web_push_reminder();
