-- Revenue AI V1 — centro de inteligência financeira e comercial

create table if not exists public.revenue_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  operation_id uuid references public.operation_center (id) on delete set null,
  product_id uuid references public.creator_products (id) on delete set null,
  platform text,
  country text,
  currency text not null default 'BRL'
    check (currency in ('BRL', 'USD', 'EUR', 'GBP', 'CAD')),
  revenue numeric(12, 2) not null default 0,
  spend numeric(12, 2) not null default 0,
  profit numeric(12, 2) not null default 0,
  roas numeric(8, 4),
  roi numeric(8, 4),
  conversions integer not null default 0,
  clicks integer not null default 0,
  ctr numeric(8, 4),
  cpc numeric(12, 4),
  cpa numeric(12, 4),
  date date not null default current_date,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists revenue_metrics_user_date_idx
  on public.revenue_metrics (user_id, date desc);

create index if not exists revenue_metrics_user_platform_idx
  on public.revenue_metrics (user_id, platform, date desc);

create index if not exists revenue_metrics_user_country_idx
  on public.revenue_metrics (user_id, country, date desc);

create index if not exists revenue_metrics_user_product_idx
  on public.revenue_metrics (user_id, product_id, date desc);

create table if not exists public.revenue_forecasts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  forecast_type text not null default 'revenue'
    check (forecast_type in ('revenue', 'profit', 'growth', 'scale')),
  period text not null default 'monthly'
    check (period in ('weekly', 'monthly', 'quarterly')),
  predicted_revenue numeric(12, 2) not null default 0,
  predicted_profit numeric(12, 2) not null default 0,
  confidence numeric(5, 2) not null default 50,
  recommendation text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists revenue_forecasts_user_idx
  on public.revenue_forecasts (user_id, created_at desc);

create index if not exists revenue_forecasts_type_idx
  on public.revenue_forecasts (user_id, forecast_type, period);

alter table public.revenue_metrics enable row level security;
alter table public.revenue_forecasts enable row level security;

do $$
begin
  execute 'drop policy if exists revenue_metrics_select_own on public.revenue_metrics';
  execute 'drop policy if exists revenue_metrics_insert_own on public.revenue_metrics';
  execute 'drop policy if exists revenue_metrics_update_own on public.revenue_metrics';
  execute 'drop policy if exists revenue_metrics_delete_own on public.revenue_metrics';

  execute 'create policy revenue_metrics_select_own on public.revenue_metrics for select using (auth.uid() = user_id)';
  execute 'create policy revenue_metrics_insert_own on public.revenue_metrics for insert with check (auth.uid() = user_id)';
  execute 'create policy revenue_metrics_update_own on public.revenue_metrics for update using (auth.uid() = user_id)';
  execute 'create policy revenue_metrics_delete_own on public.revenue_metrics for delete using (auth.uid() = user_id)';

  execute 'drop policy if exists revenue_forecasts_select_own on public.revenue_forecasts';
  execute 'drop policy if exists revenue_forecasts_insert_own on public.revenue_forecasts';
  execute 'drop policy if exists revenue_forecasts_update_own on public.revenue_forecasts';
  execute 'drop policy if exists revenue_forecasts_delete_own on public.revenue_forecasts';

  execute 'create policy revenue_forecasts_select_own on public.revenue_forecasts for select using (auth.uid() = user_id)';
  execute 'create policy revenue_forecasts_insert_own on public.revenue_forecasts for insert with check (auth.uid() = user_id)';
  execute 'create policy revenue_forecasts_update_own on public.revenue_forecasts for update using (auth.uid() = user_id)';
  execute 'create policy revenue_forecasts_delete_own on public.revenue_forecasts for delete using (auth.uid() = user_id)';
end $$;
