-- Operation Center V1.7 — colunas, FKs e índices idempotentes
-- Compatível com tabelas parciais criadas via CREATE TABLE IF NOT EXISTS anterior.
-- Não recria a tabela; preserva dados existentes.

-- ---------------------------------------------------------------------------
-- Colunas (22 campos V1.7 — alinhados com types/database.ts OperationCenter)
-- ---------------------------------------------------------------------------

alter table public.operation_center
  add column if not exists user_id uuid;

alter table public.operation_center
  add column if not exists status text;

alter table public.operation_center
  add column if not exists titulo text;

alter table public.operation_center
  add column if not exists product_id uuid;

alter table public.operation_center
  add column if not exists product_nome text;

alter table public.operation_center
  add column if not exists ceo_session_id uuid;

alter table public.operation_center
  add column if not exists smart_launch_session_id uuid;

alter table public.operation_center
  add column if not exists copylab_id uuid;

alter table public.operation_center
  add column if not exists assets_id uuid;

alter table public.operation_center
  add column if not exists landing_id uuid;

alter table public.operation_center
  add column if not exists orchestration_id uuid;

alter table public.operation_center
  add column if not exists performance_report_id uuid;

alter table public.operation_center
  add column if not exists steps jsonb;

alter table public.operation_center
  add column if not exists operational_score integer;

alter table public.operation_center
  add column if not exists success_chance integer;

alter table public.operation_center
  add column if not exists roi_previsto numeric;

alter table public.operation_center
  add column if not exists next_steps jsonb;

alter table public.operation_center
  add column if not exists executive_logs jsonb;

alter table public.operation_center
  add column if not exists metadata jsonb;

alter table public.operation_center
  add column if not exists created_at timestamptz;

alter table public.operation_center
  add column if not exists updated_at timestamptz;

-- Defaults para linhas existentes / colunas recém-adicionadas
alter table public.operation_center
  alter column status set default 'draft';

alter table public.operation_center
  alter column titulo set default 'Nova operação';

alter table public.operation_center
  alter column steps set default '{
    "produto": "pending",
    "persona": "pending",
    "oferta": "pending",
    "copy": "pending",
    "criativos": "pending",
    "landing": "pending",
    "meta_ads": "pending",
    "performance_ai": "pending",
    "aprovacao": "pending"
  }'::jsonb;

alter table public.operation_center
  alter column operational_score set default 0;

alter table public.operation_center
  alter column next_steps set default '[]'::jsonb;

alter table public.operation_center
  alter column executive_logs set default '[]'::jsonb;

alter table public.operation_center
  alter column metadata set default '{}'::jsonb;

alter table public.operation_center
  alter column created_at set default now();

alter table public.operation_center
  alter column updated_at set default now();

update public.operation_center set status = 'draft' where status is null;
update public.operation_center set titulo = 'Nova operação' where titulo is null;
update public.operation_center set steps = '{
  "produto": "pending",
  "persona": "pending",
  "oferta": "pending",
  "copy": "pending",
  "criativos": "pending",
  "landing": "pending",
  "meta_ads": "pending",
  "performance_ai": "pending",
  "aprovacao": "pending"
}'::jsonb where steps is null;
update public.operation_center set operational_score = 0 where operational_score is null;
update public.operation_center set next_steps = '[]'::jsonb where next_steps is null;
update public.operation_center set executive_logs = '[]'::jsonb where executive_logs is null;
update public.operation_center set metadata = '{}'::jsonb where metadata is null;
update public.operation_center set created_at = now() where created_at is null;
update public.operation_center set updated_at = now() where updated_at is null;

-- ---------------------------------------------------------------------------
-- Check constraint (status V1.7)
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'operation_center_status_check'
      and conrelid = 'public.operation_center'::regclass
  ) then
    alter table public.operation_center
      add constraint operation_center_status_check
      check (status in ('draft', 'preparing', 'ready', 'approved', 'cancelled'));
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Foreign keys
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'operation_center_user_id_fkey'
      and conrelid = 'public.operation_center'::regclass
  ) then
    alter table public.operation_center
      add constraint operation_center_user_id_fkey
      foreign key (user_id) references auth.users (id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'operation_center_product_id_fkey'
      and conrelid = 'public.operation_center'::regclass
  ) then
    alter table public.operation_center
      add constraint operation_center_product_id_fkey
      foreign key (product_id) references public.creator_products (id) on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'operation_center_ceo_session_id_fkey'
      and conrelid = 'public.operation_center'::regclass
  ) then
    alter table public.operation_center
      add constraint operation_center_ceo_session_id_fkey
      foreign key (ceo_session_id) references public.aura_ceo_sessions (id) on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'operation_center_smart_launch_session_id_fkey'
      and conrelid = 'public.operation_center'::regclass
  ) then
    alter table public.operation_center
      add constraint operation_center_smart_launch_session_id_fkey
      foreign key (smart_launch_session_id) references public.aura_smart_launch_sessions (id) on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'operation_center_copylab_id_fkey'
      and conrelid = 'public.operation_center'::regclass
  ) then
    alter table public.operation_center
      add constraint operation_center_copylab_id_fkey
      foreign key (copylab_id) references public.creator_copylab (id) on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'operation_center_assets_id_fkey'
      and conrelid = 'public.operation_center'::regclass
  ) then
    alter table public.operation_center
      add constraint operation_center_assets_id_fkey
      foreign key (assets_id) references public.creator_assets (id) on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'operation_center_landing_id_fkey'
      and conrelid = 'public.operation_center'::regclass
  ) then
    alter table public.operation_center
      add constraint operation_center_landing_id_fkey
      foreign key (landing_id) references public.creator_landings (id) on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'operation_center_orchestration_id_fkey'
      and conrelid = 'public.operation_center'::regclass
  ) then
    alter table public.operation_center
      add constraint operation_center_orchestration_id_fkey
      foreign key (orchestration_id) references public.creator_campaign_orchestrations (id) on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'operation_center_performance_report_id_fkey'
      and conrelid = 'public.operation_center'::regclass
  ) then
    alter table public.operation_center
      add constraint operation_center_performance_report_id_fkey
      foreign key (performance_report_id) references public.performance_reports (id) on delete set null;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Índices
-- ---------------------------------------------------------------------------

create index if not exists operation_center_user_status_idx
  on public.operation_center (user_id, status, updated_at desc);

create index if not exists operation_center_ceo_session_id_idx
  on public.operation_center (user_id, ceo_session_id)
  where ceo_session_id is not null;

create index if not exists operation_center_product_id_idx
  on public.operation_center (user_id, product_id)
  where product_id is not null;

-- ---------------------------------------------------------------------------
-- RLS, policies e trigger updated_at
-- ---------------------------------------------------------------------------

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

-- Recarrega schema cache do PostgREST
notify pgrst, 'reload schema';
