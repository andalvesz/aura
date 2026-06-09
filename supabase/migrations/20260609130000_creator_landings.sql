-- Aura Landing Builder — páginas de vendas geradas por IA

create table if not exists public.creator_landings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  product_id uuid references public.creator_products (id) on delete set null,
  copylab_id uuid references public.creator_copylab (id) on delete set null,
  modelo text not null default 'pagina_simples',
  nome text,
  avatar text,
  problema text,
  solucao text,
  promessa text,
  diferencial text,
  preco numeric(12, 2),
  hero_section text,
  headline text,
  subheadline text,
  beneficios jsonb not null default '[]'::jsonb,
  section_problema text,
  section_solucao text,
  depoimentos jsonb not null default '[]'::jsonb,
  garantia text,
  bonus text,
  faq jsonb not null default '[]'::jsonb,
  cta text,
  rodape text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists creator_landings_user_idx
  on public.creator_landings (user_id, created_at desc);

create index if not exists creator_landings_product_idx
  on public.creator_landings (product_id);

alter table public.creator_landings enable row level security;

drop policy if exists "creator_landings_select_own" on public.creator_landings;
drop policy if exists "creator_landings_insert_own" on public.creator_landings;
drop policy if exists "creator_landings_update_own" on public.creator_landings;
drop policy if exists "creator_landings_delete_own" on public.creator_landings;

create policy "creator_landings_select_own"
  on public.creator_landings for select using (auth.uid() = user_id);
create policy "creator_landings_insert_own"
  on public.creator_landings for insert with check (auth.uid() = user_id);
create policy "creator_landings_update_own"
  on public.creator_landings for update using (auth.uid() = user_id);
create policy "creator_landings_delete_own"
  on public.creator_landings for delete using (auth.uid() = user_id);

drop trigger if exists creator_landings_updated_at on public.creator_landings;
create trigger creator_landings_updated_at
  before update on public.creator_landings
  for each row execute function public.set_updated_at();
