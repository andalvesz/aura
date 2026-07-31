-- Sprint 9.2 Continuous Learning Engine
-- Proposals + signals persistence prep. Runtime V1 may stay in-memory.
-- Reuses aura_brain_feedback / module feedback tables via adapters — does not replace them.
-- Do NOT apply automatically in production.

create table if not exists public.aura_learning_signals (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid null references public.workspaces(id) on delete set null,
  signal_type text not null,
  source_layer text not null,
  source_type text not null,
  source_id text not null,
  subject_type text not null,
  subject_id text not null,
  actor_id uuid not null references auth.users(id) on delete cascade,
  context jsonb not null default '{}'::jsonb,
  value double precision not null default 1,
  weight double precision not null default 1,
  confidence double precision not null default 0.7,
  occurred_at timestamptz not null default now(),
  idempotency_key text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  soft_deleted boolean not null default false,
  unique (user_id, idempotency_key)
);

create index if not exists aura_learning_signals_user_occurred_idx
  on public.aura_learning_signals (user_id, occurred_at desc)
  where soft_deleted = false;

create table if not exists public.aura_learning_patterns (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid null,
  pattern_key text not null,
  title text not null,
  summary text not null default '',
  scope text not null default 'PERSONAL',
  signal_ids text[] not null default '{}',
  counter_signal_ids text[] not null default '{}',
  sample_size integer not null default 0,
  time_range jsonb not null default '{}'::jsonb,
  confidence double precision not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.aura_learning_proposals (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid null references public.workspaces(id) on delete set null,
  title text not null,
  summary text not null default '',
  proposal_type text not null,
  status text not null default 'GENERATED',
  scope text not null default 'PERSONAL',
  context jsonb not null default '{}'::jsonb,
  supporting_signal_ids text[] not null default '{}',
  counter_signal_ids text[] not null default '{}',
  sample_size integer not null default 0,
  time_range jsonb not null default '{}'::jsonb,
  confidence double precision not null default 0,
  expected_benefit text not null default '',
  possible_risk text not null default '',
  proposed_change jsonb not null default '{}'::jsonb,
  affected_components text[] not null default '{}',
  requires_confirmation boolean not null default true,
  valid_until timestamptz not null,
  payload_hash text not null,
  pattern_id text null,
  evaluation_id text null,
  application_id text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  soft_deleted boolean not null default false,
  row_version integer not null default 1
);

create index if not exists aura_learning_proposals_owner_updated_idx
  on public.aura_learning_proposals (owner_id, updated_at desc)
  where soft_deleted = false;

create table if not exists public.aura_learning_proposal_signals (
  proposal_id text not null references public.aura_learning_proposals(id) on delete cascade,
  signal_id text not null,
  role text not null check (role in ('supporting','counter')),
  primary key (proposal_id, signal_id, role)
);

create table if not exists public.aura_learning_applications (
  id text primary key,
  proposal_id text not null references public.aura_learning_proposals(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  applied_at timestamptz not null default now(),
  snapshot_before jsonb not null default '{}'::jsonb,
  snapshot_after jsonb not null default '{}'::jsonb,
  reversible boolean not null default true,
  reverted_at timestamptz null
);

create table if not exists public.aura_learning_evaluations (
  id text primary key,
  proposal_id text not null references public.aura_learning_proposals(id) on delete cascade,
  application_id text not null references public.aura_learning_applications(id) on delete cascade,
  baseline_metric double precision not null default 0,
  current_metric double precision not null default 0,
  window_from timestamptz not null,
  window_to timestamptz not null,
  sample_size integer not null default 0,
  result text not null default 'INCONCLUSIVE',
  limitations text[] not null default '{}',
  completed_at timestamptz null
);

create table if not exists public.aura_learning_suppressions (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid null,
  proposal_type text not null,
  pattern_key text not null,
  reason text not null default '',
  rejected_proposal_id text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz null
);

create table if not exists public.aura_learning_audit (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid null,
  proposal_id text null,
  event text not null,
  summary text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists aura_learning_audit_user_idx
  on public.aura_learning_audit (user_id, created_at desc);

alter table public.aura_learning_signals enable row level security;
alter table public.aura_learning_patterns enable row level security;
alter table public.aura_learning_proposals enable row level security;
alter table public.aura_learning_proposal_signals enable row level security;
alter table public.aura_learning_applications enable row level security;
alter table public.aura_learning_evaluations enable row level security;
alter table public.aura_learning_suppressions enable row level security;
alter table public.aura_learning_audit enable row level security;

drop policy if exists aura_learning_signals_owner on public.aura_learning_signals;
create policy aura_learning_signals_owner on public.aura_learning_signals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists aura_learning_patterns_owner on public.aura_learning_patterns;
create policy aura_learning_patterns_owner on public.aura_learning_patterns
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists aura_learning_proposals_owner on public.aura_learning_proposals;
create policy aura_learning_proposals_owner on public.aura_learning_proposals
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists aura_learning_proposal_signals_via_owner on public.aura_learning_proposal_signals;
create policy aura_learning_proposal_signals_via_owner on public.aura_learning_proposal_signals
  for all using (
    exists (select 1 from public.aura_learning_proposals p where p.id = proposal_id and p.owner_id = auth.uid())
  ) with check (
    exists (select 1 from public.aura_learning_proposals p where p.id = proposal_id and p.owner_id = auth.uid())
  );

drop policy if exists aura_learning_applications_owner on public.aura_learning_applications;
create policy aura_learning_applications_owner on public.aura_learning_applications
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists aura_learning_evaluations_via_owner on public.aura_learning_evaluations;
create policy aura_learning_evaluations_via_owner on public.aura_learning_evaluations
  for all using (
    exists (select 1 from public.aura_learning_proposals p where p.id = proposal_id and p.owner_id = auth.uid())
  ) with check (
    exists (select 1 from public.aura_learning_proposals p where p.id = proposal_id and p.owner_id = auth.uid())
  );

drop policy if exists aura_learning_suppressions_owner on public.aura_learning_suppressions;
create policy aura_learning_suppressions_owner on public.aura_learning_suppressions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists aura_learning_audit_own on public.aura_learning_audit;
create policy aura_learning_audit_own on public.aura_learning_audit
  for select using (auth.uid() = user_id);

drop policy if exists aura_learning_audit_insert_own on public.aura_learning_audit;
create policy aura_learning_audit_insert_own on public.aura_learning_audit
  for insert with check (auth.uid() = user_id);

comment on table public.aura_learning_proposals is
  'Sprint 9.2 Continuous Learning. Never auto-applied. Distinct from aura_brain_feedback.';
