-- Market Hunter V1 — descoberta automática de oportunidades de mercado

create table if not exists public.market_opportunities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  source_platform text,
  product_name text not null,
  niche text,
  country text,
  language text,
  currency text not null default 'BRL'
    check (currency in ('BRL', 'USD', 'EUR', 'GBP', 'CAD')),
  estimated_demand numeric(8, 2),
  estimated_competition numeric(8, 2),
  estimated_conversion numeric(8, 4),
  opportunity_score numeric(8, 2) not null default 0,
  recommendation text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists market_opportunities_user_idx
  on public.market_opportunities (user_id, created_at desc);

create index if not exists market_opportunities_score_idx
  on public.market_opportunities (user_id, opportunity_score desc);

create index if not exists market_opportunities_platform_idx
  on public.market_opportunities (user_id, source_platform, created_at desc);

create table if not exists public.market_watchlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  product_name text not null,
  source_platform text,
  score numeric(8, 2),
  status text not null default 'watching'
    check (status in ('watching', 'active', 'launched', 'archived')),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists market_watchlist_user_idx
  on public.market_watchlist (user_id, created_at desc);

create index if not exists market_watchlist_status_idx
  on public.market_watchlist (user_id, status);

alter table public.market_opportunities enable row level security;
alter table public.market_watchlist enable row level security;

do $$
begin
  execute 'drop policy if exists market_opportunities_select_own on public.market_opportunities';
  execute 'drop policy if exists market_opportunities_insert_own on public.market_opportunities';
  execute 'drop policy if exists market_opportunities_update_own on public.market_opportunities';
  execute 'drop policy if exists market_opportunities_delete_own on public.market_opportunities';

  execute 'create policy market_opportunities_select_own on public.market_opportunities for select using (auth.uid() = user_id)';
  execute 'create policy market_opportunities_insert_own on public.market_opportunities for insert with check (auth.uid() = user_id)';
  execute 'create policy market_opportunities_update_own on public.market_opportunities for update using (auth.uid() = user_id)';
  execute 'create policy market_opportunities_delete_own on public.market_opportunities for delete using (auth.uid() = user_id)';

  execute 'drop policy if exists market_watchlist_select_own on public.market_watchlist';
  execute 'drop policy if exists market_watchlist_insert_own on public.market_watchlist';
  execute 'drop policy if exists market_watchlist_update_own on public.market_watchlist';
  execute 'drop policy if exists market_watchlist_delete_own on public.market_watchlist';

  execute 'create policy market_watchlist_select_own on public.market_watchlist for select using (auth.uid() = user_id)';
  execute 'create policy market_watchlist_insert_own on public.market_watchlist for insert with check (auth.uid() = user_id)';
  execute 'create policy market_watchlist_update_own on public.market_watchlist for update using (auth.uid() = user_id)';
  execute 'create policy market_watchlist_delete_own on public.market_watchlist for delete using (auth.uid() = user_id)';
end $$;
