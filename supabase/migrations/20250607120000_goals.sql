-- =============================================================================
-- Aura OS — Dashboard de Metas unificado
-- Tabela: goals
-- =============================================================================

create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  titulo text not null,
  tipo text not null check (
    tipo in (
      'financeira',
      'saude',
      'conteudo',
      'vendas',
      'eventos',
      'personalizada'
    )
  ),
  meta numeric(12, 2) not null check (meta > 0),
  atual numeric(12, 2) not null default 0 check (atual >= 0),
  data_inicio date not null,
  data_fim date not null,
  status text not null default 'ativa' check (
    status in ('ativa', 'concluida', 'cancelada')
  ),
  created_at timestamptz not null default now(),
  check (data_fim >= data_inicio)
);

create index if not exists goals_user_id_idx
  on public.goals (user_id, data_fim desc);

create index if not exists goals_status_idx
  on public.goals (user_id, status);

alter table public.goals enable row level security;

drop policy if exists "goals_select_own" on public.goals;
drop policy if exists "goals_insert_own" on public.goals;
drop policy if exists "goals_update_own" on public.goals;
drop policy if exists "goals_delete_own" on public.goals;

create policy "goals_select_own"
  on public.goals for select using (auth.uid() = user_id);
create policy "goals_insert_own"
  on public.goals for insert with check (auth.uid() = user_id);
create policy "goals_update_own"
  on public.goals for update using (auth.uid() = user_id);
create policy "goals_delete_own"
  on public.goals for delete using (auth.uid() = user_id);
