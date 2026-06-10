-- Aura Knowledge & Connect — base de conhecimento, padrões e aprendizado global

create table if not exists public.knowledge_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  entry_type text not null
    check (entry_type in (
      'campaign', 'product', 'copy', 'audience', 'market', 'success', 'failure'
    )),
  category text not null default 'winner'
    check (category in ('winner', 'loser', 'neutral')),
  connector text not null default 'manual'
    check (connector in (
      'platform_hub', 'meta_business', 'kiwify', 'hotmart', 'eduzz', 'monetizze',
      'google_analytics', 'google_ads', 'stripe', 'paypal',
      'global', 'creator', 'manual'
    )),
  title text not null,
  description text,
  country text,
  currency text default 'BRL'
    check (currency in ('BRL', 'USD', 'EUR', 'GBP', 'CAD')),
  performance_score integer,
  metrics jsonb not null default '{}'::jsonb,
  source_ref text,
  status text not null default 'active'
    check (status in ('active', 'archived')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists knowledge_entries_user_idx
  on public.knowledge_entries (user_id, created_at desc);

create index if not exists knowledge_entries_type_idx
  on public.knowledge_entries (user_id, entry_type, category);

create index if not exists knowledge_entries_connector_idx
  on public.knowledge_entries (user_id, connector);

create table if not exists public.knowledge_insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  insight_type text not null
    check (insight_type in ('opportunity', 'risk', 'trend', 'emerging_market')),
  title text not null,
  summary text not null,
  priority text not null default 'medium'
    check (priority in ('low', 'medium', 'high')),
  status text not null default 'active'
    check (status in ('active', 'dismissed', 'archived')),
  related_entry_ids jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists knowledge_insights_user_idx
  on public.knowledge_insights (user_id, created_at desc);

create index if not exists knowledge_insights_type_idx
  on public.knowledge_insights (user_id, insight_type, status);

create table if not exists public.knowledge_patterns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  pattern_type text not null
    check (pattern_type in (
      'what_worked', 'what_failed', 'best_country', 'best_currency',
      'best_campaign', 'best_market'
    )),
  label text not null,
  description text,
  country text,
  currency text
    check (currency is null or currency in ('BRL', 'USD', 'EUR', 'GBP', 'CAD')),
  confidence_score integer not null default 50,
  evidence_count integer not null default 1,
  metrics jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists knowledge_patterns_user_idx
  on public.knowledge_patterns (user_id, created_at desc);

create index if not exists knowledge_patterns_type_idx
  on public.knowledge_patterns (user_id, pattern_type);

create table if not exists public.market_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  country text not null,
  currency text not null default 'BRL'
    check (currency in ('BRL', 'USD', 'EUR', 'GBP', 'CAD')),
  market_label text,
  period_start date,
  period_end date,
  sales_amount numeric(12, 2) not null default 0,
  sales_count integer not null default 0,
  roas numeric(8, 4),
  ctr numeric(8, 4),
  conversion_rate numeric(8, 4),
  connector text not null default 'manual'
    check (connector in (
      'platform_hub', 'meta_business', 'kiwify', 'hotmart', 'eduzz', 'monetizze',
      'google_analytics', 'google_ads', 'stripe', 'paypal',
      'global', 'creator', 'manual'
    )),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists market_history_user_idx
  on public.market_history (user_id, created_at desc);

create index if not exists market_history_country_idx
  on public.market_history (user_id, country, currency);

-- RLS
alter table public.knowledge_entries enable row level security;
alter table public.knowledge_insights enable row level security;
alter table public.knowledge_patterns enable row level security;
alter table public.market_history enable row level security;

create policy knowledge_entries_select_own on public.knowledge_entries
  for select using (auth.uid() = user_id);

create policy knowledge_entries_insert_own on public.knowledge_entries
  for insert with check (auth.uid() = user_id);

create policy knowledge_entries_update_own on public.knowledge_entries
  for update using (auth.uid() = user_id);

create policy knowledge_entries_delete_own on public.knowledge_entries
  for delete using (auth.uid() = user_id);

create policy knowledge_insights_select_own on public.knowledge_insights
  for select using (auth.uid() = user_id);

create policy knowledge_insights_insert_own on public.knowledge_insights
  for insert with check (auth.uid() = user_id);

create policy knowledge_insights_update_own on public.knowledge_insights
  for update using (auth.uid() = user_id);

create policy knowledge_insights_delete_own on public.knowledge_insights
  for delete using (auth.uid() = user_id);

create policy knowledge_patterns_select_own on public.knowledge_patterns
  for select using (auth.uid() = user_id);

create policy knowledge_patterns_insert_own on public.knowledge_patterns
  for insert with check (auth.uid() = user_id);

create policy knowledge_patterns_update_own on public.knowledge_patterns
  for update using (auth.uid() = user_id);

create policy knowledge_patterns_delete_own on public.knowledge_patterns
  for delete using (auth.uid() = user_id);

create policy market_history_select_own on public.market_history
  for select using (auth.uid() = user_id);

create policy market_history_insert_own on public.market_history
  for insert with check (auth.uid() = user_id);

create policy market_history_update_own on public.market_history
  for update using (auth.uid() = user_id);

create policy market_history_delete_own on public.market_history
  for delete using (auth.uid() = user_id);

drop trigger if exists knowledge_entries_updated_at on public.knowledge_entries;
create trigger knowledge_entries_updated_at
  before update on public.knowledge_entries
  for each row execute function public.set_updated_at();

drop trigger if exists knowledge_insights_updated_at on public.knowledge_insights;
create trigger knowledge_insights_updated_at
  before update on public.knowledge_insights
  for each row execute function public.set_updated_at();

drop trigger if exists knowledge_patterns_updated_at on public.knowledge_patterns;
create trigger knowledge_patterns_updated_at
  before update on public.knowledge_patterns
  for each row execute function public.set_updated_at();

drop trigger if exists market_history_updated_at on public.market_history;
create trigger market_history_updated_at
  before update on public.market_history
  for each row execute function public.set_updated_at();
