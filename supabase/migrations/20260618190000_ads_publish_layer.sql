-- Ads Commander Publish Layer — conexões de plataforma e publicação real (fase 1: Meta)

create table if not exists public.ad_platform_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  platform text not null
    check (platform in ('meta', 'google', 'tiktok')),
  meta_connection_id uuid references public.meta_connections (id) on delete set null,
  platform_connection_id uuid references public.platform_connections (id) on delete set null,
  external_account_id text not null,
  account_label text,
  status text not null default 'connected'
    check (status in ('connected', 'disconnected', 'error')),
  is_default boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  last_sync_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, platform, external_account_id)
);

create index if not exists ad_platform_connections_user_platform_idx
  on public.ad_platform_connections (user_id, platform, is_default desc, created_at desc);

alter table public.ad_campaigns
  add column if not exists platform_connection_id uuid
    references public.ad_platform_connections (id) on delete set null,
  add column if not exists external_campaign_id text,
  add column if not exists published_at timestamptz,
  add column if not exists publish_status text not null default 'not_published'
    check (publish_status in ('not_published', 'publishing', 'published', 'failed'));

create index if not exists ad_campaigns_publish_status_idx
  on public.ad_campaigns (user_id, publish_status, created_at desc);

alter table public.ad_campaigns drop constraint if exists ad_campaigns_status_check;
alter table public.ad_campaigns add constraint ad_campaigns_status_check
  check (status in (
    'draft',
    'pending_approval',
    'ready_to_publish',
    'publishing',
    'published',
    'publish_failed',
    'cancelled'
  ));

alter table public.ad_platform_connections enable row level security;

do $$
begin
  execute 'drop policy if exists ad_platform_connections_select_own on public.ad_platform_connections';
  execute 'drop policy if exists ad_platform_connections_insert_own on public.ad_platform_connections';
  execute 'drop policy if exists ad_platform_connections_update_own on public.ad_platform_connections';
  execute 'drop policy if exists ad_platform_connections_delete_own on public.ad_platform_connections';

  execute 'create policy ad_platform_connections_select_own on public.ad_platform_connections for select using (auth.uid() = user_id)';
  execute 'create policy ad_platform_connections_insert_own on public.ad_platform_connections for insert with check (auth.uid() = user_id)';
  execute 'create policy ad_platform_connections_update_own on public.ad_platform_connections for update using (auth.uid() = user_id)';
  execute 'create policy ad_platform_connections_delete_own on public.ad_platform_connections for delete using (auth.uid() = user_id)';
end $$;

drop trigger if exists ad_platform_connections_updated_at on public.ad_platform_connections;
create trigger ad_platform_connections_updated_at
  before update on public.ad_platform_connections
  for each row execute function public.set_updated_at();

notify pgrst, 'reload schema';
