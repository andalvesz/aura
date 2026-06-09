-- Aura Execution Engine — planos executáveis a partir de todos os módulos

create table if not exists public.execution_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan_date date not null default current_date,
  titulo text,
  status text not null default 'active' check (status in ('active', 'completed', 'archived')),
  briefing jsonb not null default '{}'::jsonb,
  score_execucao numeric(5, 2),
  missoes_concluidas integer not null default 0,
  missoes_total integer not null default 0,
  resumo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, plan_date)
);

create table if not exists public.execution_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan_id uuid not null references public.execution_plans (id) on delete cascade,
  task_key text not null,
  titulo text not null,
  descricao text not null default '',
  categoria text not null default 'diaria' check (categoria in ('diaria', 'semanal')),
  area text not null default 'negocios' check (
    area in ('marketing', 'negocios', 'saude', 'desenvolvimento', 'relacionamentos')
  ),
  modulo_origem text not null default 'ceo',
  prioridade numeric(5, 2) not null default 50,
  impacto numeric(5, 2) not null default 50,
  urgencia numeric(5, 2) not null default 50,
  roi numeric(8, 2) not null default 0,
  energia integer not null default 3 check (energia >= 1 and energia <= 5),
  href text,
  source_ref text,
  status text not null default 'pending' check (status in ('pending', 'completed')),
  task_date date,
  semana integer,
  ordem integer not null default 0,
  completed_at timestamptz,
  xp_reward integer not null default 15 check (xp_reward >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, plan_id, task_key)
);

create table if not exists public.execution_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan_id uuid references public.execution_plans (id) on delete set null,
  task_id uuid references public.execution_tasks (id) on delete set null,
  evento text not null,
  modulo text,
  detalhes jsonb not null default '{}'::jsonb,
  xp_ganho integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists execution_plans_user_date_idx
  on public.execution_plans (user_id, plan_date desc);

create index if not exists execution_tasks_plan_idx
  on public.execution_tasks (plan_id, ordem);

create index if not exists execution_tasks_user_date_idx
  on public.execution_tasks (user_id, task_date);

create index if not exists execution_history_user_idx
  on public.execution_history (user_id, created_at desc);

alter table public.execution_plans enable row level security;
alter table public.execution_tasks enable row level security;
alter table public.execution_history enable row level security;

drop policy if exists "execution_plans_select_own" on public.execution_plans;
drop policy if exists "execution_plans_insert_own" on public.execution_plans;
drop policy if exists "execution_plans_update_own" on public.execution_plans;
drop policy if exists "execution_plans_delete_own" on public.execution_plans;

create policy "execution_plans_select_own"
  on public.execution_plans for select using (auth.uid() = user_id);
create policy "execution_plans_insert_own"
  on public.execution_plans for insert with check (auth.uid() = user_id);
create policy "execution_plans_update_own"
  on public.execution_plans for update using (auth.uid() = user_id);
create policy "execution_plans_delete_own"
  on public.execution_plans for delete using (auth.uid() = user_id);

drop policy if exists "execution_tasks_select_own" on public.execution_tasks;
drop policy if exists "execution_tasks_insert_own" on public.execution_tasks;
drop policy if exists "execution_tasks_update_own" on public.execution_tasks;
drop policy if exists "execution_tasks_delete_own" on public.execution_tasks;

create policy "execution_tasks_select_own"
  on public.execution_tasks for select using (auth.uid() = user_id);
create policy "execution_tasks_insert_own"
  on public.execution_tasks for insert with check (auth.uid() = user_id);
create policy "execution_tasks_update_own"
  on public.execution_tasks for update using (auth.uid() = user_id);
create policy "execution_tasks_delete_own"
  on public.execution_tasks for delete using (auth.uid() = user_id);

drop policy if exists "execution_history_select_own" on public.execution_history;
drop policy if exists "execution_history_insert_own" on public.execution_history;

create policy "execution_history_select_own"
  on public.execution_history for select using (auth.uid() = user_id);
create policy "execution_history_insert_own"
  on public.execution_history for insert with check (auth.uid() = user_id);

drop trigger if exists execution_plans_updated_at on public.execution_plans;
create trigger execution_plans_updated_at
  before update on public.execution_plans
  for each row execute function public.set_updated_at();

drop trigger if exists execution_tasks_updated_at on public.execution_tasks;
create trigger execution_tasks_updated_at
  before update on public.execution_tasks
  for each row execute function public.set_updated_at();
