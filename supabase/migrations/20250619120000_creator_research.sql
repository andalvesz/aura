-- Aura Market Research — validação de oportunidades antes do Creator

create table if not exists public.creator_research (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  ideia_input text,
  nicho text,
  publico text,
  problema text,
  solucao text,
  concorrencia_analise text,
  facilidade_criacao integer check (
    facilidade_criacao is null
    or (facilidade_criacao >= 0 and facilidade_criacao <= 100)
  ),
  facilidade_venda integer check (
    facilidade_venda is null
    or (facilidade_venda >= 0 and facilidade_venda <= 100)
  ),
  demanda integer check (demanda is null or (demanda >= 0 and demanda <= 100)),
  competicao integer check (
    competicao is null or (competicao >= 0 and competicao <= 100)
  ),
  escalabilidade integer check (
    escalabilidade is null or (escalabilidade >= 0 and escalabilidade <= 100)
  ),
  potencial_lucro integer check (
    potencial_lucro is null or (potencial_lucro >= 0 and potencial_lucro <= 100)
  ),
  compatibilidade_perfil integer check (
    compatibilidade_perfil is null
    or (compatibilidade_perfil >= 0 and compatibilidade_perfil <= 100)
  ),
  nota_final integer check (
    nota_final is null or (nota_final >= 0 and nota_final <= 100)
  ),
  avatar text,
  dores jsonb not null default '[]'::jsonb,
  desejos jsonb not null default '[]'::jsonb,
  objecoes jsonb not null default '[]'::jsonb,
  produtos_concorrentes jsonb not null default '[]'::jsonb,
  diferencial_sugerido text,
  faixa_preco_min numeric(12, 2),
  faixa_preco_max numeric(12, 2),
  product_id uuid references public.creator_products (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists creator_research_user_idx
  on public.creator_research (user_id, created_at desc);

create index if not exists creator_research_product_idx
  on public.creator_research (product_id);

alter table public.creator_research enable row level security;

drop policy if exists "creator_research_select_own" on public.creator_research;
drop policy if exists "creator_research_insert_own" on public.creator_research;
drop policy if exists "creator_research_update_own" on public.creator_research;
drop policy if exists "creator_research_delete_own" on public.creator_research;

create policy "creator_research_select_own"
  on public.creator_research for select using (auth.uid() = user_id);
create policy "creator_research_insert_own"
  on public.creator_research for insert with check (auth.uid() = user_id);
create policy "creator_research_update_own"
  on public.creator_research for update using (auth.uid() = user_id);
create policy "creator_research_delete_own"
  on public.creator_research for delete using (auth.uid() = user_id);

drop trigger if exists creator_research_updated_at on public.creator_research;
create trigger creator_research_updated_at
  before update on public.creator_research
  for each row execute function public.set_updated_at();
