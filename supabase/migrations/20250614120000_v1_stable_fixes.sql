-- V1 Stable: sync token Google, escopos OAuth e idempotência XP

alter table public.google_calendar_connections
  add column if not exists sync_token text,
  add column if not exists granted_scopes text;

alter table public.xp_history
  add column if not exists idempotency_key text;

create unique index if not exists xp_history_user_idempotency_key
  on public.xp_history (user_id, idempotency_key)
  where idempotency_key is not null;
