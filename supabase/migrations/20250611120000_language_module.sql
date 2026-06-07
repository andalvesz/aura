-- =============================================================================
-- Aura English Coach — ensino personalizado de inglês
-- Tabelas: language_progress, language_sessions, language_lessons
-- =============================================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.language_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  modo_favorito text check (
    modo_favorito is null or modo_favorito in (
      'viagens',
      'aeroporto',
      'hotel',
      'disney',
      'nba',
      'negocios',
      'conversacao_livre'
    )
  ),
  nivel text not null default 'intermediario' check (
    nivel in ('iniciante', 'intermediario', 'avancado')
  ),
  streak_dias integer not null default 0 check (streak_dias >= 0),
  ultima_pratica date,
  aulas_concluidas integer not null default 0 check (aulas_concluidas >= 0),
  exercicios_concluidos integer not null default 0 check (exercicios_concluidos >= 0),
  modulos_concluidos integer not null default 0 check (modulos_concluidos >= 0),
  meta_diaria_min integer not null default 15 check (meta_diaria_min > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.language_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  modo text not null check (
    modo in (
      'viagens',
      'aeroporto',
      'hotel',
      'disney',
      'nba',
      'negocios',
      'conversacao_livre'
    )
  ),
  tipo text not null check (
    tipo in (
      'aula_diaria',
      'vocabulario',
      'frases',
      'exercicio',
      'correcao',
      'conversacao'
    )
  ),
  titulo text not null,
  duracao_min integer not null default 0 check (duracao_min >= 0),
  data date not null default current_date,
  status text not null default 'planejado' check (
    status in ('planejado', 'em_andamento', 'concluido', 'cancelado')
  ),
  conteudo jsonb not null default '{}'::jsonb,
  score integer check (score is null or (score >= 0 and score <= 100)),
  feedback text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.language_lessons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  session_id uuid references public.language_sessions (id) on delete set null,
  modo text not null check (
    modo in (
      'viagens',
      'aeroporto',
      'hotel',
      'disney',
      'nba',
      'negocios',
      'conversacao_livre'
    )
  ),
  titulo text not null,
  vocabulario jsonb not null default '[]'::jsonb,
  frases jsonb not null default '[]'::jsonb,
  exercicios jsonb not null default '[]'::jsonb,
  status text not null default 'pendente' check (
    status in ('pendente', 'em_andamento', 'concluido')
  ),
  ordem integer not null default 0,
  score integer check (score is null or (score >= 0 and score <= 100)),
  concluido_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists language_progress_user_id_idx
  on public.language_progress (user_id);

create index if not exists language_sessions_user_data_idx
  on public.language_sessions (user_id, data desc);

create index if not exists language_sessions_modo_idx
  on public.language_sessions (user_id, modo, status);

create index if not exists language_lessons_session_idx
  on public.language_lessons (session_id, ordem);

create index if not exists language_lessons_user_status_idx
  on public.language_lessons (user_id, status);

alter table public.language_progress enable row level security;
alter table public.language_sessions enable row level security;
alter table public.language_lessons enable row level security;

drop policy if exists "language_progress_select_own" on public.language_progress;
drop policy if exists "language_progress_insert_own" on public.language_progress;
drop policy if exists "language_progress_update_own" on public.language_progress;
drop policy if exists "language_progress_delete_own" on public.language_progress;

create policy "language_progress_select_own"
  on public.language_progress for select using (auth.uid() = user_id);
create policy "language_progress_insert_own"
  on public.language_progress for insert with check (auth.uid() = user_id);
create policy "language_progress_update_own"
  on public.language_progress for update using (auth.uid() = user_id);
create policy "language_progress_delete_own"
  on public.language_progress for delete using (auth.uid() = user_id);

drop policy if exists "language_sessions_select_own" on public.language_sessions;
drop policy if exists "language_sessions_insert_own" on public.language_sessions;
drop policy if exists "language_sessions_update_own" on public.language_sessions;
drop policy if exists "language_sessions_delete_own" on public.language_sessions;

create policy "language_sessions_select_own"
  on public.language_sessions for select using (auth.uid() = user_id);
create policy "language_sessions_insert_own"
  on public.language_sessions for insert with check (auth.uid() = user_id);
create policy "language_sessions_update_own"
  on public.language_sessions for update using (auth.uid() = user_id);
create policy "language_sessions_delete_own"
  on public.language_sessions for delete using (auth.uid() = user_id);

drop policy if exists "language_lessons_select_own" on public.language_lessons;
drop policy if exists "language_lessons_insert_own" on public.language_lessons;
drop policy if exists "language_lessons_update_own" on public.language_lessons;
drop policy if exists "language_lessons_delete_own" on public.language_lessons;

create policy "language_lessons_select_own"
  on public.language_lessons for select using (auth.uid() = user_id);
create policy "language_lessons_insert_own"
  on public.language_lessons for insert with check (auth.uid() = user_id);
create policy "language_lessons_update_own"
  on public.language_lessons for update using (auth.uid() = user_id);
create policy "language_lessons_delete_own"
  on public.language_lessons for delete using (auth.uid() = user_id);

drop trigger if exists language_progress_set_updated_at on public.language_progress;
create trigger language_progress_set_updated_at
  before update on public.language_progress
  for each row execute function public.set_updated_at();

drop trigger if exists language_sessions_set_updated_at on public.language_sessions;
create trigger language_sessions_set_updated_at
  before update on public.language_sessions
  for each row execute function public.set_updated_at();

drop trigger if exists language_lessons_set_updated_at on public.language_lessons;
create trigger language_lessons_set_updated_at
  before update on public.language_lessons
  for each row execute function public.set_updated_at();
