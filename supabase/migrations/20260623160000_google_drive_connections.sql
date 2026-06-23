-- Google Drive connections (Expert Brain — dedicated OAuth store)

create table if not exists public.google_drive_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  google_email text,
  google_display_name text,
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists google_drive_connections_user_id_key
  on public.google_drive_connections (user_id);

alter table public.google_drive_connections enable row level security;

drop policy if exists "google_drive_connections_select_own" on public.google_drive_connections;
create policy "google_drive_connections_select_own"
  on public.google_drive_connections for select
  using (auth.uid() = user_id);

drop policy if exists "google_drive_connections_insert_own" on public.google_drive_connections;
create policy "google_drive_connections_insert_own"
  on public.google_drive_connections for insert
  with check (auth.uid() = user_id);

drop policy if exists "google_drive_connections_update_own" on public.google_drive_connections;
create policy "google_drive_connections_update_own"
  on public.google_drive_connections for update
  using (auth.uid() = user_id);

drop policy if exists "google_drive_connections_delete_own" on public.google_drive_connections;
create policy "google_drive_connections_delete_own"
  on public.google_drive_connections for delete
  using (auth.uid() = user_id);

-- Drive-sourced ingestion items wait for download pipeline (V1: not processed yet)
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
