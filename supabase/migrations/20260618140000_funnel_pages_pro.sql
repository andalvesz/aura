-- Funnel Pages Pro — páginas automáticas por funil

create table if not exists public.funnel_pages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  funnel_id uuid not null references public.funnels (id) on delete cascade,
  offer_id uuid references public.offers (id) on delete set null,
  page_type text not null
    check (page_type in ('front_end', 'order_bump', 'upsell', 'downsell', 'thank_you', 'webinar', 'quiz')),
  landing_page_id uuid references public.landing_pages (id) on delete set null,
  slug text not null,
  title text not null,
  status text not null default 'draft'
    check (status in ('draft', 'generating', 'ready', 'published', 'archived')),
  conversion_goal numeric(8, 4),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists funnel_pages_user_slug_unique_idx
  on public.funnel_pages (user_id, slug);

create index if not exists funnel_pages_user_idx
  on public.funnel_pages (user_id, created_at desc);

create index if not exists funnel_pages_funnel_idx
  on public.funnel_pages (user_id, funnel_id, created_at desc);

create index if not exists funnel_pages_offer_idx
  on public.funnel_pages (user_id, offer_id)
  where offer_id is not null;

create index if not exists funnel_pages_landing_idx
  on public.funnel_pages (landing_page_id)
  where landing_page_id is not null;

alter table public.funnel_pages enable row level security;

do $$
begin
  execute 'drop policy if exists funnel_pages_select_own on public.funnel_pages';
  execute 'drop policy if exists funnel_pages_insert_own on public.funnel_pages';
  execute 'drop policy if exists funnel_pages_update_own on public.funnel_pages';
  execute 'drop policy if exists funnel_pages_delete_own on public.funnel_pages';

  execute 'create policy funnel_pages_select_own on public.funnel_pages for select using (auth.uid() = user_id)';
  execute 'create policy funnel_pages_insert_own on public.funnel_pages for insert with check (auth.uid() = user_id)';
  execute 'create policy funnel_pages_update_own on public.funnel_pages for update using (auth.uid() = user_id)';
  execute 'create policy funnel_pages_delete_own on public.funnel_pages for delete using (auth.uid() = user_id)';
end $$;

drop trigger if exists funnel_pages_updated_at on public.funnel_pages;
create trigger funnel_pages_updated_at
  before update on public.funnel_pages
  for each row execute function public.set_updated_at();

notify pgrst, 'reload schema';
