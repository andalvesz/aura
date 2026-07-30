-- Sprint 7.0 Decision Support Foundation
-- Read-only analysis layer. executionInfluence always 'none' (app-enforced).
-- Runtime remains in-memory; this migration prepares persistence + RLS.

create table if not exists public.aura_decision_cards (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid null references public.workspaces(id) on delete set null,
  engine_id text not null,
  kind text not null check (kind in (
    'PRIORITY','TRADEOFF','REVIEW','OPPORTUNITY','RISK','MISSING_INFO','STALE'
  )),
  title text not null,
  summary text not null,
  context text not null default '',
  confidence numeric not null default 0,
  confidence_band text not null default 'LOW',
  impact text not null default 'MEDIUM',
  urgency text not null default 'MEDIUM',
  effort text not null default 'MEDIUM',
  reversibility text not null default 'MEDIUM',
  evidence jsonb not null default '[]'::jsonb,
  limitations text[] not null default '{}',
  alternative_options jsonb not null default '[]'::jsonb,
  status text not null default 'SUGGESTED',
  execution_influence text not null default 'none' check (execution_influence = 'none'),
  visibility_scope text not null default 'PRIVATE',
  explanation text not null default '',
  why_appeared text not null default '',
  related_project_ids text[] not null default '{}',
  related_business_ids text[] not null default '{}',
  related_document_ids text[] not null default '{}',
  related_discovery_ids text[] not null default '{}',
  related_memory_ids text[] not null default '{}',
  related_entity_ids text[] not null default '{}',
  fingerprint text not null,
  tradeoff jsonb null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_reviewed_at timestamptz null
);

create index if not exists aura_decision_cards_user_idx
  on public.aura_decision_cards (user_id, updated_at desc);
create index if not exists aura_decision_cards_workspace_idx
  on public.aura_decision_cards (workspace_id, updated_at desc);
create unique index if not exists aura_decision_cards_fingerprint_idx
  on public.aura_decision_cards (user_id, coalesce(workspace_id::text, ''), fingerprint);

create table if not exists public.aura_decision_feedback (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid null,
  decision_id text not null references public.aura_decision_cards(id) on delete cascade,
  kind text not null check (kind in ('accept','ignore','archive','request_review')),
  note text null,
  actor_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.aura_decision_audit (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid null,
  decision_id text null,
  action text not null,
  summary text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.aura_decision_cards enable row level security;
alter table public.aura_decision_feedback enable row level security;
alter table public.aura_decision_audit enable row level security;

drop policy if exists aura_decision_cards_select on public.aura_decision_cards;
create policy aura_decision_cards_select on public.aura_decision_cards
  for select using (
    user_id = auth.uid()
    or (
      visibility_scope = 'WORKSPACE'
      and workspace_id is not null
      and exists (
        select 1 from public.workspace_members wm
        where wm.workspace_id = aura_decision_cards.workspace_id
          and wm.user_id = auth.uid()
      )
    )
  );

drop policy if exists aura_decision_cards_write on public.aura_decision_cards;
create policy aura_decision_cards_write on public.aura_decision_cards
  for all using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and execution_influence = 'none'
  );

drop policy if exists aura_decision_feedback_owner on public.aura_decision_feedback;
create policy aura_decision_feedback_owner on public.aura_decision_feedback
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists aura_decision_audit_select on public.aura_decision_audit;
create policy aura_decision_audit_select on public.aura_decision_audit
  for select using (user_id = auth.uid());

drop policy if exists aura_decision_audit_insert on public.aura_decision_audit;
create policy aura_decision_audit_insert on public.aura_decision_audit
  for insert with check (user_id = auth.uid());
