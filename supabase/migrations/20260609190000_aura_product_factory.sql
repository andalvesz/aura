-- Aura Product Factory — e-books digitais, design, PDF e compliance

create table if not exists public.product_factory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  product_id uuid references public.creator_products (id) on delete set null,
  copylab_id uuid references public.creator_copylab (id) on delete set null,
  research_id uuid references public.creator_research (id) on delete set null,
  titulo text,
  promessa text,
  avatar text,
  problema text,
  solucao text,
  capitulos jsonb not null default '[]'::jsonb,
  conteudo jsonb not null default '{}'::jsonb,
  exercicios jsonb not null default '[]'::jsonb,
  bonus text,
  checklist jsonb not null default '[]'::jsonb,
  conclusao text,
  design jsonb not null default '{}'::jsonb,
  status text not null default 'draft'
    check (status in ('draft', 'content_ready', 'design_ready', 'pdf_ready', 'published')),
  current_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists product_factory_user_idx
  on public.product_factory (user_id, created_at desc);

create index if not exists product_factory_product_idx
  on public.product_factory (product_id);

create table if not exists public.product_files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  factory_id uuid not null references public.product_factory (id) on delete cascade,
  file_type text not null default 'pdf'
    check (file_type in ('pdf', 'cover', 'asset')),
  storage_path text not null,
  file_url text,
  file_name text,
  mime_type text not null default 'application/pdf',
  size_bytes bigint,
  version_number integer not null default 1,
  created_at timestamptz not null default now()
);

create index if not exists product_files_user_idx
  on public.product_files (user_id, created_at desc);

create index if not exists product_files_factory_idx
  on public.product_files (factory_id, version_number desc);

create table if not exists public.product_versions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  factory_id uuid not null references public.product_factory (id) on delete cascade,
  version_number integer not null,
  snapshot jsonb not null default '{}'::jsonb,
  changelog text,
  file_id uuid references public.product_files (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (factory_id, version_number)
);

create index if not exists product_versions_user_idx
  on public.product_versions (user_id, created_at desc);

create index if not exists product_versions_factory_idx
  on public.product_versions (factory_id, version_number desc);

create table if not exists public.product_compliance_checks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  factory_id uuid not null references public.product_factory (id) on delete cascade,
  risk_score integer,
  risk_level text check (risk_level in ('low', 'medium', 'high')),
  forbidden_claims jsonb not null default '[]'::jsonb,
  misleading_risks jsonb not null default '[]'::jsonb,
  ad_checklist jsonb not null default '[]'::jsonb,
  recommendations jsonb not null default '[]'::jsonb,
  status text not null default 'warning'
    check (status in ('pass', 'warning', 'fail')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists product_compliance_checks_user_idx
  on public.product_compliance_checks (user_id, created_at desc);

create index if not exists product_compliance_checks_factory_idx
  on public.product_compliance_checks (factory_id, created_at desc);

alter table public.product_factory enable row level security;
alter table public.product_files enable row level security;
alter table public.product_versions enable row level security;
alter table public.product_compliance_checks enable row level security;

drop policy if exists "product_factory_select_own" on public.product_factory;
drop policy if exists "product_factory_insert_own" on public.product_factory;
drop policy if exists "product_factory_update_own" on public.product_factory;
drop policy if exists "product_factory_delete_own" on public.product_factory;

create policy "product_factory_select_own"
  on public.product_factory for select using (auth.uid() = user_id);
create policy "product_factory_insert_own"
  on public.product_factory for insert with check (auth.uid() = user_id);
create policy "product_factory_update_own"
  on public.product_factory for update using (auth.uid() = user_id);
create policy "product_factory_delete_own"
  on public.product_factory for delete using (auth.uid() = user_id);

drop policy if exists "product_files_select_own" on public.product_files;
drop policy if exists "product_files_insert_own" on public.product_files;
drop policy if exists "product_files_update_own" on public.product_files;
drop policy if exists "product_files_delete_own" on public.product_files;

create policy "product_files_select_own"
  on public.product_files for select using (auth.uid() = user_id);
create policy "product_files_insert_own"
  on public.product_files for insert with check (auth.uid() = user_id);
create policy "product_files_update_own"
  on public.product_files for update using (auth.uid() = user_id);
create policy "product_files_delete_own"
  on public.product_files for delete using (auth.uid() = user_id);

drop policy if exists "product_versions_select_own" on public.product_versions;
drop policy if exists "product_versions_insert_own" on public.product_versions;
drop policy if exists "product_versions_update_own" on public.product_versions;
drop policy if exists "product_versions_delete_own" on public.product_versions;

create policy "product_versions_select_own"
  on public.product_versions for select using (auth.uid() = user_id);
create policy "product_versions_insert_own"
  on public.product_versions for insert with check (auth.uid() = user_id);
create policy "product_versions_update_own"
  on public.product_versions for update using (auth.uid() = user_id);
create policy "product_versions_delete_own"
  on public.product_versions for delete using (auth.uid() = user_id);

drop policy if exists "product_compliance_checks_select_own" on public.product_compliance_checks;
drop policy if exists "product_compliance_checks_insert_own" on public.product_compliance_checks;
drop policy if exists "product_compliance_checks_update_own" on public.product_compliance_checks;
drop policy if exists "product_compliance_checks_delete_own" on public.product_compliance_checks;

create policy "product_compliance_checks_select_own"
  on public.product_compliance_checks for select using (auth.uid() = user_id);
create policy "product_compliance_checks_insert_own"
  on public.product_compliance_checks for insert with check (auth.uid() = user_id);
create policy "product_compliance_checks_update_own"
  on public.product_compliance_checks for update using (auth.uid() = user_id);
create policy "product_compliance_checks_delete_own"
  on public.product_compliance_checks for delete using (auth.uid() = user_id);

drop trigger if exists product_factory_updated_at on public.product_factory;
create trigger product_factory_updated_at
  before update on public.product_factory
  for each row execute function public.set_updated_at();

drop trigger if exists product_compliance_checks_updated_at on public.product_compliance_checks;
create trigger product_compliance_checks_updated_at
  before update on public.product_compliance_checks
  for each row execute function public.set_updated_at();

-- Storage para PDFs de produtos digitais
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-factory-pdfs',
  'product-factory-pdfs',
  true,
  10485760,
  array['application/pdf']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "product_factory_pdfs_insert_own" on storage.objects;
create policy "product_factory_pdfs_insert_own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'product-factory-pdfs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "product_factory_pdfs_update_own" on storage.objects;
create policy "product_factory_pdfs_update_own"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'product-factory-pdfs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "product_factory_pdfs_select_public" on storage.objects;
create policy "product_factory_pdfs_select_public"
  on storage.objects for select
  using (bucket_id = 'product-factory-pdfs');

drop policy if exists "product_factory_pdfs_delete_own" on storage.objects;
create policy "product_factory_pdfs_delete_own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'product-factory-pdfs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
