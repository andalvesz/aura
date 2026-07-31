-- Alvesz PDFs: private bucket + workspace-scoped storage policies
-- Path canonico: workspaces/{workspace_id}/propostas/{proposal_id}/{arquivo}
-- Idempotente. Nao move nem apaga objetos existentes.

-- 1) Bucket privado
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'alvesz-pdfs',
  'alvesz-pdfs',
  false,
  5242880,
  array['application/pdf']::text[]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- 2) Remover policies publicas / legadas do bucket
drop policy if exists "alvesz_pdfs_select_public" on storage.objects;
drop policy if exists "alvesz_pdfs_insert_own" on storage.objects;
drop policy if exists "alvesz_pdfs_update_own" on storage.objects;
drop policy if exists "alvesz_pdfs_delete_own" on storage.objects;
drop policy if exists "alvesz_pdfs_select_member" on storage.objects;
drop policy if exists "alvesz_pdfs_insert_member" on storage.objects;
drop policy if exists "alvesz_pdfs_update_member" on storage.objects;
drop policy if exists "alvesz_pdfs_delete_member" on storage.objects;
drop policy if exists "alvesz_pdfs_select_legacy_owner" on storage.objects;
drop policy if exists "alvesz_pdfs_update_legacy_owner" on storage.objects;
drop policy if exists "alvesz_pdfs_delete_legacy_owner" on storage.objects;

-- Helper: extrai workspace_id do path canonico workspaces/{uuid}/...
create or replace function public.alvesz_pdf_path_workspace_id(object_name text)
returns uuid
language plpgsql
immutable
as $$
declare
  parts text[];
  ws text;
begin
  parts := storage.foldername(object_name);
  if parts is null or array_length(parts, 1) < 2 then
    return null;
  end if;
  if parts[1] is distinct from 'workspaces' then
    return null;
  end if;
  ws := parts[2];
  if ws is null or ws !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return null;
  end if;
  return ws::uuid;
exception
  when others then
    return null;
end;
$$;

revoke all on function public.alvesz_pdf_path_workspace_id(text) from public;
grant execute on function public.alvesz_pdf_path_workspace_id(text) to authenticated;

-- 3) Policies canônicas (membership ativa no workspace do path)
create policy "alvesz_pdfs_select_member"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'alvesz-pdfs'
    and public.alvesz_pdf_path_workspace_id(name) is not null
    and public.is_workspace_member(public.alvesz_pdf_path_workspace_id(name))
  );

create policy "alvesz_pdfs_insert_member"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'alvesz-pdfs'
    and public.alvesz_pdf_path_workspace_id(name) is not null
    and public.is_workspace_member(public.alvesz_pdf_path_workspace_id(name))
    and (storage.foldername(name))[3] = 'propostas'
  );

create policy "alvesz_pdfs_update_member"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'alvesz-pdfs'
    and public.alvesz_pdf_path_workspace_id(name) is not null
    and public.is_workspace_member(public.alvesz_pdf_path_workspace_id(name))
  )
  with check (
    bucket_id = 'alvesz-pdfs'
    and public.alvesz_pdf_path_workspace_id(name) is not null
    and public.is_workspace_member(public.alvesz_pdf_path_workspace_id(name))
  );

create policy "alvesz_pdfs_delete_member"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'alvesz-pdfs'
    and public.alvesz_pdf_path_workspace_id(name) is not null
    and public.is_workspace_member(public.alvesz_pdf_path_workspace_id(name))
  );

-- 4) Leitura/escrita temporária de paths legados (user_id ou workspace_id no 1º segmento)
--     Somente para dono (auth.uid) OU membro do workspace cujo id = 1º segmento.
--     Nao reabre leitura publica.
create policy "alvesz_pdfs_select_legacy_owner"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'alvesz-pdfs'
    and public.alvesz_pdf_path_workspace_id(name) is null
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or (
        (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        and public.is_workspace_member(((storage.foldername(name))[1])::uuid)
      )
    )
  );

create policy "alvesz_pdfs_update_legacy_owner"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'alvesz-pdfs'
    and public.alvesz_pdf_path_workspace_id(name) is null
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or (
        (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        and public.is_workspace_member(((storage.foldername(name))[1])::uuid)
      )
    )
  );

create policy "alvesz_pdfs_delete_legacy_owner"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'alvesz-pdfs'
    and public.alvesz_pdf_path_workspace_id(name) is null
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or (
        (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        and public.is_workspace_member(((storage.foldername(name))[1])::uuid)
      )
    )
  );

-- Insert em path legado permanece bloqueado (somente path canonico).
