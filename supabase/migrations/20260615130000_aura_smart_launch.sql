-- Aura Smart Launch — fluxo unificado de lançamento (modo seguro)

create table if not exists public.aura_smart_launch_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  product_type text not null default 'proprio',
  target_country text not null default 'Brasil',
  target_language text not null default 'Português',
  currency text not null default 'BRL',
  meta_financeira numeric(12, 2),
  orcamento_disponivel numeric(12, 2),
  current_step integer not null default 1,
  status text not null default 'draft',
  safe_mode boolean not null default true,
  ideia text,
  nicho text,
  product_id uuid references public.creator_products (id) on delete set null,
  research_id uuid references public.creator_research (id) on delete set null,
  copylab_id uuid references public.creator_copylab (id) on delete set null,
  factory_id uuid references public.product_factory (id) on delete set null,
  landing_id uuid references public.creator_landings (id) on delete set null,
  asset_id uuid references public.creator_assets (id) on delete set null,
  ads_campaign_id uuid references public.creator_ads_campaigns (id) on delete set null,
  orchestration_id uuid references public.creator_campaign_orchestrations (id) on delete set null,
  smart_score jsonb not null default '{}'::jsonb,
  generated_outputs jsonb not null default '{}'::jsonb,
  estrategia text,
  resumo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists aura_smart_launch_sessions_user_idx
  on public.aura_smart_launch_sessions (user_id, created_at desc);

create index if not exists aura_smart_launch_sessions_product_idx
  on public.aura_smart_launch_sessions (product_id);

alter table public.aura_smart_launch_sessions enable row level security;

drop policy if exists "aura_smart_launch_sessions_select_own" on public.aura_smart_launch_sessions;
drop policy if exists "aura_smart_launch_sessions_insert_own" on public.aura_smart_launch_sessions;
drop policy if exists "aura_smart_launch_sessions_update_own" on public.aura_smart_launch_sessions;
drop policy if exists "aura_smart_launch_sessions_delete_own" on public.aura_smart_launch_sessions;

create policy "aura_smart_launch_sessions_select_own"
  on public.aura_smart_launch_sessions for select using (auth.uid() = user_id);
create policy "aura_smart_launch_sessions_insert_own"
  on public.aura_smart_launch_sessions for insert with check (auth.uid() = user_id);
create policy "aura_smart_launch_sessions_update_own"
  on public.aura_smart_launch_sessions for update using (auth.uid() = user_id);
create policy "aura_smart_launch_sessions_delete_own"
  on public.aura_smart_launch_sessions for delete using (auth.uid() = user_id);

drop trigger if exists aura_smart_launch_sessions_updated_at on public.aura_smart_launch_sessions;
create trigger aura_smart_launch_sessions_updated_at
  before update on public.aura_smart_launch_sessions
  for each row execute function public.set_updated_at();
