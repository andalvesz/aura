-- Expert Influence Audit — measure Expert Brain utilization per generation

create table if not exists public.expert_influence_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  module_name text not null,
  generation_id text,
  framework_ids uuid[] not null default '{}'::uuid[],
  decision_rule_ids uuid[] not null default '{}'::uuid[],
  success_pattern_ids uuid[] not null default '{}'::uuid[],
  failure_pattern_ids uuid[] not null default '{}'::uuid[],
  influence_score numeric(5, 2) not null default 0
    check (influence_score >= 0 and influence_score <= 100),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists expert_influence_logs_user_recent_idx
  on public.expert_influence_logs (user_id, created_at desc);

create index if not exists expert_influence_logs_user_module_idx
  on public.expert_influence_logs (user_id, module_name, created_at desc);

create index if not exists expert_influence_logs_score_idx
  on public.expert_influence_logs (user_id, influence_score);

alter table public.expert_influence_logs enable row level security;

do $$
begin
  execute 'drop policy if exists expert_influence_logs_select_own on public.expert_influence_logs';
  execute 'drop policy if exists expert_influence_logs_insert_own on public.expert_influence_logs';
  execute 'drop policy if exists expert_influence_logs_delete_own on public.expert_influence_logs';

  execute 'create policy expert_influence_logs_select_own on public.expert_influence_logs for select using (auth.uid() = user_id)';
  execute 'create policy expert_influence_logs_insert_own on public.expert_influence_logs for insert with check (auth.uid() = user_id)';
  execute 'create policy expert_influence_logs_delete_own on public.expert_influence_logs for delete using (auth.uid() = user_id)';
end $$;
