-- Checkout Engine V1 — checkouts automáticos para produtos Aura

create table if not exists public.checkout_products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  product_id uuid not null references public.creator_products (id) on delete cascade,
  platform text not null
    check (platform in ('kiwify', 'hotmart', 'stripe')),
  checkout_id text not null,
  checkout_url text,
  status text not null default 'pending'
    check (status in ('pending', 'creating', 'ready_to_sell', 'syncing', 'failed', 'inactive')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, product_id, platform)
);

create index if not exists checkout_products_user_product_idx
  on public.checkout_products (user_id, product_id, created_at desc);

create index if not exists checkout_products_user_status_idx
  on public.checkout_products (user_id, status, created_at desc);

create index if not exists checkout_products_checkout_id_idx
  on public.checkout_products (user_id, platform, checkout_id);

alter table public.checkout_products enable row level security;

do $$
begin
  execute 'drop policy if exists checkout_products_select_own on public.checkout_products';
  execute 'drop policy if exists checkout_products_insert_own on public.checkout_products';
  execute 'drop policy if exists checkout_products_update_own on public.checkout_products';
  execute 'drop policy if exists checkout_products_delete_own on public.checkout_products';

  execute 'create policy checkout_products_select_own on public.checkout_products for select using (auth.uid() = user_id)';
  execute 'create policy checkout_products_insert_own on public.checkout_products for insert with check (auth.uid() = user_id)';
  execute 'create policy checkout_products_update_own on public.checkout_products for update using (auth.uid() = user_id)';
  execute 'create policy checkout_products_delete_own on public.checkout_products for delete using (auth.uid() = user_id)';
end $$;

notify pgrst, 'reload schema';
