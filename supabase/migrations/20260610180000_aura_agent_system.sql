-- Aura Agent System — histórico de consultas multiagente

create table if not exists public.agent_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  agent_id text not null,
  user_message text not null,
  agent_response text not null,
  consulted_agents jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists agent_history_user_created_idx
  on public.agent_history (user_id, created_at desc);

create index if not exists agent_history_agent_idx
  on public.agent_history (user_id, agent_id, created_at desc);

alter table public.agent_history enable row level security;

drop policy if exists "agent_history_select_own" on public.agent_history;
create policy "agent_history_select_own"
  on public.agent_history for select using (auth.uid() = user_id);

drop policy if exists "agent_history_insert_own" on public.agent_history;
create policy "agent_history_insert_own"
  on public.agent_history for insert with check (auth.uid() = user_id);
