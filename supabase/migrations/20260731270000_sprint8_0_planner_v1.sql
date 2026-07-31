-- Sprint 8.0 Planner V1
-- Structured human-reviewable plans. executionInfluence always 'none'.
-- Does NOT replace aura_brain_plans (Sprint 4 action proposals).
-- Runtime remains in-memory; migration prepares persistence + RLS.
-- Do NOT apply automatically in production.

create table if not exists public.aura_plans (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid null references public.workspaces(id) on delete set null,
  title text not null,
  summary text not null default '',
  objective text not null,
  status text not null default 'DRAFT' check (status in (
    'DRAFT','PENDING_REVIEW','APPROVED','IN_PROGRESS','PAUSED','BLOCKED',
    'COMPLETED','CANCELLED','ARCHIVED'
  )),
  context text not null default 'personal' check (context in ('personal','workspace')),
  project_id text null,
  mission_id text null,
  recommendation_id text null,
  decision_id text null,
  scenario_id text null,
  priority_id text null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  confidence numeric not null default 0,
  assumptions text[] not null default '{}',
  limitations text[] not null default '{}',
  success_criteria text[] not null default '{}',
  start_date_suggested date null,
  target_date_suggested date null,
  estimated_effort text not null default 'MEDIUM',
  risk_level text not null default 'LOW',
  source_kind text not null default 'manual',
  source_id text null,
  alternatives text[] not null default '{}',
  pipeline_steps text[] not null default '{}',
  visibility_scope text not null default 'PRIVATE',
  execution_influence text not null default 'none' check (execution_influence = 'none'),
  row_version integer not null default 1,
  soft_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists aura_plans_user_idx on public.aura_plans (user_id, updated_at desc);
create index if not exists aura_plans_workspace_idx on public.aura_plans (workspace_id, updated_at desc);
create index if not exists aura_plans_status_idx on public.aura_plans (user_id, status);
create index if not exists aura_plans_owner_idx on public.aura_plans (owner_id);

create table if not exists public.aura_plan_steps (
  id text primary key,
  plan_id text not null references public.aura_plans(id) on delete cascade,
  title text not null,
  description text not null default '',
  step_order integer not null default 0,
  status text not null default 'DRAFT',
  step_type text not null default 'OTHER',
  owner_id uuid null,
  depends_on text[] not null default '{}',
  suggested_start date null,
  suggested_deadline date null,
  estimated_effort text not null default 'MEDIUM',
  required_resources text[] not null default '{}',
  success_criteria text[] not null default '{}',
  risk_level text not null default 'LOW',
  requires_confirmation boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists aura_plan_steps_plan_idx on public.aura_plan_steps (plan_id, step_order);

create table if not exists public.aura_plan_dependencies (
  id text primary key,
  plan_id text not null references public.aura_plans(id) on delete cascade,
  kind text not null,
  summary text not null,
  related_step_ids text[] not null default '{}',
  requires_human_review boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.aura_plan_milestones (
  id text primary key,
  plan_id text not null references public.aura_plans(id) on delete cascade,
  title text not null,
  description text not null default '',
  target_date_suggested date null,
  success_criteria text[] not null default '{}',
  related_steps text[] not null default '{}',
  status text not null default 'SUGGESTED',
  created_at timestamptz not null default now()
);

create table if not exists public.aura_plan_resources (
  id text primary key,
  plan_id text not null references public.aura_plans(id) on delete cascade,
  kind text not null,
  title text not null,
  description text not null default '',
  availability text not null default 'UNKNOWN',
  related_step_ids text[] not null default '{}'
);

create table if not exists public.aura_plan_risks (
  id text primary key,
  plan_id text not null references public.aura_plans(id) on delete cascade,
  title text not null,
  impact text not null default 'MEDIUM',
  probability text not null default 'MEDIUM',
  evidence text[] not null default '{}',
  mitigation_suggested text not null default '',
  alternative_plan text not null default ''
);

create table if not exists public.aura_plan_feedback (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid null,
  plan_id text not null references public.aura_plans(id) on delete cascade,
  step_id text null,
  kind text not null,
  note text null,
  actor_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.aura_plan_comments (
  id text primary key,
  plan_id text not null references public.aura_plans(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  mentions text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.aura_plan_audit (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid null,
  plan_id text null,
  action text not null,
  summary text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.aura_plans enable row level security;
alter table public.aura_plan_steps enable row level security;
alter table public.aura_plan_dependencies enable row level security;
alter table public.aura_plan_milestones enable row level security;
alter table public.aura_plan_resources enable row level security;
alter table public.aura_plan_risks enable row level security;
alter table public.aura_plan_feedback enable row level security;
alter table public.aura_plan_comments enable row level security;
alter table public.aura_plan_audit enable row level security;

drop policy if exists aura_plans_select on public.aura_plans;
create policy aura_plans_select on public.aura_plans
  for select using (
    soft_deleted = false
    and (
      owner_id = auth.uid()
      or created_by = auth.uid()
      or (
        visibility_scope = 'WORKSPACE'
        and workspace_id is not null
        and exists (
          select 1 from public.workspace_members wm
          where wm.workspace_id = aura_plans.workspace_id
            and wm.user_id = auth.uid()
        )
      )
    )
  );

drop policy if exists aura_plans_write on public.aura_plans;
create policy aura_plans_write on public.aura_plans
  for all using (owner_id = auth.uid() or created_by = auth.uid())
  with check (
    (owner_id = auth.uid() or created_by = auth.uid())
    and execution_influence = 'none'
  );

drop policy if exists aura_plan_steps_owner on public.aura_plan_steps;
create policy aura_plan_steps_owner on public.aura_plan_steps
  for all using (
    exists (
      select 1 from public.aura_plans p
      where p.id = aura_plan_steps.plan_id
        and (p.owner_id = auth.uid() or p.created_by = auth.uid())
    )
  );

drop policy if exists aura_plan_deps_owner on public.aura_plan_dependencies;
create policy aura_plan_deps_owner on public.aura_plan_dependencies
  for all using (
    exists (
      select 1 from public.aura_plans p
      where p.id = aura_plan_dependencies.plan_id
        and (p.owner_id = auth.uid() or p.created_by = auth.uid())
    )
  );

drop policy if exists aura_plan_milestones_owner on public.aura_plan_milestones;
create policy aura_plan_milestones_owner on public.aura_plan_milestones
  for all using (
    exists (
      select 1 from public.aura_plans p
      where p.id = aura_plan_milestones.plan_id
        and (p.owner_id = auth.uid() or p.created_by = auth.uid())
    )
  );

drop policy if exists aura_plan_resources_owner on public.aura_plan_resources;
create policy aura_plan_resources_owner on public.aura_plan_resources
  for all using (
    exists (
      select 1 from public.aura_plans p
      where p.id = aura_plan_resources.plan_id
        and (p.owner_id = auth.uid() or p.created_by = auth.uid())
    )
  );

drop policy if exists aura_plan_risks_owner on public.aura_plan_risks;
create policy aura_plan_risks_owner on public.aura_plan_risks
  for all using (
    exists (
      select 1 from public.aura_plans p
      where p.id = aura_plan_risks.plan_id
        and (p.owner_id = auth.uid() or p.created_by = auth.uid())
    )
  );

drop policy if exists aura_plan_feedback_owner on public.aura_plan_feedback;
create policy aura_plan_feedback_owner on public.aura_plan_feedback
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists aura_plan_comments_access on public.aura_plan_comments;
create policy aura_plan_comments_access on public.aura_plan_comments
  for all using (
    exists (
      select 1 from public.aura_plans p
      where p.id = aura_plan_comments.plan_id
        and (p.owner_id = auth.uid() or p.created_by = auth.uid())
    )
  );

drop policy if exists aura_plan_audit_select on public.aura_plan_audit;
create policy aura_plan_audit_select on public.aura_plan_audit
  for select using (user_id = auth.uid());

drop policy if exists aura_plan_audit_insert on public.aura_plan_audit;
create policy aura_plan_audit_insert on public.aura_plan_audit
  for insert with check (user_id = auth.uid());
