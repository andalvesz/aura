-- Propostas comerciais Alvesz Experience + observações em orçamentos

alter table public.orcamentos
  add column if not exists observacoes text;

create table if not exists public.alvesz_propostas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  orcamento_id uuid not null references public.orcamentos (id) on delete cascade,
  conteudo text not null,
  melhorada_ia boolean not null default false,
  pdf_meta jsonb not null default '{"ready":false,"version":1}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists alvesz_propostas_user_id_idx on public.alvesz_propostas (user_id);
create index if not exists alvesz_propostas_orcamento_id_idx on public.alvesz_propostas (orcamento_id);

alter table public.alvesz_propostas enable row level security;

drop policy if exists "alvesz_propostas_select_own" on public.alvesz_propostas;
create policy "alvesz_propostas_select_own"
  on public.alvesz_propostas for select using (auth.uid() = user_id);

drop policy if exists "alvesz_propostas_insert_own" on public.alvesz_propostas;
create policy "alvesz_propostas_insert_own"
  on public.alvesz_propostas for insert with check (auth.uid() = user_id);

drop policy if exists "alvesz_propostas_update_own" on public.alvesz_propostas;
create policy "alvesz_propostas_update_own"
  on public.alvesz_propostas for update using (auth.uid() = user_id);

drop policy if exists "alvesz_propostas_delete_own" on public.alvesz_propostas;
create policy "alvesz_propostas_delete_own"
  on public.alvesz_propostas for delete using (auth.uid() = user_id);

drop trigger if exists alvesz_propostas_updated_at on public.alvesz_propostas;
create trigger alvesz_propostas_updated_at
  before update on public.alvesz_propostas
  for each row execute function public.set_updated_at();
