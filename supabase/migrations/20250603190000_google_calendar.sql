-- Integração Google Calendar

create table if not exists public.google_calendar_connections (
  user_id uuid primary key references auth.users (id) on delete cascade,
  access_token text not null,
  refresh_token text not null,
  token_expires_at timestamptz not null,
  google_email text,
  calendar_id text not null default 'primary',
  sync_token text,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.google_calendar_connections enable row level security;

drop policy if exists "google_calendar_connections_select_own" on public.google_calendar_connections;
create policy "google_calendar_connections_select_own"
  on public.google_calendar_connections for select using (auth.uid() = user_id);

drop policy if exists "google_calendar_connections_insert_own" on public.google_calendar_connections;
create policy "google_calendar_connections_insert_own"
  on public.google_calendar_connections for insert with check (auth.uid() = user_id);

drop policy if exists "google_calendar_connections_update_own" on public.google_calendar_connections;
create policy "google_calendar_connections_update_own"
  on public.google_calendar_connections for update using (auth.uid() = user_id);

drop policy if exists "google_calendar_connections_delete_own" on public.google_calendar_connections;
create policy "google_calendar_connections_delete_own"
  on public.google_calendar_connections for delete using (auth.uid() = user_id);

drop trigger if exists google_calendar_connections_updated_at on public.google_calendar_connections;
create trigger google_calendar_connections_updated_at
  before update on public.google_calendar_connections
  for each row execute function public.set_updated_at();

alter table public.eventos
  add column if not exists google_event_id text,
  add column if not exists google_sync_status text;

alter table public.eventos
  drop constraint if exists eventos_google_sync_status_check;

alter table public.eventos
  add constraint eventos_google_sync_status_check
  check (
    google_sync_status is null
    or google_sync_status in ('synced', 'pending', 'error')
  );

create unique index if not exists eventos_user_google_event_id_idx
  on public.eventos (user_id, google_event_id)
  where google_event_id is not null;

create index if not exists eventos_google_sync_status_idx
  on public.eventos (user_id, google_sync_status)
  where google_sync_status is not null;
