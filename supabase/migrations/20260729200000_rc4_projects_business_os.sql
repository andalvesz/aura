-- RC4 Projects & Business OS
-- Idempotent. No Decision Support / Execution. Does not alter Cognitive Kernel.

create table if not exists public.aura_businesses (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  workspace_id uuid references public.workspaces (id) on delete set null,
  name text not null,
  segment text not null default 'other'
    check (segment in ('saas','agency','ecommerce','consulting','content','other')),
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists aura_businesses_user_idx
  on public.aura_businesses (user_id, updated_at desc);
create index if not exists aura_businesses_ws_idx
  on public.aura_businesses (workspace_id, updated_at desc)
  where workspace_id is not null;

create table if not exists public.aura_projects (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  workspace_id uuid references public.workspaces (id) on delete set null,
  business_id text references public.aura_businesses (id) on delete set null,
  name text not null,
  description text not null default '',
  status text not null default 'idea'
    check (status in ('idea','planning','active','paused','done','archived')),
  tags text[] not null default '{}',
  color text not null default '#22d3ee',
  icon text not null default 'folder',
  favorite boolean not null default false,
  archived boolean not null default false,
  memory_ids text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists aura_projects_user_idx
  on public.aura_projects (user_id, updated_at desc);
create index if not exists aura_projects_ws_idx
  on public.aura_projects (workspace_id, status, updated_at desc);
create index if not exists aura_projects_business_idx
  on public.aura_projects (business_id)
  where business_id is not null;

create table if not exists public.aura_project_members (
  id text primary key,
  project_id text not null references public.aura_projects (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner','editor','viewer')),
  added_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (project_id, user_id)
);

create index if not exists aura_project_members_user_idx
  on public.aura_project_members (user_id);

create table if not exists public.aura_project_documents (
  id text primary key,
  project_id text not null references public.aura_projects (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  workspace_id uuid references public.workspaces (id) on delete set null,
  kind text not null check (kind in ('pdf','image','audio','link','file')),
  title text not null default '',
  file_name text not null default '',
  mime_type text not null default 'application/octet-stream',
  size_bytes bigint not null default 0,
  url text,
  ocr_text text,
  searchable_text text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists aura_project_documents_project_idx
  on public.aura_project_documents (project_id, created_at desc);
create index if not exists aura_project_documents_search_idx
  on public.aura_project_documents using gin (to_tsvector('simple', searchable_text));

create table if not exists public.aura_project_timeline (
  id text primary key,
  project_id text not null references public.aura_projects (id) on delete cascade,
  actor_user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  title text not null default '',
  summary text not null default '',
  href text,
  related_type text,
  related_id text,
  created_at timestamptz not null default now()
);

create index if not exists aura_project_timeline_project_idx
  on public.aura_project_timeline (project_id, created_at desc);

-- RLS
alter table public.aura_businesses enable row level security;
alter table public.aura_projects enable row level security;
alter table public.aura_project_members enable row level security;
alter table public.aura_project_documents enable row level security;
alter table public.aura_project_timeline enable row level security;

drop policy if exists aura_businesses_select on public.aura_businesses;
create policy aura_businesses_select
  on public.aura_businesses for select
  using (
    auth.uid() = user_id
    or (workspace_id is not null and public.is_workspace_member(workspace_id))
  );
drop policy if exists aura_businesses_insert on public.aura_businesses;
create policy aura_businesses_insert
  on public.aura_businesses for insert with check (auth.uid() = user_id);
drop policy if exists aura_businesses_update on public.aura_businesses;
create policy aura_businesses_update
  on public.aura_businesses for update using (auth.uid() = user_id);

drop policy if exists aura_projects_select on public.aura_projects;
create policy aura_projects_select
  on public.aura_projects for select
  using (
    auth.uid() = user_id
    or (workspace_id is not null and public.is_workspace_member(workspace_id))
    or exists (
      select 1 from public.aura_project_members m
      where m.project_id = aura_projects.id and m.user_id = auth.uid()
    )
  );
drop policy if exists aura_projects_insert on public.aura_projects;
create policy aura_projects_insert
  on public.aura_projects for insert with check (auth.uid() = user_id);
drop policy if exists aura_projects_update on public.aura_projects;
create policy aura_projects_update
  on public.aura_projects for update
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.aura_project_members m
      where m.project_id = aura_projects.id
        and m.user_id = auth.uid()
        and m.role in ('owner','editor')
    )
  );

drop policy if exists aura_project_members_select on public.aura_project_members;
create policy aura_project_members_select
  on public.aura_project_members for select
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.aura_projects p
      where p.id = project_id
        and (
          p.user_id = auth.uid()
          or (p.workspace_id is not null and public.is_workspace_member(p.workspace_id))
        )
    )
  );
drop policy if exists aura_project_members_write on public.aura_project_members;
create policy aura_project_members_write
  on public.aura_project_members for all
  using (
    exists (
      select 1 from public.aura_projects p
      where p.id = project_id and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.aura_projects p
      where p.id = project_id and p.user_id = auth.uid()
    )
  );

drop policy if exists aura_project_documents_select on public.aura_project_documents;
create policy aura_project_documents_select
  on public.aura_project_documents for select
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.aura_projects p
      where p.id = project_id
        and (
          p.user_id = auth.uid()
          or (p.workspace_id is not null and public.is_workspace_member(p.workspace_id))
          or exists (
            select 1 from public.aura_project_members m
            where m.project_id = p.id and m.user_id = auth.uid()
          )
        )
    )
  );
drop policy if exists aura_project_documents_write on public.aura_project_documents;
create policy aura_project_documents_write
  on public.aura_project_documents for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists aura_project_timeline_select on public.aura_project_timeline;
create policy aura_project_timeline_select
  on public.aura_project_timeline for select
  using (
    exists (
      select 1 from public.aura_projects p
      where p.id = project_id
        and (
          p.user_id = auth.uid()
          or (p.workspace_id is not null and public.is_workspace_member(p.workspace_id))
          or exists (
            select 1 from public.aura_project_members m
            where m.project_id = p.id and m.user_id = auth.uid()
          )
        )
    )
  );
drop policy if exists aura_project_timeline_insert on public.aura_project_timeline;
create policy aura_project_timeline_insert
  on public.aura_project_timeline for insert
  with check (auth.uid() = actor_user_id);

alter table public.aura_daily_comments drop constraint if exists aura_daily_comments_target_type_check;
alter table public.aura_daily_comments
  add constraint aura_daily_comments_target_type_check
  check (target_type in ('memory','discovery','insight','entity','project','document'));

comment on table public.aura_projects is
  'RC4 Projects OS. executionInfluence none. No Decision Support / Execution.';
