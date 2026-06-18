-- Funnel Publish Layer — publicação em massa de páginas do funil

create table if not exists public.funnel_publish_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  funnel_id uuid not null references public.funnels (id) on delete cascade,
  status text not null default 'publishing'
    check (status in ('publishing', 'published', 'partial', 'failed')),
  published_at timestamptz,
  page_results jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists funnel_publish_logs_user_idx
  on public.funnel_publish_logs (user_id, created_at desc);

create index if not exists funnel_publish_logs_funnel_idx
  on public.funnel_publish_logs (user_id, funnel_id, created_at desc);

alter table public.funnel_publish_logs enable row level security;

do $$
begin
  execute 'drop policy if exists funnel_publish_logs_select_own on public.funnel_publish_logs';
  execute 'drop policy if exists funnel_publish_logs_insert_own on public.funnel_publish_logs';
  execute 'drop policy if exists funnel_publish_logs_update_own on public.funnel_publish_logs';

  execute 'create policy funnel_publish_logs_select_own on public.funnel_publish_logs for select using (auth.uid() = user_id)';
  execute 'create policy funnel_publish_logs_insert_own on public.funnel_publish_logs for insert with check (auth.uid() = user_id)';
  execute 'create policy funnel_publish_logs_update_own on public.funnel_publish_logs for update using (auth.uid() = user_id)';
end $$;

notify pgrst, 'reload schema';
