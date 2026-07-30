-- Memory Engine V1 — experiences, memories, feedback, promotions, audit
-- ADR-003 / ADR-003 Addendum / ADR-005 / ADR-007 · Sprint 6.3
-- Idempotent. No Knowledge Graph tables.

create table if not exists public.aura_experiences (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  workspace_id uuid references public.workspaces (id) on delete set null,
  experience_type text not null,
  occurred_at timestamptz not null,
  source_type text not null,
  source_reference jsonb,
  actor_type text not null default 'system',
  actor_id text,
  subject_type text,
  subject_id text,
  context text not null default 'general',
  payload jsonb not null default '{}'::jsonb,
  sensitivity text not null default 'STANDARD'
    check (sensitivity in ('PUBLIC_PREF','STANDARD','SENSITIVE','RESTRICTED')),
  consent_scope text not null default 'personal'
    check (consent_scope in ('personal','workspace','shared','system')),
  idempotency_key text,
  correlation_id text,
  fingerprint text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists aura_experiences_idempotency_uidx
  on public.aura_experiences (user_id, idempotency_key)
  where idempotency_key is not null;
create index if not exists aura_experiences_user_idx
  on public.aura_experiences (user_id, occurred_at desc);
create index if not exists aura_experiences_fingerprint_idx
  on public.aura_experiences (user_id, fingerprint);
create index if not exists aura_experiences_workspace_idx
  on public.aura_experiences (workspace_id, user_id)
  where workspace_id is not null;

alter table public.aura_experiences enable row level security;

create policy "aura_experiences_select_own"
  on public.aura_experiences for select using (auth.uid() = user_id);
create policy "aura_experiences_insert_own"
  on public.aura_experiences for insert with check (auth.uid() = user_id);
create policy "aura_experiences_update_own"
  on public.aura_experiences for update using (auth.uid() = user_id);
create policy "aura_experiences_delete_own"
  on public.aura_experiences for delete using (auth.uid() = user_id);

create table if not exists public.aura_memories (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  workspace_id uuid references public.workspaces (id) on delete set null,
  memory_type text not null
    check (memory_type in ('EPISODIC','SEMANTIC','PROCEDURAL','REFLECTIVE')),
  status text not null default 'ACTIVE'
    check (status in (
      'ACTIVE','PENDING_REVIEW','CONFIRMED','DISPUTED','CORRECTED',
      'SUPERSEDED','REJECTED','OUTDATED','ARCHIVED','DELETED'
    )),
  title text not null,
  content text not null,
  structured_content jsonb not null,
  source_type text not null,
  source_reference jsonb,
  evidence jsonb not null default '[]'::jsonb,
  context text not null default 'general',
  subjects jsonb not null default '[]'::jsonb,
  importance integer not null default 0
    check (importance >= 0 and importance <= 100),
  confidence integer not null default 0
    check (confidence >= 0 and confidence <= 100),
  weight integer not null default 0
    check (weight >= 0 and weight <= 100),
  sensitivity text not null default 'STANDARD'
    check (sensitivity in ('PUBLIC_PREF','STANDARD','SENSITIVE','RESTRICTED')),
  retention_policy text not null default 'standard'
    check (retention_policy in (
      'permanent','long_term','standard','short_term','session','until_date','user_managed'
    )),
  valid_from timestamptz,
  valid_until timestamptz,
  occurred_at timestamptz not null,
  last_recalled_at timestamptz,
  recall_count integer not null default 0,
  supersedes_memory_id text,
  superseded_by_memory_id text,
  duplicate_of_memory_id text,
  promotion_status text not null default 'NONE',
  experience_id text references public.aura_experiences (id) on delete set null,
  idempotency_key text,
  fingerprint text not null,
  semantic_key text,
  score_history jsonb not null default '[]'::jsonb,
  consent_scope text not null default 'personal',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  deleted_at timestamptz
);

create unique index if not exists aura_memories_idempotency_uidx
  on public.aura_memories (user_id, idempotency_key)
  where idempotency_key is not null;
create index if not exists aura_memories_user_idx
  on public.aura_memories (user_id, updated_at desc);
create index if not exists aura_memories_user_type_idx
  on public.aura_memories (user_id, memory_type);
create index if not exists aura_memories_user_status_idx
  on public.aura_memories (user_id, status);
create index if not exists aura_memories_occurred_idx
  on public.aura_memories (user_id, occurred_at desc);
create index if not exists aura_memories_context_idx
  on public.aura_memories (user_id, context);
create index if not exists aura_memories_source_idx
  on public.aura_memories (user_id, source_type);
create index if not exists aura_memories_workspace_idx
  on public.aura_memories (workspace_id, user_id)
  where workspace_id is not null;
create index if not exists aura_memories_importance_idx
  on public.aura_memories (user_id, importance desc);
create index if not exists aura_memories_confidence_idx
  on public.aura_memories (user_id, confidence desc);
create index if not exists aura_memories_weight_idx
  on public.aura_memories (user_id, weight desc);
create index if not exists aura_memories_promotion_idx
  on public.aura_memories (user_id, promotion_status);
create index if not exists aura_memories_fingerprint_idx
  on public.aura_memories (user_id, fingerprint);
create index if not exists aura_memories_semantic_idx
  on public.aura_memories (user_id, semantic_key)
  where semantic_key is not null;

alter table public.aura_memories enable row level security;

create policy "aura_memories_select_own"
  on public.aura_memories for select using (auth.uid() = user_id);
create policy "aura_memories_insert_own"
  on public.aura_memories for insert with check (auth.uid() = user_id);
create policy "aura_memories_update_own"
  on public.aura_memories for update using (auth.uid() = user_id);
create policy "aura_memories_delete_own"
  on public.aura_memories for delete using (auth.uid() = user_id);

create table if not exists public.aura_memory_evidence (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  memory_id text not null references public.aura_memories (id) on delete cascade,
  observed_at timestamptz not null,
  source_type text not null,
  source_reference jsonb,
  summary text not null,
  strength integer not null default 0
    check (strength >= 0 and strength <= 100),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists aura_memory_evidence_memory_idx
  on public.aura_memory_evidence (memory_id, observed_at desc);
create index if not exists aura_memory_evidence_user_idx
  on public.aura_memory_evidence (user_id, created_at desc);

alter table public.aura_memory_evidence enable row level security;

create policy "aura_memory_evidence_select_own"
  on public.aura_memory_evidence for select using (auth.uid() = user_id);
create policy "aura_memory_evidence_insert_own"
  on public.aura_memory_evidence for insert with check (auth.uid() = user_id);
create policy "aura_memory_evidence_delete_own"
  on public.aura_memory_evidence for delete using (auth.uid() = user_id);

create table if not exists public.aura_memory_feedback (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  memory_id text not null references public.aura_memories (id) on delete cascade,
  kind text not null
    check (kind in (
      'accurate','inaccurate','outdated','irrelevant',
      'useful','sensitive','forget','correct'
    )),
  note text,
  correction_content text,
  created_at timestamptz not null default now()
);

create index if not exists aura_memory_feedback_user_idx
  on public.aura_memory_feedback (user_id, created_at desc);
create index if not exists aura_memory_feedback_memory_idx
  on public.aura_memory_feedback (memory_id, created_at desc);

alter table public.aura_memory_feedback enable row level security;

create policy "aura_memory_feedback_select_own"
  on public.aura_memory_feedback for select using (auth.uid() = user_id);
create policy "aura_memory_feedback_insert_own"
  on public.aura_memory_feedback for insert with check (auth.uid() = user_id);

create table if not exists public.aura_memory_promotions (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  memory_id text not null references public.aura_memories (id) on delete cascade,
  decision text not null,
  reason text not null default '',
  memory_confidence integer not null default 0,
  promotion_confidence integer not null default 0,
  gates jsonb not null default '[]'::jsonb,
  target jsonb,
  requires_user_confirmation boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists aura_memory_promotions_user_idx
  on public.aura_memory_promotions (user_id, created_at desc);
create index if not exists aura_memory_promotions_memory_idx
  on public.aura_memory_promotions (memory_id, created_at desc);

alter table public.aura_memory_promotions enable row level security;

create policy "aura_memory_promotions_select_own"
  on public.aura_memory_promotions for select using (auth.uid() = user_id);
create policy "aura_memory_promotions_insert_own"
  on public.aura_memory_promotions for insert with check (auth.uid() = user_id);

create table if not exists public.aura_memory_audit (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  workspace_id uuid references public.workspaces (id) on delete set null,
  memory_id text,
  experience_id text,
  action text not null,
  previous_state jsonb,
  next_state jsonb,
  source_type text,
  reason text not null default '',
  correlation_id text,
  created_at timestamptz not null default now()
);

create index if not exists aura_memory_audit_user_idx
  on public.aura_memory_audit (user_id, created_at desc);
create index if not exists aura_memory_audit_memory_idx
  on public.aura_memory_audit (memory_id, created_at desc);

alter table public.aura_memory_audit enable row level security;

create policy "aura_memory_audit_select_own"
  on public.aura_memory_audit for select using (auth.uid() = user_id);
create policy "aura_memory_audit_insert_own"
  on public.aura_memory_audit for insert with check (auth.uid() = user_id);

-- No UPDATE/DELETE policies for audit — append-only for owners via insert only.
