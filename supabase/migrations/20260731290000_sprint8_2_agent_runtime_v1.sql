-- Sprint 8.2 Aura Agent Runtime V1
-- Controlled operational agents. Does NOT replace agent_history (chat multi-agent).
-- Runtime V1 remains in-memory; migration prepares persistence + RLS.
-- Do NOT apply automatically in production.

create table if not exists public.aura_agent_definitions (
  id text primary key,
  version text not null default '1',
  name text not null,
  description text not null default '',
  purpose text not null default '',
  allowed_contexts text[] not null default '{personal}',
  allowed_action_ids text[] not null default '{}',
  blocked_action_ids text[] not null default '{}',
  maximum_risk_level text not null default 'LOW',
  supported_autonomy_levels text[] not null default '{SUGGEST,PREPARE}',
  maximum_steps integer not null default 5,
  maximum_duration_ms integer not null default 300000,
  maximum_actions integer not null default 3,
  requires_approved_plan boolean not null default false,
  enabled_by_default boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.aura_agent_sessions (
  id text primary key,
  agent_id text not null,
  agent_version text not null default '1',
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid null references public.workspaces(id) on delete set null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  objective text not null,
  source_type text not null,
  source_id text null,
  plan_id text null,
  project_id text null,
  status text not null default 'DRAFT' check (status in (
    'DRAFT','READY','RUNNING','WAITING_CONFIRMATION','WAITING_INPUT','PAUSED',
    'COMPLETED','PARTIAL','FAILED','CANCELLED','EXPIRED','BLOCKED'
  )),
  autonomy_level text not null default 'SUGGEST',
  risk_ceiling text not null default 'LOW',
  step_budget integer not null default 5,
  action_budget integer not null default 3,
  time_budget_ms integer not null default 300000,
  steps_used integer not null default 0,
  actions_used integer not null default 0,
  retries_used integer not null default 0,
  context_snapshot jsonb null,
  current_step_id text null,
  checkpoint jsonb null,
  result jsonb null,
  report text null,
  error text null,
  lease_owner text null,
  lease_expires_at timestamptz null,
  started_at timestamptz null,
  completed_at timestamptz null,
  expires_at timestamptz not null,
  row_version integer not null default 1,
  soft_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists aura_agent_sessions_owner_idx
  on public.aura_agent_sessions (owner_id, updated_at desc);
create index if not exists aura_agent_sessions_status_idx
  on public.aura_agent_sessions (owner_id, status);
create index if not exists aura_agent_sessions_plan_idx
  on public.aura_agent_sessions (plan_id);

create table if not exists public.aura_agent_steps (
  id text primary key,
  session_id text not null references public.aura_agent_sessions(id) on delete cascade,
  step_index integer not null default 0,
  title text not null,
  plan_step_id text null,
  action_id text null,
  status text not null default 'PENDING',
  input jsonb not null default '{}'::jsonb,
  prepared_output jsonb null,
  execution_result jsonb null,
  verification jsonb null,
  error text null,
  idempotency_key text not null,
  requires_confirmation boolean not null default true,
  confirmation_token text null,
  confirmation_expires_at timestamptz null,
  confirmation_payload_hash text null,
  question text null,
  user_answer text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, idempotency_key)
);

create table if not exists public.aura_agent_checkpoints (
  session_id text primary key references public.aura_agent_sessions(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.aura_agent_messages (
  id text primary key,
  session_id text not null references public.aura_agent_sessions(id) on delete cascade,
  role text not null check (role in ('system','agent','user')),
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.aura_agent_confirmations (
  id text primary key,
  session_id text not null references public.aura_agent_sessions(id) on delete cascade,
  step_id text not null,
  token text not null unique,
  payload_hash text not null,
  requested_by uuid not null references auth.users(id) on delete cascade,
  confirmed_by uuid null,
  expires_at timestamptz not null,
  confirmed_at timestamptz null,
  revoked boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.aura_agent_results (
  session_id text primary key references public.aura_agent_sessions(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  report text null,
  created_at timestamptz not null default now()
);

create table if not exists public.aura_agent_audit (
  id text primary key,
  session_id text null,
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid null,
  action text not null,
  summary text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists aura_agent_audit_user_idx
  on public.aura_agent_audit (user_id, created_at desc);

alter table public.aura_agent_sessions enable row level security;
alter table public.aura_agent_steps enable row level security;
alter table public.aura_agent_checkpoints enable row level security;
alter table public.aura_agent_messages enable row level security;
alter table public.aura_agent_confirmations enable row level security;
alter table public.aura_agent_results enable row level security;
alter table public.aura_agent_audit enable row level security;
alter table public.aura_agent_definitions enable row level security;

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

create policy "aura_agent_sessions_insert"
  on public.aura_agent_sessions for insert
  with check (auth.uid() = owner_id and auth.uid() = user_id);

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

create policy "aura_agent_steps_select"
  on public.aura_agent_steps for select
  using (
    exists (
      select 1 from public.aura_agent_sessions s
      where s.id = session_id and (s.owner_id = auth.uid() or s.user_id = auth.uid())
    )
  );

create policy "aura_agent_audit_select"
  on public.aura_agent_audit for select using (auth.uid() = user_id);

create policy "aura_agent_audit_insert"
  on public.aura_agent_audit for insert with check (auth.uid() = user_id);

create policy "aura_agent_definitions_select"
  on public.aura_agent_definitions for select using (true);

comment on table public.aura_agent_sessions is
  'Sprint 8.2 Agent Runtime V1. Distinct from public.agent_history (chat). Runtime may stay in-memory until adapter ships.';
