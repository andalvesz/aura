-- Funnel Engine V1 — funis completos automáticos por produto

create table if not exists public.funnels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  operation_id uuid references public.operation_center (id) on delete set null,
  product_id uuid references public.creator_products (id) on delete set null,
  funnel_name text not null,
  niche text,
  status text not null default 'draft'
    check (status in ('draft', 'generating', 'ready', 'active', 'archived')),
  funnel_type text not null default 'standard'
    check (funnel_type in ('standard', 'tripwire', 'webinar', 'high_ticket')),
  total_steps integer not null default 0,
  expected_aov numeric(12, 2),
  expected_conversion numeric(8, 4),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists funnels_user_idx
  on public.funnels (user_id, created_at desc);

create index if not exists funnels_product_idx
  on public.funnels (user_id, product_id, created_at desc)
  where product_id is not null;

create index if not exists funnels_operation_idx
  on public.funnels (user_id, operation_id, created_at desc)
  where operation_id is not null;

alter table public.funnels enable row level security;

do $$
begin
  execute 'drop policy if exists funnels_select_own on public.funnels';
  execute 'drop policy if exists funnels_insert_own on public.funnels';
  execute 'drop policy if exists funnels_update_own on public.funnels';
  execute 'drop policy if exists funnels_delete_own on public.funnels';

  execute 'create policy funnels_select_own on public.funnels for select using (auth.uid() = user_id)';
  execute 'create policy funnels_insert_own on public.funnels for insert with check (auth.uid() = user_id)';
  execute 'create policy funnels_update_own on public.funnels for update using (auth.uid() = user_id)';
  execute 'create policy funnels_delete_own on public.funnels for delete using (auth.uid() = user_id)';
end $$;

drop trigger if exists funnels_updated_at on public.funnels;
create trigger funnels_updated_at
  before update on public.funnels
  for each row execute function public.set_updated_at();

create table if not exists public.funnel_steps (
  id uuid primary key default gen_random_uuid(),
  funnel_id uuid not null references public.funnels (id) on delete cascade,
  step_order integer not null,
  step_type text not null
    check (step_type in ('front_end', 'order_bump', 'upsell_1', 'upsell_2', 'downsell', 'thank_you')),
  product_id uuid references public.creator_products (id) on delete set null,
  landing_id uuid references public.landing_pages (id) on delete set null,
  copy_id uuid references public.creator_copylab (id) on delete set null,
  creative_id uuid references public.creative_assets (id) on delete set null,
  offer_id uuid references public.creator_offers (id) on delete set null,
  status text not null default 'suggested'
    check (status in ('suggested', 'ready', 'active', 'skipped')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (funnel_id, step_order),
  unique (funnel_id, step_type)
);

create index if not exists funnel_steps_funnel_idx
  on public.funnel_steps (funnel_id, step_order asc);

alter table public.funnel_steps enable row level security;

do $$
begin
  execute 'drop policy if exists funnel_steps_select_own on public.funnel_steps';
  execute 'drop policy if exists funnel_steps_insert_own on public.funnel_steps';
  execute 'drop policy if exists funnel_steps_update_own on public.funnel_steps';
  execute 'drop policy if exists funnel_steps_delete_own on public.funnel_steps';

  execute $policy$
    create policy funnel_steps_select_own on public.funnel_steps for select
    using (exists (
      select 1 from public.funnels f
      where f.id = funnel_id and f.user_id = auth.uid()
    ))
  $policy$;

  execute $policy$
    create policy funnel_steps_insert_own on public.funnel_steps for insert
    with check (exists (
      select 1 from public.funnels f
      where f.id = funnel_id and f.user_id = auth.uid()
    ))
  $policy$;

  execute $policy$
    create policy funnel_steps_update_own on public.funnel_steps for update
    using (exists (
      select 1 from public.funnels f
      where f.id = funnel_id and f.user_id = auth.uid()
    ))
  $policy$;

  execute $policy$
    create policy funnel_steps_delete_own on public.funnel_steps for delete
    using (exists (
      select 1 from public.funnels f
      where f.id = funnel_id and f.user_id = auth.uid()
    ))
  $policy$;
end $$;

notify pgrst, 'reload schema';
