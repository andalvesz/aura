-- Aura Integration Center — unified connections, sync logs and events

create table if not exists public.integration_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  platform text not null
    check (platform in (
      'meta', 'kiwify', 'hotmart', 'eduzz', 'monetizze',
      'google_ads', 'google_analytics', 'stripe', 'paypal'
    )),
  status text not null default 'disconnected'
    check (status in ('connected', 'disconnected', 'error', 'coming_soon')),
  account_label text,
  stats jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  last_sync_at timestamptz,
  next_sync_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, platform)
);

create index if not exists integration_connections_user_idx
  on public.integration_connections (user_id, updated_at desc);

create table if not exists public.integration_sync_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  platform text not null
    check (platform in (
      'meta', 'kiwify', 'hotmart', 'eduzz', 'monetizze',
      'google_ads', 'google_analytics', 'stripe', 'paypal', 'all'
    )),
  status text not null default 'success'
    check (status in ('success', 'partial', 'error')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  records_synced integer not null default 0,
  message text not null default '',
  errors jsonb not null default '[]'::jsonb,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists integration_sync_logs_user_idx
  on public.integration_sync_logs (user_id, created_at desc);

create table if not exists public.integration_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  platform text not null
    check (platform in (
      'meta', 'kiwify', 'hotmart', 'eduzz', 'monetizze',
      'google_ads', 'google_analytics', 'stripe', 'paypal', 'all'
    )),
  event_type text not null
    check (event_type in ('connection', 'sync', 'failure', 'auto_action')),
  status text not null default 'info'
    check (status in ('success', 'error', 'info')),
  title text not null,
  message text not null default '',
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists integration_events_user_idx
  on public.integration_events (user_id, created_at desc);

alter table public.integration_connections enable row level security;
alter table public.integration_sync_logs enable row level security;
alter table public.integration_events enable row level security;

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'integration_connections',
    'integration_sync_logs',
    'integration_events'
  ]
  loop
    execute format('drop policy if exists %I_select_own on public.%I', tbl, tbl);
    execute format('drop policy if exists %I_insert_own on public.%I', tbl, tbl);
    execute format('drop policy if exists %I_update_own on public.%I', tbl, tbl);
    execute format('drop policy if exists %I_delete_own on public.%I', tbl, tbl);

    execute format(
      'create policy %I_select_own on public.%I for select using (auth.uid() = user_id)',
      tbl, tbl
    );
    execute format(
      'create policy %I_insert_own on public.%I for insert with check (auth.uid() = user_id)',
      tbl, tbl
    );
    execute format(
      'create policy %I_update_own on public.%I for update using (auth.uid() = user_id)',
      tbl, tbl
    );
    execute format(
      'create policy %I_delete_own on public.%I for delete using (auth.uid() = user_id)',
      tbl, tbl
    );
  end loop;
end $$;

drop trigger if exists integration_connections_updated_at on public.integration_connections;
create trigger integration_connections_updated_at
  before update on public.integration_connections
  for each row execute function public.set_updated_at();
