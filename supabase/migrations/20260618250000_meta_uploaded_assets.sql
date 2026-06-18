-- Publish Ready Layer — assets reais enviados para Meta

create table if not exists public.meta_uploaded_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  asset_id uuid not null references public.creative_generated_assets (id) on delete cascade,
  meta_creative_id text not null,
  uploaded_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  unique (user_id, asset_id)
);

create index if not exists meta_uploaded_assets_user_asset_idx
  on public.meta_uploaded_assets (user_id, asset_id);

create index if not exists meta_uploaded_assets_user_uploaded_idx
  on public.meta_uploaded_assets (user_id, uploaded_at desc);

alter table public.meta_uploaded_assets enable row level security;

do $$
begin
  execute 'drop policy if exists meta_uploaded_assets_select_own on public.meta_uploaded_assets';
  execute 'drop policy if exists meta_uploaded_assets_insert_own on public.meta_uploaded_assets';
  execute 'drop policy if exists meta_uploaded_assets_update_own on public.meta_uploaded_assets';
  execute 'drop policy if exists meta_uploaded_assets_delete_own on public.meta_uploaded_assets';

  execute 'create policy meta_uploaded_assets_select_own on public.meta_uploaded_assets for select using (auth.uid() = user_id)';
  execute 'create policy meta_uploaded_assets_insert_own on public.meta_uploaded_assets for insert with check (auth.uid() = user_id)';
  execute 'create policy meta_uploaded_assets_update_own on public.meta_uploaded_assets for update using (auth.uid() = user_id)';
  execute 'create policy meta_uploaded_assets_delete_own on public.meta_uploaded_assets for delete using (auth.uid() = user_id)';
end $$;

notify pgrst, 'reload schema';
