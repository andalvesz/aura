-- Aura Expert Brain — camada de inteligência transversal (cursos, frameworks, playbooks, patterns)

create table if not exists public.expert_knowledge_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  source_type text not null
    check (source_type in ('course', 'video', 'pdf', 'transcript', 'marketing_material', 'other')),
  origin text,
  author text,
  niche text,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'ready', 'failed')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists expert_knowledge_sources_user_idx
  on public.expert_knowledge_sources (user_id, created_at desc);

create index if not exists expert_knowledge_sources_status_idx
  on public.expert_knowledge_sources (user_id, status, created_at desc);

create table if not exists public.expert_frameworks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  source_id uuid references public.expert_knowledge_sources (id) on delete set null,
  name text not null,
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
  description text,
  principles jsonb not null default '[]'::jsonb,
  when_to_use text,
  examples jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists expert_frameworks_user_idx
  on public.expert_frameworks (user_id, created_at desc);

create index if not exists expert_frameworks_category_idx
  on public.expert_frameworks (user_id, category, created_at desc);

create index if not exists expert_frameworks_source_idx
  on public.expert_frameworks (user_id, source_id);

create table if not exists public.expert_playbooks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  framework_id uuid references public.expert_frameworks (id) on delete set null,
  playbook_type text not null
    check (playbook_type in ('checklist', 'workflow', 'decision_tree', 'template', 'rules')),
  title text not null,
  steps jsonb not null default '[]'::jsonb,
  rules jsonb not null default '[]'::jsonb,
  examples jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists expert_playbooks_user_idx
  on public.expert_playbooks (user_id, created_at desc);

create index if not exists expert_playbooks_framework_idx
  on public.expert_playbooks (user_id, framework_id);

create table if not exists public.expert_patterns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  pattern_type text not null
    check (pattern_type in (
      'decision_rule',
      'quality_criterion',
      'checklist_item',
      'heuristic',
      'winner_signal'
    )),
  title text not null,
  description text,
  applies_to jsonb not null default '[]'::jsonb,
  confidence_score numeric(5, 2) not null default 0,
  source_ids jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists expert_patterns_user_idx
  on public.expert_patterns (user_id, created_at desc);

create index if not exists expert_patterns_type_idx
  on public.expert_patterns (user_id, pattern_type, confidence_score desc);

alter table public.expert_knowledge_sources enable row level security;
alter table public.expert_frameworks enable row level security;
alter table public.expert_playbooks enable row level security;
alter table public.expert_patterns enable row level security;

do $$
begin
  execute 'drop policy if exists expert_knowledge_sources_select_own on public.expert_knowledge_sources';
  execute 'drop policy if exists expert_knowledge_sources_insert_own on public.expert_knowledge_sources';
  execute 'drop policy if exists expert_knowledge_sources_update_own on public.expert_knowledge_sources';
  execute 'drop policy if exists expert_knowledge_sources_delete_own on public.expert_knowledge_sources';

  execute 'create policy expert_knowledge_sources_select_own on public.expert_knowledge_sources for select using (auth.uid() = user_id)';
  execute 'create policy expert_knowledge_sources_insert_own on public.expert_knowledge_sources for insert with check (auth.uid() = user_id)';
  execute 'create policy expert_knowledge_sources_update_own on public.expert_knowledge_sources for update using (auth.uid() = user_id)';
  execute 'create policy expert_knowledge_sources_delete_own on public.expert_knowledge_sources for delete using (auth.uid() = user_id)';

  execute 'drop policy if exists expert_frameworks_select_own on public.expert_frameworks';
  execute 'drop policy if exists expert_frameworks_insert_own on public.expert_frameworks';
  execute 'drop policy if exists expert_frameworks_update_own on public.expert_frameworks';
  execute 'drop policy if exists expert_frameworks_delete_own on public.expert_frameworks';

  execute 'create policy expert_frameworks_select_own on public.expert_frameworks for select using (auth.uid() = user_id)';
  execute 'create policy expert_frameworks_insert_own on public.expert_frameworks for insert with check (auth.uid() = user_id)';
  execute 'create policy expert_frameworks_update_own on public.expert_frameworks for update using (auth.uid() = user_id)';
  execute 'create policy expert_frameworks_delete_own on public.expert_frameworks for delete using (auth.uid() = user_id)';

  execute 'drop policy if exists expert_playbooks_select_own on public.expert_playbooks';
  execute 'drop policy if exists expert_playbooks_insert_own on public.expert_playbooks';
  execute 'drop policy if exists expert_playbooks_update_own on public.expert_playbooks';
  execute 'drop policy if exists expert_playbooks_delete_own on public.expert_playbooks';

  execute 'create policy expert_playbooks_select_own on public.expert_playbooks for select using (auth.uid() = user_id)';
  execute 'create policy expert_playbooks_insert_own on public.expert_playbooks for insert with check (auth.uid() = user_id)';
  execute 'create policy expert_playbooks_update_own on public.expert_playbooks for update using (auth.uid() = user_id)';
  execute 'create policy expert_playbooks_delete_own on public.expert_playbooks for delete using (auth.uid() = user_id)';

  execute 'drop policy if exists expert_patterns_select_own on public.expert_patterns';
  execute 'drop policy if exists expert_patterns_insert_own on public.expert_patterns';
  execute 'drop policy if exists expert_patterns_update_own on public.expert_patterns';
  execute 'drop policy if exists expert_patterns_delete_own on public.expert_patterns';

  execute 'create policy expert_patterns_select_own on public.expert_patterns for select using (auth.uid() = user_id)';
  execute 'create policy expert_patterns_insert_own on public.expert_patterns for insert with check (auth.uid() = user_id)';
  execute 'create policy expert_patterns_update_own on public.expert_patterns for update using (auth.uid() = user_id)';
  execute 'create policy expert_patterns_delete_own on public.expert_patterns for delete using (auth.uid() = user_id)';
end $$;
