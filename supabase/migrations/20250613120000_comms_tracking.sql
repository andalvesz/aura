-- Permite rastrear abertura de e-mail via pixel sem sessão autenticada

create or replace function public.mark_communication_opened(p_token uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated integer;
begin
  update public.communication_logs
  set
    status = 'opened',
    opened_at = coalesce(opened_at, now())
  where tracking_token = p_token
    and opened_at is null;

  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;

revoke all on function public.mark_communication_opened(uuid) from public;
grant execute on function public.mark_communication_opened(uuid) to anon, authenticated, service_role;
