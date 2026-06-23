-- Expert Brain — Transcription pipeline (Whisper → transcripts bucket → knowledge extraction)

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'expert-brain-transcripts',
  'expert-brain-transcripts',
  false,
  2147483648,
  array['text/plain', 'text/markdown', 'application/octet-stream']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "expert_brain_transcripts_insert_own" on storage.objects;
create policy "expert_brain_transcripts_insert_own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'expert-brain-transcripts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "expert_brain_transcripts_select_own" on storage.objects;
create policy "expert_brain_transcripts_select_own"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'expert-brain-transcripts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "expert_brain_transcripts_update_own" on storage.objects;
create policy "expert_brain_transcripts_update_own"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'expert-brain-transcripts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "expert_brain_transcripts_delete_own" on storage.objects;
create policy "expert_brain_transcripts_delete_own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'expert-brain-transcripts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

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

alter table public.expert_transcripts enable row level security;

do $$
begin
  execute 'drop policy if exists expert_transcripts_select_own on public.expert_transcripts';
  execute 'drop policy if exists expert_transcripts_insert_own on public.expert_transcripts';
  execute 'drop policy if exists expert_transcripts_update_own on public.expert_transcripts';
  execute 'drop policy if exists expert_transcripts_delete_own on public.expert_transcripts';

  execute 'create policy expert_transcripts_select_own on public.expert_transcripts for select using (auth.uid() = user_id)';
  execute 'create policy expert_transcripts_insert_own on public.expert_transcripts for insert with check (auth.uid() = user_id)';
  execute 'create policy expert_transcripts_update_own on public.expert_transcripts for update using (auth.uid() = user_id)';
  execute 'create policy expert_transcripts_delete_own on public.expert_transcripts for delete using (auth.uid() = user_id)';
end $$;

-- Expand ingestion queue statuses for the transcription pipeline
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
    'done'
  ));

update public.expert_ingestion_queue set status = 'uploaded' where status = 'pending';
update public.expert_ingestion_queue set status = 'completed' where status = 'done';
update public.expert_ingestion_queue set progress = 100 where status = 'completed' and progress < 100;
