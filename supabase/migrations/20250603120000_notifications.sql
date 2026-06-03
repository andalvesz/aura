-- Notificações internas da Aura OS

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  message text not null,
  type text not null,
  status text not null default 'unread' check (status in ('unread', 'read')),
  related_module text,
  related_id uuid,
  scheduled_for timestamptz,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists notifications_user_id_idx
  on public.notifications (user_id, created_at desc);

create index if not exists notifications_user_status_idx
  on public.notifications (user_id, status, created_at desc);

create index if not exists notifications_related_idx
  on public.notifications (user_id, type, related_id)
  where status = 'unread';

alter table public.notifications enable row level security;

create policy "notifications_select_own"
  on public.notifications for select using (auth.uid() = user_id);

create policy "notifications_insert_own"
  on public.notifications for insert with check (auth.uid() = user_id);

create policy "notifications_update_own"
  on public.notifications for update using (auth.uid() = user_id);

create policy "notifications_delete_own"
  on public.notifications for delete using (auth.uid() = user_id);
