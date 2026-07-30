-- Relatório somente leitura: objetos alvesz-pdfs fora do path canônico
-- workspaces/{workspace_id}/propostas/{proposal_id}/{arquivo}
-- NÃO move nem apaga arquivos.

select
  o.id,
  o.name as storage_path,
  o.bucket_id,
  o.created_at,
  o.updated_at,
  o.metadata,
  case
    when (storage.foldername(o.name))[1] = 'workspaces'
         and (storage.foldername(o.name))[3] = 'propostas'
         and array_length(storage.foldername(o.name), 1) >= 4
      then 'canonical'
    when (storage.foldername(o.name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then 'legacy_uuid_prefix'
    else 'unknown_layout'
  end as path_class,
  (storage.foldername(o.name))[1] as segment_1,
  (storage.foldername(o.name))[2] as segment_2,
  (storage.foldername(o.name))[3] as segment_3
from storage.objects o
where o.bucket_id = 'alvesz-pdfs'
  and not (
    (storage.foldername(o.name))[1] = 'workspaces'
    and (storage.foldername(o.name))[3] = 'propostas'
    and array_length(storage.foldername(o.name), 1) >= 4
  )
order by o.created_at desc;

-- Resumo
select
  count(*) filter (where (storage.foldername(name))[1] = 'workspaces'
                      and (storage.foldername(name))[3] = 'propostas') as canonical_count,
  count(*) filter (where not (
    (storage.foldername(name))[1] = 'workspaces'
    and (storage.foldername(name))[3] = 'propostas'
  )) as legacy_or_unknown_count,
  count(*) as total
from storage.objects
where bucket_id = 'alvesz-pdfs';

-- Bucket public flag
select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets
where id = 'alvesz-pdfs';
