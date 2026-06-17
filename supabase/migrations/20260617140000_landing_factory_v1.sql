-- Landing Factory V1 — páginas de vendas reais vinculadas a operações/produtos

create table if not exists public.landing_pages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  operation_id uuid references public.operation_center (id) on delete set null,
  product_id uuid references public.creator_products (id) on delete set null,
  title text,
  slug text not null,
  headline text,
  subheadline text,
  hero_copy text,
  benefits_json jsonb not null default '[]'::jsonb,
  proof_json jsonb not null default '{}'::jsonb,
  offer_json jsonb not null default '{}'::jsonb,
  faq_json jsonb not null default '[]'::jsonb,
  cta_text text,
  html text,
  status text not null default 'draft'
    check (status in ('draft', 'preview', 'published')),
  preview_url text,
  published_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists landing_pages_slug_unique_idx
  on public.landing_pages (slug);

create index if not exists landing_pages_user_idx
  on public.landing_pages (user_id, created_at desc);

create index if not exists landing_pages_operation_idx
  on public.landing_pages (user_id, operation_id, created_at desc)
  where operation_id is not null;

create index if not exists landing_pages_product_idx
  on public.landing_pages (user_id, product_id, created_at desc)
  where product_id is not null;

create index if not exists landing_pages_published_slug_idx
  on public.landing_pages (slug)
  where status = 'published';

alter table public.landing_pages enable row level security;

do $$
begin
  execute 'drop policy if exists landing_pages_select_own on public.landing_pages';
  execute 'drop policy if exists landing_pages_insert_own on public.landing_pages';
  execute 'drop policy if exists landing_pages_update_own on public.landing_pages';
  execute 'drop policy if exists landing_pages_delete_own on public.landing_pages';
  execute 'drop policy if exists landing_pages_select_published on public.landing_pages';

  execute 'create policy landing_pages_select_own on public.landing_pages for select using (auth.uid() = user_id)';
  execute 'create policy landing_pages_insert_own on public.landing_pages for insert with check (auth.uid() = user_id)';
  execute 'create policy landing_pages_update_own on public.landing_pages for update using (auth.uid() = user_id)';
  execute 'create policy landing_pages_delete_own on public.landing_pages for delete using (auth.uid() = user_id)';
  execute 'create policy landing_pages_select_published on public.landing_pages for select using (status = ''published'')';
end $$;

drop trigger if exists landing_pages_updated_at on public.landing_pages;
create trigger landing_pages_updated_at
  before update on public.landing_pages
  for each row execute function public.set_updated_at();

-- Repontar landing_id da operação para landing_pages
alter table public.operation_center drop constraint if exists operation_center_landing_id_fkey;

update public.operation_center
set landing_id = null
where landing_id is not null;

alter table public.operation_center
  add constraint operation_center_landing_id_fkey
  foreign key (landing_id) references public.landing_pages (id) on delete set null;

-- Campanhas e ads: repontar landing_id para landing_pages
alter table public.creator_campaign_orchestrations drop constraint if exists creator_campaign_orchestrations_landing_id_fkey;
alter table public.creator_ads_campaigns drop constraint if exists creator_ads_campaigns_landing_id_fkey;
alter table public.aura_smart_launch_sessions drop constraint if exists aura_smart_launch_sessions_landing_id_fkey;

update public.creator_campaign_orchestrations set landing_id = null where landing_id is not null;
update public.creator_ads_campaigns set landing_id = null where landing_id is not null;
update public.aura_smart_launch_sessions set landing_id = null where landing_id is not null;

alter table public.creator_campaign_orchestrations
  add constraint creator_campaign_orchestrations_landing_id_fkey
  foreign key (landing_id) references public.landing_pages (id) on delete set null;

alter table public.creator_ads_campaigns
  add constraint creator_ads_campaigns_landing_id_fkey
  foreign key (landing_id) references public.landing_pages (id) on delete set null;

alter table public.aura_smart_launch_sessions
  add constraint aura_smart_launch_sessions_landing_id_fkey
  foreign key (landing_id) references public.landing_pages (id) on delete set null;

notify pgrst, 'reload schema';
