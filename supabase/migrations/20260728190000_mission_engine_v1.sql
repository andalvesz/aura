-- Mission Engine V1 — missions as first-class life/business objectives
-- Payload JSONB stores full Mission graph (phases, tasks, risks, etc.)
-- Historical migrations untouched.

create table if not exists public.aura_missions (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  workspace_id uuid references public.workspaces (id) on delete set null,
  title text not null,
  description text not null default '',
  type text not null
    check (type in ('PERSONAL','BUSINESS','LEARNING','HEALTH','FINANCIAL','TRAVEL','CUSTOM')),
  status text not null default 'PLANNING'
    check (status in ('PLANNING','ACTIVE','PAUSED','BLOCKED','COMPLETED','ARCHIVED')),
  priority integer not null default 50
    check (priority >= 0 and priority <= 100),
  start_date date,
  target_date date,
  progress_pct integer not null default 0
    check (progress_pct >= 0 and progress_pct <= 100),
  score jsonb not null default '{}'::jsonb,
  modules jsonb not null default '[]'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  last_activity_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists aura_missions_user_idx
  on public.aura_missions (user_id, updated_at desc);

create index if not exists aura_missions_user_status_idx
  on public.aura_missions (user_id, status);

alter table public.aura_missions enable row level security;

create policy "aura_missions_select_own"
  on public.aura_missions for select using (auth.uid() = user_id);
create policy "aura_missions_insert_own"
  on public.aura_missions for insert with check (auth.uid() = user_id);
create policy "aura_missions_update_own"
  on public.aura_missions for update using (auth.uid() = user_id);
create policy "aura_missions_delete_own"
  on public.aura_missions for delete using (auth.uid() = user_id);
