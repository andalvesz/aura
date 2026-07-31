-- Sprint 10.0 SaaS & Skills Platform Foundation
-- Capability/skill installations, feature flags, templates, branding, metering, entitlements, audit.
-- Do NOT apply automatically in production.

-- Capabilities catalog mirror (code remains source of truth for definitions)
create table if not exists public.aura_capabilities (
  id text primary key,
  version text not null,
  name text not null,
  description text not null default '',
  category text not null default '',
  capability_type text not null,
  status text not null default 'STABLE',
  scope text not null default 'SYSTEM',
  core boolean not null default false,
  private_workspace boolean not null default false,
  allowed_workspace_slugs text[] not null default '{}',
  dependencies jsonb not null default '[]'::jsonb,
  conflicts text[] not null default '{}',
  config_schema jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  soft_deleted boolean not null default false
);

create table if not exists public.aura_capability_installations (
  id text primary key,
  capability_id text not null references public.aura_capabilities(id),
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid null references public.workspaces(id) on delete cascade,
  status text not null default 'installed',
  installed_version text not null,
  enabled boolean not null default false,
  config jsonb not null default '{}'::jsonb,
  error_message text null,
  installed_at timestamptz not null default now(),
  enabled_at timestamptz null,
  disabled_at timestamptz null,
  updated_at timestamptz not null default now(),
  soft_deleted boolean not null default false,
  unique (capability_id, user_id, workspace_id)
);

create index if not exists aura_capability_installations_user_idx
  on public.aura_capability_installations (user_id, updated_at desc)
  where soft_deleted = false;

create table if not exists public.aura_capability_configs (
  id text primary key,
  installation_id text not null references public.aura_capability_installations(id) on delete cascade,
  config jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid not null references auth.users(id) on delete cascade
);

create table if not exists public.aura_skills (
  id text primary key,
  slug text not null unique,
  name text not null,
  description text not null default '',
  version text not null,
  category text not null default '',
  author_type text not null default 'SYSTEM',
  author_id text not null default 'system',
  visibility text not null default 'SYSTEM',
  status text not null default 'STABLE',
  capabilities text[] not null default '{}',
  required_capabilities text[] not null default '{}',
  permissions text[] not null default '{}',
  risk_level text not null default 'LOW',
  config_schema jsonb not null default '{}'::jsonb,
  default_config jsonb not null default '{}'::jsonb,
  icon text not null default '',
  documentation text not null default '',
  private_workspace boolean not null default false,
  allowed_workspace_slugs text[] not null default '{}',
  uninstallable boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  soft_deleted boolean not null default false
);

create table if not exists public.aura_skill_installations (
  id text primary key,
  skill_id text not null references public.aura_skills(id),
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid null references public.workspaces(id) on delete cascade,
  status text not null default 'installed',
  installed_version text not null,
  enabled boolean not null default false,
  config jsonb not null default '{}'::jsonb,
  error_message text null,
  installed_at timestamptz not null default now(),
  enabled_at timestamptz null,
  disabled_at timestamptz null,
  updated_at timestamptz not null default now(),
  soft_deleted boolean not null default false,
  unique (skill_id, user_id, workspace_id)
);

create index if not exists aura_skill_installations_user_idx
  on public.aura_skill_installations (user_id, updated_at desc)
  where soft_deleted = false;

create table if not exists public.aura_skill_configs (
  id text primary key,
  installation_id text not null references public.aura_skill_installations(id) on delete cascade,
  config jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid not null references auth.users(id) on delete cascade
);

create table if not exists public.aura_feature_flags (
  id text primary key,
  key text not null,
  scope text not null,
  enabled boolean not null default false,
  user_id uuid null references auth.users(id) on delete cascade,
  workspace_id uuid null references public.workspaces(id) on delete cascade,
  capability_id text null,
  environment text null,
  reason text not null default '',
  updated_at timestamptz not null default now()
);

create index if not exists aura_feature_flags_key_idx
  on public.aura_feature_flags (key, scope);

create table if not exists public.aura_templates (
  id text primary key,
  kind text not null,
  name text not null,
  description text not null default '',
  version text not null default '1.0.0',
  category text not null default '',
  payload jsonb not null default '{}'::jsonb,
  required_capabilities text[] not null default '{}',
  system boolean not null default false,
  status text not null default 'STABLE',
  owner_id uuid null references auth.users(id) on delete set null,
  workspace_id uuid null references public.workspaces(id) on delete cascade,
  created_at timestamptz not null default now(),
  soft_deleted boolean not null default false
);

create table if not exists public.aura_workspace_branding (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  name text not null default '',
  logo_url text null,
  primary_color text null,
  description text null,
  icon text null,
  updated_at timestamptz not null default now()
);

create table if not exists public.aura_usage_events (
  id text primary key,
  kind text not null,
  user_id uuid null references auth.users(id) on delete set null,
  workspace_id uuid null references public.workspaces(id) on delete set null,
  value double precision not null default 1,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index if not exists aura_usage_events_kind_occurred_idx
  on public.aura_usage_events (kind, occurred_at desc);

create table if not exists public.aura_entitlements (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid null references public.workspaces(id) on delete cascade,
  plan text not null default 'CUSTOM',
  full_access boolean not null default true,
  features text[] not null default '{*}',
  resolved_at timestamptz not null default now(),
  unique (user_id, workspace_id)
);

create table if not exists public.aura_platform_audit (
  id text primary key,
  event text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid null,
  subject_type text not null default '',
  subject_id text not null default '',
  summary text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists aura_platform_audit_user_idx
  on public.aura_platform_audit (user_id, created_at desc);

-- RLS
alter table public.aura_capabilities enable row level security;
alter table public.aura_capability_installations enable row level security;
alter table public.aura_capability_configs enable row level security;
alter table public.aura_skills enable row level security;
alter table public.aura_skill_installations enable row level security;
alter table public.aura_skill_configs enable row level security;
alter table public.aura_feature_flags enable row level security;
alter table public.aura_templates enable row level security;
alter table public.aura_workspace_branding enable row level security;
alter table public.aura_usage_events enable row level security;
alter table public.aura_entitlements enable row level security;
alter table public.aura_platform_audit enable row level security;

-- Catalog readable by authenticated users (definitions are non-secret)
drop policy if exists aura_capabilities_select on public.aura_capabilities;
create policy aura_capabilities_select on public.aura_capabilities
  for select to authenticated
  using (soft_deleted = false);

drop policy if exists aura_skills_select on public.aura_skills;
create policy aura_skills_select on public.aura_skills
  for select to authenticated
  using (
    soft_deleted = false
    and (
      visibility in ('SYSTEM', 'FUTURE_PUBLIC')
      or (visibility = 'WORKSPACE' and private_workspace = false)
      or (
        private_workspace = true
        and exists (
          select 1 from public.workspace_members wm
          join public.workspaces w on w.id = wm.workspace_id
          where wm.user_id = auth.uid()
            and wm.status = 'active'
            and w.slug = any (allowed_workspace_slugs)
        )
      )
    )
  );

drop policy if exists aura_cap_inst_select on public.aura_capability_installations;
create policy aura_cap_inst_select on public.aura_capability_installations
  for select to authenticated
  using (
    user_id = auth.uid()
    or (
      workspace_id is not null
      and public.is_workspace_member(workspace_id)
    )
  );

drop policy if exists aura_cap_inst_mutate on public.aura_capability_installations;
create policy aura_cap_inst_mutate on public.aura_capability_installations
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists aura_skill_inst_select on public.aura_skill_installations;
create policy aura_skill_inst_select on public.aura_skill_installations
  for select to authenticated
  using (
    user_id = auth.uid()
    or (
      workspace_id is not null
      and public.is_workspace_member(workspace_id)
    )
  );

drop policy if exists aura_skill_inst_mutate on public.aura_skill_installations;
create policy aura_skill_inst_mutate on public.aura_skill_installations
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists aura_cap_cfg_all on public.aura_capability_configs;
create policy aura_cap_cfg_all on public.aura_capability_configs
  for all to authenticated
  using (
    exists (
      select 1 from public.aura_capability_installations i
      where i.id = installation_id and i.user_id = auth.uid()
    )
  )
  with check (updated_by = auth.uid());

drop policy if exists aura_skill_cfg_all on public.aura_skill_configs;
create policy aura_skill_cfg_all on public.aura_skill_configs
  for all to authenticated
  using (
    exists (
      select 1 from public.aura_skill_installations i
      where i.id = installation_id and i.user_id = auth.uid()
    )
  )
  with check (updated_by = auth.uid());

drop policy if exists aura_ff_select on public.aura_feature_flags;
create policy aura_ff_select on public.aura_feature_flags
  for select to authenticated
  using (
    scope = 'system'
    or user_id = auth.uid()
    or (workspace_id is not null and public.is_workspace_member(workspace_id))
  );

drop policy if exists aura_templates_select on public.aura_templates;
create policy aura_templates_select on public.aura_templates
  for select to authenticated
  using (
    soft_deleted = false
    and (
      system = true
      or owner_id = auth.uid()
      or (workspace_id is not null and public.is_workspace_member(workspace_id))
    )
  );

drop policy if exists aura_branding_select on public.aura_workspace_branding;
create policy aura_branding_select on public.aura_workspace_branding
  for select to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists aura_branding_mutate on public.aura_workspace_branding;
create policy aura_branding_mutate on public.aura_workspace_branding
  for all to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

drop policy if exists aura_usage_select on public.aura_usage_events;
create policy aura_usage_select on public.aura_usage_events
  for select to authenticated
  using (
    user_id = auth.uid()
    or (workspace_id is not null and public.is_workspace_member(workspace_id))
  );

drop policy if exists aura_entitlements_select on public.aura_entitlements;
create policy aura_entitlements_select on public.aura_entitlements
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists aura_platform_audit_select on public.aura_platform_audit;
create policy aura_platform_audit_select on public.aura_platform_audit
  for select to authenticated
  using (user_id = auth.uid());

-- Constraint: no consórcios capability id
alter table public.aura_capabilities
  drop constraint if exists aura_capabilities_no_consorcios;
alter table public.aura_capabilities
  add constraint aura_capabilities_no_consorcios
  check (id not ilike '%consorcio%');

alter table public.aura_skills
  drop constraint if exists aura_skills_no_consorcios;
alter table public.aura_skills
  add constraint aura_skills_no_consorcios
  check (id not ilike '%consorcio%' and slug not ilike '%consorcio%');
