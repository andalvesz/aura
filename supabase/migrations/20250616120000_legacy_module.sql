-- =============================================================================
-- Aura OS — Legado & Hall da Fama
-- Tabelas: legacy_timeline, legacy_achievements, legacy_certificates,
--          legacy_life_events, legacy_milestones
-- =============================================================================

create table if not exists public.legacy_timeline (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  titulo text not null,
  descricao text,
  categoria text not null check (
    categoria in (
      'ginastica',
      'danca',
      'teatro',
      'empreendedorismo',
      'tecnologia',
      'viagens',
      'vida_pessoal'
    )
  ),
  ano integer not null check (ano >= 1990 and ano <= 2100),
  mes integer check (mes is null or (mes >= 1 and mes <= 12)),
  ordem integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.legacy_achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  titulo text not null,
  descricao text,
  tipo text not null check (
    tipo in ('medalha', 'trofeu', 'vaga', 'conquista_pessoal', 'outro')
  ),
  categoria text not null check (
    categoria in (
      'ginastica',
      'danca',
      'teatro',
      'empreendedorismo',
      'tecnologia',
      'viagens',
      'vida_pessoal'
    )
  ),
  ano integer not null check (ano >= 1990 and ano <= 2100),
  local text,
  ordem integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.legacy_certificates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  titulo text not null,
  instituicao text,
  categoria text not null check (
    categoria in (
      'ginastica',
      'danca',
      'teatro',
      'empreendedorismo',
      'tecnologia',
      'viagens',
      'vida_pessoal'
    )
  ),
  ano integer not null check (ano >= 1990 and ano <= 2100),
  descricao text,
  ordem integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.legacy_life_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  titulo text not null,
  descricao text,
  categoria text not null check (
    categoria in (
      'ginastica',
      'danca',
      'teatro',
      'empreendedorismo',
      'tecnologia',
      'viagens',
      'vida_pessoal'
    )
  ),
  data_evento date not null,
  tipo_evento text not null default 'outro' check (
    tipo_evento in (
      'competicao',
      'apresentacao',
      'conquista',
      'viagem',
      'pessoal',
      'profissional',
      'outro'
    )
  ),
  ordem integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.legacy_milestones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  titulo text not null,
  descricao text,
  categoria text not null check (
    categoria in (
      'ginastica',
      'danca',
      'teatro',
      'empreendedorismo',
      'tecnologia',
      'viagens',
      'vida_pessoal'
    )
  ),
  data_marco date,
  tipo_marco text not null check (
    tipo_marco in (
      'inicio_ginastica',
      'inicio_danca',
      'inicio_teatro',
      'primeiro_cliente_alvesz',
      'criacao_aura',
      'noivado',
      'viagem_internacional',
      'conquista_futura',
      'outro'
    )
  ),
  status text not null default 'concluido' check (
    status in ('concluido', 'em_andamento', 'futuro')
  ),
  ordem integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes
create index if not exists legacy_timeline_user_idx
  on public.legacy_timeline (user_id, ano desc, ordem);
create index if not exists legacy_achievements_user_idx
  on public.legacy_achievements (user_id, ano desc, categoria);
create index if not exists legacy_certificates_user_idx
  on public.legacy_certificates (user_id, ano desc);
create index if not exists legacy_life_events_user_idx
  on public.legacy_life_events (user_id, data_evento desc);
create index if not exists legacy_milestones_user_idx
  on public.legacy_milestones (user_id, data_marco desc nulls last);

-- updated_at triggers
drop trigger if exists legacy_timeline_updated_at on public.legacy_timeline;
create trigger legacy_timeline_updated_at
  before update on public.legacy_timeline
  for each row execute function public.set_updated_at();

drop trigger if exists legacy_achievements_updated_at on public.legacy_achievements;
create trigger legacy_achievements_updated_at
  before update on public.legacy_achievements
  for each row execute function public.set_updated_at();

drop trigger if exists legacy_certificates_updated_at on public.legacy_certificates;
create trigger legacy_certificates_updated_at
  before update on public.legacy_certificates
  for each row execute function public.set_updated_at();

drop trigger if exists legacy_life_events_updated_at on public.legacy_life_events;
create trigger legacy_life_events_updated_at
  before update on public.legacy_life_events
  for each row execute function public.set_updated_at();

drop trigger if exists legacy_milestones_updated_at on public.legacy_milestones;
create trigger legacy_milestones_updated_at
  before update on public.legacy_milestones
  for each row execute function public.set_updated_at();

-- RLS
alter table public.legacy_timeline enable row level security;
alter table public.legacy_achievements enable row level security;
alter table public.legacy_certificates enable row level security;
alter table public.legacy_life_events enable row level security;
alter table public.legacy_milestones enable row level security;

-- legacy_timeline policies
drop policy if exists "legacy_timeline_select_own" on public.legacy_timeline;
drop policy if exists "legacy_timeline_insert_own" on public.legacy_timeline;
drop policy if exists "legacy_timeline_update_own" on public.legacy_timeline;
drop policy if exists "legacy_timeline_delete_own" on public.legacy_timeline;
create policy "legacy_timeline_select_own" on public.legacy_timeline for select using (auth.uid() = user_id);
create policy "legacy_timeline_insert_own" on public.legacy_timeline for insert with check (auth.uid() = user_id);
create policy "legacy_timeline_update_own" on public.legacy_timeline for update using (auth.uid() = user_id);
create policy "legacy_timeline_delete_own" on public.legacy_timeline for delete using (auth.uid() = user_id);

-- legacy_achievements policies
drop policy if exists "legacy_achievements_select_own" on public.legacy_achievements;
drop policy if exists "legacy_achievements_insert_own" on public.legacy_achievements;
drop policy if exists "legacy_achievements_update_own" on public.legacy_achievements;
drop policy if exists "legacy_achievements_delete_own" on public.legacy_achievements;
create policy "legacy_achievements_select_own" on public.legacy_achievements for select using (auth.uid() = user_id);
create policy "legacy_achievements_insert_own" on public.legacy_achievements for insert with check (auth.uid() = user_id);
create policy "legacy_achievements_update_own" on public.legacy_achievements for update using (auth.uid() = user_id);
create policy "legacy_achievements_delete_own" on public.legacy_achievements for delete using (auth.uid() = user_id);

-- legacy_certificates policies
drop policy if exists "legacy_certificates_select_own" on public.legacy_certificates;
drop policy if exists "legacy_certificates_insert_own" on public.legacy_certificates;
drop policy if exists "legacy_certificates_update_own" on public.legacy_certificates;
drop policy if exists "legacy_certificates_delete_own" on public.legacy_certificates;
create policy "legacy_certificates_select_own" on public.legacy_certificates for select using (auth.uid() = user_id);
create policy "legacy_certificates_insert_own" on public.legacy_certificates for insert with check (auth.uid() = user_id);
create policy "legacy_certificates_update_own" on public.legacy_certificates for update using (auth.uid() = user_id);
create policy "legacy_certificates_delete_own" on public.legacy_certificates for delete using (auth.uid() = user_id);

-- legacy_life_events policies
drop policy if exists "legacy_life_events_select_own" on public.legacy_life_events;
drop policy if exists "legacy_life_events_insert_own" on public.legacy_life_events;
drop policy if exists "legacy_life_events_update_own" on public.legacy_life_events;
drop policy if exists "legacy_life_events_delete_own" on public.legacy_life_events;
create policy "legacy_life_events_select_own" on public.legacy_life_events for select using (auth.uid() = user_id);
create policy "legacy_life_events_insert_own" on public.legacy_life_events for insert with check (auth.uid() = user_id);
create policy "legacy_life_events_update_own" on public.legacy_life_events for update using (auth.uid() = user_id);
create policy "legacy_life_events_delete_own" on public.legacy_life_events for delete using (auth.uid() = user_id);

-- legacy_milestones policies
drop policy if exists "legacy_milestones_select_own" on public.legacy_milestones;
drop policy if exists "legacy_milestones_insert_own" on public.legacy_milestones;
drop policy if exists "legacy_milestones_update_own" on public.legacy_milestones;
drop policy if exists "legacy_milestones_delete_own" on public.legacy_milestones;
create policy "legacy_milestones_select_own" on public.legacy_milestones for select using (auth.uid() = user_id);
create policy "legacy_milestones_insert_own" on public.legacy_milestones for insert with check (auth.uid() = user_id);
create policy "legacy_milestones_update_own" on public.legacy_milestones for update using (auth.uid() = user_id);
create policy "legacy_milestones_delete_own" on public.legacy_milestones for delete using (auth.uid() = user_id);
