-- World Model V1 — entities, relationships, suppressions, audit
-- ADR-004 / ADR-004 Addendum / ADR-005 / ADR-007 · Sprint 6.4
-- Idempotent. No Neo4j. No Discovery tables.

create table if not exists public.aura_world_entities (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  workspace_id uuid references public.workspaces (id) on delete set null,
  entity_type text not null,
  canonical_key text not null,
  display_name text not null,
  description text not null default '',
  status text not null default 'ACTIVE'
    check (status in (
      'ACTIVE','PENDING_REVIEW','CONFIRMED','DISPUTED','SUPERSEDED',
      'OUTDATED','REJECTED','ARCHIVED','DELETED'
    )),
  confidence integer not null default 0
    check (confidence >= 0 and confidence <= 100),
  importance integer not null default 0
    check (importance >= 0 and importance <= 100),
  sensitivity text not null default 'STANDARD'
    check (sensitivity in ('PUBLIC_PREF','STANDARD','SENSITIVE','RESTRICTED')),
  context text not null default 'general',
  attributes jsonb not null default '{}'::jsonb,
  source_type text not null,
  source_reference jsonb,
  external_reference text,
  aliases jsonb not null default '[]'::jsonb,
  valid_from timestamptz,
  valid_until timestamptz,
  first_observed_at timestamptz not null default now(),
  last_observed_at timestamptz not null default now(),
  merged_into_id text,
  score_history jsonb not null default '[]'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  deleted_at timestamptz
);

create unique index if not exists aura_world_entities_canonical_uidx
  on public.aura_world_entities (user_id, canonical_key)
  where deleted_at is null and status not in ('DELETED','SUPERSEDED');
create unique index if not exists aura_world_entities_source_uidx
  on public.aura_world_entities (
    user_id,
    source_type,
    ((source_reference->>'entityType')),
    ((source_reference->>'entityId'))
  )
  where source_reference is not null and deleted_at is null;
create index if not exists aura_world_entities_user_idx
  on public.aura_world_entities (user_id, updated_at desc);
create index if not exists aura_world_entities_type_idx
  on public.aura_world_entities (user_id, entity_type);
create index if not exists aura_world_entities_status_idx
  on public.aura_world_entities (user_id, status);
create index if not exists aura_world_entities_context_idx
  on public.aura_world_entities (user_id, context);
create index if not exists aura_world_entities_workspace_idx
  on public.aura_world_entities (workspace_id, user_id)
  where workspace_id is not null;
create index if not exists aura_world_entities_confidence_idx
  on public.aura_world_entities (user_id, confidence desc);

alter table public.aura_world_entities enable row level security;

create policy "aura_world_entities_select_own"
  on public.aura_world_entities for select using (auth.uid() = user_id);
create policy "aura_world_entities_insert_own"
  on public.aura_world_entities for insert with check (auth.uid() = user_id);
create policy "aura_world_entities_update_own"
  on public.aura_world_entities for update using (auth.uid() = user_id);
create policy "aura_world_entities_delete_own"
  on public.aura_world_entities for delete using (auth.uid() = user_id);

create table if not exists public.aura_world_relationships (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  workspace_id uuid references public.workspaces (id) on delete set null,
  source_entity_id text not null references public.aura_world_entities (id) on delete cascade,
  target_entity_id text not null references public.aura_world_entities (id) on delete cascade,
  relationship_type text not null,
  direction text not null default 'forward'
    check (direction in ('forward','symmetric')),
  status text not null default 'ACTIVE'
    check (status in (
      'ACTIVE','HYPOTHESIS','PENDING_CONFIRMATION','CONFIRMED','DISPUTED',
      'REJECTED','SUPERSEDED','OUTDATED','ARCHIVED','DELETED'
    )),
  confidence integer not null default 0
    check (confidence >= 0 and confidence <= 100),
  weight integer not null default 0
    check (weight >= 0 and weight <= 100),
  importance integer not null default 0
    check (importance >= 0 and importance <= 100),
  context text not null default 'general',
  source_type text not null,
  source_reference jsonb,
  evidence jsonb not null default '[]'::jsonb,
  projection_confidence integer not null default 0
    check (projection_confidence >= 0 and projection_confidence <= 100),
  valid_from timestamptz,
  valid_until timestamptz,
  first_observed_at timestamptz not null default now(),
  last_observed_at timestamptz not null default now(),
  supersedes_relationship_id text,
  superseded_by_relationship_id text,
  score_history jsonb not null default '[]'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  deleted_at timestamptz,
  check (source_entity_id <> target_entity_id or relationship_type = 'SELF')
);

create unique index if not exists aura_world_rel_idempotency_uidx
  on public.aura_world_relationships (
    user_id,
    relationship_type,
    source_entity_id,
    target_entity_id,
    ((source_reference->>'entityType')),
    ((source_reference->>'entityId'))
  )
  where source_reference is not null and deleted_at is null and status <> 'DELETED';
create index if not exists aura_world_rel_user_idx
  on public.aura_world_relationships (user_id, updated_at desc);
create index if not exists aura_world_rel_source_idx
  on public.aura_world_relationships (source_entity_id, relationship_type);
create index if not exists aura_world_rel_target_idx
  on public.aura_world_relationships (target_entity_id, relationship_type);
create index if not exists aura_world_rel_type_idx
  on public.aura_world_relationships (user_id, relationship_type);
create index if not exists aura_world_rel_status_idx
  on public.aura_world_relationships (user_id, status);
create index if not exists aura_world_rel_workspace_idx
  on public.aura_world_relationships (workspace_id, user_id)
  where workspace_id is not null;

alter table public.aura_world_relationships enable row level security;

create policy "aura_world_relationships_select_own"
  on public.aura_world_relationships for select using (auth.uid() = user_id);
create policy "aura_world_relationships_insert_own"
  on public.aura_world_relationships for insert with check (auth.uid() = user_id);
create policy "aura_world_relationships_update_own"
  on public.aura_world_relationships for update using (auth.uid() = user_id);
create policy "aura_world_relationships_delete_own"
  on public.aura_world_relationships for delete using (auth.uid() = user_id);

create table if not exists public.aura_world_suppressions (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  workspace_id uuid references public.workspaces (id) on delete set null,
  kind text not null check (kind in ('entity','relationship')),
  source_type text not null,
  source_reference jsonb not null,
  relationship_type text,
  reason text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists aura_world_suppressions_user_idx
  on public.aura_world_suppressions (user_id, created_at desc);

alter table public.aura_world_suppressions enable row level security;

create policy "aura_world_suppressions_select_own"
  on public.aura_world_suppressions for select using (auth.uid() = user_id);
create policy "aura_world_suppressions_insert_own"
  on public.aura_world_suppressions for insert with check (auth.uid() = user_id);

create table if not exists public.aura_world_audit (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  workspace_id uuid references public.workspaces (id) on delete set null,
  entity_id text,
  relationship_id text,
  action text not null,
  previous_state jsonb,
  next_state jsonb,
  source_type text,
  reason text not null default '',
  correlation_id text,
  created_at timestamptz not null default now()
);

create index if not exists aura_world_audit_user_idx
  on public.aura_world_audit (user_id, created_at desc);
create index if not exists aura_world_audit_entity_idx
  on public.aura_world_audit (entity_id, created_at desc);

alter table public.aura_world_audit enable row level security;

create policy "aura_world_audit_select_own"
  on public.aura_world_audit for select using (auth.uid() = user_id);
create policy "aura_world_audit_insert_own"
  on public.aura_world_audit for insert with check (auth.uid() = user_id);

-- No UPDATE/DELETE on audit — append-only.
