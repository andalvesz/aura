-- Conversion Intelligence V1 — aprendizado de padrões reais de conversão

create table if not exists public.conversion_insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  funnel_id uuid references public.funnels (id) on delete set null,
  product_id uuid references public.creator_products (id) on delete set null,
  offer_id uuid references public.offers (id) on delete set null,
  landing_id uuid references public.landing_pages (id) on delete set null,
  creative_id uuid references public.creative_assets (id) on delete set null,
  campaign_id uuid references public.creator_ads_campaigns (id) on delete set null,
  country text,
  language text,
  conversion_rate numeric(8, 4),
  ctr numeric(8, 4),
  cpc numeric(12, 4),
  cpa numeric(12, 4),
  roas numeric(8, 4),
  revenue numeric(12, 2),
  spend numeric(12, 2),
  insight text,
  recommendation text,
  confidence_score numeric(5, 2) not null default 50,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists conversion_insights_user_idx
  on public.conversion_insights (user_id, created_at desc);

create index if not exists conversion_insights_funnel_idx
  on public.conversion_insights (user_id, funnel_id, created_at desc)
  where funnel_id is not null;

create index if not exists conversion_insights_product_idx
  on public.conversion_insights (user_id, product_id, created_at desc)
  where product_id is not null;

create index if not exists conversion_insights_country_idx
  on public.conversion_insights (user_id, country, created_at desc)
  where country is not null;

create index if not exists conversion_insights_confidence_idx
  on public.conversion_insights (user_id, confidence_score desc, created_at desc);

alter table public.conversion_insights enable row level security;

do $$
begin
  execute 'drop policy if exists conversion_insights_select_own on public.conversion_insights';
  execute 'drop policy if exists conversion_insights_insert_own on public.conversion_insights';
  execute 'drop policy if exists conversion_insights_update_own on public.conversion_insights';
  execute 'drop policy if exists conversion_insights_delete_own on public.conversion_insights';

  execute 'create policy conversion_insights_select_own on public.conversion_insights for select using (auth.uid() = user_id)';
  execute 'create policy conversion_insights_insert_own on public.conversion_insights for insert with check (auth.uid() = user_id)';
  execute 'create policy conversion_insights_update_own on public.conversion_insights for update using (auth.uid() = user_id)';
  execute 'create policy conversion_insights_delete_own on public.conversion_insights for delete using (auth.uid() = user_id)';
end $$;

notify pgrst, 'reload schema';
