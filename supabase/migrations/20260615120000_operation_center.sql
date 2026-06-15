-- Operation Center — executive operational workflow (Fase Executive V1.5)

create table if not exists public.operation_center (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'draft'
    check (status in ('draft', 'preparing', 'ready', 'approved', 'cancelled')),
  titulo text not null default 'Nova operação',
  product_id uuid references public.creator_products (id) on delete set null,
  product_nome text,
  ceo_session_id uuid references public.aura_ceo_sessions (id) on delete set null,
  smart_launch_session_id uuid references public.aura_smart_launch_sessions (id) on delete set null,
  copylab_id uuid references public.creator_copylab (id) on delete set null,
  assets_id uuid references public.creator_assets (id) on delete set null,
  landing_id uuid references public.creator_landings (id) on delete set null,
  orchestration_id uuid references public.creator_campaign_orchestrations (id) on delete set null,
  performance_report_id uuid references public.performance_reports (id) on delete set null,
  steps jsonb not null default '{
    "produto": "pending",
    "persona": "pending",
    "oferta": "pending",
    "copy": "pending",
    "criativos": "pending",
    "landing": "pending",
    "meta_ads": "pending",
    "performance_ai": "pending",
    "aprovacao": "pending"
  }'::jsonb,
  operational_score integer not null default 0,
  success_chance integer,
  roi_previsto numeric,
  next_steps jsonb not null default '[]'::jsonb,
  executive_logs jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists operation_center_user_status_idx
  on public.operation_center (user_id, status, updated_at desc);

alter table public.operation_center enable row level security;

do $$
begin
  execute 'drop policy if exists operation_center_select_own on public.operation_center';
  execute 'drop policy if exists operation_center_insert_own on public.operation_center';
  execute 'drop policy if exists operation_center_update_own on public.operation_center';
  execute 'drop policy if exists operation_center_delete_own on public.operation_center';

  execute 'create policy operation_center_select_own on public.operation_center for select using (auth.uid() = user_id)';
  execute 'create policy operation_center_insert_own on public.operation_center for insert with check (auth.uid() = user_id)';
  execute 'create policy operation_center_update_own on public.operation_center for update using (auth.uid() = user_id)';
  execute 'create policy operation_center_delete_own on public.operation_center for delete using (auth.uid() = user_id)';
end $$;

drop trigger if exists operation_center_updated_at on public.operation_center;
create trigger operation_center_updated_at
  before update on public.operation_center
  for each row execute function public.set_updated_at();
