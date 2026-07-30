-- Cognitive Engine V1 — artifacts, evidence, feedback, suppressions, runs, audit
-- ADR-008 · ADR-005 · ADR-007 · Sprint 6.5
-- Idempotent. No Discovery tables. No chain-of-thought storage.

create table if not exists public.aura_cognitive_artifacts (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  workspace_id uuid references public.workspaces (id) on delete set null,
  artifact_type text not null
    check (artifact_type in (
      'PATTERN','CONFLICT','PROGRESS_OBSERVATION','HYPOTHESIS','INSIGHT',
      'RISK_SIGNAL','RECOMMENDATION','CLARIFYING_QUESTION',
      'INSUFFICIENT_EVIDENCE','DATA_QUALITY_WARNING'
    )),
  category text not null default 'general',
  status text not null default 'GENERATED'
    check (status in (
      'DRAFT','GENERATED','VALIDATED','PENDING_REVIEW','CONFIRMED','DISPUTED',
      'CORRECTED','REJECTED','SUPERSEDED','OUTDATED','ARCHIVED','DELETED'
    )),
  title text not null,
  summary text not null default '',
  structured_content jsonb not null default '{}'::jsonb,
  confidence integer not null default 0
    check (confidence >= 0 and confidence <= 100),
  importance integer not null default 0
    check (importance >= 0 and importance <= 100),
  sensitivity text not null default 'STANDARD'
    check (sensitivity in ('PUBLIC_PREF','STANDARD','SENSITIVE','RESTRICTED')),
  method text not null default 'cognitive_engine_v1',
  method_version text not null default 'cognitive-engine-v1',
  fingerprint text not null,
  evidence_set_hash text not null default '',
  suppression_key text,
  time_range jsonb not null default '{}'::jsonb,
  valid_from timestamptz,
  valid_until timestamptz,
  first_generated_at timestamptz not null default now(),
  last_validated_at timestamptz,
  supersedes_artifact_id text,
  superseded_by_artifact_id text,
  generated_by text not null default 'deterministic'
    check (generated_by in ('deterministic','hybrid','provider')),
  provider_metadata jsonb,
  execution_influence text not null default 'none'
    check (execution_influence = 'none'),
  subject_references jsonb not null default '[]'::jsonb,
  entity_references jsonb not null default '[]'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  deleted_at timestamptz
);

create unique index if not exists aura_cognitive_artifacts_fingerprint_uidx
  on public.aura_cognitive_artifacts (user_id, fingerprint)
  where deleted_at is null and status not in ('DELETED','SUPERSEDED');
create index if not exists aura_cognitive_artifacts_user_idx
  on public.aura_cognitive_artifacts (user_id, updated_at desc);
create index if not exists aura_cognitive_artifacts_type_idx
  on public.aura_cognitive_artifacts (user_id, artifact_type);
create index if not exists aura_cognitive_artifacts_status_idx
  on public.aura_cognitive_artifacts (user_id, status);
create index if not exists aura_cognitive_artifacts_category_idx
  on public.aura_cognitive_artifacts (user_id, category);
create index if not exists aura_cognitive_artifacts_confidence_idx
  on public.aura_cognitive_artifacts (user_id, confidence desc);
create index if not exists aura_cognitive_artifacts_importance_idx
  on public.aura_cognitive_artifacts (user_id, importance desc);
create index if not exists aura_cognitive_artifacts_suppression_idx
  on public.aura_cognitive_artifacts (user_id, suppression_key)
  where suppression_key is not null;
create index if not exists aura_cognitive_artifacts_workspace_idx
  on public.aura_cognitive_artifacts (workspace_id, user_id)
  where workspace_id is not null;
create index if not exists aura_cognitive_artifacts_validated_idx
  on public.aura_cognitive_artifacts (user_id, last_validated_at desc nulls last);
create index if not exists aura_cognitive_artifacts_generated_idx
  on public.aura_cognitive_artifacts (user_id, first_generated_at desc);

alter table public.aura_cognitive_artifacts enable row level security;

create policy "aura_cognitive_artifacts_select_own"
  on public.aura_cognitive_artifacts for select using (auth.uid() = user_id);
create policy "aura_cognitive_artifacts_insert_own"
  on public.aura_cognitive_artifacts for insert with check (auth.uid() = user_id);
create policy "aura_cognitive_artifacts_update_own"
  on public.aura_cognitive_artifacts for update using (auth.uid() = user_id);
create policy "aura_cognitive_artifacts_delete_own"
  on public.aura_cognitive_artifacts for delete using (auth.uid() = user_id);

create table if not exists public.aura_cognitive_evidence (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  artifact_id text not null references public.aura_cognitive_artifacts (id) on delete cascade,
  evidence_type text not null,
  source_layer text not null,
  source_type text not null,
  source_id text not null,
  source_reference jsonb,
  independence_key text not null,
  confidence integer not null default 0
    check (confidence >= 0 and confidence <= 100),
  summary text not null default '',
  supports text not null default 'supports'
    check (supports in ('supports','counter','neutral')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists aura_cognitive_evidence_artifact_idx
  on public.aura_cognitive_evidence (artifact_id);
create index if not exists aura_cognitive_evidence_user_idx
  on public.aura_cognitive_evidence (user_id, created_at desc);
create index if not exists aura_cognitive_evidence_independence_idx
  on public.aura_cognitive_evidence (user_id, independence_key);

alter table public.aura_cognitive_evidence enable row level security;

create policy "aura_cognitive_evidence_select_own"
  on public.aura_cognitive_evidence for select using (auth.uid() = user_id);
create policy "aura_cognitive_evidence_insert_own"
  on public.aura_cognitive_evidence for insert with check (auth.uid() = user_id);
create policy "aura_cognitive_evidence_update_own"
  on public.aura_cognitive_evidence for update using (auth.uid() = user_id);
create policy "aura_cognitive_evidence_delete_own"
  on public.aura_cognitive_evidence for delete using (auth.uid() = user_id);

create table if not exists public.aura_cognitive_feedback (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  workspace_id uuid references public.workspaces (id) on delete set null,
  artifact_id text not null references public.aura_cognitive_artifacts (id) on delete cascade,
  kind text not null,
  note text,
  correction_payload jsonb,
  created_at timestamptz not null default now()
);

create index if not exists aura_cognitive_feedback_user_idx
  on public.aura_cognitive_feedback (user_id, created_at desc);
create index if not exists aura_cognitive_feedback_artifact_idx
  on public.aura_cognitive_feedback (artifact_id);

alter table public.aura_cognitive_feedback enable row level security;

create policy "aura_cognitive_feedback_select_own"
  on public.aura_cognitive_feedback for select using (auth.uid() = user_id);
create policy "aura_cognitive_feedback_insert_own"
  on public.aura_cognitive_feedback for insert with check (auth.uid() = user_id);

create table if not exists public.aura_cognitive_suppressions (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  workspace_id uuid references public.workspaces (id) on delete set null,
  artifact_type text not null,
  category text,
  semantic_key text not null,
  context text,
  source_set_hash text,
  reason text not null,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  broken_at timestamptz,
  break_reason text
);

create index if not exists aura_cognitive_suppressions_user_idx
  on public.aura_cognitive_suppressions (user_id, semantic_key);
create index if not exists aura_cognitive_suppressions_active_idx
  on public.aura_cognitive_suppressions (user_id, created_at desc)
  where broken_at is null;

alter table public.aura_cognitive_suppressions enable row level security;

create policy "aura_cognitive_suppressions_select_own"
  on public.aura_cognitive_suppressions for select using (auth.uid() = user_id);
create policy "aura_cognitive_suppressions_insert_own"
  on public.aura_cognitive_suppressions for insert with check (auth.uid() = user_id);
create policy "aura_cognitive_suppressions_update_own"
  on public.aura_cognitive_suppressions for update using (auth.uid() = user_id);
create policy "aura_cognitive_suppressions_delete_own"
  on public.aura_cognitive_suppressions for delete using (auth.uid() = user_id);

create table if not exists public.aura_cognitive_runs (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  workspace_id uuid references public.workspaces (id) on delete set null,
  correlation_id text not null,
  status text not null default 'completed',
  context_type text not null default 'generate',
  artifacts_generated integer not null default 0,
  insufficient_count integer not null default 0,
  blocked_count integer not null default 0,
  duration_ms integer not null default 0,
  dry_run boolean not null default false,
  report jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists aura_cognitive_runs_user_idx
  on public.aura_cognitive_runs (user_id, created_at desc);

alter table public.aura_cognitive_runs enable row level security;

create policy "aura_cognitive_runs_select_own"
  on public.aura_cognitive_runs for select using (auth.uid() = user_id);
create policy "aura_cognitive_runs_insert_own"
  on public.aura_cognitive_runs for insert with check (auth.uid() = user_id);

create table if not exists public.aura_cognitive_audit (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  workspace_id uuid references public.workspaces (id) on delete set null,
  action text not null,
  artifact_id text,
  actor text not null default 'system',
  previous_status text,
  new_status text,
  method text,
  method_version text,
  provider text,
  validator_disposition text,
  justification text not null default '',
  correlation_id text,
  source_references jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists aura_cognitive_audit_user_idx
  on public.aura_cognitive_audit (user_id, created_at desc);
create index if not exists aura_cognitive_audit_artifact_idx
  on public.aura_cognitive_audit (artifact_id)
  where artifact_id is not null;

alter table public.aura_cognitive_audit enable row level security;

create policy "aura_cognitive_audit_select_own"
  on public.aura_cognitive_audit for select using (auth.uid() = user_id);
create policy "aura_cognitive_audit_insert_own"
  on public.aura_cognitive_audit for insert with check (auth.uid() = user_id);
