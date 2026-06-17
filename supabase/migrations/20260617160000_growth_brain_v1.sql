-- Growth Brain V1 — sistema de aprendizado com resultados de campanhas

create table if not exists public.growth_brain_memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  operation_id uuid references public.operation_center (id) on delete set null,
  product_id uuid references public.creator_products (id) on delete set null,
  copy_id uuid references public.creator_copylab (id) on delete set null,
  creative_id uuid references public.creator_assets (id) on delete set null,
  landing_id uuid references public.creator_landings (id) on delete set null,
  campaign_id uuid references public.creator_ads_campaigns (id) on delete set null,
  source_platform text,
  country text,
  language text,
  ctr numeric(8, 4),
  cpc numeric(12, 4),
  cpa numeric(12, 4),
  roas numeric(8, 4),
  revenue numeric(12, 2),
  spend numeric(12, 2),
  conversion_rate numeric(8, 4),
  status text not null default 'active'
    check (status in ('active', 'archived', 'learning')),
  lesson text,
  recommendation text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists growth_brain_memories_user_idx
  on public.growth_brain_memories (user_id, created_at desc);

create index if not exists growth_brain_memories_source_idx
  on public.growth_brain_memories (user_id, source_platform, created_at desc);

create index if not exists growth_brain_memories_campaign_idx
  on public.growth_brain_memories (user_id, campaign_id, created_at desc);

create table if not exists public.growth_patterns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  niche text,
  country text,
  language text,
  pattern_type text not null
    check (pattern_type in (
      'copy', 'creative', 'landing', 'campaign', 'niche', 'country', 'language', 'revenue', 'performance'
    )),
  score numeric(8, 2) not null default 0,
  lesson text,
  recommendation text,
  created_at timestamptz not null default now()
);

create index if not exists growth_patterns_user_idx
  on public.growth_patterns (user_id, created_at desc);

create index if not exists growth_patterns_type_idx
  on public.growth_patterns (user_id, pattern_type, score desc);

alter table public.growth_brain_memories enable row level security;
alter table public.growth_patterns enable row level security;

do $$
begin
  execute 'drop policy if exists growth_brain_memories_select_own on public.growth_brain_memories';
  execute 'drop policy if exists growth_brain_memories_insert_own on public.growth_brain_memories';
  execute 'drop policy if exists growth_brain_memories_update_own on public.growth_brain_memories';
  execute 'drop policy if exists growth_brain_memories_delete_own on public.growth_brain_memories';

  execute 'create policy growth_brain_memories_select_own on public.growth_brain_memories for select using (auth.uid() = user_id)';
  execute 'create policy growth_brain_memories_insert_own on public.growth_brain_memories for insert with check (auth.uid() = user_id)';
  execute 'create policy growth_brain_memories_update_own on public.growth_brain_memories for update using (auth.uid() = user_id)';
  execute 'create policy growth_brain_memories_delete_own on public.growth_brain_memories for delete using (auth.uid() = user_id)';

  execute 'drop policy if exists growth_patterns_select_own on public.growth_patterns';
  execute 'drop policy if exists growth_patterns_insert_own on public.growth_patterns';
  execute 'drop policy if exists growth_patterns_update_own on public.growth_patterns';
  execute 'drop policy if exists growth_patterns_delete_own on public.growth_patterns';

  execute 'create policy growth_patterns_select_own on public.growth_patterns for select using (auth.uid() = user_id)';
  execute 'create policy growth_patterns_insert_own on public.growth_patterns for insert with check (auth.uid() = user_id)';
  execute 'create policy growth_patterns_update_own on public.growth_patterns for update using (auth.uid() = user_id)';
  execute 'create policy growth_patterns_delete_own on public.growth_patterns for delete using (auth.uid() = user_id)';
end $$;
