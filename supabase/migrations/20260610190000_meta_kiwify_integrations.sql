-- Meta Ads Connect + Kiwify Connect + platform_results

-- Meta connections
create table if not exists public.meta_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  business_id text,
  business_name text,
  access_token_encrypted text not null,
  token_expires_at timestamptz,
  status text not null default 'disconnected'
    check (status in ('connected', 'disconnected', 'error')),
  scopes text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  last_sync_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create index if not exists meta_connections_user_idx
  on public.meta_connections (user_id);

-- Meta ad accounts
create table if not exists public.meta_ad_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  connection_id uuid not null references public.meta_connections (id) on delete cascade,
  external_account_id text not null,
  name text not null,
  currency text not null default 'USD',
  timezone text,
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, external_account_id)
);

create index if not exists meta_ad_accounts_user_idx
  on public.meta_ad_accounts (user_id, created_at desc);

-- Meta campaigns
create table if not exists public.meta_campaigns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  connection_id uuid not null references public.meta_connections (id) on delete cascade,
  ad_account_id uuid references public.meta_ad_accounts (id) on delete set null,
  external_campaign_id text,
  creator_campaign_id uuid,
  name text not null,
  status text not null default 'paused'
    check (status in ('draft', 'active', 'paused', 'archived', 'pending_review')),
  effective_status text,
  objective text,
  daily_budget_cents integer,
  currency text not null default 'USD',
  aura_created boolean not null default false,
  requires_approval boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists meta_campaigns_user_idx
  on public.meta_campaigns (user_id, created_at desc);

create index if not exists meta_campaigns_external_idx
  on public.meta_campaigns (user_id, external_campaign_id);

-- Meta campaign metrics
create table if not exists public.meta_campaign_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  campaign_id uuid not null references public.meta_campaigns (id) on delete cascade,
  ctr numeric(8, 4) not null default 0,
  cpa numeric(12, 2) not null default 0,
  roas numeric(8, 4) not null default 0,
  spend_cents integer not null default 0,
  impressions integer not null default 0,
  clicks integer not null default 0,
  conversions integer not null default 0,
  frequency numeric(8, 4) not null default 0,
  budget_spent_pct numeric(5, 2) not null default 0,
  metrics_date date not null default current_date,
  raw_metrics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (campaign_id, metrics_date)
);

create index if not exists meta_campaign_metrics_user_idx
  on public.meta_campaign_metrics (user_id, metrics_date desc);

-- Kiwify connections
create table if not exists public.kiwify_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id text not null,
  credentials_encrypted text not null,
  status text not null default 'disconnected'
    check (status in ('connected', 'disconnected', 'error')),
  account_label text,
  last_sync_at timestamptz,
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create index if not exists kiwify_connections_user_idx
  on public.kiwify_connections (user_id);

-- Kiwify products
create table if not exists public.kiwify_products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  connection_id uuid not null references public.kiwify_connections (id) on delete cascade,
  external_product_id text not null,
  name text not null,
  price_cents integer,
  currency text not null default 'BRL',
  status text not null default 'active',
  affiliate_enabled boolean not null default false,
  affiliate_score integer,
  metadata jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, external_product_id)
);

create index if not exists kiwify_products_user_idx
  on public.kiwify_products (user_id, created_at desc);

-- Kiwify sales
create table if not exists public.kiwify_sales (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  connection_id uuid not null references public.kiwify_connections (id) on delete cascade,
  external_sale_id text not null,
  product_id uuid references public.kiwify_products (id) on delete set null,
  external_product_id text,
  product_name text,
  status text not null default 'unknown',
  gross_cents integer not null default 0,
  net_cents integer not null default 0,
  commission_cents integer not null default 0,
  currency text not null default 'BRL',
  sold_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, external_sale_id)
);

create index if not exists kiwify_sales_user_idx
  on public.kiwify_sales (user_id, sold_at desc);

-- Kiwify commissions
create table if not exists public.kiwify_commissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  connection_id uuid not null references public.kiwify_connections (id) on delete cascade,
  sale_id uuid references public.kiwify_sales (id) on delete set null,
  external_commission_id text,
  product_name text,
  amount_cents integer not null default 0,
  currency text not null default 'BRL',
  status text not null default 'pending',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists kiwify_commissions_user_idx
  on public.kiwify_commissions (user_id, created_at desc);

-- Platform results (shared feed for Performance, Money, CEO)
create table if not exists public.platform_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  platform text not null check (platform in ('meta', 'kiwify', 'hotmart', 'eduzz', 'monetizze')),
  result_type text not null
    check (result_type in ('revenue', 'commission', 'campaign_metrics', 'affiliate_analysis', 'sync_summary')),
  title text not null,
  summary text,
  value_cents integer,
  currency text not null default 'BRL',
  metrics jsonb not null default '{}'::jsonb,
  source_id uuid,
  source_table text,
  routed_to jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists platform_results_user_idx
  on public.platform_results (user_id, created_at desc);

create index if not exists platform_results_platform_idx
  on public.platform_results (user_id, platform, created_at desc);

-- Integration action logs
create table if not exists public.integration_action_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  platform text not null check (platform in ('meta', 'kiwify')),
  action_type text not null,
  status text not null default 'success' check (status in ('success', 'error', 'pending_approval')),
  message text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists integration_action_logs_user_idx
  on public.integration_action_logs (user_id, created_at desc);

-- RLS
alter table public.meta_connections enable row level security;
alter table public.meta_ad_accounts enable row level security;
alter table public.meta_campaigns enable row level security;
alter table public.meta_campaign_metrics enable row level security;
alter table public.kiwify_connections enable row level security;
alter table public.kiwify_products enable row level security;
alter table public.kiwify_sales enable row level security;
alter table public.kiwify_commissions enable row level security;
alter table public.platform_results enable row level security;
alter table public.integration_action_logs enable row level security;

-- Policies helper pattern
do $$
declare
  t text;
begin
  for t in select unnest(array[
    'meta_connections', 'meta_ad_accounts', 'meta_campaigns', 'meta_campaign_metrics',
    'kiwify_connections', 'kiwify_products', 'kiwify_sales', 'kiwify_commissions',
    'platform_results', 'integration_action_logs'
  ]) loop
    execute format('drop policy if exists %I on public.%I', t || '_select_own', t);
    execute format('create policy %I on public.%I for select using (auth.uid() = user_id)', t || '_select_own', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert_own', t);
    execute format('create policy %I on public.%I for insert with check (auth.uid() = user_id)', t || '_insert_own', t);
    execute format('drop policy if exists %I on public.%I', t || '_update_own', t);
    execute format('create policy %I on public.%I for update using (auth.uid() = user_id)', t || '_update_own', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete_own', t);
    execute format('create policy %I on public.%I for delete using (auth.uid() = user_id)', t || '_delete_own', t);
  end loop;
end $$;

-- updated_at triggers
drop trigger if exists meta_connections_updated_at on public.meta_connections;
create trigger meta_connections_updated_at
  before update on public.meta_connections
  for each row execute function public.set_updated_at();

drop trigger if exists meta_ad_accounts_updated_at on public.meta_ad_accounts;
create trigger meta_ad_accounts_updated_at
  before update on public.meta_ad_accounts
  for each row execute function public.set_updated_at();

drop trigger if exists meta_campaigns_updated_at on public.meta_campaigns;
create trigger meta_campaigns_updated_at
  before update on public.meta_campaigns
  for each row execute function public.set_updated_at();

drop trigger if exists kiwify_connections_updated_at on public.kiwify_connections;
create trigger kiwify_connections_updated_at
  before update on public.kiwify_connections
  for each row execute function public.set_updated_at();

drop trigger if exists kiwify_products_updated_at on public.kiwify_products;
create trigger kiwify_products_updated_at
  before update on public.kiwify_products
  for each row execute function public.set_updated_at();

drop trigger if exists kiwify_commissions_updated_at on public.kiwify_commissions;
create trigger kiwify_commissions_updated_at
  before update on public.kiwify_commissions
  for each row execute function public.set_updated_at();
