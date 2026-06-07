-- =============================================================================
-- Aura Travel — planejamento e acompanhamento de viagens
-- Tabelas: trips, trip_checklist_items
-- =============================================================================

create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  nome text not null,
  destino text not null,
  data_ida date not null,
  data_volta date not null,
  orcamento numeric(12, 2) not null default 0 check (orcamento >= 0),
  gasto_atual numeric(12, 2) not null default 0 check (gasto_atual >= 0),
  status text not null default 'planejando' check (
    status in ('planejando', 'confirmada', 'em_viagem', 'concluida', 'cancelada')
  ),
  template_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (data_volta >= data_ida)
);

create table if not exists public.trip_checklist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  trip_id uuid not null references public.trips (id) on delete cascade,
  categoria text not null check (
    categoria in (
      'documentos',
      'passaporte',
      'visto',
      'ingressos',
      'hospedagem',
      'seguro',
      'transporte'
    )
  ),
  titulo text not null,
  status text not null default 'pendente' check (
    status in ('pendente', 'feito')
  ),
  ordem integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists trips_user_id_idx
  on public.trips (user_id, data_ida desc);

create index if not exists trips_status_idx
  on public.trips (user_id, status);

create index if not exists trip_checklist_trip_id_idx
  on public.trip_checklist_items (trip_id, ordem);

create index if not exists trip_checklist_user_id_idx
  on public.trip_checklist_items (user_id, trip_id);

alter table public.trips enable row level security;
alter table public.trip_checklist_items enable row level security;

drop policy if exists "trips_select_own" on public.trips;
drop policy if exists "trips_insert_own" on public.trips;
drop policy if exists "trips_update_own" on public.trips;
drop policy if exists "trips_delete_own" on public.trips;

create policy "trips_select_own"
  on public.trips for select using (auth.uid() = user_id);
create policy "trips_insert_own"
  on public.trips for insert with check (auth.uid() = user_id);
create policy "trips_update_own"
  on public.trips for update using (auth.uid() = user_id);
create policy "trips_delete_own"
  on public.trips for delete using (auth.uid() = user_id);

drop policy if exists "trip_checklist_select_own" on public.trip_checklist_items;
drop policy if exists "trip_checklist_insert_own" on public.trip_checklist_items;
drop policy if exists "trip_checklist_update_own" on public.trip_checklist_items;
drop policy if exists "trip_checklist_delete_own" on public.trip_checklist_items;

create policy "trip_checklist_select_own"
  on public.trip_checklist_items for select using (auth.uid() = user_id);
create policy "trip_checklist_insert_own"
  on public.trip_checklist_items for insert with check (auth.uid() = user_id);
create policy "trip_checklist_update_own"
  on public.trip_checklist_items for update using (auth.uid() = user_id);
create policy "trip_checklist_delete_own"
  on public.trip_checklist_items for delete using (auth.uid() = user_id);

drop trigger if exists trips_set_updated_at on public.trips;
create trigger trips_set_updated_at
  before update on public.trips
  for each row execute function public.set_updated_at();

drop trigger if exists trip_checklist_set_updated_at on public.trip_checklist_items;
create trigger trip_checklist_set_updated_at
  before update on public.trip_checklist_items
  for each row execute function public.set_updated_at();
