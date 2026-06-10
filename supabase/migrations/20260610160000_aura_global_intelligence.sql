-- Aura Global Intelligence — estratégias internacionais por mercado

create table if not exists public.global_markets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  country text not null,
  language text not null,
  currency text not null default 'BRL'
    check (currency in ('BRL', 'USD', 'EUR', 'GBP', 'CAD')),
  product_type text not null default 'curso'
    check (product_type in ('curso', 'ebook', 'mentoria', 'software', 'afiliado', 'servico', 'outro')),
  objective text not null default 'proprio'
    check (objective in ('proprio', 'afiliado')),
  product_name text,
  creator_product_id uuid references public.creator_products (id) on delete set null,
  status text not null default 'active'
    check (status in ('active', 'paused', 'archived')),
  global_score integer,
  score_financial integer,
  score_competition integer,
  score_entry_ease integer,
  score_skills_alignment integer,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists global_markets_user_idx
  on public.global_markets (user_id, created_at desc);

create index if not exists global_markets_status_idx
  on public.global_markets (user_id, status);

create table if not exists public.global_strategies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  market_id uuid not null references public.global_markets (id) on delete cascade,
  suggested_price numeric(12, 2),
  currency text not null default 'BRL'
    check (currency in ('BRL', 'USD', 'EUR', 'GBP', 'CAD')),
  audience text,
  channels jsonb not null default '[]'::jsonb,
  difficulty text not null default 'media'
    check (difficulty in ('baixa', 'media', 'alta')),
  profit_potential text not null default 'medio'
    check (profit_potential in ('baixo', 'medio', 'alto')),
  profit_potential_score integer,
  ai_summary text,
  raw_analysis jsonb not null default '{}'::jsonb,
  status text not null default 'active'
    check (status in ('draft', 'active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists global_strategies_user_idx
  on public.global_strategies (user_id, created_at desc);

create index if not exists global_strategies_market_idx
  on public.global_strategies (market_id, created_at desc);

create table if not exists public.global_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  market_id uuid references public.global_markets (id) on delete set null,
  strategy_id uuid references public.global_strategies (id) on delete set null,
  currency text not null default 'BRL'
    check (currency in ('BRL', 'USD', 'EUR', 'GBP', 'CAD')),
  revenue_amount numeric(12, 2) not null default 0,
  revenue_converted_brl numeric(12, 2) not null default 0,
  product_name text,
  period_start date,
  period_end date,
  source text not null default 'manual'
    check (source in ('manual', 'platform_hub', 'creator', 'money_missions')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists global_results_user_idx
  on public.global_results (user_id, created_at desc);

create index if not exists global_results_market_idx
  on public.global_results (market_id, created_at desc);

-- RLS
alter table public.global_markets enable row level security;
alter table public.global_strategies enable row level security;
alter table public.global_results enable row level security;

create policy global_markets_select_own on public.global_markets
  for select using (auth.uid() = user_id);

create policy global_markets_insert_own on public.global_markets
  for insert with check (auth.uid() = user_id);

create policy global_markets_update_own on public.global_markets
  for update using (auth.uid() = user_id);

create policy global_markets_delete_own on public.global_markets
  for delete using (auth.uid() = user_id);

create policy global_strategies_select_own on public.global_strategies
  for select using (auth.uid() = user_id);

create policy global_strategies_insert_own on public.global_strategies
  for insert with check (auth.uid() = user_id);

create policy global_strategies_update_own on public.global_strategies
  for update using (auth.uid() = user_id);

create policy global_strategies_delete_own on public.global_strategies
  for delete using (auth.uid() = user_id);

create policy global_results_select_own on public.global_results
  for select using (auth.uid() = user_id);

create policy global_results_insert_own on public.global_results
  for insert with check (auth.uid() = user_id);

create policy global_results_update_own on public.global_results
  for update using (auth.uid() = user_id);

create policy global_results_delete_own on public.global_results
  for delete using (auth.uid() = user_id);

drop trigger if exists global_markets_updated_at on public.global_markets;
create trigger global_markets_updated_at
  before update on public.global_markets
  for each row execute function public.set_updated_at();

drop trigger if exists global_strategies_updated_at on public.global_strategies;
create trigger global_strategies_updated_at
  before update on public.global_strategies
  for each row execute function public.set_updated_at();

drop trigger if exists global_results_updated_at on public.global_results;
create trigger global_results_updated_at
  before update on public.global_results
  for each row execute function public.set_updated_at();
