-- Sprint 10.1 Public Beta & Production Readiness
-- Corrective / additive schema on top of Sprint 10.0 platform foundation.
-- Do NOT apply automatically in production.

-- row_version on existing platform tables
alter table public.aura_capability_installations
  add column if not exists row_version integer not null default 1;
alter table public.aura_skill_installations
  add column if not exists row_version integer not null default 1;
alter table public.aura_feature_flags
  add column if not exists row_version integer not null default 1;
alter table public.aura_entitlements
  add column if not exists row_version integer not null default 1;
alter table public.aura_workspace_branding
  add column if not exists row_version integer not null default 1;
alter table public.aura_templates
  add column if not exists row_version integer not null default 1;

-- Onboarding progress (retomável)
create table if not exists public.aura_onboarding_progress (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid null references public.workspaces(id) on delete set null,
  step integer not null default 1,
  completed boolean not null default false,
  answers jsonb not null default '{}'::jsonb,
  experience_mode text not null default 'CUSTOM',
  first_value_checklist jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  soft_deleted boolean not null default false,
  row_version integer not null default 1,
  unique (user_id)
);

create index if not exists aura_onboarding_progress_user_idx
  on public.aura_onboarding_progress (user_id)
  where soft_deleted = false;

-- Navigation preferences
create table if not exists public.aura_navigation_prefs (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid null references public.workspaces(id) on delete cascade,
  order_ids text[] not null default '{}',
  hidden_ids text[] not null default '{}',
  favorite_ids text[] not null default '{}',
  last_route text null,
  updated_at timestamptz not null default now(),
  row_version integer not null default 1,
  unique (user_id, workspace_id)
);

create index if not exists aura_navigation_prefs_user_idx
  on public.aura_navigation_prefs (user_id);

-- Beta access foundation
create table if not exists public.aura_beta_access (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  access_status text not null default 'ACTIVE'
    check (access_status in ('INVITED', 'ACTIVE', 'SUSPENDED', 'REVOKED')),
  invited_at timestamptz null,
  activated_at timestamptz null,
  suspended_at timestamptz null,
  beta_cohort text null,
  admin_notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  soft_deleted boolean not null default false,
  row_version integer not null default 1,
  unique (user_id)
);

create index if not exists aura_beta_access_status_idx
  on public.aura_beta_access (access_status)
  where soft_deleted = false;

-- Privacy preferences
create table if not exists public.aura_privacy_prefs (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  learning_enabled boolean not null default true,
  memory_promotion_enabled boolean not null default true,
  external_providers_enabled boolean not null default true,
  usage_analytics_enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  row_version integer not null default 1,
  unique (user_id)
);

-- Account / workspace deletion requests (no instant irreversible wipe)
create table if not exists public.aura_deletion_requests (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid null references public.workspaces(id) on delete set null,
  status text not null default 'REQUESTED'
    check (status in ('REQUESTED', 'REVIEW', 'SCHEDULED', 'CANCELLED', 'COMPLETED')),
  reason text not null default '',
  impact_summary jsonb not null default '{}'::jsonb,
  requested_at timestamptz not null default now(),
  review_until timestamptz null,
  completed_at timestamptz null,
  soft_deleted boolean not null default false,
  row_version integer not null default 1
);

create index if not exists aura_deletion_requests_user_idx
  on public.aura_deletion_requests (user_id, requested_at desc)
  where soft_deleted = false;

-- Observability events (minimized, no secrets)
create table if not exists public.aura_platform_observability (
  id text primary key,
  event text not null,
  user_id uuid null references auth.users(id) on delete set null,
  workspace_id uuid null,
  correlation_id text not null,
  duration_ms double precision null,
  result text not null default 'ok',
  error_code text null,
  environment text not null default 'development',
  module text not null default 'platform',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists aura_platform_observability_event_idx
  on public.aura_platform_observability (event, created_at desc);

-- Ensure existing users are ACTIVE in beta (idempotent seed helper via function)
create or replace function public.ensure_beta_active_for_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.aura_beta_access (
    id, user_id, access_status, activated_at, beta_cohort, admin_notes
  ) values (
    'beta_' || p_user_id::text,
    p_user_id,
    'ACTIVE',
    now(),
    'legacy_active',
    ''
  )
  on conflict (user_id) do nothing;
end;
$$;

-- RLS
alter table public.aura_onboarding_progress enable row level security;
alter table public.aura_navigation_prefs enable row level security;
alter table public.aura_beta_access enable row level security;
alter table public.aura_privacy_prefs enable row level security;
alter table public.aura_deletion_requests enable row level security;
alter table public.aura_platform_observability enable row level security;

drop policy if exists aura_onboarding_own on public.aura_onboarding_progress;
create policy aura_onboarding_own on public.aura_onboarding_progress
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists aura_nav_prefs_own on public.aura_navigation_prefs;
create policy aura_nav_prefs_own on public.aura_navigation_prefs
  for all to authenticated
  using (
    user_id = auth.uid()
    and (workspace_id is null or public.is_workspace_member(workspace_id))
  )
  with check (user_id = auth.uid());

drop policy if exists aura_beta_own_select on public.aura_beta_access;
create policy aura_beta_own_select on public.aura_beta_access
  for select to authenticated
  using (user_id = auth.uid() and soft_deleted = false);

drop policy if exists aura_privacy_own on public.aura_privacy_prefs;
create policy aura_privacy_own on public.aura_privacy_prefs
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists aura_deletion_own on public.aura_deletion_requests;
create policy aura_deletion_own on public.aura_deletion_requests
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists aura_obs_insert_own on public.aura_platform_observability;
create policy aura_obs_insert_own on public.aura_platform_observability
  for insert to authenticated
  with check (user_id is null or user_id = auth.uid());

drop policy if exists aura_obs_select_own on public.aura_platform_observability;
create policy aura_obs_select_own on public.aura_platform_observability
  for select to authenticated
  using (user_id = auth.uid() or user_id is null);
