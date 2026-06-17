-- Creative Director V1 — pacotes criativos completos por operação

alter table public.creative_assets
  drop constraint if exists creative_assets_asset_type_check;

alter table public.creative_assets
  add constraint creative_assets_asset_type_check
  check (asset_type in (
    'image',
    'carousel',
    'banner',
    'thumbnail',
    'vsl_script',
    'reel_script',
    'ugc_script',
    'headline_variations',
    'cta_variations'
  ));

notify pgrst, 'reload schema';

-- Storage: creative-packages/{user_id}/{operation_id}/{package_id}.json
drop policy if exists "product_files_creative_packages_insert" on storage.objects;
create policy "product_files_creative_packages_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'product-files'
    and (storage.foldername(name))[1] = 'creative-packages'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

drop policy if exists "product_files_creative_packages_update" on storage.objects;
create policy "product_files_creative_packages_update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'product-files'
    and (storage.foldername(name))[1] = 'creative-packages'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

drop policy if exists "product_files_creative_packages_delete" on storage.objects;
create policy "product_files_creative_packages_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'product-files'
    and (storage.foldername(name))[1] = 'creative-packages'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

drop policy if exists "product_files_creative_packages_select" on storage.objects;
create policy "product_files_creative_packages_select"
  on storage.objects for select
  using (
    bucket_id = 'product-files'
    and (storage.foldername(name))[1] = 'creative-packages'
  );
