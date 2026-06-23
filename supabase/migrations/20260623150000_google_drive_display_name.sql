alter table public.google_calendar_connections
  add column if not exists google_display_name text;
