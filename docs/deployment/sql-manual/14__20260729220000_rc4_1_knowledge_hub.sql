-- RC4.1 Documents & Knowledge Hub
-- In-memory engine is primary at runtime; this migration prepares persistence + RLS.
-- executionInfluence remains 'none' (application-enforced).

create table if not exists public.aura_knowledge_documents (
  id text primary key,
  title text not null,
  description text not null default '',
  type text not null check (type in ('note','pdf','image','link','file','audio','contract')),
  workspace_id uuid null references public.workspaces(id) on delete set null,
  project_id text null,
  business_id text null,
  tags text[] not null default '{}',
  author_user_id uuid not null references auth.users(id) on delete cascade,
  visibility text not null default 'PRIVATE'
    check (visibility in ('PRIVATE','WORKSPACE','SHARED_WITH_SELECTED_MEMBERS','SYSTEM_INTERNAL')),
  content text not null default '',
  summary text not null default '',
  file_name text null,
  mime_type text null,
  size_bytes bigint not null default 0,
  url text null,
  storage_path text null,
  link_preview jsonb null,
  ocr_text text null,
  ocr_status text not null default 'none'
    check (ocr_status in ('none','pending','processing','ready','failed','manual')),
  ocr_confidence numeric null,
  searchable_text text not null default '',
  favorite boolean not null default false,
  archived boolean not null default false,
  collection_ids text[] not null default '{}',
  current_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists aura_knowledge_documents_author_idx
  on public.aura_knowledge_documents (author_user_id, updated_at desc);
create index if not exists aura_knowledge_documents_workspace_idx
  on public.aura_knowledge_documents (workspace_id, updated_at desc);
create index if not exists aura_knowledge_documents_project_idx
  on public.aura_knowledge_documents (project_id) where project_id is not null;
create index if not exists aura_knowledge_documents_business_idx
  on public.aura_knowledge_documents (business_id) where business_id is not null;
create index if not exists aura_knowledge_documents_search_idx
  on public.aura_knowledge_documents using gin (to_tsvector('simple', searchable_text));

create table if not exists public.aura_knowledge_versions (
  id text primary key,
  document_id text not null references public.aura_knowledge_documents(id) on delete cascade,
  version integer not null,
  title text not null,
  description text not null default '',
  content text not null default '',
  ocr_text text null,
  author_user_id uuid not null references auth.users(id) on delete cascade,
  note text not null default '',
  created_at timestamptz not null default now(),
  unique (document_id, version)
);

create table if not exists public.aura_knowledge_relations (
  id text primary key,
  document_id text not null references public.aura_knowledge_documents(id) on delete cascade,
  relation_type text not null check (relation_type in ('project','business','memory','entity','discovery')),
  target_id text not null,
  label text not null default '',
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (document_id, relation_type, target_id)
);

create table if not exists public.aura_knowledge_comments (
  id text primary key,
  document_id text not null references public.aura_knowledge_documents(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid null,
  parent_id text null references public.aura_knowledge_comments(id) on delete set null,
  body text not null default '',
  visibility text not null default 'PRIVATE',
  edited_at timestamptz null,
  deleted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.aura_knowledge_comment_history (
  id text primary key,
  comment_id text not null references public.aura_knowledge_comments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  previous_body text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.aura_knowledge_collections (
  id text primary key,
  name text not null,
  kind text not null default 'collection' check (kind in ('collection','folder')),
  parent_id text null references public.aura_knowledge_collections(id) on delete set null,
  workspace_id uuid null,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  document_ids text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.aura_knowledge_activity (
  id text primary key,
  document_id text null references public.aura_knowledge_documents(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid null,
  kind text not null,
  title text not null,
  summary text not null default '',
  href text null,
  created_at timestamptz not null default now()
);

alter table public.aura_knowledge_documents enable row level security;
alter table public.aura_knowledge_versions enable row level security;
alter table public.aura_knowledge_relations enable row level security;
alter table public.aura_knowledge_comments enable row level security;
alter table public.aura_knowledge_comment_history enable row level security;
alter table public.aura_knowledge_collections enable row level security;
alter table public.aura_knowledge_activity enable row level security;

-- Documents: owner full access; workspace members can select WORKSPACE rows
drop policy if exists aura_knowledge_documents_select on public.aura_knowledge_documents;
create policy aura_knowledge_documents_select on public.aura_knowledge_documents
  for select using (
    author_user_id = auth.uid()
    or (
      visibility = 'WORKSPACE'
      and workspace_id is not null
      and exists (
        select 1 from public.workspace_members wm
        where wm.workspace_id = aura_knowledge_documents.workspace_id
          and wm.user_id = auth.uid()
      )
    )
  );

drop policy if exists aura_knowledge_documents_write on public.aura_knowledge_documents;
create policy aura_knowledge_documents_write on public.aura_knowledge_documents
  for all using (author_user_id = auth.uid())
  with check (author_user_id = auth.uid());

drop policy if exists aura_knowledge_versions_access on public.aura_knowledge_versions;
create policy aura_knowledge_versions_access on public.aura_knowledge_versions
  for all using (
    exists (
      select 1 from public.aura_knowledge_documents d
      where d.id = document_id and d.author_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.aura_knowledge_documents d
      where d.id = document_id and d.author_user_id = auth.uid()
    )
  );

drop policy if exists aura_knowledge_versions_select_ws on public.aura_knowledge_versions;
create policy aura_knowledge_versions_select_ws on public.aura_knowledge_versions
  for select using (
    exists (
      select 1 from public.aura_knowledge_documents d
      where d.id = document_id
        and (
          d.author_user_id = auth.uid()
          or (
            d.visibility = 'WORKSPACE'
            and d.workspace_id is not null
            and exists (
              select 1 from public.workspace_members wm
              where wm.workspace_id = d.workspace_id and wm.user_id = auth.uid()
            )
          )
        )
    )
  );

drop policy if exists aura_knowledge_relations_access on public.aura_knowledge_relations;
create policy aura_knowledge_relations_access on public.aura_knowledge_relations
  for all using (
    exists (
      select 1 from public.aura_knowledge_documents d
      where d.id = document_id and d.author_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.aura_knowledge_documents d
      where d.id = document_id and d.author_user_id = auth.uid()
    )
  );

drop policy if exists aura_knowledge_comments_select on public.aura_knowledge_comments;
create policy aura_knowledge_comments_select on public.aura_knowledge_comments
  for select using (
    user_id = auth.uid()
    or exists (
      select 1 from public.aura_knowledge_documents d
      where d.id = document_id
        and (
          d.author_user_id = auth.uid()
          or (
            d.visibility = 'WORKSPACE'
            and d.workspace_id is not null
            and exists (
              select 1 from public.workspace_members wm
              where wm.workspace_id = d.workspace_id and wm.user_id = auth.uid()
            )
          )
        )
    )
  );

drop policy if exists aura_knowledge_comments_write on public.aura_knowledge_comments;
create policy aura_knowledge_comments_write on public.aura_knowledge_comments
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists aura_knowledge_comment_history_owner on public.aura_knowledge_comment_history;
create policy aura_knowledge_comment_history_owner on public.aura_knowledge_comment_history
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists aura_knowledge_collections_owner on public.aura_knowledge_collections;
create policy aura_knowledge_collections_owner on public.aura_knowledge_collections
  for all using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

drop policy if exists aura_knowledge_activity_select on public.aura_knowledge_activity;
create policy aura_knowledge_activity_select on public.aura_knowledge_activity
  for select using (user_id = auth.uid());

drop policy if exists aura_knowledge_activity_insert on public.aura_knowledge_activity;
create policy aura_knowledge_activity_insert on public.aura_knowledge_activity
  for insert with check (user_id = auth.uid());
