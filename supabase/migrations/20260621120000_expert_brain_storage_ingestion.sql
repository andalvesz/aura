-- Expert Brain — Storage bucket + fila de ingestão assíncrona
-- file_size_limit = 2 * 1024 * 1024 * 1024 (EXPERT_BRAIN_MAX_FILE_SIZE no app)
-- O limite global do projeto (Dashboard → Storage → Settings) também deve ser ≥ 2 GB.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'expert-brain-files',
  'expert-brain-files',
  false,
  2147483648,
  array[
    'application/zip',
    'application/x-zip-compressed',
    'application/pdf',
    'video/mp4',
    'video/quicktime',
    'video/webm',
    'video/x-matroska',
    'video/x-msvideo',
    'text/plain',
    'text/markdown',
    'application/octet-stream'
  ]::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "expert_brain_files_insert_own" on storage.objects;
create policy "expert_brain_files_insert_own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'expert-brain-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "expert_brain_files_update_own" on storage.objects;
create policy "expert_brain_files_update_own"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'expert-brain-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "expert_brain_files_select_own" on storage.objects;
create policy "expert_brain_files_select_own"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'expert-brain-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "expert_brain_files_delete_own" on storage.objects;
create policy "expert_brain_files_delete_own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'expert-brain-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create table if not exists public.expert_ingestion_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  file_path text not null,
  course_name text,
  module_name text,
  lesson_name text,
  file_name text,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'done', 'failed')),
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

alter table public.expert_ingestion_queue enable row level security;

do $$
begin
  execute 'drop policy if exists expert_ingestion_queue_select_own on public.expert_ingestion_queue';
  execute 'drop policy if exists expert_ingestion_queue_insert_own on public.expert_ingestion_queue';
  execute 'drop policy if exists expert_ingestion_queue_update_own on public.expert_ingestion_queue';
  execute 'drop policy if exists expert_ingestion_queue_delete_own on public.expert_ingestion_queue';

  execute 'create policy expert_ingestion_queue_select_own on public.expert_ingestion_queue for select using (auth.uid() = user_id)';
  execute 'create policy expert_ingestion_queue_insert_own on public.expert_ingestion_queue for insert with check (auth.uid() = user_id)';
  execute 'create policy expert_ingestion_queue_update_own on public.expert_ingestion_queue for update using (auth.uid() = user_id)';
  execute 'create policy expert_ingestion_queue_delete_own on public.expert_ingestion_queue for delete using (auth.uid() = user_id)';
end $$;
