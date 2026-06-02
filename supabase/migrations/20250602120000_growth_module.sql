-- Crescimento Digital — tabelas, RLS e triggers
-- Execute após 20250528120000_aura_modules.sql (requer public.set_updated_at)

-- ---------------------------------------------------------------------------
-- 1. Metas e progresso (growth_goals)
-- ---------------------------------------------------------------------------
create table if not exists public.growth_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  meta_receita_mensal numeric(12, 2) not null default 0 check (meta_receita_mensal >= 0),
  receita_atual numeric(12, 2) not null default 0 check (receita_atual >= 0),
  xp_total integer not null default 0 check (xp_total >= 0),
  nivel integer not null default 1 check (nivel >= 1),
  mes_referencia date not null default date_trunc('month', current_date)::date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, mes_referencia)
);

create index if not exists growth_goals_user_id_idx on public.growth_goals (user_id);
create index if not exists growth_goals_mes_idx on public.growth_goals (user_id, mes_referencia desc);

alter table public.growth_goals enable row level security;

create policy "growth_goals_select_own"
  on public.growth_goals for select using (auth.uid() = user_id);
create policy "growth_goals_insert_own"
  on public.growth_goals for insert with check (auth.uid() = user_id);
create policy "growth_goals_update_own"
  on public.growth_goals for update using (auth.uid() = user_id);
create policy "growth_goals_delete_own"
  on public.growth_goals for delete using (auth.uid() = user_id);

drop trigger if exists growth_goals_updated_at on public.growth_goals;
create trigger growth_goals_updated_at
  before update on public.growth_goals
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 2. Missões diárias (growth_missions)
-- ---------------------------------------------------------------------------
create table if not exists public.growth_missions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  mission_key text not null,
  titulo text not null,
  descricao text not null default '',
  xp_reward integer not null default 10 check (xp_reward >= 0),
  status text not null default 'pending' check (status in ('pending', 'completed')),
  mission_date date not null default current_date,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, mission_key, mission_date)
);

create index if not exists growth_missions_user_id_idx on public.growth_missions (user_id);
create index if not exists growth_missions_date_idx on public.growth_missions (user_id, mission_date desc);

alter table public.growth_missions enable row level security;

create policy "growth_missions_select_own"
  on public.growth_missions for select using (auth.uid() = user_id);
create policy "growth_missions_insert_own"
  on public.growth_missions for insert with check (auth.uid() = user_id);
create policy "growth_missions_update_own"
  on public.growth_missions for update using (auth.uid() = user_id);
create policy "growth_missions_delete_own"
  on public.growth_missions for delete using (auth.uid() = user_id);

drop trigger if exists growth_missions_updated_at on public.growth_missions;
create trigger growth_missions_updated_at
  before update on public.growth_missions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 3. Máquina de vendas (growth_actions)
-- ---------------------------------------------------------------------------
create table if not exists public.growth_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  vertical text not null check (vertical in ('alvesz', 'consorcios', 'marca_pessoal')),
  oferta_principal text,
  canal_venda text,
  publico_alvo text,
  cta text,
  funil text,
  ideias_acao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, vertical)
);

create index if not exists growth_actions_user_id_idx on public.growth_actions (user_id);

alter table public.growth_actions enable row level security;

create policy "growth_actions_select_own"
  on public.growth_actions for select using (auth.uid() = user_id);
create policy "growth_actions_insert_own"
  on public.growth_actions for insert with check (auth.uid() = user_id);
create policy "growth_actions_update_own"
  on public.growth_actions for update using (auth.uid() = user_id);
create policy "growth_actions_delete_own"
  on public.growth_actions for delete using (auth.uid() = user_id);

drop trigger if exists growth_actions_updated_at on public.growth_actions;
create trigger growth_actions_updated_at
  before update on public.growth_actions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 4. Perfis para análise (growth_profiles)
-- ---------------------------------------------------------------------------
create table if not exists public.growth_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plataforma text not null,
  username text not null,
  nicho text,
  objetivo text,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, plataforma)
);

create index if not exists growth_profiles_user_id_idx on public.growth_profiles (user_id);

alter table public.growth_profiles enable row level security;

create policy "growth_profiles_select_own"
  on public.growth_profiles for select using (auth.uid() = user_id);
create policy "growth_profiles_insert_own"
  on public.growth_profiles for insert with check (auth.uid() = user_id);
create policy "growth_profiles_update_own"
  on public.growth_profiles for update using (auth.uid() = user_id);
create policy "growth_profiles_delete_own"
  on public.growth_profiles for delete using (auth.uid() = user_id);

drop trigger if exists growth_profiles_updated_at on public.growth_profiles;
create trigger growth_profiles_updated_at
  before update on public.growth_profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 5. Análises de perfil (growth_analyses)
-- ---------------------------------------------------------------------------
create table if not exists public.growth_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  profile_id uuid references public.growth_profiles (id) on delete set null,
  conteudo text,
  status text not null default 'pending' check (status in ('pending', 'completed', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists growth_analyses_user_id_idx on public.growth_analyses (user_id);
create index if not exists growth_analyses_profile_idx on public.growth_analyses (profile_id);

alter table public.growth_analyses enable row level security;

create policy "growth_analyses_select_own"
  on public.growth_analyses for select using (auth.uid() = user_id);
create policy "growth_analyses_insert_own"
  on public.growth_analyses for insert with check (auth.uid() = user_id);
create policy "growth_analyses_update_own"
  on public.growth_analyses for update using (auth.uid() = user_id);
create policy "growth_analyses_delete_own"
  on public.growth_analyses for delete using (auth.uid() = user_id);

drop trigger if exists growth_analyses_updated_at on public.growth_analyses;
create trigger growth_analyses_updated_at
  before update on public.growth_analyses
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 6. Leads e vendas (growth_leads)
-- ---------------------------------------------------------------------------
create table if not exists public.growth_leads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  origem text not null default 'outro',
  nome text not null,
  contato text,
  status text not null default 'novo' check (status in ('novo', 'contato', 'proposta', 'fechado', 'perdido')),
  valor_potencial numeric(12, 2) not null default 0 check (valor_potencial >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists growth_leads_user_id_idx on public.growth_leads (user_id);
create index if not exists growth_leads_status_idx on public.growth_leads (user_id, status);
create index if not exists growth_leads_created_idx on public.growth_leads (user_id, created_at desc);

alter table public.growth_leads enable row level security;

create policy "growth_leads_select_own"
  on public.growth_leads for select using (auth.uid() = user_id);
create policy "growth_leads_insert_own"
  on public.growth_leads for insert with check (auth.uid() = user_id);
create policy "growth_leads_update_own"
  on public.growth_leads for update using (auth.uid() = user_id);
create policy "growth_leads_delete_own"
  on public.growth_leads for delete using (auth.uid() = user_id);

drop trigger if exists growth_leads_updated_at on public.growth_leads;
create trigger growth_leads_updated_at
  before update on public.growth_leads
  for each row execute function public.set_updated_at();
