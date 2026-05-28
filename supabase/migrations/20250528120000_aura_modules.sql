-- Aura — módulos completos + RLS + IA
-- Execute no Supabase SQL Editor (após schema de profiles)

-- ---------------------------------------------------------------------------
-- Helpers
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
-- 1. Gastos (Financeiro)
-- ---------------------------------------------------------------------------
create table if not exists public.gastos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  titulo text not null,
  valor numeric(12, 2) not null check (valor >= 0),
  categoria text not null,
  data date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists gastos_user_id_idx on public.gastos (user_id);
create index if not exists gastos_data_idx on public.gastos (user_id, data desc);

alter table public.gastos enable row level security;

create policy "gastos_select_own"
  on public.gastos for select using (auth.uid() = user_id);
create policy "gastos_insert_own"
  on public.gastos for insert with check (auth.uid() = user_id);
create policy "gastos_update_own"
  on public.gastos for update using (auth.uid() = user_id);
create policy "gastos_delete_own"
  on public.gastos for delete using (auth.uid() = user_id);

drop trigger if exists gastos_updated_at on public.gastos;
create trigger gastos_updated_at
  before update on public.gastos
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 2. Eventos (Calendário)
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

create policy "eventos_select_own"
  on public.eventos for select using (auth.uid() = user_id);
create policy "eventos_insert_own"
  on public.eventos for insert with check (auth.uid() = user_id);
create policy "eventos_update_own"
  on public.eventos for update using (auth.uid() = user_id);
create policy "eventos_delete_own"
  on public.eventos for delete using (auth.uid() = user_id);

drop trigger if exists eventos_updated_at on public.eventos;
create trigger eventos_updated_at
  before update on public.eventos
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 3. Clientes (Alvesz)
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

create policy "clientes_select_own"
  on public.clientes for select using (auth.uid() = user_id);
create policy "clientes_insert_own"
  on public.clientes for insert with check (auth.uid() = user_id);
create policy "clientes_update_own"
  on public.clientes for update using (auth.uid() = user_id);
create policy "clientes_delete_own"
  on public.clientes for delete using (auth.uid() = user_id);

drop trigger if exists clientes_updated_at on public.clientes;
create trigger clientes_updated_at
  before update on public.clientes
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 4. Orçamentos (Alvesz)
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

create policy "orcamentos_select_own"
  on public.orcamentos for select using (auth.uid() = user_id);
create policy "orcamentos_insert_own"
  on public.orcamentos for insert with check (auth.uid() = user_id);
create policy "orcamentos_update_own"
  on public.orcamentos for update using (auth.uid() = user_id);
create policy "orcamentos_delete_own"
  on public.orcamentos for delete using (auth.uid() = user_id);

drop trigger if exists orcamentos_updated_at on public.orcamentos;
create trigger orcamentos_updated_at
  before update on public.orcamentos
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 5. Estoque (Alvesz)
-- ---------------------------------------------------------------------------
create table if not exists public.estoque (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  produto text not null,
  quantidade numeric(12, 2) not null default 0,
  unidade text not null default 'un',
  minimo_alerta numeric(12, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists estoque_user_id_idx on public.estoque (user_id);

alter table public.estoque enable row level security;

create policy "estoque_select_own"
  on public.estoque for select using (auth.uid() = user_id);
create policy "estoque_insert_own"
  on public.estoque for insert with check (auth.uid() = user_id);
create policy "estoque_update_own"
  on public.estoque for update using (auth.uid() = user_id);
create policy "estoque_delete_own"
  on public.estoque for delete using (auth.uid() = user_id);

drop trigger if exists estoque_updated_at on public.estoque;
create trigger estoque_updated_at
  before update on public.estoque
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 6. Treinos (Saúde)
-- ---------------------------------------------------------------------------
create table if not exists public.treinos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  titulo text not null,
  categoria text not null default 'geral',
  exercicios jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists treinos_user_id_idx on public.treinos (user_id);

alter table public.treinos enable row level security;

create policy "treinos_select_own"
  on public.treinos for select using (auth.uid() = user_id);
create policy "treinos_insert_own"
  on public.treinos for insert with check (auth.uid() = user_id);
create policy "treinos_update_own"
  on public.treinos for update using (auth.uid() = user_id);
create policy "treinos_delete_own"
  on public.treinos for delete using (auth.uid() = user_id);

drop trigger if exists treinos_updated_at on public.treinos;
create trigger treinos_updated_at
  before update on public.treinos
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 7. Dieta (Saúde)
-- ---------------------------------------------------------------------------
create table if not exists public.dieta (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  refeicao text not null,
  horario time not null,
  calorias integer not null default 0 check (calorias >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists dieta_user_id_idx on public.dieta (user_id);

alter table public.dieta enable row level security;

create policy "dieta_select_own"
  on public.dieta for select using (auth.uid() = user_id);
create policy "dieta_insert_own"
  on public.dieta for insert with check (auth.uid() = user_id);
create policy "dieta_update_own"
  on public.dieta for update using (auth.uid() = user_id);
create policy "dieta_delete_own"
  on public.dieta for delete using (auth.uid() = user_id);

drop trigger if exists dieta_updated_at on public.dieta;
create trigger dieta_updated_at
  before update on public.dieta
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 8. Conteúdos (Social Media)
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

create policy "conteudos_select_own"
  on public.conteudos for select using (auth.uid() = user_id);
create policy "conteudos_insert_own"
  on public.conteudos for insert with check (auth.uid() = user_id);
create policy "conteudos_update_own"
  on public.conteudos for update using (auth.uid() = user_id);
create policy "conteudos_delete_own"
  on public.conteudos for delete using (auth.uid() = user_id);

drop trigger if exists conteudos_updated_at on public.conteudos;
create trigger conteudos_updated_at
  before update on public.conteudos
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 9. Leads (Consórcios)
-- ---------------------------------------------------------------------------
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  nome text not null,
  telefone text,
  origem text not null default 'outro',
  status text not null default 'novo',
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists leads_user_id_idx on public.leads (user_id);
create index if not exists leads_status_idx on public.leads (user_id, status);

alter table public.leads enable row level security;

create policy "leads_select_own"
  on public.leads for select using (auth.uid() = user_id);
create policy "leads_insert_own"
  on public.leads for insert with check (auth.uid() = user_id);
create policy "leads_update_own"
  on public.leads for update using (auth.uid() = user_id);
create policy "leads_delete_own"
  on public.leads for delete using (auth.uid() = user_id);

drop trigger if exists leads_updated_at on public.leads;
create trigger leads_updated_at
  before update on public.leads
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 10. IA — mensagens por módulo (futuro)
-- ---------------------------------------------------------------------------
create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  module text not null,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ai_messages_user_module_idx
  on public.ai_messages (user_id, module, created_at desc);

alter table public.ai_messages enable row level security;

create policy "ai_messages_select_own"
  on public.ai_messages for select using (auth.uid() = user_id);
create policy "ai_messages_insert_own"
  on public.ai_messages for insert with check (auth.uid() = user_id);
create policy "ai_messages_delete_own"
  on public.ai_messages for delete using (auth.uid() = user_id);
