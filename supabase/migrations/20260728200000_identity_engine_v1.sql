-- Identity Engine V1 — claims, evidence trail (in payload), audit
-- ADR-002 / ADR-005 / ADR-007 · Sprint 6.2
-- Idempotent. No Memory/Graph tables.

create table if not exists public.aura_identity_claims (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  workspace_id uuid references public.workspaces (id) on delete set null,
  category text not null,
  key text not null,
  value jsonb not null default 'null'::jsonb,
  value_type text not null default 'string',
  label text not null,
  description text not null default '',
  status text not null default 'OBSERVED'
    check (status in (
      'UNKNOWN','OBSERVED','HYPOTHESIS','LIKELY','CONFIRMED','LEARNED',
      'OUTDATED','ARCHIVED','REJECTED'
    )),
  confidence integer not null default 0
    check (confidence >= 0 and confidence <= 100),
  weight numeric not null default 1,
  context_scope text not null default 'global',
  source_type text not null,
  source_reference jsonb,
  evidence jsonb not null default '[]'::jsonb,
  confidence_history jsonb not null default '[]'::jsonb,
  confirmed_by uuid references auth.users (id) on delete set null,
  confirmed_at timestamptz,
  rejected_by uuid references auth.users (id) on delete set null,
  rejected_at timestamptz,
  rejection_reason text,
  valid_from timestamptz,
  valid_until timestamptz,
  last_observed_at timestamptz,
  sensitivity text not null default 'STANDARD'
    check (sensitivity in ('PUBLIC_PREF','STANDARD','SENSITIVE','RESTRICTED')),
  conflict_group_id text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create index if not exists aura_identity_claims_user_idx
  on public.aura_identity_claims (user_id, updated_at desc);
create index if not exists aura_identity_claims_user_status_idx
  on public.aura_identity_claims (user_id, status);
create index if not exists aura_identity_claims_user_category_idx
  on public.aura_identity_claims (user_id, category);
create index if not exists aura_identity_claims_user_key_idx
  on public.aura_identity_claims (user_id, key);
create index if not exists aura_identity_claims_workspace_idx
  on public.aura_identity_claims (workspace_id, user_id)
  where workspace_id is not null;
create index if not exists aura_identity_claims_context_idx
  on public.aura_identity_claims (user_id, context_scope);
create index if not exists aura_identity_claims_confidence_idx
  on public.aura_identity_claims (user_id, confidence);

alter table public.aura_identity_claims enable row level security;

create policy "aura_identity_claims_select_own"
  on public.aura_identity_claims for select using (auth.uid() = user_id);
create policy "aura_identity_claims_insert_own"
  on public.aura_identity_claims for insert with check (auth.uid() = user_id);
create policy "aura_identity_claims_update_own"
  on public.aura_identity_claims for update using (auth.uid() = user_id);
create policy "aura_identity_claims_delete_own"
  on public.aura_identity_claims for delete using (auth.uid() = user_id);

create table if not exists public.aura_identity_audit (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  workspace_id uuid references public.workspaces (id) on delete set null,
  claim_id text,
  action text not null,
  previous_state jsonb,
  next_state jsonb,
  source_type text,
  reason text not null default '',
  correlation_id text,
  created_at timestamptz not null default now()
);

create index if not exists aura_identity_audit_user_idx
  on public.aura_identity_audit (user_id, created_at desc);
create index if not exists aura_identity_audit_claim_idx
  on public.aura_identity_audit (claim_id, created_at desc);

alter table public.aura_identity_audit enable row level security;

create policy "aura_identity_audit_select_own"
  on public.aura_identity_audit for select using (auth.uid() = user_id);
create policy "aura_identity_audit_insert_own"
  on public.aura_identity_audit for insert with check (auth.uid() = user_id);

-- No UPDATE/DELETE policies for audit — append-only for owners via insert only.
