-- Histórico de ações executadas pela Central de Comandos da Aura

create table if not exists public.aura_command_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  command_id text not null,
  module text not null,
  summary text not null,
  payload jsonb not null default '{}'::jsonb,
  result jsonb,
  status text not null default 'success' check (status in ('success', 'error')),
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists aura_command_history_user_created_idx
  on public.aura_command_history (user_id, created_at desc);

alter table public.aura_command_history enable row level security;

drop policy if exists "aura_command_history_select_own" on public.aura_command_history;
create policy "aura_command_history_select_own"
  on public.aura_command_history for select using (auth.uid() = user_id);

drop policy if exists "aura_command_history_insert_own" on public.aura_command_history;
create policy "aura_command_history_insert_own"
  on public.aura_command_history for insert with check (auth.uid() = user_id);
