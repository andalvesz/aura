-- Ads Commander V1 — preparação de campanhas multi-plataforma (nunca publica automaticamente)

create table if not exists public.ad_campaigns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  operation_id uuid references public.operation_center (id) on delete set null,
  platform text not null
    check (platform in ('meta', 'google', 'tiktok', 'other')),
  campaign_name text not null,
  objective text,
  budget numeric(12, 2),
  country text,
  language text,
  audience jsonb not null default '{}'::jsonb,
  creatives_json jsonb not null default '[]'::jsonb,
  copy_json jsonb not null default '{}'::jsonb,
  landing_id uuid references public.landing_pages (id) on delete set null,
  status text not null default 'draft'
    check (status in ('draft', 'pending_approval', 'ready_to_publish', 'cancelled')),
  approval_required boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ad_campaigns_user_idx
  on public.ad_campaigns (user_id, created_at desc);

create index if not exists ad_campaigns_operation_idx
  on public.ad_campaigns (user_id, operation_id, created_at desc)
  where operation_id is not null;

create index if not exists ad_campaigns_status_idx
  on public.ad_campaigns (user_id, status, created_at desc);

create table if not exists public.ad_sets (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.ad_campaigns (id) on delete cascade,
  audience jsonb not null default '{}'::jsonb,
  placements jsonb not null default '[]'::jsonb,
  budget numeric(12, 2),
  status text not null default 'draft'
    check (status in ('draft', 'ready')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ad_sets_campaign_idx
  on public.ad_sets (campaign_id, created_at desc);

create table if not exists public.ad_creatives (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.ad_campaigns (id) on delete cascade,
  creative_asset_id uuid references public.creative_assets (id) on delete set null,
  headline text,
  primary_text text,
  description text,
  cta text,
  status text not null default 'draft'
    check (status in ('draft', 'ready')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ad_creatives_campaign_idx
  on public.ad_creatives (campaign_id, created_at desc);

alter table public.ad_campaigns enable row level security;
alter table public.ad_sets enable row level security;
alter table public.ad_creatives enable row level security;

do $$
begin
  execute 'drop policy if exists ad_campaigns_select_own on public.ad_campaigns';
  execute 'drop policy if exists ad_campaigns_insert_own on public.ad_campaigns';
  execute 'drop policy if exists ad_campaigns_update_own on public.ad_campaigns';
  execute 'drop policy if exists ad_campaigns_delete_own on public.ad_campaigns';

  execute 'create policy ad_campaigns_select_own on public.ad_campaigns for select using (auth.uid() = user_id)';
  execute 'create policy ad_campaigns_insert_own on public.ad_campaigns for insert with check (auth.uid() = user_id)';
  execute 'create policy ad_campaigns_update_own on public.ad_campaigns for update using (auth.uid() = user_id)';
  execute 'create policy ad_campaigns_delete_own on public.ad_campaigns for delete using (auth.uid() = user_id)';

  execute 'drop policy if exists ad_sets_select_own on public.ad_sets';
  execute 'drop policy if exists ad_sets_insert_own on public.ad_sets';
  execute 'drop policy if exists ad_sets_update_own on public.ad_sets';
  execute 'drop policy if exists ad_sets_delete_own on public.ad_sets';

  execute 'create policy ad_sets_select_own on public.ad_sets for select using (
    exists (select 1 from public.ad_campaigns c where c.id = campaign_id and c.user_id = auth.uid())
  )';
  execute 'create policy ad_sets_insert_own on public.ad_sets for insert with check (
    exists (select 1 from public.ad_campaigns c where c.id = campaign_id and c.user_id = auth.uid())
  )';
  execute 'create policy ad_sets_update_own on public.ad_sets for update using (
    exists (select 1 from public.ad_campaigns c where c.id = campaign_id and c.user_id = auth.uid())
  )';
  execute 'create policy ad_sets_delete_own on public.ad_sets for delete using (
    exists (select 1 from public.ad_campaigns c where c.id = campaign_id and c.user_id = auth.uid())
  )';

  execute 'drop policy if exists ad_creatives_select_own on public.ad_creatives';
  execute 'drop policy if exists ad_creatives_insert_own on public.ad_creatives';
  execute 'drop policy if exists ad_creatives_update_own on public.ad_creatives';
  execute 'drop policy if exists ad_creatives_delete_own on public.ad_creatives';

  execute 'create policy ad_creatives_select_own on public.ad_creatives for select using (
    exists (select 1 from public.ad_campaigns c where c.id = campaign_id and c.user_id = auth.uid())
  )';
  execute 'create policy ad_creatives_insert_own on public.ad_creatives for insert with check (
    exists (select 1 from public.ad_campaigns c where c.id = campaign_id and c.user_id = auth.uid())
  )';
  execute 'create policy ad_creatives_update_own on public.ad_creatives for update using (
    exists (select 1 from public.ad_campaigns c where c.id = campaign_id and c.user_id = auth.uid())
  )';
  execute 'create policy ad_creatives_delete_own on public.ad_creatives for delete using (
    exists (select 1 from public.ad_campaigns c where c.id = campaign_id and c.user_id = auth.uid())
  )';
end $$;

drop trigger if exists ad_campaigns_updated_at on public.ad_campaigns;
create trigger ad_campaigns_updated_at
  before update on public.ad_campaigns
  for each row execute function public.set_updated_at();

notify pgrst, 'reload schema';
