-- Aura CopyLab — geração de copy e comunicação do produto

create table if not exists public.creator_copylab (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  product_id uuid references public.creator_products (id) on delete set null,
  nome text,
  avatar text,
  problema text,
  solucao text,
  promessa text,
  diferencial text,
  preco numeric(12, 2),
  headline text,
  subheadline text,
  big_idea text,
  mecanismo_unico text,
  bullets jsonb not null default '[]'::jsonb,
  garantia text,
  bonus text,
  cta text,
  pagina_vendas text,
  estrutura_vsl text,
  storytelling text,
  email_lancamento text,
  whatsapp_venda text,
  instagram_post text,
  facebook_ad text,
  google_ad text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists creator_copylab_user_idx
  on public.creator_copylab (user_id, created_at desc);

create index if not exists creator_copylab_product_idx
  on public.creator_copylab (product_id);

alter table public.creator_copylab enable row level security;

drop policy if exists "creator_copylab_select_own" on public.creator_copylab;
drop policy if exists "creator_copylab_insert_own" on public.creator_copylab;
drop policy if exists "creator_copylab_update_own" on public.creator_copylab;
drop policy if exists "creator_copylab_delete_own" on public.creator_copylab;

create policy "creator_copylab_select_own"
  on public.creator_copylab for select using (auth.uid() = user_id);
create policy "creator_copylab_insert_own"
  on public.creator_copylab for insert with check (auth.uid() = user_id);
create policy "creator_copylab_update_own"
  on public.creator_copylab for update using (auth.uid() = user_id);
create policy "creator_copylab_delete_own"
  on public.creator_copylab for delete using (auth.uid() = user_id);

drop trigger if exists creator_copylab_updated_at on public.creator_copylab;
create trigger creator_copylab_updated_at
  before update on public.creator_copylab
  for each row execute function public.set_updated_at();
