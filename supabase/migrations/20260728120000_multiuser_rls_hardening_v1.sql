-- Aura Multiuser V1 — RLS hardening + integrity helpers (idempotent)
-- Read companion report: supabase/reports/20260728_multiuser_integrity_readonly.sql
-- Does NOT delete business data. Safe to re-run.

-- ---------------------------------------------------------------------------
-- 1. Immutable workspace_id on WORKSPACE tables (blocks cross-workspace moves)
-- ---------------------------------------------------------------------------
create or replace function public.prevent_workspace_id_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and new.workspace_id is distinct from old.workspace_id then
    raise exception 'workspace_id_immutable';
  end if;
  return new;
end;
$$;

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
    execute format('drop trigger if exists %I on public.%I', t || '_workspace_id_immutable', t);
    execute format(
      'create trigger %I before update on public.%I
       for each row execute function public.prevent_workspace_id_change()',
      t || '_workspace_id_immutable', t
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Tighten UPDATE policies: membership on old + new row; workspace_id present
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
      continue;
    end if;

    execute format('drop policy if exists %I on public.%I', t || '_update_member', t);
    execute format(
      'create policy %I on public.%I for update
         using (public.is_workspace_member(workspace_id))
         with check (
           public.is_workspace_member(workspace_id)
           and workspace_id is not null
         )',
      t || '_update_member', t
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Prevent removing / demoting the last active owner
-- ---------------------------------------------------------------------------
create or replace function public.protect_last_workspace_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owners int;
  v_ws uuid;
begin
  v_ws := coalesce(old.workspace_id, new.workspace_id);

  if tg_op = 'DELETE' then
    if old.role = 'owner' and old.status = 'active' then
      select count(*) into v_owners
      from public.workspace_members m
      where m.workspace_id = v_ws
        and m.role = 'owner'
        and m.status = 'active'
        and m.id <> old.id;
      if v_owners < 1 then
        raise exception 'last_owner_protected';
      end if;
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE' then
    if old.role = 'owner' and old.status = 'active'
       and (new.role is distinct from 'owner' or new.status is distinct from 'active') then
      select count(*) into v_owners
      from public.workspace_members m
      where m.workspace_id = v_ws
        and m.role = 'owner'
        and m.status = 'active'
        and m.id <> old.id;
      if v_owners < 1 then
        raise exception 'last_owner_protected';
      end if;
    end if;
    return new;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists workspace_members_protect_last_owner on public.workspace_members;
create trigger workspace_members_protect_last_owner
  before update or delete on public.workspace_members
  for each row execute function public.protect_last_workspace_owner();

-- ---------------------------------------------------------------------------
-- 4. Soft-heal: stale active_workspace_id / context without active membership
-- ---------------------------------------------------------------------------
update public.profiles p
set
  active_workspace_id = null,
  active_context = 'personal',
  updated_at = now()
where p.active_workspace_id is not null
  and not exists (
    select 1
    from public.workspace_members m
    where m.workspace_id = p.active_workspace_id
      and m.user_id = p.id
      and m.status = 'active'
  );

update public.profiles p
set
  active_context = 'personal',
  updated_at = now()
where p.active_context = 'workspace'
  and p.active_workspace_id is null;

-- ---------------------------------------------------------------------------
-- 5. Optional: stamp remaining null workspace_id rows onto Alvesz (if exists)
--     Does not invent a workspace when Alvesz is missing.
-- ---------------------------------------------------------------------------
do $$
declare
  v_ws uuid;
begin
  select id into v_ws from public.workspaces where slug = 'alvesz' limit 1;
  if v_ws is null then
    raise notice 'multiuser_hardening: no alvesz workspace — skip null workspace_id backfill';
    return;
  end if;

  update public.clientes set workspace_id = v_ws where workspace_id is null;
  update public.orcamentos set workspace_id = v_ws where workspace_id is null;
  update public.estoque set workspace_id = v_ws where workspace_id is null;
  if to_regclass('public.leads') is not null then
    update public.leads set workspace_id = v_ws where workspace_id is null;
  end if;
  if to_regclass('public.alvesz_eventos') is not null then
    update public.alvesz_eventos set workspace_id = v_ws where workspace_id is null;
  end if;
  if to_regclass('public.alvesz_propostas') is not null then
    update public.alvesz_propostas set workspace_id = v_ws where workspace_id is null;
  end if;
end $$;

-- Attempt NOT NULL only when clean
do $$
declare
  t text;
  nulls bigint;
begin
  foreach t in array array[
    'clientes', 'orcamentos', 'estoque', 'leads', 'alvesz_eventos', 'alvesz_propostas'
  ]
  loop
    if to_regclass('public.' || t) is null then
      continue;
    end if;
    execute format('select count(*) from public.%I where workspace_id is null', t) into nulls;
    if nulls = 0 then
      begin
        execute format('alter table public.%I alter column workspace_id set not null', t);
      exception
        when others then
          raise notice 'multiuser_hardening: could not set NOT NULL on %: %', t, sqlerrm;
      end;
    else
      raise notice 'multiuser_hardening: % still has % null workspace_id row(s)', t, nulls;
    end if;
  end loop;
end $$;
