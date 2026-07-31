-- Sprint 8.2 part B — RLS (safe to re-run)
alter table public.aura_agent_sessions enable row level security;
alter table public.aura_agent_steps enable row level security;
alter table public.aura_agent_checkpoints enable row level security;
alter table public.aura_agent_messages enable row level security;
alter table public.aura_agent_confirmations enable row level security;
alter table public.aura_agent_results enable row level security;
alter table public.aura_agent_audit enable row level security;
alter table public.aura_agent_definitions enable row level security;

drop policy if exists "aura_agent_sessions_select" on public.aura_agent_sessions;
create policy "aura_agent_sessions_select"
  on public.aura_agent_sessions for select
  using (
    auth.uid() = owner_id or auth.uid() = user_id
    or (
      workspace_id is not null and exists (
        select 1 from public.workspace_members wm
        where wm.workspace_id = aura_agent_sessions.workspace_id
          and wm.user_id = auth.uid()
      )
    )
  );

drop policy if exists "aura_agent_sessions_insert" on public.aura_agent_sessions;
create policy "aura_agent_sessions_insert"
  on public.aura_agent_sessions for insert
  with check (auth.uid() = owner_id and auth.uid() = user_id);

drop policy if exists "aura_agent_sessions_update" on public.aura_agent_sessions;
create policy "aura_agent_sessions_update"
  on public.aura_agent_sessions for update
  using (
    auth.uid() = owner_id
    or (
      workspace_id is not null and exists (
        select 1 from public.workspace_members wm
        where wm.workspace_id = aura_agent_sessions.workspace_id
          and wm.user_id = auth.uid()
          and wm.role in ('owner','admin','editor','member')
      )
    )
  );

drop policy if exists "aura_agent_steps_select" on public.aura_agent_steps;
create policy "aura_agent_steps_select"
  on public.aura_agent_steps for select
  using (
    exists (
      select 1 from public.aura_agent_sessions s
      where s.id = session_id and (s.owner_id = auth.uid() or s.user_id = auth.uid())
    )
  );

drop policy if exists "aura_agent_audit_select" on public.aura_agent_audit;
create policy "aura_agent_audit_select"
  on public.aura_agent_audit for select using (auth.uid() = user_id);

drop policy if exists "aura_agent_audit_insert" on public.aura_agent_audit;
create policy "aura_agent_audit_insert"
  on public.aura_agent_audit for insert with check (auth.uid() = user_id);

drop policy if exists "aura_agent_definitions_select" on public.aura_agent_definitions;
create policy "aura_agent_definitions_select"
  on public.aura_agent_definitions for select using (true);

comment on table public.aura_agent_sessions is
  'Sprint 8.2 Agent Runtime V1. Distinct from public.agent_history (chat). Runtime may stay in-memory until adapter ships.';

