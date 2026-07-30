-- Aura Brain Core — settings, plans, audit, feedback, automations
-- Reuses public.notifications for internal alerts (no aura_brain_notifications).
-- Historical migrations untouched. No DROP of legacy leads.

create table if not exists public.aura_brain_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  default_autonomy_level text not null default 'SUGGEST'
    check (default_autonomy_level in ('SUGGEST', 'PREPARE', 'CONFIRM', 'AUTO_SAFE')),
  allowed_action_types jsonb not null default '[]'::jsonb,
  blocked_action_types jsonb not null default '[]'::jsonb,
  quiet_hours jsonb,
  daily_execution_limit integer not null default 20
    check (daily_execution_limit >= 0 and daily_execution_limit <= 500),
  require_confirmation_financial boolean not null default true,
  require_confirmation_external boolean not null default true,
  require_confirmation_deletion boolean not null default true,
  automations_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.aura_brain_settings enable row level security;

create policy "aura_brain_settings_select_own"
  on public.aura_brain_settings for select using (auth.uid() = user_id);
create policy "aura_brain_settings_insert_own"
  on public.aura_brain_settings for insert with check (auth.uid() = user_id);
create policy "aura_brain_settings_update_own"
  on public.aura_brain_settings for update using (auth.uid() = user_id);

create table if not exists public.aura_brain_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  workspace_id uuid references public.workspaces (id) on delete set null,
  title text not null,
  objective text not null,
  source text not null,
  priority text not null check (priority in ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW')),
  status text not null default 'DRAFT'
    check (status in ('DRAFT','PROPOSED','APPROVED','IN_PROGRESS','COMPLETED','FAILED','CANCELLED','EXPIRED')),
  context text not null check (context in ('personal', 'workspace')),
  steps jsonb not null default '[]'::jsonb,
  confidence numeric not null default 0.5,
  requires_confirmation boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists aura_brain_plans_user_idx
  on public.aura_brain_plans (user_id, created_at desc);

alter table public.aura_brain_plans enable row level security;

create policy "aura_brain_plans_select_own"
  on public.aura_brain_plans for select using (auth.uid() = user_id);
create policy "aura_brain_plans_insert_own"
  on public.aura_brain_plans for insert with check (auth.uid() = user_id);
create policy "aura_brain_plans_update_own"
  on public.aura_brain_plans for update using (auth.uid() = user_id);

create table if not exists public.aura_brain_audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  workspace_id uuid references public.workspaces (id) on delete set null,
  context text not null check (context in ('personal', 'workspace')),
  source text not null,
  plan_id uuid,
  action_id text,
  automation_id text,
  autonomy_level text not null,
  risk_level text,
  input_summary jsonb not null default '{}'::jsonb,
  status text not null,
  error text,
  undo_available boolean not null default false,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists aura_brain_audit_user_idx
  on public.aura_brain_audit_logs (user_id, created_at desc);

alter table public.aura_brain_audit_logs enable row level security;

create policy "aura_brain_audit_select_own"
  on public.aura_brain_audit_logs for select using (auth.uid() = user_id);
create policy "aura_brain_audit_insert_own"
  on public.aura_brain_audit_logs for insert with check (auth.uid() = user_id);

create table if not exists public.aura_brain_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  workspace_id uuid references public.workspaces (id) on delete set null,
  target_kind text not null
    check (target_kind in ('recommendation', 'insight', 'plan', 'action')),
  target_id text not null,
  signal text not null
    check (signal in ('util', 'nao_util', 'concluido', 'ignorado', 'nao_sugerir_novamente')),
  created_at timestamptz not null default now()
);

create index if not exists aura_brain_feedback_user_idx
  on public.aura_brain_feedback (user_id, created_at desc);

alter table public.aura_brain_feedback enable row level security;

create policy "aura_brain_feedback_select_own"
  on public.aura_brain_feedback for select using (auth.uid() = user_id);
create policy "aura_brain_feedback_insert_own"
  on public.aura_brain_feedback for insert with check (auth.uid() = user_id);

create table if not exists public.aura_brain_automations (
  row_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  automation_id text not null,
  enabled boolean not null default true,
  cooldown_ms integer not null default 60000,
  max_executions_per_day integer not null default 10,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique (user_id, automation_id)
);

create index if not exists aura_brain_automations_user_idx
  on public.aura_brain_automations (user_id);

alter table public.aura_brain_automations enable row level security;

create policy "aura_brain_automations_select_own"
  on public.aura_brain_automations for select using (auth.uid() = user_id);
create policy "aura_brain_automations_insert_own"
  on public.aura_brain_automations for insert with check (auth.uid() = user_id);
create policy "aura_brain_automations_update_own"
  on public.aura_brain_automations for update using (auth.uid() = user_id);
