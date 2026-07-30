-- Discovery Engine V1 — artifacts, feedback, suppressions, runs, audit
-- ADR-006 · ADR-005 · ADR-007 · RC2
-- Idempotent. execution_influence always 'none'. No Decision Support / Execution.

create table if not exists public.aura_discovery_artifacts (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  workspace_id uuid references public.workspaces (id) on delete set null,
  discovery_type text not null
    check (discovery_type in (
      'OPPORTUNITY','RISK','GAP','DEPENDENCY','STAGNATION','DUPLICATE','UNKNOWN'
    )),
  status text not null default 'PENDING_CONFIRMATION'
    check (status in (
      'GENERATED','PENDING_CONFIRMATION','CONFIRMED','REJECTED',
      'ARCHIVED','SUPPRESSED','OUTDATED','DELETED'
    )),
  title text not null,
  summary text not null default '',
  confidence integer not null default 0
    check (confidence >= 0 and confidence <= 100),
  impact text not null default 'MEDIUM'
    check (impact in ('LOW','MEDIUM','HIGH')),
  urgency text not null default 'MEDIUM'
    check (urgency in ('LOW','MEDIUM','HIGH')),
  reversibility text not null default 'HIGH'
    check (reversibility in ('HIGH','MEDIUM','LOW')),
  fingerprint text not null,
  evidence_set_hash text not null default '',
  suppression_key text,
  detector_id text not null default 'unknown',
  method text not null default 'discovery_engine_v1',
  method_version text not null default 'discovery-engine-v1',
  origin text not null default 'discovery_registry',
  sensitivity text not null default 'STANDARD'
    check (sensitivity in ('PUBLIC_PREF','STANDARD','SENSITIVE','RESTRICTED')),
  execution_influence text not null default 'none'
    check (execution_influence = 'none'),
  first_generated_at timestamptz not null default now(),
  last_validated_at timestamptz,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  deleted_at timestamptz
);

create unique index if not exists aura_discovery_artifacts_fingerprint_uidx
  on public.aura_discovery_artifacts (user_id, fingerprint)
  where deleted_at is null and status not in ('DELETED','SUPPRESSED');
create index if not exists aura_discovery_artifacts_user_idx
  on public.aura_discovery_artifacts (user_id, updated_at desc);
create index if not exists aura_discovery_artifacts_type_idx
  on public.aura_discovery_artifacts (user_id, discovery_type);
create index if not exists aura_discovery_artifacts_status_idx
  on public.aura_discovery_artifacts (user_id, status);
create index if not exists aura_discovery_artifacts_confidence_idx
  on public.aura_discovery_artifacts (user_id, confidence desc);
create index if not exists aura_discovery_artifacts_suppression_idx
  on public.aura_discovery_artifacts (user_id, suppression_key)
  where suppression_key is not null;
create index if not exists aura_discovery_artifacts_workspace_idx
  on public.aura_discovery_artifacts (workspace_id, updated_at desc)
  where workspace_id is not null;

alter table public.aura_discovery_artifacts enable row level security;

-- Own rows always; workspace-scoped rows readable by members (multiuser RC2)
drop policy if exists aura_discovery_artifacts_select on public.aura_discovery_artifacts;
create policy aura_discovery_artifacts_select
  on public.aura_discovery_artifacts for select
  using (
    auth.uid() = user_id
    or (
      workspace_id is not null
      and public.is_workspace_member(workspace_id)
    )
  );

drop policy if exists aura_discovery_artifacts_insert_own on public.aura_discovery_artifacts;
create policy aura_discovery_artifacts_insert_own
  on public.aura_discovery_artifacts for insert
  with check (auth.uid() = user_id);

drop policy if exists aura_discovery_artifacts_update_member on public.aura_discovery_artifacts;
create policy aura_discovery_artifacts_update_member
  on public.aura_discovery_artifacts for update
  using (
    auth.uid() = user_id
    or (
      workspace_id is not null
      and public.is_workspace_member(workspace_id)
    )
  )
  with check (
    auth.uid() = user_id
    or (
      workspace_id is not null
      and public.is_workspace_member(workspace_id)
    )
  );

drop policy if exists aura_discovery_artifacts_delete_own on public.aura_discovery_artifacts;
create policy aura_discovery_artifacts_delete_own
  on public.aura_discovery_artifacts for delete
  using (auth.uid() = user_id);

create table if not exists public.aura_discovery_feedback (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  workspace_id uuid references public.workspaces (id) on delete set null,
  artifact_id text not null references public.aura_discovery_artifacts (id) on delete cascade,
  kind text not null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists aura_discovery_feedback_user_idx
  on public.aura_discovery_feedback (user_id, created_at desc);
create index if not exists aura_discovery_feedback_artifact_idx
  on public.aura_discovery_feedback (artifact_id);

alter table public.aura_discovery_feedback enable row level security;

drop policy if exists aura_discovery_feedback_select on public.aura_discovery_feedback;
create policy aura_discovery_feedback_select
  on public.aura_discovery_feedback for select
  using (
    auth.uid() = user_id
    or (
      workspace_id is not null
      and public.is_workspace_member(workspace_id)
    )
  );

drop policy if exists aura_discovery_feedback_insert_own on public.aura_discovery_feedback;
create policy aura_discovery_feedback_insert_own
  on public.aura_discovery_feedback for insert
  with check (auth.uid() = user_id);

create table if not exists public.aura_discovery_suppressions (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  workspace_id uuid references public.workspaces (id) on delete set null,
  artifact_type text not null,
  semantic_key text not null,
  reason text not null,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  broken_at timestamptz,
  break_reason text
);

create index if not exists aura_discovery_suppressions_user_idx
  on public.aura_discovery_suppressions (user_id, semantic_key);
create index if not exists aura_discovery_suppressions_active_idx
  on public.aura_discovery_suppressions (user_id, created_at desc)
  where broken_at is null;

alter table public.aura_discovery_suppressions enable row level security;

drop policy if exists aura_discovery_suppressions_select_own on public.aura_discovery_suppressions;
create policy aura_discovery_suppressions_select_own
  on public.aura_discovery_suppressions for select
  using (auth.uid() = user_id);

drop policy if exists aura_discovery_suppressions_insert_own on public.aura_discovery_suppressions;
create policy aura_discovery_suppressions_insert_own
  on public.aura_discovery_suppressions for insert
  with check (auth.uid() = user_id);

drop policy if exists aura_discovery_suppressions_update_own on public.aura_discovery_suppressions;
create policy aura_discovery_suppressions_update_own
  on public.aura_discovery_suppressions for update
  using (auth.uid() = user_id);

create table if not exists public.aura_discovery_runs (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  workspace_id uuid references public.workspaces (id) on delete set null,
  correlation_id text not null,
  status text not null default 'completed',
  artifacts_generated integer not null default 0,
  suppressed_count integer not null default 0,
  reused_count integer not null default 0,
  duration_ms integer not null default 0,
  dry_run boolean not null default false,
  report jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists aura_discovery_runs_user_idx
  on public.aura_discovery_runs (user_id, created_at desc);

alter table public.aura_discovery_runs enable row level security;

drop policy if exists aura_discovery_runs_select_own on public.aura_discovery_runs;
create policy aura_discovery_runs_select_own
  on public.aura_discovery_runs for select
  using (auth.uid() = user_id);

drop policy if exists aura_discovery_runs_insert_own on public.aura_discovery_runs;
create policy aura_discovery_runs_insert_own
  on public.aura_discovery_runs for insert
  with check (auth.uid() = user_id);

create table if not exists public.aura_discovery_audit (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  workspace_id uuid references public.workspaces (id) on delete set null,
  action text not null,
  artifact_id text,
  actor text not null default 'system',
  previous_status text,
  new_status text,
  justification text not null default '',
  correlation_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists aura_discovery_audit_user_idx
  on public.aura_discovery_audit (user_id, created_at desc);
create index if not exists aura_discovery_audit_artifact_idx
  on public.aura_discovery_audit (artifact_id);

alter table public.aura_discovery_audit enable row level security;

drop policy if exists aura_discovery_audit_select on public.aura_discovery_audit;
create policy aura_discovery_audit_select
  on public.aura_discovery_audit for select
  using (
    auth.uid() = user_id
    or (
      workspace_id is not null
      and public.is_workspace_member(workspace_id)
    )
  );

drop policy if exists aura_discovery_audit_insert_own on public.aura_discovery_audit;
create policy aura_discovery_audit_insert_own
  on public.aura_discovery_audit for insert
  with check (auth.uid() = user_id);
