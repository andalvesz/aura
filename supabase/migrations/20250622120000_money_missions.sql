-- Aura Money Missions — planos financeiros executáveis

create table if not exists public.money_mission_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  valor_meta numeric(12, 2) not null,
  valor_conquistado numeric(12, 2) not null default 0,
  prazo text not null check (prazo in ('30_dias', '90_dias', '6_meses', '1_ano')),
  prioridade text not null check (prioridade in ('seguranca', 'crescimento', 'escala')),
  data_inicio date not null default current_date,
  data_fim date not null,
  status text not null default 'active' check (status in ('active', 'completed', 'archived')),
  plano_financeiro text,
  produtos_recomendados jsonb not null default '[]'::jsonb,
  servicos_recomendados jsonb not null default '[]'::jsonb,
  receita_estimada numeric(12, 2),
  investimento_necessario numeric(12, 2),
  roi_estimado numeric(8, 2),
  riscos jsonb not null default '[]'::jsonb,
  probabilidade_sucesso integer check (
    probabilidade_sucesso is null or (probabilidade_sucesso >= 0 and probabilidade_sucesso <= 100)
  ),
  cronograma jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.money_mission_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan_id uuid not null references public.money_mission_plans (id) on delete cascade,
  mission_key text not null,
  titulo text not null,
  descricao text not null default '',
  semana integer,
  ordem integer not null default 0,
  tipo text not null default 'semanal' check (tipo in ('semanal', 'diaria')),
  status text not null default 'pending' check (status in ('pending', 'completed')),
  mission_date date,
  completed_at timestamptz,
  xp_reward integer not null default 15 check (xp_reward >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, plan_id, mission_key)
);

create index if not exists money_mission_plans_user_idx
  on public.money_mission_plans (user_id, created_at desc);

create index if not exists money_mission_plans_status_idx
  on public.money_mission_plans (user_id, status);

create index if not exists money_mission_tasks_plan_idx
  on public.money_mission_tasks (plan_id, ordem);

create index if not exists money_mission_tasks_user_date_idx
  on public.money_mission_tasks (user_id, mission_date);

alter table public.money_mission_plans enable row level security;
alter table public.money_mission_tasks enable row level security;

drop policy if exists "money_mission_plans_select_own" on public.money_mission_plans;
drop policy if exists "money_mission_plans_insert_own" on public.money_mission_plans;
drop policy if exists "money_mission_plans_update_own" on public.money_mission_plans;
drop policy if exists "money_mission_plans_delete_own" on public.money_mission_plans;

create policy "money_mission_plans_select_own"
  on public.money_mission_plans for select using (auth.uid() = user_id);
create policy "money_mission_plans_insert_own"
  on public.money_mission_plans for insert with check (auth.uid() = user_id);
create policy "money_mission_plans_update_own"
  on public.money_mission_plans for update using (auth.uid() = user_id);
create policy "money_mission_plans_delete_own"
  on public.money_mission_plans for delete using (auth.uid() = user_id);

drop policy if exists "money_mission_tasks_select_own" on public.money_mission_tasks;
drop policy if exists "money_mission_tasks_insert_own" on public.money_mission_tasks;
drop policy if exists "money_mission_tasks_update_own" on public.money_mission_tasks;
drop policy if exists "money_mission_tasks_delete_own" on public.money_mission_tasks;

create policy "money_mission_tasks_select_own"
  on public.money_mission_tasks for select using (auth.uid() = user_id);
create policy "money_mission_tasks_insert_own"
  on public.money_mission_tasks for insert with check (auth.uid() = user_id);
create policy "money_mission_tasks_update_own"
  on public.money_mission_tasks for update using (auth.uid() = user_id);
create policy "money_mission_tasks_delete_own"
  on public.money_mission_tasks for delete using (auth.uid() = user_id);

drop trigger if exists money_mission_plans_updated_at on public.money_mission_plans;
create trigger money_mission_plans_updated_at
  before update on public.money_mission_plans
  for each row execute function public.set_updated_at();

drop trigger if exists money_mission_tasks_updated_at on public.money_mission_tasks;
create trigger money_mission_tasks_updated_at
  before update on public.money_mission_tasks
  for each row execute function public.set_updated_at();
