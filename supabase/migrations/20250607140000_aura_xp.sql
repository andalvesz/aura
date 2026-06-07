-- =============================================================================
-- Aura OS — Sistema de progresso (XP)
-- Tabelas: user_xp, xp_history
-- =============================================================================

create table if not exists public.user_xp (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  xp_total integer not null default 0 check (xp_total >= 0),
  nivel integer not null default 1 check (nivel >= 1),
  streak_dias integer not null default 0 check (streak_dias >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.xp_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  acao text not null,
  xp integer not null check (xp > 0),
  created_at timestamptz not null default now()
);

create index if not exists user_xp_user_id_idx on public.user_xp (user_id);

create index if not exists xp_history_user_created_idx
  on public.xp_history (user_id, created_at desc);

create index if not exists xp_history_user_acao_idx
  on public.xp_history (user_id, acao, created_at desc);

alter table public.user_xp enable row level security;
alter table public.xp_history enable row level security;

drop policy if exists "user_xp_select_own" on public.user_xp;
drop policy if exists "user_xp_insert_own" on public.user_xp;
drop policy if exists "user_xp_update_own" on public.user_xp;
drop policy if exists "user_xp_delete_own" on public.user_xp;

create policy "user_xp_select_own"
  on public.user_xp for select using (auth.uid() = user_id);
create policy "user_xp_insert_own"
  on public.user_xp for insert with check (auth.uid() = user_id);
create policy "user_xp_update_own"
  on public.user_xp for update using (auth.uid() = user_id);
create policy "user_xp_delete_own"
  on public.user_xp for delete using (auth.uid() = user_id);

drop policy if exists "xp_history_select_own" on public.xp_history;
drop policy if exists "xp_history_insert_own" on public.xp_history;
drop policy if exists "xp_history_update_own" on public.xp_history;
drop policy if exists "xp_history_delete_own" on public.xp_history;

create policy "xp_history_select_own"
  on public.xp_history for select using (auth.uid() = user_id);
create policy "xp_history_insert_own"
  on public.xp_history for insert with check (auth.uid() = user_id);
create policy "xp_history_update_own"
  on public.xp_history for update using (auth.uid() = user_id);
create policy "xp_history_delete_own"
  on public.xp_history for delete using (auth.uid() = user_id);
