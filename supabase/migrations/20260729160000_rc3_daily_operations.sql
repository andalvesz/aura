-- RC3 Daily Operations — favorites, comments, activity, brain notifications
-- Idempotent. No Decision Support / Execution. Does not alter Cognitive Kernel.

create table if not exists public.aura_daily_favorites (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  workspace_id uuid references public.workspaces (id) on delete set null,
  target_type text not null
    check (target_type in ('memory','entity','project','discovery','document')),
  target_id text not null,
  title text not null default '',
  href text not null default '',
  created_at timestamptz not null default now()
);

create unique index if not exists aura_daily_favorites_uidx
  on public.aura_daily_favorites (user_id, target_type, target_id);
create index if not exists aura_daily_favorites_user_idx
  on public.aura_daily_favorites (user_id, created_at desc);

alter table public.aura_daily_favorites enable row level security;

drop policy if exists aura_daily_favorites_own on public.aura_daily_favorites;
create policy aura_daily_favorites_select_own
  on public.aura_daily_favorites for select using (auth.uid() = user_id);
create policy aura_daily_favorites_insert_own
  on public.aura_daily_favorites for insert with check (auth.uid() = user_id);
create policy aura_daily_favorites_delete_own
  on public.aura_daily_favorites for delete using (auth.uid() = user_id);

create table if not exists public.aura_daily_comments (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  workspace_id uuid references public.workspaces (id) on delete set null,
  target_type text not null
    check (target_type in ('memory','discovery','insight','entity')),
  target_id text not null,
  body text not null,
  visibility_scope text not null default 'PRIVATE'
    check (visibility_scope in ('PRIVATE','WORKSPACE','SHARED_WITH_SELECTED_MEMBERS','SYSTEM_INTERNAL')),
  edited_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists aura_daily_comments_target_idx
  on public.aura_daily_comments (target_type, target_id, created_at desc)
  where deleted_at is null;
create index if not exists aura_daily_comments_user_idx
  on public.aura_daily_comments (user_id, created_at desc);

alter table public.aura_daily_comments enable row level security;

drop policy if exists aura_daily_comments_select on public.aura_daily_comments;
create policy aura_daily_comments_select
  on public.aura_daily_comments for select
  using (
    deleted_at is null
    and (
      auth.uid() = user_id
      or (
        visibility_scope = 'WORKSPACE'
        and workspace_id is not null
        and public.is_workspace_member(workspace_id)
      )
    )
  );

create policy aura_daily_comments_insert_own
  on public.aura_daily_comments for insert
  with check (auth.uid() = user_id);

create policy aura_daily_comments_update_own
  on public.aura_daily_comments for update
  using (auth.uid() = user_id);

create table if not exists public.aura_daily_comment_history (
  id text primary key,
  comment_id text not null references public.aura_daily_comments (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  previous_body text not null,
  created_at timestamptz not null default now()
);

alter table public.aura_daily_comment_history enable row level security;
create policy aura_daily_comment_history_own
  on public.aura_daily_comment_history for select
  using (auth.uid() = user_id);
create policy aura_daily_comment_history_insert_own
  on public.aura_daily_comment_history for insert
  with check (auth.uid() = user_id);

create table if not exists public.aura_daily_activity (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  workspace_id uuid references public.workspaces (id) on delete set null,
  actor_user_id uuid not null references auth.users (id) on delete cascade,
  activity_type text not null,
  title text not null,
  summary text not null default '',
  target_type text,
  target_id text,
  href text,
  visibility_scope text not null default 'PRIVATE'
    check (visibility_scope in ('PRIVATE','WORKSPACE','SHARED_WITH_SELECTED_MEMBERS','SYSTEM_INTERNAL')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists aura_daily_activity_user_idx
  on public.aura_daily_activity (user_id, created_at desc);
create index if not exists aura_daily_activity_ws_idx
  on public.aura_daily_activity (workspace_id, created_at desc)
  where workspace_id is not null;

alter table public.aura_daily_activity enable row level security;

create policy aura_daily_activity_select
  on public.aura_daily_activity for select
  using (
    auth.uid() = user_id
    or (
      visibility_scope = 'WORKSPACE'
      and workspace_id is not null
      and public.is_workspace_member(workspace_id)
    )
  );

create policy aura_daily_activity_insert_own
  on public.aura_daily_activity for insert
  with check (auth.uid() = actor_user_id);

create table if not exists public.aura_brain_notifications (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  workspace_id uuid references public.workspaces (id) on delete set null,
  kind text not null
    check (kind in (
      'new_discovery','new_comment','feedback_received','shared_memory'
    )),
  title text not null,
  message text not null default '',
  href text,
  related_type text,
  related_id text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists aura_brain_notifications_user_idx
  on public.aura_brain_notifications (user_id, created_at desc);

alter table public.aura_brain_notifications enable row level security;

create policy aura_brain_notifications_select_own
  on public.aura_brain_notifications for select using (auth.uid() = user_id);
create policy aura_brain_notifications_insert_own
  on public.aura_brain_notifications for insert with check (auth.uid() = user_id);
create policy aura_brain_notifications_update_own
  on public.aura_brain_notifications for update using (auth.uid() = user_id);
create policy aura_brain_notifications_delete_own
  on public.aura_brain_notifications for delete using (auth.uid() = user_id);
