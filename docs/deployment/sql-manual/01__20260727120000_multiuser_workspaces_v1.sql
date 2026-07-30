-- Aura Multiuser V1 — Sprint 1
-- Workspaces, members, roles, invites, profile context, Alvesz backfill, RLS
-- Idempotent. Does NOT touch UNRESOLVED tables (creator/growth/expert/etc.).

-- ---------------------------------------------------------------------------
-- 1. Profiles extensions
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists onboarding_completed boolean not null default false;

alter table public.profiles
  add column if not exists active_workspace_id uuid;

alter table public.profiles
  add column if not exists active_context text not null default 'personal';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_active_context_check'
  ) then
    alter table public.profiles
      add constraint profiles_active_context_check
      check (active_context in ('personal', 'workspace'));
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Workspaces
-- ---------------------------------------------------------------------------
create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workspaces_slug_unique unique (slug)
);

create index if not exists workspaces_created_by_idx on public.workspaces (created_by);

alter table public.workspaces enable row level security;

-- ---------------------------------------------------------------------------
-- 3. Workspace members
-- ---------------------------------------------------------------------------
create table if not exists public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member',
  status text not null default 'active',
  invited_by uuid references auth.users (id) on delete set null,
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  constraint workspace_members_role_check check (role in ('owner', 'admin', 'member')),
  constraint workspace_members_status_check check (status in ('active', 'invited', 'suspended')),
  constraint workspace_members_workspace_user_unique unique (workspace_id, user_id)
);

create index if not exists workspace_members_user_id_idx on public.workspace_members (user_id);
create index if not exists workspace_members_workspace_id_idx on public.workspace_members (workspace_id);

alter table public.workspace_members enable row level security;

-- ---------------------------------------------------------------------------
-- 4. Workspace invites (token stored as hash only)
-- ---------------------------------------------------------------------------
create table if not exists public.workspace_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  email text not null,
  role text not null default 'member',
  token_hash text not null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  invited_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint workspace_invites_role_check check (role in ('admin', 'member')),
  constraint workspace_invites_token_hash_unique unique (token_hash)
);

create index if not exists workspace_invites_email_idx
  on public.workspace_invites (lower(email));

create index if not exists workspace_invites_workspace_id_idx
  on public.workspace_invites (workspace_id);

alter table public.workspace_invites enable row level security;

-- FK profiles.active_workspace_id (after workspaces exists)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_active_workspace_id_fkey'
  ) then
    alter table public.profiles
      add constraint profiles_active_workspace_id_fkey
      foreign key (active_workspace_id) references public.workspaces (id) on delete set null;
  end if;
end $$;

create index if not exists profiles_active_workspace_id_idx
  on public.profiles (active_workspace_id);

-- ---------------------------------------------------------------------------
-- 5. SECURITY DEFINER helpers (fixed search_path)
-- ---------------------------------------------------------------------------
create or replace function public.is_workspace_member(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members m
    where m.workspace_id = p_workspace_id
      and m.user_id = auth.uid()
      and m.status = 'active'
  );
$$;

create or replace function public.is_workspace_admin(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members m
    where m.workspace_id = p_workspace_id
      and m.user_id = auth.uid()
      and m.status = 'active'
      and m.role in ('owner', 'admin')
  );
$$;

create or replace function public.is_workspace_owner(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members m
    where m.workspace_id = p_workspace_id
      and m.user_id = auth.uid()
      and m.status = 'active'
      and m.role = 'owner'
  );
$$;

revoke all on function public.is_workspace_member(uuid) from public;
revoke all on function public.is_workspace_admin(uuid) from public;
revoke all on function public.is_workspace_owner(uuid) from public;
grant execute on function public.is_workspace_member(uuid) to authenticated;
grant execute on function public.is_workspace_admin(uuid) to authenticated;
grant execute on function public.is_workspace_owner(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Add workspace_id to WORKSPACE tables (only if table exists)
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'clientes', 'orcamentos', 'estoque', 'leads', 'alvesz_eventos', 'alvesz_propostas'
  ]
  loop
    if to_regclass('public.' || t) is null then
      raise notice 'multiuser_v1: skipping missing table %', t;
      continue;
    end if;
    execute format(
      'alter table public.%I add column if not exists workspace_id uuid',
      t
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 7. Backfill: create Alvesz workspace + owner + assign rows
-- ---------------------------------------------------------------------------
do $$
declare
  v_owner uuid;
  v_ws uuid;
  v_existing uuid;
  t text;
  v_sql text := '';
  v_parts text[] := array[]::text[];
begin
  select id into v_existing from public.workspaces where slug = 'alvesz' limit 1;

  if v_existing is null then
    if to_regclass('public.clientes') is not null then
      v_parts := array_append(
        v_parts,
        'select user_id, count(*)::bigint as c from public.clientes group by user_id'
      );
    end if;
    if to_regclass('public.orcamentos') is not null then
      v_parts := array_append(
        v_parts,
        'select user_id, count(*)::bigint as c from public.orcamentos group by user_id'
      );
    end if;
    if to_regclass('public.estoque') is not null then
      v_parts := array_append(
        v_parts,
        'select user_id, count(*)::bigint as c from public.estoque group by user_id'
      );
    end if;

    if array_length(v_parts, 1) is not null then
      v_sql := format(
        'select user_id from (%s) s group by user_id order by sum(c) desc limit 1',
        array_to_string(v_parts, ' union all ')
      );
      execute v_sql into v_owner;
    end if;

    if v_owner is null then
      select id into v_owner from auth.users order by created_at asc limit 1;
    end if;

    if v_owner is null then
      raise notice 'multiuser_v1: no auth users found — skipping Alvesz seed';
      return;
    end if;

    insert into public.workspaces (name, slug, created_by)
    values ('Alvesz', 'alvesz', v_owner)
    returning id into v_ws;

    insert into public.workspace_members (workspace_id, user_id, role, status, joined_at)
    values (v_ws, v_owner, 'owner', 'active', now())
    on conflict (workspace_id, user_id) do nothing;

    update public.profiles
    set
      active_workspace_id = coalesce(active_workspace_id, v_ws),
      active_context = case
        when active_context = 'workspace' then 'workspace'
        else active_context
      end,
      updated_at = now()
    where id = v_owner;
  else
    v_ws := v_existing;

    select created_by into v_owner from public.workspaces where id = v_ws;

    insert into public.workspace_members (workspace_id, user_id, role, status, joined_at)
    values (v_ws, v_owner, 'owner', 'active', now())
    on conflict (workspace_id, user_id) do update
      set role = 'owner',
          status = 'active',
          joined_at = coalesce(public.workspace_members.joined_at, now());
  end if;

  -- Assign unscoped Alvesz business rows to Alvesz workspace (skip missing tables)
  foreach t in array array[
    'clientes', 'orcamentos', 'estoque', 'leads', 'alvesz_eventos', 'alvesz_propostas'
  ]
  loop
    if to_regclass('public.' || t) is null then
      continue;
    end if;
    execute format(
      'update public.%I set workspace_id = $1 where workspace_id is null',
      t
    ) using v_ws;
  end loop;
end $$;

-- FKs + NOT NULL after backfill (only if table exists and no nulls remain)
do $$
declare
  t text;
  null_count bigint;
begin
  foreach t in array array[
    'clientes', 'orcamentos', 'estoque', 'leads', 'alvesz_eventos', 'alvesz_propostas'
  ]
  loop
    if to_regclass('public.' || t) is null then
      continue;
    end if;
    execute format(
      'select count(*) from public.%I where workspace_id is null',
      t
    ) into null_count;
    if null_count = 0 then
      execute format(
        'alter table public.%I alter column workspace_id set not null',
        t
      );
    end if;
  end loop;
end $$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'clientes', 'orcamentos', 'estoque', 'leads', 'alvesz_eventos', 'alvesz_propostas'
  ]
  loop
    if to_regclass('public.' || t) is null then
      continue;
    end if;
    if not exists (
      select 1 from pg_constraint where conname = t || '_workspace_id_fkey'
    ) then
      execute format(
        'alter table public.%I add constraint %I foreign key (workspace_id) references public.workspaces (id) on delete restrict',
        t, t || '_workspace_id_fkey'
      );
    end if;
    execute format(
      'create index if not exists %I on public.%I (workspace_id)',
      t || '_workspace_id_idx', t
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 8. RLS — workspaces
-- ---------------------------------------------------------------------------
drop policy if exists workspaces_select_member on public.workspaces;
create policy workspaces_select_member
  on public.workspaces for select
  using (public.is_workspace_member(id));

drop policy if exists workspaces_insert_authenticated on public.workspaces;
create policy workspaces_insert_authenticated
  on public.workspaces for insert
  with check (auth.uid() = created_by);

drop policy if exists workspaces_update_owner on public.workspaces;
create policy workspaces_update_owner
  on public.workspaces for update
  using (public.is_workspace_owner(id))
  with check (public.is_workspace_owner(id));

drop policy if exists workspaces_delete_owner on public.workspaces;
create policy workspaces_delete_owner
  on public.workspaces for delete
  using (public.is_workspace_owner(id));

-- ---------------------------------------------------------------------------
-- 9. RLS — workspace_members
-- ---------------------------------------------------------------------------
drop policy if exists workspace_members_select_member on public.workspace_members;
create policy workspace_members_select_member
  on public.workspace_members for select
  using (public.is_workspace_member(workspace_id));

drop policy if exists workspace_members_insert_admin on public.workspace_members;
create policy workspace_members_insert_admin
  on public.workspace_members for insert
  with check (
    public.is_workspace_admin(workspace_id)
    and role in ('admin', 'member')
  );

-- Allow bootstrap: owner row for workspace creator (used at creation time)
drop policy if exists workspace_members_insert_self_owner on public.workspace_members;
create policy workspace_members_insert_self_owner
  on public.workspace_members for insert
  with check (
    auth.uid() = user_id
    and role = 'owner'
    and exists (
      select 1 from public.workspaces w
      where w.id = workspace_id and w.created_by = auth.uid()
    )
  );

drop policy if exists workspace_members_update_owner on public.workspace_members;
create policy workspace_members_update_owner
  on public.workspace_members for update
  using (public.is_workspace_owner(workspace_id))
  with check (
    public.is_workspace_owner(workspace_id)
    -- prevent demoting/removing last owner via role change to non-owner on self is app-enforced;
    -- block promoting to owner except by current owner (already required)
  );

drop policy if exists workspace_members_delete_admin on public.workspace_members;
create policy workspace_members_delete_admin
  on public.workspace_members for delete
  using (
    public.is_workspace_admin(workspace_id)
    and role <> 'owner'
    and user_id <> auth.uid()
  );

-- ---------------------------------------------------------------------------
-- 10. RLS — workspace_invites
-- ---------------------------------------------------------------------------
drop policy if exists workspace_invites_select_admin on public.workspace_invites;
create policy workspace_invites_select_admin
  on public.workspace_invites for select
  using (public.is_workspace_admin(workspace_id));

drop policy if exists workspace_invites_insert_admin on public.workspace_invites;
create policy workspace_invites_insert_admin
  on public.workspace_invites for insert
  with check (
    public.is_workspace_admin(workspace_id)
    and invited_by = auth.uid()
    and role in ('admin', 'member')
  );

drop policy if exists workspace_invites_update_admin on public.workspace_invites;
create policy workspace_invites_update_admin
  on public.workspace_invites for update
  using (public.is_workspace_admin(workspace_id))
  with check (public.is_workspace_admin(workspace_id));

drop policy if exists workspace_invites_delete_admin on public.workspace_invites;
create policy workspace_invites_delete_admin
  on public.workspace_invites for delete
  using (public.is_workspace_admin(workspace_id));

-- ---------------------------------------------------------------------------
-- 11. RLS — WORKSPACE data tables (replace user-only policies)
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
  pol text;
begin
  foreach t in array array[
    'clientes', 'orcamentos', 'estoque', 'leads', 'alvesz_eventos', 'alvesz_propostas'
  ]
  loop
    if to_regclass('public.' || t) is null then
      continue;
    end if;

    execute format('alter table public.%I enable row level security', t);

    -- Drop legacy own policies (quoted and unquoted names)
    for pol in
      select policyname from pg_policies
      where schemaname = 'public' and tablename = t
    loop
      execute format('drop policy if exists %I on public.%I', pol, t);
    end loop;

    execute format(
      'create policy %I on public.%I for select using (public.is_workspace_member(workspace_id))',
      t || '_select_member', t
    );
    execute format(
      'create policy %I on public.%I for insert with check (
         public.is_workspace_member(workspace_id)
         and auth.uid() = user_id
         and workspace_id is not null
       )',
      t || '_insert_member', t
    );
    execute format(
      'create policy %I on public.%I for update using (public.is_workspace_member(workspace_id))
         with check (public.is_workspace_member(workspace_id))',
      t || '_update_member', t
    );
    execute format(
      'create policy %I on public.%I for delete using (public.is_workspace_admin(workspace_id))',
      t || '_delete_admin', t
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 12. Profiles: allow select own + update own (incl. context fields)
-- ---------------------------------------------------------------------------
drop policy if exists "Users can view own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists profiles_select_own on public.profiles;
drop policy if exists profiles_update_own on public.profiles;

create policy profiles_select_own
  on public.profiles for select
  using (auth.uid() = id);

create policy profiles_update_own
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Members can read basic profile of co-members (name/avatar for members UI)
drop policy if exists profiles_select_workspace_peers on public.profiles;
create policy profiles_select_workspace_peers
  on public.profiles for select
  using (
    exists (
      select 1
      from public.workspace_members me
      join public.workspace_members peer
        on peer.workspace_id = me.workspace_id
       and peer.status = 'active'
      where me.user_id = auth.uid()
        and me.status = 'active'
        and peer.user_id = profiles.id
    )
  );

-- ---------------------------------------------------------------------------
-- 13. Accept-invite helper (SECURITY DEFINER) — validates email + token hash
-- ---------------------------------------------------------------------------
create or replace function public.accept_workspace_invite(p_token_hash text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.workspace_invites%rowtype;
  v_uid uuid := auth.uid();
  v_email text;
  v_member_id uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select email into v_email from auth.users where id = v_uid;
  if v_email is null then
    raise exception 'user_email_missing';
  end if;

  select * into v_invite
  from public.workspace_invites
  where token_hash = p_token_hash
  for update;

  if not found then
    raise exception 'invite_not_found';
  end if;

  if v_invite.accepted_at is not null then
    raise exception 'invite_already_used';
  end if;

  if v_invite.expires_at < now() then
    raise exception 'invite_expired';
  end if;

  if lower(v_invite.email) <> lower(v_email) then
    raise exception 'invite_email_mismatch';
  end if;

  -- Admin cannot create owner via invite (already constrained); never elevate to owner here
  if v_invite.role = 'owner' then
    raise exception 'invite_invalid_role';
  end if;

  insert into public.workspace_members (
    workspace_id, user_id, role, status, invited_by, joined_at
  )
  values (
    v_invite.workspace_id,
    v_uid,
    v_invite.role,
    'active',
    v_invite.invited_by,
    now()
  )
  on conflict (workspace_id, user_id) do update
    set status = 'active',
        role = excluded.role,
        joined_at = coalesce(public.workspace_members.joined_at, now()),
        invited_by = coalesce(public.workspace_members.invited_by, excluded.invited_by)
  returning id into v_member_id;

  update public.workspace_invites
  set accepted_at = now()
  where id = v_invite.id;

  update public.profiles
  set
    active_workspace_id = v_invite.workspace_id,
    active_context = 'workspace',
    updated_at = now()
  where id = v_uid;

  return v_invite.workspace_id;
end;
$$;

revoke all on function public.accept_workspace_invite(text) from public;
grant execute on function public.accept_workspace_invite(text) to authenticated;

-- updated_at triggers
drop trigger if exists workspaces_updated_at on public.workspaces;
create trigger workspaces_updated_at
  before update on public.workspaces
  for each row execute function public.set_updated_at();
