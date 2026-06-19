-- Aura Expert Brain V2 — decision rules, checklists, failure/success patterns

create table if not exists public.expert_decision_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  source_id uuid references public.expert_knowledge_sources (id) on delete set null,
  framework_id uuid references public.expert_frameworks (id) on delete set null,
  title text not null,
  category text not null
    check (category in (
      'product_creation',
      'copywriting',
      'funnel_strategy',
      'offer_creation',
      'creative_strategy',
      'paid_traffic',
      'landing_page',
      'sales_psychology',
      'launch_strategy',
      'retention',
      'scaling'
    )),
  rule text not null,
  when_to_apply text,
  when_not_to_apply text,
  confidence_score numeric(5, 2) not null default 0,
  priority integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists expert_decision_rules_user_idx
  on public.expert_decision_rules (user_id, created_at desc);

create index if not exists expert_decision_rules_category_idx
  on public.expert_decision_rules (user_id, category, priority desc, confidence_score desc);

create index if not exists expert_decision_rules_source_idx
  on public.expert_decision_rules (user_id, source_id);

create table if not exists public.expert_checklists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  source_id uuid references public.expert_knowledge_sources (id) on delete set null,
  title text not null,
  checklist_type text not null
    check (checklist_type in ('operational', 'quality', 'launch', 'validation', 'scaling', 'other')),
  items jsonb not null default '[]'::jsonb,
  pass_criteria text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists expert_checklists_user_idx
  on public.expert_checklists (user_id, created_at desc);

create index if not exists expert_checklists_type_idx
  on public.expert_checklists (user_id, checklist_type, created_at desc);

create table if not exists public.expert_failure_patterns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  source_id uuid references public.expert_knowledge_sources (id) on delete set null,
  title text not null,
  description text,
  warning_signs jsonb not null default '[]'::jsonb,
  consequences jsonb not null default '[]'::jsonb,
  prevention_actions jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists expert_failure_patterns_user_idx
  on public.expert_failure_patterns (user_id, created_at desc);

create table if not exists public.expert_success_patterns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  source_id uuid references public.expert_knowledge_sources (id) on delete set null,
  title text not null,
  description text,
  success_signals jsonb not null default '[]'::jsonb,
  scaling_actions jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists expert_success_patterns_user_idx
  on public.expert_success_patterns (user_id, created_at desc);

alter table public.expert_decision_rules enable row level security;
alter table public.expert_checklists enable row level security;
alter table public.expert_failure_patterns enable row level security;
alter table public.expert_success_patterns enable row level security;

do $$
begin
  execute 'drop policy if exists expert_decision_rules_select_own on public.expert_decision_rules';
  execute 'drop policy if exists expert_decision_rules_insert_own on public.expert_decision_rules';
  execute 'drop policy if exists expert_decision_rules_update_own on public.expert_decision_rules';
  execute 'drop policy if exists expert_decision_rules_delete_own on public.expert_decision_rules';

  execute 'create policy expert_decision_rules_select_own on public.expert_decision_rules for select using (auth.uid() = user_id)';
  execute 'create policy expert_decision_rules_insert_own on public.expert_decision_rules for insert with check (auth.uid() = user_id)';
  execute 'create policy expert_decision_rules_update_own on public.expert_decision_rules for update using (auth.uid() = user_id)';
  execute 'create policy expert_decision_rules_delete_own on public.expert_decision_rules for delete using (auth.uid() = user_id)';

  execute 'drop policy if exists expert_checklists_select_own on public.expert_checklists';
  execute 'drop policy if exists expert_checklists_insert_own on public.expert_checklists';
  execute 'drop policy if exists expert_checklists_update_own on public.expert_checklists';
  execute 'drop policy if exists expert_checklists_delete_own on public.expert_checklists';

  execute 'create policy expert_checklists_select_own on public.expert_checklists for select using (auth.uid() = user_id)';
  execute 'create policy expert_checklists_insert_own on public.expert_checklists for insert with check (auth.uid() = user_id)';
  execute 'create policy expert_checklists_update_own on public.expert_checklists for update using (auth.uid() = user_id)';
  execute 'create policy expert_checklists_delete_own on public.expert_checklists for delete using (auth.uid() = user_id)';

  execute 'drop policy if exists expert_failure_patterns_select_own on public.expert_failure_patterns';
  execute 'drop policy if exists expert_failure_patterns_insert_own on public.expert_failure_patterns';
  execute 'drop policy if exists expert_failure_patterns_update_own on public.expert_failure_patterns';
  execute 'drop policy if exists expert_failure_patterns_delete_own on public.expert_failure_patterns';

  execute 'create policy expert_failure_patterns_select_own on public.expert_failure_patterns for select using (auth.uid() = user_id)';
  execute 'create policy expert_failure_patterns_insert_own on public.expert_failure_patterns for insert with check (auth.uid() = user_id)';
  execute 'create policy expert_failure_patterns_update_own on public.expert_failure_patterns for update using (auth.uid() = user_id)';
  execute 'create policy expert_failure_patterns_delete_own on public.expert_failure_patterns for delete using (auth.uid() = user_id)';

  execute 'drop policy if exists expert_success_patterns_select_own on public.expert_success_patterns';
  execute 'drop policy if exists expert_success_patterns_insert_own on public.expert_success_patterns';
  execute 'drop policy if exists expert_success_patterns_update_own on public.expert_success_patterns';
  execute 'drop policy if exists expert_success_patterns_delete_own on public.expert_success_patterns';

  execute 'create policy expert_success_patterns_select_own on public.expert_success_patterns for select using (auth.uid() = user_id)';
  execute 'create policy expert_success_patterns_insert_own on public.expert_success_patterns for insert with check (auth.uid() = user_id)';
  execute 'create policy expert_success_patterns_update_own on public.expert_success_patterns for update using (auth.uid() = user_id)';
  execute 'create policy expert_success_patterns_delete_own on public.expert_success_patterns for delete using (auth.uid() = user_id)';
end $$;
