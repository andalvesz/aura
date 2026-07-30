-- RC2.1 Collaborative Go-Live — visibility scopes + workspace RLS parity + concurrency
-- ADR-007 · RC2.1
-- Idempotent. Does NOT enable Decision Support or Execution.
-- Apply manually (see docs/operations/rc2-go-live-checklist.md). Do not auto-apply in production.

-- ---------------------------------------------------------------------------
-- 1) Visibility scope column (PRIVATE | WORKSPACE | SHARED_WITH_SELECTED_MEMBERS | SYSTEM_INTERNAL)
-- SHARED_WITH_SELECTED_MEMBERS is reserved; app fails closed to PRIVATE until ACL exists.
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'aura_memories' and column_name = 'visibility_scope'
  ) then
    alter table public.aura_memories
      add column visibility_scope text not null default 'PRIVATE'
      check (visibility_scope in ('PRIVATE','WORKSPACE','SHARED_WITH_SELECTED_MEMBERS','SYSTEM_INTERNAL'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'aura_experiences' and column_name = 'visibility_scope'
  ) then
    alter table public.aura_experiences
      add column visibility_scope text not null default 'PRIVATE'
      check (visibility_scope in ('PRIVATE','WORKSPACE','SHARED_WITH_SELECTED_MEMBERS','SYSTEM_INTERNAL'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'aura_world_entities' and column_name = 'visibility_scope'
  ) then
    alter table public.aura_world_entities
      add column visibility_scope text not null default 'PRIVATE'
      check (visibility_scope in ('PRIVATE','WORKSPACE','SHARED_WITH_SELECTED_MEMBERS','SYSTEM_INTERNAL'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'aura_world_relationships' and column_name = 'visibility_scope'
  ) then
    alter table public.aura_world_relationships
      add column visibility_scope text not null default 'PRIVATE'
      check (visibility_scope in ('PRIVATE','WORKSPACE','SHARED_WITH_SELECTED_MEMBERS','SYSTEM_INTERNAL'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'aura_cognitive_artifacts' and column_name = 'visibility_scope'
  ) then
    alter table public.aura_cognitive_artifacts
      add column visibility_scope text not null default 'PRIVATE'
      check (visibility_scope in ('PRIVATE','WORKSPACE','SHARED_WITH_SELECTED_MEMBERS','SYSTEM_INTERNAL'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'aura_discovery_artifacts' and column_name = 'visibility_scope'
  ) then
    alter table public.aura_discovery_artifacts
      add column visibility_scope text not null default 'PRIVATE'
      check (visibility_scope in ('PRIVATE','WORKSPACE','SHARED_WITH_SELECTED_MEMBERS','SYSTEM_INTERNAL'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'aura_discovery_feedback' and column_name = 'visibility_scope'
  ) then
    alter table public.aura_discovery_feedback
      add column visibility_scope text not null default 'PRIVATE'
      check (visibility_scope in ('PRIVATE','WORKSPACE','SHARED_WITH_SELECTED_MEMBERS','SYSTEM_INTERNAL'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'aura_discovery_suppressions' and column_name = 'visibility_scope'
  ) then
    alter table public.aura_discovery_suppressions
      add column visibility_scope text not null default 'PRIVATE'
      check (visibility_scope in ('PRIVATE','WORKSPACE','SHARED_WITH_SELECTED_MEMBERS','SYSTEM_INTERNAL'));
  end if;
end $$;

-- Optimistic concurrency for collaborative feedback
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'aura_discovery_artifacts' and column_name = 'row_version'
  ) then
    alter table public.aura_discovery_artifacts
      add column row_version integer not null default 1;
  end if;
end $$;

-- Backfill WORKSPACE visibility only when consent_scope/workspace already explicit
update public.aura_memories
set visibility_scope = 'WORKSPACE'
where visibility_scope = 'PRIVATE'
  and workspace_id is not null
  and coalesce(consent_scope, 'personal') = 'workspace';

update public.aura_experiences
set visibility_scope = 'WORKSPACE'
where visibility_scope = 'PRIVATE'
  and workspace_id is not null
  and coalesce(consent_scope, 'personal') = 'workspace';

update public.aura_discovery_artifacts
set visibility_scope = 'WORKSPACE'
where visibility_scope = 'PRIVATE'
  and workspace_id is not null;

-- ---------------------------------------------------------------------------
-- 2) Helper: workspace-scoped visibility read predicate
-- ---------------------------------------------------------------------------

create or replace function public.aura_brain_visibility_readable(
  p_user_id uuid,
  p_workspace_id uuid,
  p_visibility_scope text
) returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    auth.uid() = p_user_id
    or (
      p_visibility_scope = 'WORKSPACE'
      and p_workspace_id is not null
      and public.is_workspace_member(p_workspace_id)
    );
$$;

revoke all on function public.aura_brain_visibility_readable(uuid, uuid, text) from public;
grant execute on function public.aura_brain_visibility_readable(uuid, uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3) Memory RLS — members read WORKSPACE rows only (PRIVATE stays owner-only)
-- ---------------------------------------------------------------------------

drop policy if exists "aura_memories_select_own" on public.aura_memories;
drop policy if exists aura_memories_select on public.aura_memories;
create policy aura_memories_select
  on public.aura_memories for select
  using (
    public.aura_brain_visibility_readable(user_id, workspace_id, visibility_scope)
  );

drop policy if exists "aura_experiences_select_own" on public.aura_experiences;
drop policy if exists aura_experiences_select on public.aura_experiences;
create policy aura_experiences_select
  on public.aura_experiences for select
  using (
    public.aura_brain_visibility_readable(user_id, workspace_id, visibility_scope)
  );

-- ---------------------------------------------------------------------------
-- 4) World Model RLS
-- ---------------------------------------------------------------------------

drop policy if exists "aura_world_entities_select_own" on public.aura_world_entities;
drop policy if exists aura_world_entities_select on public.aura_world_entities;
create policy aura_world_entities_select
  on public.aura_world_entities for select
  using (
    public.aura_brain_visibility_readable(user_id, workspace_id, visibility_scope)
  );

drop policy if exists "aura_world_relationships_select_own" on public.aura_world_relationships;
drop policy if exists aura_world_relationships_select on public.aura_world_relationships;
create policy aura_world_relationships_select
  on public.aura_world_relationships for select
  using (
    public.aura_brain_visibility_readable(user_id, workspace_id, visibility_scope)
  );

-- ---------------------------------------------------------------------------
-- 5) Cognitive RLS
-- ---------------------------------------------------------------------------

drop policy if exists "aura_cognitive_artifacts_select_own" on public.aura_cognitive_artifacts;
drop policy if exists aura_cognitive_artifacts_select on public.aura_cognitive_artifacts;
create policy aura_cognitive_artifacts_select
  on public.aura_cognitive_artifacts for select
  using (
    public.aura_brain_visibility_readable(user_id, workspace_id, visibility_scope)
  );

-- ---------------------------------------------------------------------------
-- 6) Discovery — tighten SELECT to visibility_scope (not any workspace_id row)
-- ---------------------------------------------------------------------------

drop policy if exists aura_discovery_artifacts_select on public.aura_discovery_artifacts;
create policy aura_discovery_artifacts_select
  on public.aura_discovery_artifacts for select
  using (
    public.aura_brain_visibility_readable(user_id, workspace_id, visibility_scope)
  );

drop policy if exists aura_discovery_artifacts_update_member on public.aura_discovery_artifacts;
create policy aura_discovery_artifacts_update_member
  on public.aura_discovery_artifacts for update
  using (
    public.aura_brain_visibility_readable(user_id, workspace_id, visibility_scope)
  )
  with check (
    public.aura_brain_visibility_readable(user_id, workspace_id, visibility_scope)
  );

drop policy if exists aura_discovery_feedback_select on public.aura_discovery_feedback;
create policy aura_discovery_feedback_select
  on public.aura_discovery_feedback for select
  using (
    public.aura_brain_visibility_readable(user_id, workspace_id, visibility_scope)
  );

-- Suppressions: workspace-shared when scope WORKSPACE (anti-reappear for collaborators)
drop policy if exists aura_discovery_suppressions_select_own on public.aura_discovery_suppressions;
drop policy if exists aura_discovery_suppressions_select on public.aura_discovery_suppressions;
create policy aura_discovery_suppressions_select
  on public.aura_discovery_suppressions for select
  using (
    public.aura_brain_visibility_readable(user_id, workspace_id, visibility_scope)
  );

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

-- ---------------------------------------------------------------------------
-- 7) Indexes for collaborative reads
-- ---------------------------------------------------------------------------

create index if not exists aura_memories_visibility_ws_idx
  on public.aura_memories (workspace_id, visibility_scope, updated_at desc)
  where workspace_id is not null and visibility_scope = 'WORKSPACE';

create index if not exists aura_discovery_artifacts_visibility_ws_idx
  on public.aura_discovery_artifacts (workspace_id, visibility_scope, updated_at desc)
  where workspace_id is not null and visibility_scope = 'WORKSPACE';

create index if not exists aura_world_entities_visibility_ws_idx
  on public.aura_world_entities (workspace_id, visibility_scope, updated_at desc)
  where workspace_id is not null and visibility_scope = 'WORKSPACE';

create index if not exists aura_cognitive_artifacts_visibility_ws_idx
  on public.aura_cognitive_artifacts (workspace_id, visibility_scope, updated_at desc)
  where workspace_id is not null and visibility_scope = 'WORKSPACE';
