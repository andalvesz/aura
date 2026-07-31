-- Sprint 8.1 Automation Engine V1
-- Controlled, auditable automations. Reuses aura_brain_settings + Action Registry in code.
-- Does NOT replace aura_brain_automations (Sprint 4 trigger flags).
-- Runtime V1 remains in-memory; migration prepares persistence + RLS.
-- Do NOT apply automatically in production.

create table if not exists public.aura_automations (
  id text primary key,
  title text not null,
  description text not null default '',
  status text not null default 'PROPOSED' check (status in (
    'DRAFT','PROPOSED','PREPARED','AWAITING_CONFIRMATION','APPROVED','SCHEDULED',
    'RUNNING','SUCCEEDED','FAILED','CANCELLED','EXPIRED','UNDONE','BLOCKED'
  )),
  trigger_type text not null,
  source_type text not null,
  source_id text null,
  plan_id text null,
  plan_step_id text null,
  action_id text not null,
  action_version text not null default '1',
  workspace_id uuid null references public.workspaces(id) on delete set null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  autonomy_level text not null default 'SUGGEST',
  risk_level text not null default 'LOW',
  reversibility text not null default 'soft',
  input jsonb not null default '{}'::jsonb,
  prepared_output jsonb null,
  execution_result jsonb null,
  execution_error text null,
  error_class text null,
  idempotency_key text not null,
  cooldown_key text not null,
  scheduled_for timestamptz null,
  expires_at timestamptz null,
  requires_confirmation boolean not null default true,
  confirmed_by uuid null references auth.users(id) on delete set null,
  confirmed_at timestamptz null,
  confirmation_token text null,
  confirmation_expires_at timestamptz null,
  confirmation_payload_hash text null,
  executed_at timestamptz null,
  undone_at timestamptz null,
  undo_token text null,
  row_version integer not null default 1,
  lease_owner text null,
  lease_expires_at timestamptz null,
  execution_attempt integer not null default 0,
  max_attempts integer not null default 3,
  next_retry_at timestamptz null,
  context text not null default 'personal' check (context in ('personal','workspace')),
  project_id text null,
  gate_failures text[] not null default '{}',
  explain_summary text not null default '',
  evidence text[] not null default '{}',
  limitations text[] not null default '{}',
  will_change text[] not null default '{}',
  will_not_change text[] not null default '{}',
  execution_influence text not null default 'proposed' check (execution_influence in (
    'proposed','prepared','confirmed','auto_safe','executed'
  )),
  soft_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, idempotency_key)
);

create index if not exists aura_automations_owner_idx
  on public.aura_automations (owner_id, updated_at desc);
create index if not exists aura_automations_workspace_idx
  on public.aura_automations (workspace_id, updated_at desc);
create index if not exists aura_automations_status_idx
  on public.aura_automations (owner_id, status);
create index if not exists aura_automations_plan_idx
  on public.aura_automations (plan_id);
create index if not exists aura_automations_scheduled_idx
  on public.aura_automations (status, scheduled_for)
  where status = 'SCHEDULED' and soft_deleted = false;
create index if not exists aura_automations_lease_idx
  on public.aura_automations (lease_owner, lease_expires_at)
  where status = 'RUNNING';

create table if not exists public.aura_automation_attempts (
  id text primary key,
  automation_id text not null references public.aura_automations(id) on delete cascade,
  attempt integer not null,
  status text not null,
  error_class text null,
  error text null,
  lease_owner text null,
  started_at timestamptz not null default now(),
  finished_at timestamptz null,
  output_summary jsonb not null default '{}'::jsonb
);

create index if not exists aura_automation_attempts_auto_idx
  on public.aura_automation_attempts (automation_id, attempt desc);

create table if not exists public.aura_automation_confirmations (
  id text primary key,
  automation_id text not null references public.aura_automations(id) on delete cascade,
  token text not null unique,
  payload_hash text not null,
  requested_by uuid not null references auth.users(id) on delete cascade,
  confirmed_by uuid null references auth.users(id) on delete set null,
  expires_at timestamptz not null,
  confirmed_at timestamptz null,
  revoked boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists aura_automation_confirmations_auto_idx
  on public.aura_automation_confirmations (automation_id);

create table if not exists public.aura_automation_schedules (
  id text primary key,
  automation_id text not null references public.aura_automations(id) on delete cascade,
  scheduled_for timestamptz not null,
  processed_at timestamptz null,
  created_at timestamptz not null default now()
);

create table if not exists public.aura_automation_leases (
  automation_id text primary key references public.aura_automations(id) on delete cascade,
  lease_owner text not null,
  lease_expires_at timestamptz not null,
  row_version integer not null default 1,
  updated_at timestamptz not null default now()
);

create table if not exists public.aura_automation_audit (
  id text primary key,
  automation_id text null,
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid null,
  action text not null,
  summary text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists aura_automation_audit_user_idx
  on public.aura_automation_audit (user_id, created_at desc);
create index if not exists aura_automation_audit_auto_idx
  on public.aura_automation_audit (automation_id, created_at desc);

-- Extend settings (safe defaults)
alter table public.aura_brain_settings
  add column if not exists allow_auto_safe boolean not null default false;
alter table public.aura_brain_settings
  add column if not exists pause_all_automations boolean not null default false;

alter table public.aura_automations enable row level security;
alter table public.aura_automation_attempts enable row level security;
alter table public.aura_automation_confirmations enable row level security;
alter table public.aura_automation_schedules enable row level security;
alter table public.aura_automation_leases enable row level security;
alter table public.aura_automation_audit enable row level security;

create policy "aura_automations_select_own"
  on public.aura_automations for select
  using (
    auth.uid() = owner_id
    or auth.uid() = created_by
    or (
      workspace_id is not null
      and exists (
        select 1 from public.workspace_members wm
        where wm.workspace_id = aura_automations.workspace_id
          and wm.user_id = auth.uid()
      )
    )
  );

create policy "aura_automations_insert_own"
  on public.aura_automations for insert
  with check (auth.uid() = owner_id and auth.uid() = created_by);

create policy "aura_automations_update_own"
  on public.aura_automations for update
  using (
    auth.uid() = owner_id
    or (
      workspace_id is not null
      and exists (
        select 1 from public.workspace_members wm
        where wm.workspace_id = aura_automations.workspace_id
          and wm.user_id = auth.uid()
          and wm.role in ('owner', 'admin', 'editor', 'member')
      )
    )
  );

create policy "aura_automation_attempts_select"
  on public.aura_automation_attempts for select
  using (
    exists (
      select 1 from public.aura_automations a
      where a.id = automation_id
        and (a.owner_id = auth.uid() or a.created_by = auth.uid())
    )
  );

create policy "aura_automation_confirmations_select"
  on public.aura_automation_confirmations for select
  using (
    exists (
      select 1 from public.aura_automations a
      where a.id = automation_id and a.owner_id = auth.uid()
    )
  );

create policy "aura_automation_schedules_select"
  on public.aura_automation_schedules for select
  using (
    exists (
      select 1 from public.aura_automations a
      where a.id = automation_id and a.owner_id = auth.uid()
    )
  );

create policy "aura_automation_leases_select"
  on public.aura_automation_leases for select
  using (
    exists (
      select 1 from public.aura_automations a
      where a.id = automation_id and a.owner_id = auth.uid()
    )
  );

create policy "aura_automation_audit_select_own"
  on public.aura_automation_audit for select
  using (auth.uid() = user_id);

create policy "aura_automation_audit_insert_own"
  on public.aura_automation_audit for insert
  with check (auth.uid() = user_id);

-- Retention helper comment: soft_deleted + audits retained; purge policy out of band.
comment on table public.aura_automations is
  'Sprint 8.1 Automation Engine V1. Runtime may remain in-memory until persistence adapter ships.';
