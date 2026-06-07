-- google_calendar_connections — schema para Supabase remoto

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.google_calendar_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  google_email text,
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists google_calendar_connections_user_id_key
  on public.google_calendar_connections (user_id);

alter table public.google_calendar_connections enable row level security;

drop policy if exists "google_calendar_connections_select_own" on public.google_calendar_connections;
create policy "google_calendar_connections_select_own"
  on public.google_calendar_connections for select
  using (auth.uid() = user_id);

drop policy if exists "google_calendar_connections_insert_own" on public.google_calendar_connections;
create policy "google_calendar_connections_insert_own"
  on public.google_calendar_connections for insert
  with check (auth.uid() = user_id);

drop policy if exists "google_calendar_connections_update_own" on public.google_calendar_connections;
create policy "google_calendar_connections_update_own"
  on public.google_calendar_connections for update
  using (auth.uid() = user_id);

drop policy if exists "google_calendar_connections_delete_own" on public.google_calendar_connections;
create policy "google_calendar_connections_delete_own"
  on public.google_calendar_connections for delete
  using (auth.uid() = user_id);

drop trigger if exists google_calendar_connections_updated_at on public.google_calendar_connections;
create trigger google_calendar_connections_updated_at
  before update on public.google_calendar_connections
  for each row execute function public.set_updated_at();
