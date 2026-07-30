-- Sprint 7.2 Prioritization Engine
-- Attention queue only. executionInfluence always 'none' (app-enforced).
-- Runtime remains in-memory; this migration prepares persistence + RLS.

create table if not exists public.aura_priority_items (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid null references public.workspaces(id) on delete set null,
  engine_id text not null,
  kind text not null check (kind in (
    'IMPACT','URGENCY','CONFIDENCE','OPPORTUNITY','RISK','REVIEW','STALE'
  )),
  title text not null,
  summary text not null,
  priority_score numeric not null default 0,
  score_breakdown jsonb not null default '{}'::jsonb,
  confidence numeric not null default 0,
  confidence_band text not null default 'LOW',
  impact text not null default 'MEDIUM',
  urgency text not null default 'MEDIUM',
  effort text not null default 'MEDIUM',
  reversibility text not null default 'MEDIUM',
  attention_reason text not null default '',
  evidence jsonb not null default '[]'::jsonb,
  limitations text[] not null default '{}',
  alternative_views jsonb not null default '[]'::jsonb,
  related_decision text null,
  related_scenario text null,
  related_project text null,
  related_discovery text null,
  related_business_ids text[] not null default '{}',
  related_document_ids text[] not null default '{}',
  related_memory_ids text[] not null default '{}',
  related_entity_ids text[] not null default '{}',
  status text not null default 'SUGGESTED',
  execution_influence text not null default 'none' check (execution_influence = 'none'),
  visibility_scope text not null default 'PRIVATE',
  explanation text not null default '',
  criteria_contributed text[] not null default '{}',
  missing_data text[] not null default '{}',
  ranking integer null,
  fingerprint text not null,
  signal_observed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_reviewed_at timestamptz null
);

create index if not exists aura_priority_items_user_idx
  on public.aura_priority_items (user_id, updated_at desc);
create index if not exists aura_priority_items_workspace_idx
  on public.aura_priority_items (workspace_id, updated_at desc);
create index if not exists aura_priority_items_score_idx
  on public.aura_priority_items (user_id, priority_score desc);
create unique index if not exists aura_priority_items_fingerprint_idx
  on public.aura_priority_items (user_id, coalesce(workspace_id::text, ''), fingerprint);

create table if not exists public.aura_priority_feedback (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid null,
  priority_id text not null references public.aura_priority_items(id) on delete cascade,
  kind text not null check (kind in ('confirm','ignore','archive','request_review')),
  note text null,
  actor_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.aura_priority_audit (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid null,
  priority_id text null,
  action text not null,
  summary text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.aura_priority_comparisons (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid null,
  priority_ids text[] not null default '{}',
  title text not null,
  score_diffs jsonb not null default '[]'::jsonb,
  explanation text not null default '',
  execution_influence text not null default 'none' check (execution_influence = 'none'),
  created_at timestamptz not null default now()
);

alter table public.aura_priority_items enable row level security;
alter table public.aura_priority_feedback enable row level security;
alter table public.aura_priority_audit enable row level security;
alter table public.aura_priority_comparisons enable row level security;

drop policy if exists aura_priority_items_select on public.aura_priority_items;
create policy aura_priority_items_select on public.aura_priority_items
  for select using (
    user_id = auth.uid()
    or (
      visibility_scope = 'WORKSPACE'
      and workspace_id is not null
      and exists (
        select 1 from public.workspace_members wm
        where wm.workspace_id = aura_priority_items.workspace_id
          and wm.user_id = auth.uid()
      )
    )
  );

drop policy if exists aura_priority_items_write on public.aura_priority_items;
create policy aura_priority_items_write on public.aura_priority_items
  for all using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and execution_influence = 'none'
  );

drop policy if exists aura_priority_feedback_owner on public.aura_priority_feedback;
create policy aura_priority_feedback_owner on public.aura_priority_feedback
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists aura_priority_audit_select on public.aura_priority_audit;
create policy aura_priority_audit_select on public.aura_priority_audit
  for select using (user_id = auth.uid());

drop policy if exists aura_priority_audit_insert on public.aura_priority_audit;
create policy aura_priority_audit_insert on public.aura_priority_audit
  for insert with check (user_id = auth.uid());

drop policy if exists aura_priority_comparisons_owner on public.aura_priority_comparisons;
create policy aura_priority_comparisons_owner on public.aura_priority_comparisons
  for all using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and execution_influence = 'none'
  );
