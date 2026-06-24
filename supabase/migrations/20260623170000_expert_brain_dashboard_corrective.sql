-- Expert Brain dashboard — corrective idempotent migration
-- Ensures all tables/columns/policies used by GET /api/expert-brain exist in production.

alter table public.expert_knowledge_sources
  add column if not exists raw_text text,
  add column if not exists course_id uuid,
  add column if not exists module_id uuid,
  add column if not exists lesson_id uuid;

create table if not exists public.expert_courses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  author text,
  niche text,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'ready', 'failed', 'partial')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists expert_courses_user_idx
  on public.expert_courses (user_id, created_at desc);

create table if not exists public.expert_course_modules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  course_id uuid not null references public.expert_courses (id) on delete cascade,
  title text not null,
  sort_order int not null default 0,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'ready', 'failed', 'partial')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists expert_course_modules_course_idx
  on public.expert_course_modules (user_id, course_id, sort_order);

create table if not exists public.expert_course_lessons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  module_id uuid not null references public.expert_course_modules (id) on delete cascade,
  source_id uuid references public.expert_knowledge_sources (id) on delete set null,
  title text not null,
  source_type text not null default 'other'
    check (source_type in ('course', 'video', 'pdf', 'transcript', 'marketing_material', 'other')),
  sort_order int not null default 0,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'ready', 'failed')),
  raw_text text,
  file_name text,
  file_path text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists expert_course_lessons_module_idx
  on public.expert_course_lessons (user_id, module_id, sort_order);

create index if not exists expert_course_lessons_source_idx
  on public.expert_course_lessons (user_id, source_id);

create table if not exists public.expert_processing_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  entity_type text not null
    check (entity_type in ('lesson', 'module', 'course', 'source')),
  entity_id uuid not null,
  action text not null default 'process'
    check (action in ('process', 'reprocess')),
  priority int not null default 0,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'done', 'failed')),
  attempts int not null default 0,
  error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists expert_processing_queue_pending_idx
  on public.expert_processing_queue (user_id, status, priority desc, created_at asc);

create table if not exists public.expert_ingestion_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  file_path text not null,
  course_name text,
  module_name text,
  lesson_name text,
  file_name text,
  status text not null default 'uploaded',
  progress numeric(5, 2) not null default 0,
  error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists expert_ingestion_queue_pending_idx
  on public.expert_ingestion_queue (user_id, status, created_at asc);

create index if not exists expert_ingestion_queue_recent_idx
  on public.expert_ingestion_queue (user_id, created_at desc);

create table if not exists public.expert_transcripts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  ingestion_id uuid references public.expert_ingestion_queue (id) on delete set null,
  lesson_id uuid references public.expert_course_lessons (id) on delete set null,
  source_id uuid references public.expert_knowledge_sources (id) on delete set null,
  file_path text not null,
  transcript_path text,
  word_count integer not null default 0,
  duration_seconds numeric(10, 2),
  status text not null default 'transcribing'
    check (status in ('transcribing', 'ready', 'failed', 'waiting_for_openai')),
  error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists expert_transcripts_user_recent_idx
  on public.expert_transcripts (user_id, created_at desc);

create index if not exists expert_transcripts_ingestion_idx
  on public.expert_transcripts (ingestion_id);

create index if not exists expert_transcripts_lesson_idx
  on public.expert_transcripts (lesson_id);

alter table public.expert_ingestion_queue
  drop constraint if exists expert_ingestion_queue_status_check;

alter table public.expert_ingestion_queue
  add constraint expert_ingestion_queue_status_check
  check (status in (
    'uploaded',
    'transcribing',
    'extracting',
    'completed',
    'waiting_for_openai',
    'failed',
    'pending',
    'processing',
    'done',
    'pending_drive'
  ));

do $$
begin
  alter table public.expert_knowledge_sources
    add constraint expert_knowledge_sources_course_fk
      foreign key (course_id) references public.expert_courses (id) on delete set null;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.expert_knowledge_sources
    add constraint expert_knowledge_sources_module_fk
      foreign key (module_id) references public.expert_course_modules (id) on delete set null;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.expert_knowledge_sources
    add constraint expert_knowledge_sources_lesson_fk
      foreign key (lesson_id) references public.expert_course_lessons (id) on delete set null;
exception
  when duplicate_object then null;
end $$;

alter table public.expert_courses enable row level security;
alter table public.expert_course_modules enable row level security;
alter table public.expert_course_lessons enable row level security;
alter table public.expert_processing_queue enable row level security;
alter table public.expert_ingestion_queue enable row level security;
alter table public.expert_transcripts enable row level security;

do $$
begin
  execute 'drop policy if exists expert_courses_select_own on public.expert_courses';
  execute 'drop policy if exists expert_courses_insert_own on public.expert_courses';
  execute 'drop policy if exists expert_courses_update_own on public.expert_courses';
  execute 'drop policy if exists expert_courses_delete_own on public.expert_courses';
  execute 'create policy expert_courses_select_own on public.expert_courses for select using (auth.uid() = user_id)';
  execute 'create policy expert_courses_insert_own on public.expert_courses for insert with check (auth.uid() = user_id)';
  execute 'create policy expert_courses_update_own on public.expert_courses for update using (auth.uid() = user_id)';
  execute 'create policy expert_courses_delete_own on public.expert_courses for delete using (auth.uid() = user_id)';

  execute 'drop policy if exists expert_course_modules_select_own on public.expert_course_modules';
  execute 'drop policy if exists expert_course_modules_insert_own on public.expert_course_modules';
  execute 'drop policy if exists expert_course_modules_update_own on public.expert_course_modules';
  execute 'drop policy if exists expert_course_modules_delete_own on public.expert_course_modules';
  execute 'create policy expert_course_modules_select_own on public.expert_course_modules for select using (auth.uid() = user_id)';
  execute 'create policy expert_course_modules_insert_own on public.expert_course_modules for insert with check (auth.uid() = user_id)';
  execute 'create policy expert_course_modules_update_own on public.expert_course_modules for update using (auth.uid() = user_id)';
  execute 'create policy expert_course_modules_delete_own on public.expert_course_modules for delete using (auth.uid() = user_id)';

  execute 'drop policy if exists expert_course_lessons_select_own on public.expert_course_lessons';
  execute 'drop policy if exists expert_course_lessons_insert_own on public.expert_course_lessons';
  execute 'drop policy if exists expert_course_lessons_update_own on public.expert_course_lessons';
  execute 'drop policy if exists expert_course_lessons_delete_own on public.expert_course_lessons';
  execute 'create policy expert_course_lessons_select_own on public.expert_course_lessons for select using (auth.uid() = user_id)';
  execute 'create policy expert_course_lessons_insert_own on public.expert_course_lessons for insert with check (auth.uid() = user_id)';
  execute 'create policy expert_course_lessons_update_own on public.expert_course_lessons for update using (auth.uid() = user_id)';
  execute 'create policy expert_course_lessons_delete_own on public.expert_course_lessons for delete using (auth.uid() = user_id)';

  execute 'drop policy if exists expert_processing_queue_select_own on public.expert_processing_queue';
  execute 'drop policy if exists expert_processing_queue_insert_own on public.expert_processing_queue';
  execute 'drop policy if exists expert_processing_queue_update_own on public.expert_processing_queue';
  execute 'drop policy if exists expert_processing_queue_delete_own on public.expert_processing_queue';
  execute 'create policy expert_processing_queue_select_own on public.expert_processing_queue for select using (auth.uid() = user_id)';
  execute 'create policy expert_processing_queue_insert_own on public.expert_processing_queue for insert with check (auth.uid() = user_id)';
  execute 'create policy expert_processing_queue_update_own on public.expert_processing_queue for update using (auth.uid() = user_id)';
  execute 'create policy expert_processing_queue_delete_own on public.expert_processing_queue for delete using (auth.uid() = user_id)';

  execute 'drop policy if exists expert_ingestion_queue_select_own on public.expert_ingestion_queue';
  execute 'drop policy if exists expert_ingestion_queue_insert_own on public.expert_ingestion_queue';
  execute 'drop policy if exists expert_ingestion_queue_update_own on public.expert_ingestion_queue';
  execute 'drop policy if exists expert_ingestion_queue_delete_own on public.expert_ingestion_queue';
  execute 'create policy expert_ingestion_queue_select_own on public.expert_ingestion_queue for select using (auth.uid() = user_id)';
  execute 'create policy expert_ingestion_queue_insert_own on public.expert_ingestion_queue for insert with check (auth.uid() = user_id)';
  execute 'create policy expert_ingestion_queue_update_own on public.expert_ingestion_queue for update using (auth.uid() = user_id)';
  execute 'create policy expert_ingestion_queue_delete_own on public.expert_ingestion_queue for delete using (auth.uid() = user_id)';

  execute 'drop policy if exists expert_transcripts_select_own on public.expert_transcripts';
  execute 'drop policy if exists expert_transcripts_insert_own on public.expert_transcripts';
  execute 'drop policy if exists expert_transcripts_update_own on public.expert_transcripts';
  execute 'drop policy if exists expert_transcripts_delete_own on public.expert_transcripts';
  execute 'create policy expert_transcripts_select_own on public.expert_transcripts for select using (auth.uid() = user_id)';
  execute 'create policy expert_transcripts_insert_own on public.expert_transcripts for insert with check (auth.uid() = user_id)';
  execute 'create policy expert_transcripts_update_own on public.expert_transcripts for update using (auth.uid() = user_id)';
  execute 'create policy expert_transcripts_delete_own on public.expert_transcripts for delete using (auth.uid() = user_id)';
end $$;
