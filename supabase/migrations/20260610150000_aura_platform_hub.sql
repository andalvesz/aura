-- Aura Platform Hub — integrações com plataformas de vendas, afiliados e marketing

create table if not exists public.platform_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  platform text not null
    check (platform in (
      'kiwify', 'hotmart', 'eduzz', 'monetizze',
      'meta_business', 'google_ads', 'tiktok_ads', 'stripe', 'paypal'
    )),
  auth_type text not null default 'api_key'
    check (auth_type in ('api_key', 'token', 'oauth')),
  status text not null default 'disconnected'
    check (status in ('connected', 'disconnected', 'error')),
  account_label text,
  external_account_id text,
  credentials_encrypted text not null,
  metadata jsonb not null default '{}'::jsonb,
  last_sync_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, platform)
);

create index if not exists platform_connections_user_idx
  on public.platform_connections (user_id, created_at desc);

create index if not exists platform_connections_status_idx
  on public.platform_connections (user_id, status);

create table if not exists public.platform_sync_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  connection_id uuid not null references public.platform_connections (id) on delete cascade,
  platform text not null,
  sync_type text not null default 'full'
    check (sync_type in ('full', 'products', 'sales', 'commissions', 'affiliates', 'metrics')),
  status text not null default 'pending'
    check (status in ('pending', 'running', 'success', 'error')),
  records_synced integer not null default 0,
  payload_summary jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists platform_sync_logs_user_idx
  on public.platform_sync_logs (user_id, created_at desc);

create index if not exists platform_sync_logs_connection_idx
  on public.platform_sync_logs (connection_id, created_at desc);

create table if not exists public.affiliate_products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  connection_id uuid references public.platform_connections (id) on delete set null,
  platform text not null,
  external_product_id text not null,
  name text not null,
  price_cents integer,
  commission_cents integer,
  commission_pct numeric(5, 2),
  currency text not null default 'BRL',
  status text not null default 'active',
  affiliate_enabled boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, platform, external_product_id)
);

create index if not exists affiliate_products_user_idx
  on public.affiliate_products (user_id, created_at desc);

create index if not exists affiliate_products_platform_idx
  on public.affiliate_products (user_id, platform);

create table if not exists public.affiliate_analysis (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  platform text,
  affiliate_product_id uuid references public.affiliate_products (id) on delete set null,
  analysis_type text not null default 'affiliate_score'
    check (analysis_type in ('affiliate_score', 'product_ranking', 'import_summary')),
  ai_score integer,
  ticket_medio numeric(12, 2),
  potencial_venda numeric(12, 2),
  concorrencia text,
  legado_compat text,
  summary text,
  insights jsonb not null default '[]'::jsonb,
  raw_input jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists affiliate_analysis_user_idx
  on public.affiliate_analysis (user_id, created_at desc);

-- RLS
alter table public.platform_connections enable row level security;
alter table public.platform_sync_logs enable row level security;
alter table public.affiliate_products enable row level security;
alter table public.affiliate_analysis enable row level security;

create policy platform_connections_select_own on public.platform_connections
  for select using (auth.uid() = user_id);

create policy platform_connections_insert_own on public.platform_connections
  for insert with check (auth.uid() = user_id);

create policy platform_connections_update_own on public.platform_connections
  for update using (auth.uid() = user_id);

create policy platform_connections_delete_own on public.platform_connections
  for delete using (auth.uid() = user_id);

create policy platform_sync_logs_select_own on public.platform_sync_logs
  for select using (auth.uid() = user_id);

create policy platform_sync_logs_insert_own on public.platform_sync_logs
  for insert with check (auth.uid() = user_id);

create policy platform_sync_logs_update_own on public.platform_sync_logs
  for update using (auth.uid() = user_id);

create policy platform_sync_logs_delete_own on public.platform_sync_logs
  for delete using (auth.uid() = user_id);

create policy affiliate_products_select_own on public.affiliate_products
  for select using (auth.uid() = user_id);

create policy affiliate_products_insert_own on public.affiliate_products
  for insert with check (auth.uid() = user_id);

create policy affiliate_products_update_own on public.affiliate_products
  for update using (auth.uid() = user_id);

create policy affiliate_products_delete_own on public.affiliate_products
  for delete using (auth.uid() = user_id);

create policy affiliate_analysis_select_own on public.affiliate_analysis
  for select using (auth.uid() = user_id);

create policy affiliate_analysis_insert_own on public.affiliate_analysis
  for insert with check (auth.uid() = user_id);

create policy affiliate_analysis_update_own on public.affiliate_analysis
  for update using (auth.uid() = user_id);

create policy affiliate_analysis_delete_own on public.affiliate_analysis
  for delete using (auth.uid() = user_id);

drop trigger if exists platform_connections_updated_at on public.platform_connections;
create trigger platform_connections_updated_at
  before update on public.platform_connections
  for each row execute function public.set_updated_at();

drop trigger if exists affiliate_products_updated_at on public.affiliate_products;
create trigger affiliate_products_updated_at
  before update on public.affiliate_products
  for each row execute function public.set_updated_at();

drop trigger if exists affiliate_analysis_updated_at on public.affiliate_analysis;
create trigger affiliate_analysis_updated_at
  before update on public.affiliate_analysis
  for each row execute function public.set_updated_at();
