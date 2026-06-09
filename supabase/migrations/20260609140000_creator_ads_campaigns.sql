-- Aura Ads Manager — campanhas de tráfego pago (somente rascunho)

create table if not exists public.creator_ads_campaigns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  product_id uuid references public.creator_products (id) on delete set null,
  asset_id uuid references public.creator_assets (id) on delete set null,
  landing_id uuid references public.creator_landings (id) on delete set null,
  copylab_id uuid references public.creator_copylab (id) on delete set null,
  status text not null default 'draft',
  nome text,
  avatar text,
  problema text,
  solucao text,
  promessa text,
  diferencial text,
  preco numeric(12, 2),
  objetivo text,
  orcamento_nivel text,
  investimento_diario_min numeric(12, 2),
  investimento_diario_max numeric(12, 2),
  investimento_mensal_previsto numeric(12, 2),
  campanha_nome text,
  campanha_estrategia text,
  publicos jsonb not null default '[]'::jsonb,
  conjuntos_anuncios jsonb not null default '[]'::jsonb,
  anuncios jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists creator_ads_campaigns_user_idx
  on public.creator_ads_campaigns (user_id, created_at desc);

create index if not exists creator_ads_campaigns_product_idx
  on public.creator_ads_campaigns (product_id);

alter table public.creator_ads_campaigns enable row level security;

drop policy if exists "creator_ads_campaigns_select_own" on public.creator_ads_campaigns;
drop policy if exists "creator_ads_campaigns_insert_own" on public.creator_ads_campaigns;
drop policy if exists "creator_ads_campaigns_update_own" on public.creator_ads_campaigns;
drop policy if exists "creator_ads_campaigns_delete_own" on public.creator_ads_campaigns;

create policy "creator_ads_campaigns_select_own"
  on public.creator_ads_campaigns for select using (auth.uid() = user_id);
create policy "creator_ads_campaigns_insert_own"
  on public.creator_ads_campaigns for insert with check (auth.uid() = user_id);
create policy "creator_ads_campaigns_update_own"
  on public.creator_ads_campaigns for update using (auth.uid() = user_id);
create policy "creator_ads_campaigns_delete_own"
  on public.creator_ads_campaigns for delete using (auth.uid() = user_id);

drop trigger if exists creator_ads_campaigns_updated_at on public.creator_ads_campaigns;
create trigger creator_ads_campaigns_updated_at
  before update on public.creator_ads_campaigns
  for each row execute function public.set_updated_at();
