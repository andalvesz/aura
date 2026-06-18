-- Creative Director Real V1 — assets de mídia gerados (imagem/vídeo)

create table if not exists public.creative_generated_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  creative_id uuid references public.creative_assets (id) on delete set null,
  asset_type text not null
    check (asset_type in (
      'image',
      'carousel',
      'story',
      'thumbnail',
      'reel_cover',
      'ugc_frame'
    )),
  provider text not null
    check (provider in ('openai', 'flux', 'runway', 'kling', 'veo')),
  file_url text,
  thumbnail_url text,
  prompt text,
  status text not null default 'generating'
    check (status in ('generating', 'prompt_ready', 'ready', 'failed', 'blocked')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists creative_generated_assets_user_idx
  on public.creative_generated_assets (user_id, created_at desc);

create index if not exists creative_generated_assets_creative_idx
  on public.creative_generated_assets (user_id, creative_id, created_at desc)
  where creative_id is not null;

create index if not exists creative_generated_assets_status_idx
  on public.creative_generated_assets (user_id, status, created_at desc);

alter table public.creative_generated_assets enable row level security;

do $$
begin
  execute 'drop policy if exists creative_generated_assets_select_own on public.creative_generated_assets';
  execute 'drop policy if exists creative_generated_assets_insert_own on public.creative_generated_assets';
  execute 'drop policy if exists creative_generated_assets_update_own on public.creative_generated_assets';
  execute 'drop policy if exists creative_generated_assets_delete_own on public.creative_generated_assets';

  execute 'create policy creative_generated_assets_select_own on public.creative_generated_assets for select using (auth.uid() = user_id)';
  execute 'create policy creative_generated_assets_insert_own on public.creative_generated_assets for insert with check (auth.uid() = user_id)';
  execute 'create policy creative_generated_assets_update_own on public.creative_generated_assets for update using (auth.uid() = user_id)';
  execute 'create policy creative_generated_assets_delete_own on public.creative_generated_assets for delete using (auth.uid() = user_id)';
end $$;

-- Storage: creative-generated/{user_id}/{asset_id}.png
drop policy if exists "product_files_creative_generated_insert" on storage.objects;
create policy "product_files_creative_generated_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'product-files'
    and (storage.foldername(name))[1] = 'creative-generated'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

drop policy if exists "product_files_creative_generated_update" on storage.objects;
create policy "product_files_creative_generated_update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'product-files'
    and (storage.foldername(name))[1] = 'creative-generated'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

drop policy if exists "product_files_creative_generated_delete" on storage.objects;
create policy "product_files_creative_generated_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'product-files'
    and (storage.foldername(name))[1] = 'creative-generated'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

drop policy if exists "product_files_creative_generated_select" on storage.objects;
create policy "product_files_creative_generated_select"
  on storage.objects for select
  using (
    bucket_id = 'product-files'
    and (storage.foldername(name))[1] = 'creative-generated'
  );

notify pgrst, 'reload schema';
