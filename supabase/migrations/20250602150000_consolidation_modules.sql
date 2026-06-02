-- Consolidação: Calendário, Social Media, Alvesz Experience

-- Eventos: vínculo opcional com lead do Crescimento
alter table public.eventos
  add column if not exists growth_lead_id uuid references public.growth_leads (id) on delete set null;

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
  add column if not exists growth_lead_id uuid references public.growth_leads (id) on delete set null;

-- Eventos Alvesz (módulo Alvesz Experience)
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

create policy "alvesz_eventos_select_own"
  on public.alvesz_eventos for select using (auth.uid() = user_id);
create policy "alvesz_eventos_insert_own"
  on public.alvesz_eventos for insert with check (auth.uid() = user_id);
create policy "alvesz_eventos_update_own"
  on public.alvesz_eventos for update using (auth.uid() = user_id);
create policy "alvesz_eventos_delete_own"
  on public.alvesz_eventos for delete using (auth.uid() = user_id);

drop trigger if exists alvesz_eventos_updated_at on public.alvesz_eventos;
create trigger alvesz_eventos_updated_at
  before update on public.alvesz_eventos
  for each row execute function public.set_updated_at();
