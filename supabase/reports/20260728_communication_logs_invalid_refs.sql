-- Relatório somente leitura: communication_logs com refs de Workspace inválidas
-- NÃO apaga registros.

-- Cliente de outro workspace / sem membership do dono do log
select
  cl.id as log_id,
  cl.user_id,
  cl.cliente_id,
  c.workspace_id as cliente_workspace_id,
  'cliente_ref' as ref_kind
from public.communication_logs cl
left join public.clientes c on c.id = cl.cliente_id
where cl.cliente_id is not null
  and (
    c.id is null
    or c.workspace_id is null
    or not exists (
      select 1
      from public.workspace_members m
      where m.workspace_id = c.workspace_id
        and m.user_id = cl.user_id
        and m.status = 'active'
    )
  );

-- Orçamento inacessível ao dono do log
select
  cl.id as log_id,
  cl.user_id,
  cl.orcamento_id,
  o.workspace_id as orcamento_workspace_id,
  'orcamento_ref' as ref_kind
from public.communication_logs cl
left join public.orcamentos o on o.id = cl.orcamento_id
where cl.orcamento_id is not null
  and (
    o.id is null
    or o.workspace_id is null
    or not exists (
      select 1
      from public.workspace_members m
      where m.workspace_id = o.workspace_id
        and m.user_id = cl.user_id
        and m.status = 'active'
    )
  );

-- Proposta inacessível
select
  cl.id as log_id,
  cl.user_id,
  cl.proposta_id,
  p.workspace_id as proposta_workspace_id,
  'proposta_ref' as ref_kind
from public.communication_logs cl
left join public.alvesz_propostas p on p.id = cl.proposta_id
where cl.proposta_id is not null
  and (
    p.id is null
    or p.workspace_id is null
    or not exists (
      select 1
      from public.workspace_members m
      where m.workspace_id = p.workspace_id
        and m.user_id = cl.user_id
        and m.status = 'active'
    )
  );

-- Lead: growth_leads de outro user OU leads de workspace sem membership
select
  cl.id as log_id,
  cl.user_id,
  cl.lead_id,
  coalesce(gl.user_id::text, l.workspace_id::text) as lead_owner_or_ws,
  'lead_ref' as ref_kind
from public.communication_logs cl
left join public.growth_leads gl on gl.id = cl.lead_id
left join public.leads l on l.id = cl.lead_id
where cl.lead_id is not null
  and not (
    (gl.id is not null and gl.user_id = cl.user_id)
    or (
      l.id is not null
      and l.workspace_id is not null
      and exists (
        select 1
        from public.workspace_members m
        where m.workspace_id = l.workspace_id
          and m.user_id = cl.user_id
          and m.status = 'active'
      )
    )
  );
