-- Aura Multiuser V1 — Integrity report (READ ONLY)
-- Run in Supabase SQL Editor. Does not modify data.
-- Expected: most counts = 0 after migrations applied.

-- 1) WORKSPACE rows missing workspace_id
select 'clientes_null_ws' as check_id, count(*)::int as n from public.clientes where workspace_id is null
union all select 'orcamentos_null_ws', count(*)::int from public.orcamentos where workspace_id is null
union all select 'estoque_null_ws', count(*)::int from public.estoque where workspace_id is null
union all select 'leads_null_ws', count(*)::int from public.leads where workspace_id is null
union all select 'alvesz_eventos_null_ws', count(*)::int from public.alvesz_eventos where workspace_id is null
union all select 'alvesz_propostas_null_ws', count(*)::int from public.alvesz_propostas where workspace_id is null

-- 2) PERSONAL sample tables missing user_id (should be impossible if NOT NULL)
union all select 'gastos_null_user', count(*)::int from public.gastos where user_id is null
union all select 'eventos_null_user', count(*)::int from public.eventos where user_id is null
union all select 'goals_null_user', count(*)::int from public.goals where user_id is null
union all select 'expert_ingestion_queue_null_user', count(*)::int from public.expert_ingestion_queue where user_id is null
union all select 'expert_transcripts_null_user', count(*)::int from public.expert_transcripts where user_id is null

-- 3) Duplicate memberships (same workspace + user)
union all
select 'duplicate_memberships', count(*)::int
from (
  select workspace_id, user_id
  from public.workspace_members
  group by workspace_id, user_id
  having count(*) > 1
) d

-- 4) Auth users without profile
union all
select 'auth_users_without_profile', count(*)::int
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null

-- 5) Profiles without auth.users
union all
select 'profiles_without_auth_user', count(*)::int
from public.profiles p
left join auth.users u on u.id = p.id
where u.id is null

-- 6) Workspaces without active owner
union all
select 'workspaces_without_owner', count(*)::int
from public.workspaces w
where not exists (
  select 1 from public.workspace_members m
  where m.workspace_id = w.id and m.role = 'owner' and m.status = 'active'
)

-- 7) Workspaces with >1 active owner
union all
select 'workspaces_multi_owner', count(*)::int
from (
  select workspace_id
  from public.workspace_members
  where role = 'owner' and status = 'active'
  group by workspace_id
  having count(*) > 1
) mo

-- 8) Expired invites still not accepted
union all
select 'expired_open_invites', count(*)::int
from public.workspace_invites
where accepted_at is null and expires_at < now()

-- 9) Invites accepted more than once (same token_hash)
union all
select 'duplicate_accepted_token_hash', count(*)::int
from (
  select token_hash
  from public.workspace_invites
  where accepted_at is not null
  group by token_hash
  having count(*) > 1
) x

-- 10) Memberships pointing to missing users
union all
select 'memberships_orphan_user', count(*)::int
from public.workspace_members m
left join auth.users u on u.id = m.user_id
where u.id is null

-- 11) active_workspace_id without active membership
union all
select 'stale_active_workspace', count(*)::int
from public.profiles p
where p.active_workspace_id is not null
  and not exists (
    select 1 from public.workspace_members m
    where m.workspace_id = p.active_workspace_id
      and m.user_id = p.id
      and m.status = 'active'
  )

-- 12) Alvesz rows not on Alvesz workspace (when slug exists)
union all
select 'clientes_wrong_ws', count(*)::int
from public.clientes c
cross join lateral (
  select id from public.workspaces where slug = 'alvesz' limit 1
) w
where c.workspace_id is distinct from w.id

order by check_id;
