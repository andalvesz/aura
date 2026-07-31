-- communication_logs: PERSONAL rows may reference Workspace entities.
-- Validate membership on insert/update. Do not delete legacy invalid rows.

create or replace function public.user_can_access_workspace_entity(
  p_table text,
  p_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  ws uuid;
  owner uuid;
begin
  if p_id is null then
    return true;
  end if;

  if p_table = 'clientes' then
    select workspace_id into ws from public.clientes where id = p_id;
    if ws is null then return false; end if;
    return public.is_workspace_member(ws);
  elsif p_table = 'orcamentos' then
    select workspace_id into ws from public.orcamentos where id = p_id;
    if ws is null then return false; end if;
    return public.is_workspace_member(ws);
  elsif p_table = 'alvesz_propostas' then
    select workspace_id into ws from public.alvesz_propostas where id = p_id;
    if ws is null then return false; end if;
    return public.is_workspace_member(ws);
  elsif p_table = 'leads' then
    if to_regclass('public.leads') is null then
      return true;
    end if;
    select workspace_id into ws from public.leads where id = p_id;
    if not found then
      -- lead_id may point at growth_leads (legacy FK)
      if to_regclass('public.growth_leads') is not null then
        select user_id into owner from public.growth_leads where id = p_id;
        return owner is not null and owner = auth.uid();
      end if;
      return false;
    end if;
    if ws is null then return false; end if;
    return public.is_workspace_member(ws);
  elsif p_table = 'growth_leads' then
    if to_regclass('public.growth_leads') is null then
      return true;
    end if;
    select user_id into owner from public.growth_leads where id = p_id;
    return owner is not null and owner = auth.uid();
  elsif p_table = 'alvesz_eventos' then
    if to_regclass('public.alvesz_eventos') is null then
      return true;
    end if;
    select workspace_id into ws from public.alvesz_eventos where id = p_id;
    if ws is null then return false; end if;
    return public.is_workspace_member(ws);
  end if;

  return false;
end;
$$;

revoke all on function public.user_can_access_workspace_entity(text, uuid) from public;
grant execute on function public.user_can_access_workspace_entity(text, uuid) to authenticated;

create or replace function public.validate_communication_log_workspace_refs()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_id is distinct from auth.uid() then
    raise exception 'communication_log_user_mismatch'
      using errcode = '42501';
  end if;

  if new.cliente_id is not null
     and not public.user_can_access_workspace_entity('clientes', new.cliente_id) then
    raise exception 'communication_log_invalid_cliente_ref'
      using errcode = '42501';
  end if;

  if new.orcamento_id is not null
     and not public.user_can_access_workspace_entity('orcamentos', new.orcamento_id) then
    raise exception 'communication_log_invalid_orcamento_ref'
      using errcode = '42501';
  end if;

  if new.proposta_id is not null
     and not public.user_can_access_workspace_entity('alvesz_propostas', new.proposta_id) then
    raise exception 'communication_log_invalid_proposta_ref'
      using errcode = '42501';
  end if;

  if new.lead_id is not null then
    -- Prefer workspace leads; fall back to growth_leads ownership
    if not (
      public.user_can_access_workspace_entity('leads', new.lead_id)
      or public.user_can_access_workspace_entity('growth_leads', new.lead_id)
    ) then
      raise exception 'communication_log_invalid_lead_ref'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists communication_logs_validate_workspace_refs on public.communication_logs;
create trigger communication_logs_validate_workspace_refs
  before insert or update of cliente_id, orcamento_id, proposta_id, lead_id, user_id
  on public.communication_logs
  for each row
  execute function public.validate_communication_log_workspace_refs();

-- Tighten insert policy: still own-user only (trigger handles cross-refs)
drop policy if exists "communication_logs_insert_own" on public.communication_logs;
create policy "communication_logs_insert_own"
  on public.communication_logs for insert
  with check (auth.uid() = user_id);

drop policy if exists "communication_logs_select_own" on public.communication_logs;
create policy "communication_logs_select_own"
  on public.communication_logs for select
  using (auth.uid() = user_id);

drop policy if exists "communication_logs_update_own" on public.communication_logs;
create policy "communication_logs_update_own"
  on public.communication_logs for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
