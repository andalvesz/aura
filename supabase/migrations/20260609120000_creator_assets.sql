-- Aura Creative Studio — ativos visuais e de conteúdo para produtos digitais

create table if not exists public.creator_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  product_id uuid references public.creator_products (id) on delete set null,
  copylab_id uuid references public.creator_copylab (id) on delete set null,
  nome text,
  avatar text,
  problema text,
  solucao text,
  promessa text,
  diferencial text,
  preco numeric(12, 2),
  criativo_facebook text,
  criativo_instagram text,
  capa_ebook text,
  thumbnail_youtube text,
  mockup_produto text,
  roteiro_reels text,
  roteiro_shorts text,
  roteiro_tiktok text,
  vsl text,
  carrossel_instagram jsonb not null default '[]'::jsonb,
  stories jsonb not null default '[]'::jsonb,
  legendas text,
  cta text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists creator_assets_user_idx
  on public.creator_assets (user_id, created_at desc);

create index if not exists creator_assets_product_idx
  on public.creator_assets (product_id);

alter table public.creator_assets enable row level security;

drop policy if exists "creator_assets_select_own" on public.creator_assets;
drop policy if exists "creator_assets_insert_own" on public.creator_assets;
drop policy if exists "creator_assets_update_own" on public.creator_assets;
drop policy if exists "creator_assets_delete_own" on public.creator_assets;

create policy "creator_assets_select_own"
  on public.creator_assets for select using (auth.uid() = user_id);
create policy "creator_assets_insert_own"
  on public.creator_assets for insert with check (auth.uid() = user_id);
create policy "creator_assets_update_own"
  on public.creator_assets for update using (auth.uid() = user_id);
create policy "creator_assets_delete_own"
  on public.creator_assets for delete using (auth.uid() = user_id);

drop trigger if exists creator_assets_updated_at on public.creator_assets;
create trigger creator_assets_updated_at
  before update on public.creator_assets
  for each row execute function public.set_updated_at();
