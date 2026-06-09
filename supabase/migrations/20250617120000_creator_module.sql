-- Aura Creator — produtos digitais validados por IA

create table if not exists public.creator_products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'draft' check (
    status in ('draft', 'validated', 'offered', 'launched')
  ),
  nicho text,
  conhecimento text,
  publico_alvo_input text,
  objetivo_financeiro numeric(12, 2),
  prazo text,
  used_aura_data boolean not null default false,
  nome text,
  problema text,
  solucao text,
  avatar text,
  publico_alvo text,
  promessa text,
  mecanismo_unico text,
  diferenciais text,
  faixa_preco_min numeric(12, 2),
  faixa_preco_max numeric(12, 2),
  formato text,
  probabilidade_venda integer check (
    probabilidade_venda is null
    or (probabilidade_venda >= 0 and probabilidade_venda <= 100)
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.creator_validation (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  product_id uuid not null references public.creator_products (id) on delete cascade,
  demanda integer not null check (demanda >= 0 and demanda <= 100),
  concorrencia integer not null check (concorrencia >= 0 and concorrencia <= 100),
  facilidade_criacao integer not null check (
    facilidade_criacao >= 0 and facilidade_criacao <= 100
  ),
  facilidade_venda integer not null check (
    facilidade_venda >= 0 and facilidade_venda <= 100
  ),
  escalabilidade integer not null check (
    escalabilidade >= 0 and escalabilidade <= 100
  ),
  nota_final integer not null check (nota_final >= 0 and nota_final <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id)
);

create table if not exists public.creator_offers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  product_id uuid not null references public.creator_products (id) on delete cascade,
  headline text,
  subheadline text,
  bullet_points jsonb not null default '[]'::jsonb,
  garantia text,
  bonus text,
  cta text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id)
);

create table if not exists public.creator_launches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  product_id uuid not null references public.creator_products (id) on delete cascade,
  status text not null default 'planned' check (
    status in ('planned', 'active', 'completed', 'paused')
  ),
  potencial_estimado numeric(12, 2),
  launched_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id)
);

create index if not exists creator_products_user_idx
  on public.creator_products (user_id, created_at desc);

create index if not exists creator_products_user_status_idx
  on public.creator_products (user_id, status);

create index if not exists creator_validation_user_idx
  on public.creator_validation (user_id);

create index if not exists creator_offers_user_idx
  on public.creator_offers (user_id);

create index if not exists creator_launches_user_idx
  on public.creator_launches (user_id);

alter table public.creator_products enable row level security;
alter table public.creator_validation enable row level security;
alter table public.creator_offers enable row level security;
alter table public.creator_launches enable row level security;

drop policy if exists "creator_products_select_own" on public.creator_products;
drop policy if exists "creator_products_insert_own" on public.creator_products;
drop policy if exists "creator_products_update_own" on public.creator_products;
drop policy if exists "creator_products_delete_own" on public.creator_products;

create policy "creator_products_select_own"
  on public.creator_products for select using (auth.uid() = user_id);
create policy "creator_products_insert_own"
  on public.creator_products for insert with check (auth.uid() = user_id);
create policy "creator_products_update_own"
  on public.creator_products for update using (auth.uid() = user_id);
create policy "creator_products_delete_own"
  on public.creator_products for delete using (auth.uid() = user_id);

drop policy if exists "creator_validation_select_own" on public.creator_validation;
drop policy if exists "creator_validation_insert_own" on public.creator_validation;
drop policy if exists "creator_validation_update_own" on public.creator_validation;
drop policy if exists "creator_validation_delete_own" on public.creator_validation;

create policy "creator_validation_select_own"
  on public.creator_validation for select using (auth.uid() = user_id);
create policy "creator_validation_insert_own"
  on public.creator_validation for insert with check (auth.uid() = user_id);
create policy "creator_validation_update_own"
  on public.creator_validation for update using (auth.uid() = user_id);
create policy "creator_validation_delete_own"
  on public.creator_validation for delete using (auth.uid() = user_id);

drop policy if exists "creator_offers_select_own" on public.creator_offers;
drop policy if exists "creator_offers_insert_own" on public.creator_offers;
drop policy if exists "creator_offers_update_own" on public.creator_offers;
drop policy if exists "creator_offers_delete_own" on public.creator_offers;

create policy "creator_offers_select_own"
  on public.creator_offers for select using (auth.uid() = user_id);
create policy "creator_offers_insert_own"
  on public.creator_offers for insert with check (auth.uid() = user_id);
create policy "creator_offers_update_own"
  on public.creator_offers for update using (auth.uid() = user_id);
create policy "creator_offers_delete_own"
  on public.creator_offers for delete using (auth.uid() = user_id);

drop policy if exists "creator_launches_select_own" on public.creator_launches;
drop policy if exists "creator_launches_insert_own" on public.creator_launches;
drop policy if exists "creator_launches_update_own" on public.creator_launches;
drop policy if exists "creator_launches_delete_own" on public.creator_launches;

create policy "creator_launches_select_own"
  on public.creator_launches for select using (auth.uid() = user_id);
create policy "creator_launches_insert_own"
  on public.creator_launches for insert with check (auth.uid() = user_id);
create policy "creator_launches_update_own"
  on public.creator_launches for update using (auth.uid() = user_id);
create policy "creator_launches_delete_own"
  on public.creator_launches for delete using (auth.uid() = user_id);

drop trigger if exists creator_products_updated_at on public.creator_products;
create trigger creator_products_updated_at
  before update on public.creator_products
  for each row execute function public.set_updated_at();

drop trigger if exists creator_validation_updated_at on public.creator_validation;
create trigger creator_validation_updated_at
  before update on public.creator_validation
  for each row execute function public.set_updated_at();

drop trigger if exists creator_offers_updated_at on public.creator_offers;
create trigger creator_offers_updated_at
  before update on public.creator_offers
  for each row execute function public.set_updated_at();

drop trigger if exists creator_launches_updated_at on public.creator_launches;
create trigger creator_launches_updated_at
  before update on public.creator_launches
  for each row execute function public.set_updated_at();
