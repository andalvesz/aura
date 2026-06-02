-- Módulo Saúde — hábitos, treinos, refeições e sessões (leitura/meditação)

-- ---------------------------------------------------------------------------
-- Hábitos
-- ---------------------------------------------------------------------------
create table if not exists public.health_habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  titulo text not null,
  frequencia text not null default 'diario',
  status text not null default 'ativo',
  data date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists health_habits_user_id_idx on public.health_habits (user_id);
create index if not exists health_habits_data_idx on public.health_habits (user_id, data desc);

alter table public.health_habits enable row level security;

create policy "health_habits_select_own"
  on public.health_habits for select using (auth.uid() = user_id);
create policy "health_habits_insert_own"
  on public.health_habits for insert with check (auth.uid() = user_id);
create policy "health_habits_update_own"
  on public.health_habits for update using (auth.uid() = user_id);
create policy "health_habits_delete_own"
  on public.health_habits for delete using (auth.uid() = user_id);

drop trigger if exists health_habits_updated_at on public.health_habits;
create trigger health_habits_updated_at
  before update on public.health_habits
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Treinos
-- ---------------------------------------------------------------------------
create table if not exists public.health_workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  nome text not null,
  grupo_muscular text not null default 'geral',
  exercicios jsonb not null default '[]'::jsonb,
  duracao_min integer not null default 0 check (duracao_min >= 0),
  observacoes text,
  data date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists health_workouts_user_id_idx on public.health_workouts (user_id);
create index if not exists health_workouts_data_idx on public.health_workouts (user_id, data desc);

alter table public.health_workouts enable row level security;

create policy "health_workouts_select_own"
  on public.health_workouts for select using (auth.uid() = user_id);
create policy "health_workouts_insert_own"
  on public.health_workouts for insert with check (auth.uid() = user_id);
create policy "health_workouts_update_own"
  on public.health_workouts for update using (auth.uid() = user_id);
create policy "health_workouts_delete_own"
  on public.health_workouts for delete using (auth.uid() = user_id);

drop trigger if exists health_workouts_updated_at on public.health_workouts;
create trigger health_workouts_updated_at
  before update on public.health_workouts
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Refeições / dieta
-- ---------------------------------------------------------------------------
create table if not exists public.health_meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  nome text not null,
  horario time not null,
  alimentos text,
  calorias integer check (calorias is null or calorias >= 0),
  observacoes text,
  data date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists health_meals_user_id_idx on public.health_meals (user_id);
create index if not exists health_meals_data_idx on public.health_meals (user_id, data desc);

alter table public.health_meals enable row level security;

create policy "health_meals_select_own"
  on public.health_meals for select using (auth.uid() = user_id);
create policy "health_meals_insert_own"
  on public.health_meals for insert with check (auth.uid() = user_id);
create policy "health_meals_update_own"
  on public.health_meals for update using (auth.uid() = user_id);
create policy "health_meals_delete_own"
  on public.health_meals for delete using (auth.uid() = user_id);

drop trigger if exists health_meals_updated_at on public.health_meals;
create trigger health_meals_updated_at
  before update on public.health_meals
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Sessões (leitura, meditação)
-- ---------------------------------------------------------------------------
create table if not exists public.health_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  tipo text not null check (tipo in ('leitura', 'meditacao')),
  titulo text not null,
  duracao_min integer not null default 0 check (duracao_min >= 0),
  data date not null default current_date,
  status text not null default 'planejado',
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists health_sessions_user_id_idx on public.health_sessions (user_id);
create index if not exists health_sessions_tipo_idx on public.health_sessions (user_id, tipo);

alter table public.health_sessions enable row level security;

create policy "health_sessions_select_own"
  on public.health_sessions for select using (auth.uid() = user_id);
create policy "health_sessions_insert_own"
  on public.health_sessions for insert with check (auth.uid() = user_id);
create policy "health_sessions_update_own"
  on public.health_sessions for update using (auth.uid() = user_id);
create policy "health_sessions_delete_own"
  on public.health_sessions for delete using (auth.uid() = user_id);

drop trigger if exists health_sessions_updated_at on public.health_sessions;
create trigger health_sessions_updated_at
  before update on public.health_sessions
  for each row execute function public.set_updated_at();
