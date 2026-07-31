-- Sprint 9.1 Conversational Command Center
-- Persistence prep for conversations. Runtime V1 may stay in-memory until adapter ships.
-- Does NOT replace ai_messages / agent_history / aura_command_history (legacy chat surfaces).
-- Do NOT apply automatically in production.

create table if not exists public.aura_conversations (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid null references public.workspaces(id) on delete set null,
  title text not null default 'Nova conversa',
  status text not null default 'ACTIVE' check (status in (
    'ACTIVE','WAITING_CONFIRMATION','ARCHIVED','DELETED'
  )),
  focus jsonb not null default '{}'::jsonb,
  memory_choice text not null default 'none',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz null,
  soft_deleted boolean not null default false,
  row_version integer not null default 1
);

create index if not exists aura_conversations_owner_updated_idx
  on public.aura_conversations (owner_id, updated_at desc)
  where soft_deleted = false;

create index if not exists aura_conversations_workspace_idx
  on public.aura_conversations (workspace_id, updated_at desc)
  where soft_deleted = false and workspace_id is not null;

create table if not exists public.aura_conversation_messages (
  id text primary key,
  conversation_id text not null references public.aura_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user','assistant','system')),
  content text not null default '',
  intent_kind text null,
  citations jsonb not null default '[]'::jsonb,
  draft_ids text[] not null default '{}',
  pending_action_ids text[] not null default '{}',
  navigation_href text null,
  explanation jsonb null,
  created_at timestamptz not null default now(),
  soft_deleted boolean not null default false
);

create index if not exists aura_conversation_messages_conv_idx
  on public.aura_conversation_messages (conversation_id, created_at asc)
  where soft_deleted = false;

create table if not exists public.aura_conversation_sources (
  id text primary key,
  conversation_id text not null references public.aura_conversations(id) on delete cascade,
  message_id text null references public.aura_conversation_messages(id) on delete set null,
  kind text not null,
  title text not null,
  href text not null,
  snippet text null,
  confirmed_by_user boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.aura_conversation_drafts (
  id text primary key,
  conversation_id text not null references public.aura_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  title text not null,
  preview text not null default '',
  payload jsonb not null default '{}'::jsonb,
  risk_level text not null default 'LOW',
  requires_confirmation boolean not null default true,
  status text not null default 'PREVIEW',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  soft_deleted boolean not null default false
);

create table if not exists public.aura_conversation_actions (
  id text primary key,
  conversation_id text not null references public.aura_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  title text not null,
  origin text not null default 'conversation',
  changes_summary text not null default '',
  risk_level text not null default 'LOW',
  reversibility text not null default 'reversible',
  expires_at timestamptz not null,
  payload_hash text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'PENDING',
  created_at timestamptz not null default now()
);

create table if not exists public.aura_conversation_context (
  conversation_id text primary key references public.aura_conversations(id) on delete cascade,
  workspace_id uuid null,
  project_id text null,
  mission_id text null,
  business_id text null,
  plan_id text null,
  context_mode text not null default 'personal',
  label text not null default 'Pessoal',
  updated_at timestamptz not null default now()
);

create table if not exists public.aura_conversation_audit (
  id text primary key,
  conversation_id text null,
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid null,
  event text not null,
  summary text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists aura_conversation_audit_user_idx
  on public.aura_conversation_audit (user_id, created_at desc);

alter table public.aura_conversations enable row level security;
alter table public.aura_conversation_messages enable row level security;
alter table public.aura_conversation_sources enable row level security;
alter table public.aura_conversation_drafts enable row level security;
alter table public.aura_conversation_actions enable row level security;
alter table public.aura_conversation_context enable row level security;
alter table public.aura_conversation_audit enable row level security;

drop policy if exists "aura_conversations_owner" on public.aura_conversations;
create policy "aura_conversations_owner"
  on public.aura_conversations for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

drop policy if exists "aura_conversation_messages_owner" on public.aura_conversation_messages;
create policy "aura_conversation_messages_owner"
  on public.aura_conversation_messages for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "aura_conversation_sources_via_owner" on public.aura_conversation_sources;
create policy "aura_conversation_sources_via_owner"
  on public.aura_conversation_sources for all
  using (
    exists (
      select 1 from public.aura_conversations c
      where c.id = conversation_id and c.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.aura_conversations c
      where c.id = conversation_id and c.owner_id = auth.uid()
    )
  );

drop policy if exists "aura_conversation_drafts_owner" on public.aura_conversation_drafts;
create policy "aura_conversation_drafts_owner"
  on public.aura_conversation_drafts for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "aura_conversation_actions_owner" on public.aura_conversation_actions;
create policy "aura_conversation_actions_owner"
  on public.aura_conversation_actions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "aura_conversation_context_via_owner" on public.aura_conversation_context;
create policy "aura_conversation_context_via_owner"
  on public.aura_conversation_context for all
  using (
    exists (
      select 1 from public.aura_conversations c
      where c.id = conversation_id and c.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.aura_conversations c
      where c.id = conversation_id and c.owner_id = auth.uid()
    )
  );

drop policy if exists "aura_conversation_audit_own" on public.aura_conversation_audit;
create policy "aura_conversation_audit_own"
  on public.aura_conversation_audit for select
  using (auth.uid() = user_id);

drop policy if exists "aura_conversation_audit_insert_own" on public.aura_conversation_audit;
create policy "aura_conversation_audit_insert_own"
  on public.aura_conversation_audit for insert
  with check (auth.uid() = user_id);

comment on table public.aura_conversations is
  'Sprint 9.1 Conversational Command Center. Distinct from ai_messages / agent_history / aura_command_history.';
