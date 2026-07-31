-- Sprint 10.2 Private Beta Operations
-- Do NOT apply automatically in production.

-- Beta invites (token plaintext NEVER stored — only token_hash)
create table if not exists public.aura_beta_invites (
  id text primary key,
  email text not null,
  status text not null default 'PENDING'
    check (status in ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED')),
  token_hash text not null,
  cohort text not null default 'CUSTOM'
    check (cohort in ('FOUNDERS', 'PERSONAL_USERS', 'CREATORS', 'BUSINESSES', 'TEAMS', 'CUSTOM')),
  experience_mode_suggested text null,
  workspace_mode text null,
  expires_at timestamptz not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  accepted_by uuid null references auth.users(id) on delete set null,
  accepted_at timestamptz null,
  revoked_at timestamptz null,
  created_at timestamptz not null default now(),
  soft_deleted boolean not null default false,
  row_version integer not null default 1,
  unique (token_hash)
);

create index if not exists aura_beta_invites_email_idx
  on public.aura_beta_invites (email)
  where soft_deleted = false;
create index if not exists aura_beta_invites_status_idx
  on public.aura_beta_invites (status)
  where soft_deleted = false;

-- Cohort config (reference / admin; not authorization)
create table if not exists public.aura_beta_cohorts (
  id text primary key
    check (id in ('FOUNDERS', 'PERSONAL_USERS', 'CREATORS', 'BUSINESSES', 'TEAMS', 'CUSTOM')),
  label text not null,
  feature_flags jsonb not null default '{}'::jsonb,
  suggested_skill_ids text[] not null default '{}',
  onboarding_variant text not null default 'custom',
  technical_limits jsonb not null default '{}'::jsonb,
  feedback_form_id text not null default 'feedback.general',
  release_channel text not null default 'BETA'
    check (release_channel in ('INTERNAL', 'BETA', 'STABLE')),
  updated_at timestamptz not null default now()
);

insert into public.aura_beta_cohorts (id, label, onboarding_variant, release_channel)
values
  ('FOUNDERS', 'Founders', 'founders', 'INTERNAL'),
  ('PERSONAL_USERS', 'Personal users', 'personal', 'BETA'),
  ('CREATORS', 'Creators', 'creators', 'BETA'),
  ('BUSINESSES', 'Businesses', 'business', 'BETA'),
  ('TEAMS', 'Teams', 'teams', 'BETA'),
  ('CUSTOM', 'Custom', 'custom', 'BETA')
on conflict (id) do nothing;

-- Feedback
create table if not exists public.aura_feedback_items (
  id text primary key,
  title text not null,
  description text not null default '',
  type text not null
    check (type in ('BUG', 'IDEA', 'CONFUSING', 'SLOW', 'MISSING_FEATURE', 'POSITIVE', 'OTHER')),
  severity text not null default 'low'
    check (severity in ('low', 'medium', 'high', 'critical')),
  target_kind text not null default 'general',
  route text null,
  context jsonb not null default '{}'::jsonb,
  screenshot_reference text null,
  browser_metadata jsonb not null default '{}'::jsonb,
  device_metadata jsonb not null default '{}'::jsonb,
  correlation_id text null,
  status text not null default 'NEW'
    check (status in ('NEW', 'TRIAGED', 'PLANNED', 'IN_PROGRESS', 'RESOLVED', 'WONT_FIX', 'DUPLICATE', 'ARCHIVED')),
  priority integer not null default 0,
  assignee_id uuid null references auth.users(id) on delete set null,
  linked_release_id text null,
  duplicate_of_id text null,
  internal_notes text not null default '',
  created_by uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid null references public.workspaces(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  soft_deleted boolean not null default false,
  row_version integer not null default 1
);

create index if not exists aura_feedback_items_created_by_idx
  on public.aura_feedback_items (created_by, created_at desc)
  where soft_deleted = false;
create index if not exists aura_feedback_items_status_idx
  on public.aura_feedback_items (status)
  where soft_deleted = false;

create table if not exists public.aura_feedback_comments (
  id text primary key,
  feedback_id text not null references public.aura_feedback_items(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  internal boolean not null default false,
  created_at timestamptz not null default now(),
  soft_deleted boolean not null default false
);

create index if not exists aura_feedback_comments_feedback_idx
  on public.aura_feedback_comments (feedback_id, created_at);

-- Releases
create table if not exists public.aura_releases (
  id text primary key,
  version text not null,
  channel text not null check (channel in ('INTERNAL', 'BETA', 'STABLE')),
  status text not null default 'DRAFT'
    check (status in ('DRAFT', 'READY', 'RELEASED', 'ROLLED_BACK', 'ARCHIVED')),
  title text not null,
  summary text not null default '',
  changes jsonb not null default '[]'::jsonb,
  known_issues jsonb not null default '[]'::jsonb,
  migration_required boolean not null default false,
  released_at timestamptz null,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  soft_deleted boolean not null default false,
  row_version integer not null default 1,
  unique (version, channel)
);

create table if not exists public.aura_release_reads (
  id text primary key,
  release_id text not null references public.aura_releases(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  read_at timestamptz not null default now(),
  unique (release_id, user_id)
);

-- Announcements
create table if not exists public.aura_announcements (
  id text primary key,
  kind text not null,
  title text not null,
  body text not null default '',
  scope text not null
    check (scope in ('global', 'cohort', 'workspace', 'user', 'capability')),
  scope_id text null,
  starts_at timestamptz not null default now(),
  ends_at timestamptz null,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  soft_deleted boolean not null default false,
  row_version integer not null default 1
);

create table if not exists public.aura_announcement_reads (
  id text primary key,
  announcement_id text not null references public.aura_announcements(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  read_at timestamptz not null default now(),
  unique (announcement_id, user_id)
);

-- Error groups (no sensitive stacks)
create table if not exists public.aura_error_groups (
  id text primary key,
  code text not null,
  route text null,
  version text null,
  environment text not null default 'development',
  workspace_anon_id text null,
  frequency integer not null default 1,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  status text not null default 'OPEN'
    check (status in ('OPEN', 'INVESTIGATING', 'MONITORING', 'RESOLVED', 'IGNORED')),
  sample_message text not null default '',
  soft_deleted boolean not null default false,
  row_version integer not null default 1
);

create index if not exists aura_error_groups_last_seen_idx
  on public.aura_error_groups (last_seen desc)
  where soft_deleted = false;

-- Product events (aggregated analytics)
create table if not exists public.aura_product_events (
  id text primary key,
  name text not null,
  user_id uuid null references auth.users(id) on delete set null,
  workspace_id uuid null,
  correlation_id text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists aura_product_events_name_idx
  on public.aura_product_events (name, created_at desc);

create table if not exists public.aura_first_value_events (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  signup_at timestamptz not null,
  onboarding_completed_at timestamptz null,
  first_value_at timestamptz not null,
  first_value_type text not null,
  time_to_first_value_ms bigint not null,
  unique (user_id)
);

-- Maintenance
create table if not exists public.aura_maintenance_rules (
  id text primary key,
  scope text not null check (scope in ('global', 'capability', 'route', 'workspace')),
  scope_key text null,
  message text not null,
  active boolean not null default true,
  starts_at timestamptz not null default now(),
  ends_at timestamptz null,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  soft_deleted boolean not null default false,
  row_version integer not null default 1
);

-- Platform audit (ops)
create table if not exists public.aura_platform_audit (
  id text primary key,
  event text not null,
  actor_id uuid null references auth.users(id) on delete set null,
  subject_type text not null,
  subject_id text not null,
  summary text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  correlation_id text null,
  created_at timestamptz not null default now()
);

create index if not exists aura_platform_audit_created_idx
  on public.aura_platform_audit (created_at desc);

-- Feature rollouts
create table if not exists public.aura_feature_rollouts (
  id text primary key,
  key text not null unique,
  percent integer not null default 0 check (percent >= 0 and percent <= 100),
  cohorts text[] not null default '{}',
  user_ids uuid[] not null default '{}',
  workspace_ids uuid[] not null default '{}',
  environment text null,
  enabled boolean not null default true,
  reason text not null default '',
  updated_at timestamptz not null default now(),
  updated_by uuid null references auth.users(id) on delete set null
);

-- Privacy prefs: analytics layers (additive)
alter table public.aura_privacy_prefs
  add column if not exists analytics_essential boolean not null default true;
alter table public.aura_privacy_prefs
  add column if not exists analytics_product boolean not null default false;
alter table public.aura_privacy_prefs
  add column if not exists analytics_performance boolean not null default false;
alter table public.aura_privacy_prefs
  add column if not exists analytics_providers boolean not null default false;

-- RLS
alter table public.aura_beta_invites enable row level security;
alter table public.aura_beta_cohorts enable row level security;
alter table public.aura_feedback_items enable row level security;
alter table public.aura_feedback_comments enable row level security;
alter table public.aura_releases enable row level security;
alter table public.aura_release_reads enable row level security;
alter table public.aura_announcements enable row level security;
alter table public.aura_announcement_reads enable row level security;
alter table public.aura_error_groups enable row level security;
alter table public.aura_product_events enable row level security;
alter table public.aura_first_value_events enable row level security;
alter table public.aura_maintenance_rules enable row level security;
alter table public.aura_platform_audit enable row level security;
alter table public.aura_feature_rollouts enable row level security;

-- Own-row: feedback
drop policy if exists aura_feedback_items_own on public.aura_feedback_items;
create policy aura_feedback_items_own on public.aura_feedback_items
  for all using (auth.uid() = created_by)
  with check (auth.uid() = created_by);

drop policy if exists aura_feedback_comments_own on public.aura_feedback_comments;
create policy aura_feedback_comments_own on public.aura_feedback_comments
  for select using (
    exists (
      select 1 from public.aura_feedback_items f
      where f.id = feedback_id and f.created_by = auth.uid() and f.soft_deleted = false
    )
    or author_id = auth.uid()
  );

-- Release reads own
drop policy if exists aura_release_reads_own on public.aura_release_reads;
create policy aura_release_reads_own on public.aura_release_reads
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists aura_announcement_reads_own on public.aura_announcement_reads;
create policy aura_announcement_reads_own on public.aura_announcement_reads
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Released changelog readable by authenticated
drop policy if exists aura_releases_read_released on public.aura_releases;
create policy aura_releases_read_released on public.aura_releases
  for select using (
    soft_deleted = false
    and status in ('RELEASED', 'ROLLED_BACK')
  );

-- Announcements: authenticated can read non-deleted (scope filtered in app)
drop policy if exists aura_announcements_read on public.aura_announcements;
create policy aura_announcements_read on public.aura_announcements
  for select using (soft_deleted = false);

-- Cohorts readable
drop policy if exists aura_beta_cohorts_read on public.aura_beta_cohorts;
create policy aura_beta_cohorts_read on public.aura_beta_cohorts
  for select using (true);

-- First value own
drop policy if exists aura_first_value_own on public.aura_first_value_events;
create policy aura_first_value_own on public.aura_first_value_events
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Product events: insert own; no broad select of others
drop policy if exists aura_product_events_insert_own on public.aura_product_events;
create policy aura_product_events_insert_own on public.aura_product_events
  for insert with check (user_id is null or auth.uid() = user_id);

-- Error groups / audit / invites / maintenance / rollouts:
-- admin via service role only (no broad authenticated select of invites/errors)
drop policy if exists aura_maintenance_rules_read on public.aura_maintenance_rules;
create policy aura_maintenance_rules_read on public.aura_maintenance_rules
  for select using (soft_deleted = false and active = true);

drop policy if exists aura_feature_rollouts_read on public.aura_feature_rollouts;
create policy aura_feature_rollouts_read on public.aura_feature_rollouts
  for select using (true);
