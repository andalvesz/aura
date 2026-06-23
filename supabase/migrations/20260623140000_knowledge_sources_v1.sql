-- Knowledge Sources V1 — Google Drive, TXT/PDF uploads, processing pipeline, influence tracking

create table if not exists public.knowledge_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  source_type text not null
    check (source_type in ('drive_video', 'txt', 'pdf', 'transcript')),
  provider text not null
    check (provider in ('google_drive', 'upload')),
  course_name text,
  module_name text,
  lesson_name text,
  status text not null default 'pending'
    check (status in ('pending', 'queued', 'processing', 'ready', 'failed')),
  progress integer not null default 0
    check (progress >= 0 and progress <= 100),
  drive_file_id text,
  drive_mime_type text,
  expert_source_id uuid references public.expert_knowledge_sources (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists knowledge_sources_user_recent_idx
  on public.knowledge_sources (user_id, created_at desc);

create index if not exists knowledge_sources_status_idx
  on public.knowledge_sources (user_id, status, created_at desc);

alter table public.knowledge_sources enable row level security;

do $$
begin
  execute 'drop policy if exists knowledge_sources_select_own on public.knowledge_sources';
  execute 'drop policy if exists knowledge_sources_insert_own on public.knowledge_sources';
  execute 'drop policy if exists knowledge_sources_update_own on public.knowledge_sources';
  execute 'drop policy if exists knowledge_sources_delete_own on public.knowledge_sources';

  execute 'create policy knowledge_sources_select_own on public.knowledge_sources for select using (auth.uid() = user_id)';
  execute 'create policy knowledge_sources_insert_own on public.knowledge_sources for insert with check (auth.uid() = user_id)';
  execute 'create policy knowledge_sources_update_own on public.knowledge_sources for update using (auth.uid() = user_id)';
  execute 'create policy knowledge_sources_delete_own on public.knowledge_sources for delete using (auth.uid() = user_id)';
end $$;

create table if not exists public.knowledge_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  source_id uuid not null references public.knowledge_sources (id) on delete cascade,
  status text not null default 'queued'
    check (status in ('queued', 'running', 'completed', 'failed')),
  stage text not null default 'queued'
    check (stage in (
      'queued',
      'downloading',
      'transcribing',
      'extracting',
      'saving',
      'completed',
      'failed'
    )),
  started_at timestamptz,
  completed_at timestamptz,
  error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists knowledge_jobs_source_idx
  on public.knowledge_jobs (source_id, created_at desc);

create index if not exists knowledge_jobs_user_pending_idx
  on public.knowledge_jobs (user_id, status, created_at asc);

alter table public.knowledge_jobs enable row level security;

do $$
begin
  execute 'drop policy if exists knowledge_jobs_select_own on public.knowledge_jobs';
  execute 'drop policy if exists knowledge_jobs_insert_own on public.knowledge_jobs';
  execute 'drop policy if exists knowledge_jobs_update_own on public.knowledge_jobs';
  execute 'drop policy if exists knowledge_jobs_delete_own on public.knowledge_jobs';

  execute 'create policy knowledge_jobs_select_own on public.knowledge_jobs for select using (auth.uid() = user_id)';
  execute 'create policy knowledge_jobs_insert_own on public.knowledge_jobs for insert with check (auth.uid() = user_id)';
  execute 'create policy knowledge_jobs_update_own on public.knowledge_jobs for update using (auth.uid() = user_id)';
  execute 'create policy knowledge_jobs_delete_own on public.knowledge_jobs for delete using (auth.uid() = user_id)';
end $$;

create table if not exists public.knowledge_influence_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  module text not null,
  generation_id text,
  frameworks jsonb not null default '[]'::jsonb,
  decision_rules jsonb not null default '[]'::jsonb,
  patterns jsonb not null default '[]'::jsonb,
  success_patterns jsonb not null default '[]'::jsonb,
  failure_patterns jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists knowledge_influence_logs_user_module_idx
  on public.knowledge_influence_logs (user_id, module, created_at desc);

alter table public.knowledge_influence_logs enable row level security;

do $$
begin
  execute 'drop policy if exists knowledge_influence_logs_select_own on public.knowledge_influence_logs';
  execute 'drop policy if exists knowledge_influence_logs_insert_own on public.knowledge_influence_logs';
  execute 'drop policy if exists knowledge_influence_logs_delete_own on public.knowledge_influence_logs';

  execute 'create policy knowledge_influence_logs_select_own on public.knowledge_influence_logs for select using (auth.uid() = user_id)';
  execute 'create policy knowledge_influence_logs_insert_own on public.knowledge_influence_logs for insert with check (auth.uid() = user_id)';
  execute 'create policy knowledge_influence_logs_delete_own on public.knowledge_influence_logs for delete using (auth.uid() = user_id)';
end $$;
