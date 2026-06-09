-- Aura CEO — sessões de inteligência central

create table if not exists public.aura_ceo_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  pergunta text not null,
  resumo_executivo text,
  prioridades jsonb not null default '[]'::jsonb,
  riscos jsonb not null default '[]'::jsonb,
  oportunidades jsonb not null default '[]'::jsonb,
  plano_acao text,
  cronograma jsonb not null default '[]'::jsonb,
  missoes_recomendadas jsonb not null default '[]'::jsonb,
  probabilidade_sucesso integer check (
    probabilidade_sucesso is null or (probabilidade_sucesso >= 0 and probabilidade_sucesso <= 100)
  ),
  opportunity_radar jsonb not null default '{}'::jsonb,
  score_ia integer check (score_ia is null or (score_ia >= 0 and score_ia <= 100)),
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists aura_ceo_sessions_user_idx
  on public.aura_ceo_sessions (user_id, created_at desc);

create index if not exists aura_ceo_sessions_status_idx
  on public.aura_ceo_sessions (user_id, status);

alter table public.aura_ceo_sessions enable row level security;

drop policy if exists "aura_ceo_sessions_select_own" on public.aura_ceo_sessions;
drop policy if exists "aura_ceo_sessions_insert_own" on public.aura_ceo_sessions;
drop policy if exists "aura_ceo_sessions_update_own" on public.aura_ceo_sessions;
drop policy if exists "aura_ceo_sessions_delete_own" on public.aura_ceo_sessions;

create policy "aura_ceo_sessions_select_own"
  on public.aura_ceo_sessions for select using (auth.uid() = user_id);
create policy "aura_ceo_sessions_insert_own"
  on public.aura_ceo_sessions for insert with check (auth.uid() = user_id);
create policy "aura_ceo_sessions_update_own"
  on public.aura_ceo_sessions for update using (auth.uid() = user_id);
create policy "aura_ceo_sessions_delete_own"
  on public.aura_ceo_sessions for delete using (auth.uid() = user_id);

drop trigger if exists aura_ceo_sessions_updated_at on public.aura_ceo_sessions;
create trigger aura_ceo_sessions_updated_at
  before update on public.aura_ceo_sessions
  for each row execute function public.set_updated_at();
