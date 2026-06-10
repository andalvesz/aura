-- Aura Product Factory — tipos de produto, campos extras, versões rotuladas, bucket product-files

alter table public.product_factory
  add column if not exists product_type text not null default 'ebook'
    check (product_type in (
      'ebook',
      'checklist',
      'workbook',
      'guia_pratico',
      'plano_7_dias',
      'plano_30_dias',
      'mini_curso'
    )),
  add column if not exists subtitulo text,
  add column if not exists publico text,
  add column if not exists objetivo text;

alter table public.product_versions
  add column if not exists version_label text
    check (version_label in ('rascunho', 'revisado', 'final'));

create index if not exists product_factory_type_idx
  on public.product_factory (user_id, product_type);

-- Bucket principal para arquivos de produtos digitais
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-files',
  'product-files',
  true,
  10485760,
  array['application/pdf', 'image/png', 'image/jpeg', 'image/webp']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "product_files_insert_own" on storage.objects;
create policy "product_files_insert_own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'product-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "product_files_update_own" on storage.objects;
create policy "product_files_update_own"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'product-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "product_files_select_public" on storage.objects;
create policy "product_files_select_public"
  on storage.objects for select
  using (bucket_id = 'product-files');

drop policy if exists "product_files_delete_own" on storage.objects;
create policy "product_files_delete_own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'product-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
