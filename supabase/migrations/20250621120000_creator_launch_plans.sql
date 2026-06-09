-- Aura Launch Center — planos de lançamento unificados

create table if not exists public.creator_launch_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  product_id uuid not null references public.creator_products (id) on delete cascade,
  titulo text,
  estagio_atual text,
  score_ia integer check (
    score_ia is null or (score_ia >= 0 and score_ia <= 100)
  ),
  receita_estimada numeric(12, 2),
  data_prevista_lancamento date,
  tarefas jsonb not null default '[]'::jsonb,
  cronograma jsonb not null default '[]'::jsonb,
  prioridades jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists creator_launch_plans_user_idx
  on public.creator_launch_plans (user_id, created_at desc);

create index if not exists creator_launch_plans_product_idx
  on public.creator_launch_plans (product_id);

alter table public.creator_launch_plans enable row level security;

drop policy if exists "creator_launch_plans_select_own" on public.creator_launch_plans;
drop policy if exists "creator_launch_plans_insert_own" on public.creator_launch_plans;
drop policy if exists "creator_launch_plans_update_own" on public.creator_launch_plans;
drop policy if exists "creator_launch_plans_delete_own" on public.creator_launch_plans;

create policy "creator_launch_plans_select_own"
  on public.creator_launch_plans for select using (auth.uid() = user_id);
create policy "creator_launch_plans_insert_own"
  on public.creator_launch_plans for insert with check (auth.uid() = user_id);
create policy "creator_launch_plans_update_own"
  on public.creator_launch_plans for update using (auth.uid() = user_id);
create policy "creator_launch_plans_delete_own"
  on public.creator_launch_plans for delete using (auth.uid() = user_id);

drop trigger if exists creator_launch_plans_updated_at on public.creator_launch_plans;
create trigger creator_launch_plans_updated_at
  before update on public.creator_launch_plans
  for each row execute function public.set_updated_at();
