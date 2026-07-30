-- RC3.1 Mobile & Smart Capture — attachments library
-- Idempotent. No Decision Support / Execution. Does not alter Cognitive Kernel.

create table if not exists public.aura_memory_attachments (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  workspace_id uuid references public.workspaces (id) on delete set null,
  memory_id text,
  kind text not null
    check (kind in ('image','pdf','audio','link','video_link','file')),
  file_name text not null default '',
  mime_type text not null default 'application/octet-stream',
  size_bytes bigint not null default 0,
  storage_path text,
  url text,
  ocr_text text,
  link_preview jsonb,
  tags text[] not null default '{}',
  virus_scan jsonb not null default '{"status":"skipped","provider":"prepared","scannedAt":null,"detail":"prepared"}'::jsonb,
  searchable_text text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists aura_memory_attachments_user_idx
  on public.aura_memory_attachments (user_id, created_at desc);
create index if not exists aura_memory_attachments_memory_idx
  on public.aura_memory_attachments (memory_id)
  where memory_id is not null;
create index if not exists aura_memory_attachments_search_idx
  on public.aura_memory_attachments using gin (to_tsvector('simple', searchable_text));

alter table public.aura_memory_attachments enable row level security;

drop policy if exists aura_memory_attachments_select_own on public.aura_memory_attachments;
create policy aura_memory_attachments_select_own
  on public.aura_memory_attachments for select
  using (
    auth.uid() = user_id
    or (
      workspace_id is not null
      and public.is_workspace_member(workspace_id)
    )
  );

drop policy if exists aura_memory_attachments_insert_own on public.aura_memory_attachments;
create policy aura_memory_attachments_insert_own
  on public.aura_memory_attachments for insert
  with check (auth.uid() = user_id);

drop policy if exists aura_memory_attachments_update_own on public.aura_memory_attachments;
create policy aura_memory_attachments_update_own
  on public.aura_memory_attachments for update
  using (auth.uid() = user_id);

drop policy if exists aura_memory_attachments_delete_own on public.aura_memory_attachments;
create policy aura_memory_attachments_delete_own
  on public.aura_memory_attachments for delete
  using (auth.uid() = user_id);

-- Optional pin surfaces on daily favorites (RC3.1)
alter table public.aura_daily_favorites
  add column if not exists pins text[] not null default '{}';

comment on table public.aura_memory_attachments is
  'RC3.1 Smart Capture attachment library (OCR, links, files). executionInfluence none.';
