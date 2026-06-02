-- Consolidação: Calendário, Social Media, Alvesz Experience
-- Seguro para Supabase sem depender de migrations anteriores.
-- Requer: auth.users (Supabase Auth). Opcional: public.growth_leads (FK aplicada se existir).

-- ---------------------------------------------------------------------------
-- Helper
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 1. Eventos (Calendário) — criar se não existir
-- ---------------------------------------------------------------------------
create table if not exists public.eventos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  titulo text not null,
  descricao text,
  data_inicio timestamptz not null,
  data_fim timestamptz,
  local text,
  tipo text not null default 'geral',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists eventos_user_id_idx on public.eventos (user_id);
create index if not exists eventos_data_inicio_idx on public.eventos (user_id, data_inicio);

alter table public.eventos enable row level security;

drop policy if exists "eventos_select_own" on public.eventos;
create policy "eventos_select_own"
  on public.eventos for select using (auth.uid() = user_id);

drop policy if exists "eventos_insert_own" on public.eventos;
create policy "eventos_insert_own"
  on public.eventos for insert with check (auth.uid() = user_id);

drop policy if exists "eventos_update_own" on public.eventos;
create policy "eventos_update_own"
  on public.eventos for update using (auth.uid() = user_id);

drop policy if exists "eventos_delete_own" on public.eventos;
create policy "eventos_delete_own"
  on public.eventos for delete using (auth.uid() = user_id);

drop trigger if exists eventos_updated_at on public.eventos;
create trigger eventos_updated_at
  before update on public.eventos
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 2. Clientes (Alvesz) — antes de orçamentos (FK cliente_id)
-- ---------------------------------------------------------------------------
create table if not exists public.clientes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  nome text not null,
  telefone text,
  email text,
  tipo text not null default 'pessoa_fisica',
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists clientes_user_id_idx on public.clientes (user_id);

alter table public.clientes enable row level security;

drop policy if exists "clientes_select_own" on public.clientes;
create policy "clientes_select_own"
  on public.clientes for select using (auth.uid() = user_id);

drop policy if exists "clientes_insert_own" on public.clientes;
create policy "clientes_insert_own"
  on public.clientes for insert with check (auth.uid() = user_id);

drop policy if exists "clientes_update_own" on public.clientes;
create policy "clientes_update_own"
  on public.clientes for update using (auth.uid() = user_id);

drop policy if exists "clientes_delete_own" on public.clientes;
create policy "clientes_delete_own"
  on public.clientes for delete using (auth.uid() = user_id);

drop trigger if exists clientes_updated_at on public.clientes;
create trigger clientes_updated_at
  before update on public.clientes
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 3. Orçamentos (Alvesz)
-- ---------------------------------------------------------------------------
create table if not exists public.orcamentos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  cliente_id uuid references public.clientes (id) on delete set null,
  tipo_evento text not null,
  convidados integer not null default 0 check (convidados >= 0),
  valor_total numeric(12, 2) not null default 0,
  lucro_estimado numeric(12, 2) not null default 0,
  status text not null default 'rascunho',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists orcamentos_user_id_idx on public.orcamentos (user_id);
create index if not exists orcamentos_cliente_id_idx on public.orcamentos (cliente_id);

alter table public.orcamentos enable row level security;

drop policy if exists "orcamentos_select_own" on public.orcamentos;
create policy "orcamentos_select_own"
  on public.orcamentos for select using (auth.uid() = user_id);

drop policy if exists "orcamentos_insert_own" on public.orcamentos;
create policy "orcamentos_insert_own"
  on public.orcamentos for insert with check (auth.uid() = user_id);

drop policy if exists "orcamentos_update_own" on public.orcamentos;
create policy "orcamentos_update_own"
  on public.orcamentos for update using (auth.uid() = user_id);

drop policy if exists "orcamentos_delete_own" on public.orcamentos;
create policy "orcamentos_delete_own"
  on public.orcamentos for delete using (auth.uid() = user_id);

drop trigger if exists orcamentos_updated_at on public.orcamentos;
create trigger orcamentos_updated_at
  before update on public.orcamentos
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 4. Conteúdos (Social Media)
-- ---------------------------------------------------------------------------
create table if not exists public.conteudos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plataforma text not null,
  titulo text not null,
  status text not null default 'ideia',
  data_publicacao timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists conteudos_user_id_idx on public.conteudos (user_id);
create index if not exists conteudos_status_idx on public.conteudos (user_id, status);

alter table public.conteudos enable row level security;

drop policy if exists "conteudos_select_own" on public.conteudos;
create policy "conteudos_select_own"
  on public.conteudos for select using (auth.uid() = user_id);

drop policy if exists "conteudos_insert_own" on public.conteudos;
create policy "conteudos_insert_own"
  on public.conteudos for insert with check (auth.uid() = user_id);

drop policy if exists "conteudos_update_own" on public.conteudos;
create policy "conteudos_update_own"
  on public.conteudos for update using (auth.uid() = user_id);

drop policy if exists "conteudos_delete_own" on public.conteudos;
create policy "conteudos_delete_own"
  on public.conteudos for delete using (auth.uid() = user_id);

drop trigger if exists conteudos_updated_at on public.conteudos;
create trigger conteudos_updated_at
  before update on public.conteudos
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 5. Colunas de consolidação (ALTER seguro)
-- ---------------------------------------------------------------------------

-- Eventos: vínculo opcional com lead do Crescimento
alter table public.eventos
  add column if not exists growth_lead_id uuid;

create index if not exists eventos_growth_lead_id_idx on public.eventos (growth_lead_id);

-- Conteúdos: campos extras
alter table public.conteudos
  add column if not exists formato text,
  add column if not exists objetivo text,
  add column if not exists observacoes text,
  add column if not exists roteiro text;

-- Clientes: Instagram
alter table public.clientes
  add column if not exists instagram text;

-- Orçamentos: data, local, vínculo growth
alter table public.orcamentos
  add column if not exists data_evento date,
  add column if not exists local text,
  add column if not exists growth_lead_id uuid;

-- FKs para growth_leads apenas se a tabela existir
do $$
begin
  if to_regclass('public.growth_leads') is not null then
    if not exists (
      select 1 from pg_constraint where conname = 'eventos_growth_lead_id_fkey'
    ) then
      alter table public.eventos
        add constraint eventos_growth_lead_id_fkey
        foreign key (growth_lead_id) references public.growth_leads (id) on delete set null;
    end if;

    if not exists (
      select 1 from pg_constraint where conname = 'orcamentos_growth_lead_id_fkey'
    ) then
      alter table public.orcamentos
        add constraint orcamentos_growth_lead_id_fkey
        foreign key (growth_lead_id) references public.growth_leads (id) on delete set null;
    end if;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 6. Eventos Alvesz (módulo Alvesz Experience)
-- ---------------------------------------------------------------------------
create table if not exists public.alvesz_eventos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  titulo text not null,
  data_evento date not null,
  local text,
  cliente_id uuid references public.clientes (id) on delete set null,
  valor_fechado numeric(12, 2) not null default 0 check (valor_fechado >= 0),
  evento_calendario_id uuid references public.eventos (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists alvesz_eventos_user_id_idx on public.alvesz_eventos (user_id);
create index if not exists alvesz_eventos_data_idx on public.alvesz_eventos (user_id, data_evento);

alter table public.alvesz_eventos enable row level security;

drop policy if exists "alvesz_eventos_select_own" on public.alvesz_eventos;
create policy "alvesz_eventos_select_own"
  on public.alvesz_eventos for select using (auth.uid() = user_id);

drop policy if exists "alvesz_eventos_insert_own" on public.alvesz_eventos;
create policy "alvesz_eventos_insert_own"
  on public.alvesz_eventos for insert with check (auth.uid() = user_id);

drop policy if exists "alvesz_eventos_update_own" on public.alvesz_eventos;
create policy "alvesz_eventos_update_own"
  on public.alvesz_eventos for update using (auth.uid() = user_id);

drop policy if exists "alvesz_eventos_delete_own" on public.alvesz_eventos;
create policy "alvesz_eventos_delete_own"
  on public.alvesz_eventos for delete using (auth.uid() = user_id);

drop trigger if exists alvesz_eventos_updated_at on public.alvesz_eventos;
create trigger alvesz_eventos_updated_at
  before update on public.alvesz_eventos
  for each row execute function public.set_updated_at();
