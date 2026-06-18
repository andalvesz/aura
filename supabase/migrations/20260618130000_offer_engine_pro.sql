-- Offer Engine Pro — estrutura completa de monetização por produto/funil

create table if not exists public.offers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  funnel_id uuid references public.funnels (id) on delete set null,
  product_id uuid references public.creator_products (id) on delete set null,
  offer_type text not null
    check (offer_type in ('front_end', 'order_bump', 'upsell', 'downsell', 'vip_offer', 'continuity')),
  title text not null,
  description text,
  price numeric(12, 2) not null default 0,
  currency text not null default 'BRL',
  expected_take_rate numeric(8, 4),
  expected_revenue numeric(12, 2),
  status text not null default 'suggested'
    check (status in ('draft', 'suggested', 'ready', 'active', 'archived')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists offers_user_idx
  on public.offers (user_id, created_at desc);

create index if not exists offers_product_idx
  on public.offers (user_id, product_id, created_at desc)
  where product_id is not null;

create index if not exists offers_funnel_idx
  on public.offers (user_id, funnel_id, created_at desc)
  where funnel_id is not null;

create index if not exists offers_type_idx
  on public.offers (user_id, offer_type, created_at desc);

alter table public.offers enable row level security;

do $$
begin
  execute 'drop policy if exists offers_select_own on public.offers';
  execute 'drop policy if exists offers_insert_own on public.offers';
  execute 'drop policy if exists offers_update_own on public.offers';
  execute 'drop policy if exists offers_delete_own on public.offers';

  execute 'create policy offers_select_own on public.offers for select using (auth.uid() = user_id)';
  execute 'create policy offers_insert_own on public.offers for insert with check (auth.uid() = user_id)';
  execute 'create policy offers_update_own on public.offers for update using (auth.uid() = user_id)';
  execute 'create policy offers_delete_own on public.offers for delete using (auth.uid() = user_id)';
end $$;

drop trigger if exists offers_updated_at on public.offers;
create trigger offers_updated_at
  before update on public.offers
  for each row execute function public.set_updated_at();

notify pgrst, 'reload schema';
