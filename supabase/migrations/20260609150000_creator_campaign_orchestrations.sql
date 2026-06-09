-- Aura Campaign Orchestrator — preparação de campanha (sem publicação)

create table if not exists public.creator_campaign_orchestrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  product_id uuid references public.creator_products (id) on delete set null,
  research_id uuid references public.creator_research (id) on delete set null,
  copylab_id uuid references public.creator_copylab (id) on delete set null,
  asset_id uuid references public.creator_assets (id) on delete set null,
  landing_id uuid references public.creator_landings (id) on delete set null,
  ads_campaign_id uuid references public.creator_ads_campaigns (id) on delete set null,
  launch_plan_id uuid references public.creator_launch_plans (id) on delete set null,
  status text not null default 'draft',
  pipeline_step text,
  score_lancamento numeric(5, 2),
  probabilidade_sucesso numeric(5, 2),
  investimento_necessario numeric(12, 2),
  receita_prevista numeric(12, 2),
  roi_estimado numeric(8, 2),
  orcamento_sugerido jsonb not null default '{}'::jsonb,
  plano_lancamento jsonb not null default '{}'::jsonb,
  conexoes jsonb not null default '{}'::jsonb,
  riscos jsonb not null default '[]'::jsonb,
  resumo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists creator_campaign_orchestrations_user_idx
  on public.creator_campaign_orchestrations (user_id, created_at desc);

create index if not exists creator_campaign_orchestrations_product_idx
  on public.creator_campaign_orchestrations (product_id);

alter table public.creator_campaign_orchestrations enable row level security;

drop policy if exists "creator_campaign_orchestrations_select_own" on public.creator_campaign_orchestrations;
drop policy if exists "creator_campaign_orchestrations_insert_own" on public.creator_campaign_orchestrations;
drop policy if exists "creator_campaign_orchestrations_update_own" on public.creator_campaign_orchestrations;
drop policy if exists "creator_campaign_orchestrations_delete_own" on public.creator_campaign_orchestrations;

create policy "creator_campaign_orchestrations_select_own"
  on public.creator_campaign_orchestrations for select using (auth.uid() = user_id);
create policy "creator_campaign_orchestrations_insert_own"
  on public.creator_campaign_orchestrations for insert with check (auth.uid() = user_id);
create policy "creator_campaign_orchestrations_update_own"
  on public.creator_campaign_orchestrations for update using (auth.uid() = user_id);
create policy "creator_campaign_orchestrations_delete_own"
  on public.creator_campaign_orchestrations for delete using (auth.uid() = user_id);

drop trigger if exists creator_campaign_orchestrations_updated_at on public.creator_campaign_orchestrations;
create trigger creator_campaign_orchestrations_updated_at
  before update on public.creator_campaign_orchestrations
  for each row execute function public.set_updated_at();
