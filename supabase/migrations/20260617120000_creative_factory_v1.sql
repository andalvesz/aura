-- Creative Factory V1 — criativos reais vinculados a operações/produtos

create table if not exists public.creative_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  operation_id uuid references public.operation_center (id) on delete set null,
  product_id uuid references public.creator_products (id) on delete set null,
  asset_type text not null
    check (asset_type in (
      'image',
      'carousel',
      'banner',
      'thumbnail',
      'vsl_script',
      'reel_script',
      'ugc_script'
    )),
  title text,
  prompt text,
  copy text,
  format text,
  status text not null default 'generating'
    check (status in ('generating', 'ready', 'failed')),
  file_url text,
  storage_path text,
  thumbnail_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists creative_assets_user_idx
  on public.creative_assets (user_id, created_at desc);

create index if not exists creative_assets_operation_idx
  on public.creative_assets (user_id, operation_id, created_at desc)
  where operation_id is not null;

create index if not exists creative_assets_product_idx
  on public.creative_assets (user_id, product_id, created_at desc)
  where product_id is not null;

alter table public.creative_assets enable row level security;

do $$
begin
  execute 'drop policy if exists creative_assets_select_own on public.creative_assets';
  execute 'drop policy if exists creative_assets_insert_own on public.creative_assets';
  execute 'drop policy if exists creative_assets_update_own on public.creative_assets';
  execute 'drop policy if exists creative_assets_delete_own on public.creative_assets';

  execute 'create policy creative_assets_select_own on public.creative_assets for select using (auth.uid() = user_id)';
  execute 'create policy creative_assets_insert_own on public.creative_assets for insert with check (auth.uid() = user_id)';
  execute 'create policy creative_assets_update_own on public.creative_assets for update using (auth.uid() = user_id)';
  execute 'create policy creative_assets_delete_own on public.creative_assets for delete using (auth.uid() = user_id)';
end $$;

drop trigger if exists creative_assets_updated_at on public.creative_assets;
create trigger creative_assets_updated_at
  before update on public.creative_assets
  for each row execute function public.set_updated_at();

-- Bucket product-files — MIME types para criativos (.json / .txt)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-files',
  'product-files',
  true,
  10485760,
  array[
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/webp',
    'application/json',
    'text/plain'
  ]::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Storage: creative-assets/{user_id}/{operation_id}/{asset_id}
drop policy if exists "product_files_creative_assets_insert" on storage.objects;
create policy "product_files_creative_assets_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'product-files'
    and (storage.foldername(name))[1] = 'creative-assets'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

drop policy if exists "product_files_creative_assets_update" on storage.objects;
create policy "product_files_creative_assets_update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'product-files'
    and (storage.foldername(name))[1] = 'creative-assets'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

drop policy if exists "product_files_creative_assets_delete" on storage.objects;
create policy "product_files_creative_assets_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'product-files'
    and (storage.foldername(name))[1] = 'creative-assets'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

drop policy if exists "product_files_creative_assets_select" on storage.objects;
create policy "product_files_creative_assets_select"
  on storage.objects for select
  using (
    bucket_id = 'product-files'
    and (storage.foldername(name))[1] = 'creative-assets'
  );

notify pgrst, 'reload schema';
