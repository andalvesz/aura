-- Excellence Auto Improve — improvement cycles audit trail

create table if not exists public.improvement_cycles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  asset_type text not null check (
    asset_type in ('copy', 'landing', 'creative', 'offer', 'funnel')
  ),
  asset_id uuid not null,
  cycle_number integer not null check (cycle_number >= 1 and cycle_number <= 3),
  action text not null check (
    action in ('review', 'improve', 'approve', 'block')
  ),
  score_before numeric(5, 2) check (score_before >= 0 and score_before <= 100),
  score_after numeric(5, 2) check (score_after >= 0 and score_after <= 100),
  status text not null default 'running'
    check (status in ('running', 'approved', 'blocked', 'improved', 'max_cycles')),
  improvements_applied jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists improvement_cycles_user_asset_idx
  on public.improvement_cycles (user_id, asset_type, asset_id, cycle_number);

create index if not exists improvement_cycles_user_created_idx
  on public.improvement_cycles (user_id, created_at desc);

alter table public.improvement_cycles enable row level security;

do $$
begin
  execute 'drop policy if exists improvement_cycles_select_own on public.improvement_cycles';
  execute 'drop policy if exists improvement_cycles_insert_own on public.improvement_cycles';
  execute 'drop policy if exists improvement_cycles_update_own on public.improvement_cycles';
  execute 'drop policy if exists improvement_cycles_delete_own on public.improvement_cycles';

  execute 'create policy improvement_cycles_select_own on public.improvement_cycles for select using (auth.uid() = user_id)';
  execute 'create policy improvement_cycles_insert_own on public.improvement_cycles for insert with check (auth.uid() = user_id)';
  execute 'create policy improvement_cycles_update_own on public.improvement_cycles for update using (auth.uid() = user_id)';
  execute 'create policy improvement_cycles_delete_own on public.improvement_cycles for delete using (auth.uid() = user_id)';
end $$;
