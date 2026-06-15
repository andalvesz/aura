-- Meta Intelligence: aggregated metrics, insights and autopilot recommendations

create table if not exists public.meta_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  entity_type text not null
    check (entity_type in ('account', 'campaign', 'adset', 'ad', 'audience', 'pixel')),
  entity_id text not null,
  entity_name text,
  campaign_id uuid references public.meta_campaigns (id) on delete set null,
  metrics_date date not null default current_date,
  ctr numeric(8, 4) not null default 0,
  cpc numeric(12, 2) not null default 0,
  cpm numeric(12, 2) not null default 0,
  cpa numeric(12, 2) not null default 0,
  roas numeric(8, 4) not null default 0,
  frequency numeric(8, 4) not null default 0,
  daily_spend_cents integer not null default 0,
  conversions integer not null default 0,
  impressions integer not null default 0,
  clicks integer not null default 0,
  spend_cents integer not null default 0,
  raw_metrics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, entity_type, entity_id, metrics_date)
);

create index if not exists meta_metrics_user_idx
  on public.meta_metrics (user_id, metrics_date desc);

create index if not exists meta_metrics_entity_idx
  on public.meta_metrics (user_id, entity_type, entity_id);

create table if not exists public.meta_insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  insight_type text not null
    check (insight_type in (
      'saturated_creative', 'low_ctr', 'high_cpc', 'bad_audience',
      'promising_campaign', 'scale_opportunity', 'pause_alert', 'revenue_gap'
    )),
  title text not null,
  summary text not null,
  recommendation text,
  severity text not null default 'info'
    check (severity in ('info', 'warning', 'success', 'critical')),
  entity_type text,
  entity_id text,
  entity_name text,
  metrics_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

create index if not exists meta_insights_user_idx
  on public.meta_insights (user_id, created_at desc);

create table if not exists public.meta_recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  action_type text not null
    check (action_type in ('generate_creative', 'generate_copy', 'suggest_pause', 'suggest_scale')),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'executed')),
  campaign_id uuid references public.meta_campaigns (id) on delete set null,
  title text not null,
  summary text not null,
  details jsonb not null default '{}'::jsonb,
  requires_approval boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists meta_recommendations_user_idx
  on public.meta_recommendations (user_id, created_at desc);

create index if not exists meta_recommendations_status_idx
  on public.meta_recommendations (user_id, status);

alter table public.meta_metrics enable row level security;
alter table public.meta_insights enable row level security;
alter table public.meta_recommendations enable row level security;

do $$
declare
  t text;
begin
  for t in select unnest(array['meta_metrics', 'meta_insights', 'meta_recommendations']) loop
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

drop trigger if exists meta_recommendations_updated_at on public.meta_recommendations;
create trigger meta_recommendations_updated_at
  before update on public.meta_recommendations
  for each row execute function public.set_updated_at();
