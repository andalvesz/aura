-- Aura Creator — intelligence pipeline (9 estados, checklists, scores IA, financeiro)

-- Migrar status antigos para o novo pipeline
alter table public.creator_products drop constraint if exists creator_products_status_check;

update public.creator_products
set status = case status
  when 'draft' then 'ideia'
  when 'validated' then 'validacao'
  when 'offered' then 'pagina_vendas'
  when 'launched' then 'escala'
  else status
end;

alter table public.creator_products
  alter column status set default 'ideia';

alter table public.creator_products
  add constraint creator_products_status_check check (
    status in (
      'ideia',
      'pesquisa',
      'validacao',
      'producao',
      'pagina_vendas',
      'criativos',
      'lancamento',
      'trafego',
      'escala'
    )
  );

-- Campos financeiros
alter table public.creator_products
  add column if not exists investimento_previsto numeric(12, 2),
  add column if not exists receita_prevista numeric(12, 2),
  add column if not exists roi_estimado numeric(8, 2);

-- Novos scores IA na validação
alter table public.creator_validation
  add column if not exists viabilidade integer check (
    viabilidade is null or (viabilidade >= 0 and viabilidade <= 100)
  ),
  add column if not exists lucro_potencial integer check (
    lucro_potencial is null or (lucro_potencial >= 0 and lucro_potencial <= 100)
  ),
  add column if not exists tempo_lancar integer check (
    tempo_lancar is null or (tempo_lancar >= 0 and tempo_lancar <= 100)
  ),
  add column if not exists compatibilidade_perfil integer check (
    compatibilidade_perfil is null
    or (compatibilidade_perfil >= 0 and compatibilidade_perfil <= 100)
  );

-- Checklist por produto e estágio
create table if not exists public.creator_checklist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  product_id uuid not null references public.creator_products (id) on delete cascade,
  estagio text not null check (
    estagio in (
      'ideia',
      'pesquisa',
      'validacao',
      'producao',
      'pagina_vendas',
      'criativos',
      'lancamento',
      'trafego',
      'escala'
    )
  ),
  titulo text not null,
  status text not null default 'pendente' check (status in ('pendente', 'feito')),
  ordem integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists creator_checklist_product_idx
  on public.creator_checklist_items (product_id, estagio, ordem);

create index if not exists creator_checklist_user_idx
  on public.creator_checklist_items (user_id, product_id);

alter table public.creator_checklist_items enable row level security;

drop policy if exists "creator_checklist_select_own" on public.creator_checklist_items;
drop policy if exists "creator_checklist_insert_own" on public.creator_checklist_items;
drop policy if exists "creator_checklist_update_own" on public.creator_checklist_items;
drop policy if exists "creator_checklist_delete_own" on public.creator_checklist_items;

create policy "creator_checklist_select_own"
  on public.creator_checklist_items for select using (auth.uid() = user_id);
create policy "creator_checklist_insert_own"
  on public.creator_checklist_items for insert with check (auth.uid() = user_id);
create policy "creator_checklist_update_own"
  on public.creator_checklist_items for update using (auth.uid() = user_id);
create policy "creator_checklist_delete_own"
  on public.creator_checklist_items for delete using (auth.uid() = user_id);

drop trigger if exists creator_checklist_updated_at on public.creator_checklist_items;
create trigger creator_checklist_updated_at
  before update on public.creator_checklist_items
  for each row execute function public.set_updated_at();
