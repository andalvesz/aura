-- Sprint 7.1 Scenario Engine
-- Hypothetical simulations only. execution_influence must remain 'none'.

create table if not exists public.aura_scenario_cards (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid null references public.workspaces(id) on delete set null,
  engine_id text not null,
  scenario_type text not null check (scenario_type in (
    'BEST_CASE','WORST_CASE','MOST_LIKELY','OPTIMISTIC','CONSERVATIVE','NEUTRAL'
  )),
  title text not null,
  description text not null default '',
  status text not null default 'DRAFT',
  context text not null default '',
  confidence numeric not null default 0,
  impact text not null default 'MEDIUM',
  assumptions jsonb not null default '[]'::jsonb,
  limitations text[] not null default '{}',
  evidence jsonb not null default '[]'::jsonb,
  alternative_scenarios jsonb not null default '[]'::jsonb,
  related_decision_id text null,
  related_project_id text null,
  related_discovery_id text null,
  related_business_id text null,
  related_document_ids text[] not null default '{}',
  related_memory_ids text[] not null default '{}',
  what_if_prompt text null,
  ignored_data text[] not null default '{}',
  why_result text not null default '',
  timeline jsonb not null default '[]'::jsonb,
  uncertainty jsonb not null default '{}'::jsonb,
  comparison_group_id text null,
  execution_influence text not null default 'none' check (execution_influence = 'none'),
  visibility_scope text not null default 'PRIVATE',
  fingerprint text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists aura_scenario_cards_user_idx
  on public.aura_scenario_cards (user_id, updated_at desc);
create unique index if not exists aura_scenario_cards_fp_idx
  on public.aura_scenario_cards (user_id, coalesce(workspace_id::text, ''), fingerprint);

create table if not exists public.aura_scenario_feedback (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid null,
  scenario_id text not null references public.aura_scenario_cards(id) on delete cascade,
  kind text not null check (kind in ('save','archive','compare','discard')),
  note text null,
  actor_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.aura_scenario_comparisons (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid null,
  scenario_ids text[] not null,
  title text not null,
  advantages text[] not null default '{}',
  disadvantages text[] not null default '{}',
  risks text[] not null default '{}',
  opportunities text[] not null default '{}',
  missing_data text[] not null default '{}',
  explanation text not null default '',
  execution_influence text not null default 'none' check (execution_influence = 'none'),
  created_at timestamptz not null default now()
);

create table if not exists public.aura_scenario_audit (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid null,
  scenario_id text null,
  action text not null,
  summary text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.aura_scenario_cards enable row level security;
alter table public.aura_scenario_feedback enable row level security;
alter table public.aura_scenario_comparisons enable row level security;
alter table public.aura_scenario_audit enable row level security;

drop policy if exists aura_scenario_cards_select on public.aura_scenario_cards;
create policy aura_scenario_cards_select on public.aura_scenario_cards
  for select using (
    user_id = auth.uid()
    or (
      visibility_scope = 'WORKSPACE'
      and workspace_id is not null
      and exists (
        select 1 from public.workspace_members wm
        where wm.workspace_id = aura_scenario_cards.workspace_id
          and wm.user_id = auth.uid()
      )
    )
  );

drop policy if exists aura_scenario_cards_write on public.aura_scenario_cards;
create policy aura_scenario_cards_write on public.aura_scenario_cards
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid() and execution_influence = 'none');

drop policy if exists aura_scenario_feedback_owner on public.aura_scenario_feedback;
create policy aura_scenario_feedback_owner on public.aura_scenario_feedback
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists aura_scenario_comparisons_owner on public.aura_scenario_comparisons;
create policy aura_scenario_comparisons_owner on public.aura_scenario_comparisons
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid() and execution_influence = 'none');

drop policy if exists aura_scenario_audit_select on public.aura_scenario_audit;
create policy aura_scenario_audit_select on public.aura_scenario_audit
  for select using (user_id = auth.uid());

drop policy if exists aura_scenario_audit_insert on public.aura_scenario_audit;
create policy aura_scenario_audit_insert on public.aura_scenario_audit
  for insert with check (user_id = auth.uid());
