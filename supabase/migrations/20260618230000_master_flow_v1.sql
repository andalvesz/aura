-- Aura Master Flow V1 — automated business pipeline orchestration

create table if not exists public.master_flows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'running', 'completed', 'failed', 'paused')),
  product_id uuid references public.creator_products (id) on delete set null,
  funnel_id uuid references public.funnels (id) on delete set null,
  campaign_id uuid references public.ad_campaigns (id) on delete set null,
  progress integer not null default 0
    check (progress >= 0 and progress <= 100),
  current_step text not null default 'market_hunter'
    check (current_step in (
      'market_hunter',
      'decision_engine',
      'product_factory',
      'copylab',
      'offer_engine',
      'funnel_engine',
      'funnel_pages',
      'creative_director',
      'ads_commander',
      'excellence',
      'done'
    )),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists master_flows_user_status_idx
  on public.master_flows (user_id, status, created_at desc);

alter table public.master_flows enable row level security;

do $$
begin
  execute 'drop policy if exists master_flows_select_own on public.master_flows';
  execute 'drop policy if exists master_flows_insert_own on public.master_flows';
  execute 'drop policy if exists master_flows_update_own on public.master_flows';
  execute 'drop policy if exists master_flows_delete_own on public.master_flows';

  execute 'create policy master_flows_select_own on public.master_flows for select using (auth.uid() = user_id)';
  execute 'create policy master_flows_insert_own on public.master_flows for insert with check (auth.uid() = user_id)';
  execute 'create policy master_flows_update_own on public.master_flows for update using (auth.uid() = user_id)';
  execute 'create policy master_flows_delete_own on public.master_flows for delete using (auth.uid() = user_id)';
end $$;

drop trigger if exists master_flows_updated_at on public.master_flows;
create trigger master_flows_updated_at
  before update on public.master_flows
  for each row execute function public.set_updated_at();
