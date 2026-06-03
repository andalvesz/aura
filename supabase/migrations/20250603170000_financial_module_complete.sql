-- =============================================================================
-- Aura OS — Módulo Financeiro completo (idempotente)
-- Execute no Supabase SQL Editor se aparecer "Could not find the table".
-- Tabelas: gastos, financial_goals, financial_income, financial_balance
-- =============================================================================

-- Helper updated_at (compartilhado com outros módulos)
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 1. gastos
-- -----------------------------------------------------------------------------
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

drop policy if exists "gastos_select_own" on public.gastos;
drop policy if exists "gastos_insert_own" on public.gastos;
drop policy if exists "gastos_update_own" on public.gastos;
drop policy if exists "gastos_delete_own" on public.gastos;

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

-- -----------------------------------------------------------------------------
-- 2. financial_goals
-- -----------------------------------------------------------------------------
create table if not exists public.financial_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  titulo text not null,
  valor_meta numeric(12, 2) not null check (valor_meta > 0),
  valor_atual numeric(12, 2) not null default 0 check (valor_atual >= 0),
  data_inicio date not null,
  data_fim date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (data_fim >= data_inicio)
);

create index if not exists financial_goals_user_id_idx
  on public.financial_goals (user_id, data_fim desc);

alter table public.financial_goals enable row level security;

drop policy if exists "financial_goals_select_own" on public.financial_goals;
drop policy if exists "financial_goals_insert_own" on public.financial_goals;
drop policy if exists "financial_goals_update_own" on public.financial_goals;
drop policy if exists "financial_goals_delete_own" on public.financial_goals;

create policy "financial_goals_select_own"
  on public.financial_goals for select using (auth.uid() = user_id);
create policy "financial_goals_insert_own"
  on public.financial_goals for insert with check (auth.uid() = user_id);
create policy "financial_goals_update_own"
  on public.financial_goals for update using (auth.uid() = user_id);
create policy "financial_goals_delete_own"
  on public.financial_goals for delete using (auth.uid() = user_id);

drop trigger if exists financial_goals_updated_at on public.financial_goals;
create trigger financial_goals_updated_at
  before update on public.financial_goals
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 3. financial_income
-- -----------------------------------------------------------------------------
create table if not exists public.financial_income (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  descricao text not null,
  valor numeric(12, 2) not null check (valor > 0),
  origem text not null,
  data date not null default current_date,
  orcamento_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists financial_income_user_id_idx
  on public.financial_income (user_id, data desc);

create unique index if not exists financial_income_orcamento_unique_idx
  on public.financial_income (user_id, orcamento_id)
  where orcamento_id is not null;

alter table public.financial_income enable row level security;

drop policy if exists "financial_income_select_own" on public.financial_income;
drop policy if exists "financial_income_insert_own" on public.financial_income;
drop policy if exists "financial_income_update_own" on public.financial_income;
drop policy if exists "financial_income_delete_own" on public.financial_income;

create policy "financial_income_select_own"
  on public.financial_income for select using (auth.uid() = user_id);
create policy "financial_income_insert_own"
  on public.financial_income for insert with check (auth.uid() = user_id);
create policy "financial_income_update_own"
  on public.financial_income for update using (auth.uid() = user_id);
create policy "financial_income_delete_own"
  on public.financial_income for delete using (auth.uid() = user_id);

drop trigger if exists financial_income_updated_at on public.financial_income;
create trigger financial_income_updated_at
  before update on public.financial_income
  for each row execute function public.set_updated_at();

-- FK orcamento_id apenas se public.orcamentos existir
do $$
begin
  if to_regclass('public.orcamentos') is not null then
    if not exists (
      select 1 from pg_constraint where conname = 'financial_income_orcamento_id_fkey'
    ) then
      alter table public.financial_income
        add constraint financial_income_orcamento_id_fkey
        foreign key (orcamento_id) references public.orcamentos (id) on delete set null;
    end if;
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. financial_balance
-- -----------------------------------------------------------------------------
create table if not exists public.financial_balance (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  valor_atual numeric(12, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists financial_balance_user_id_unique_idx
  on public.financial_balance (user_id);

create index if not exists financial_balance_user_updated_idx
  on public.financial_balance (user_id, updated_at desc);

alter table public.financial_balance enable row level security;

drop policy if exists "financial_balance_select_own" on public.financial_balance;
drop policy if exists "financial_balance_insert_own" on public.financial_balance;
drop policy if exists "financial_balance_update_own" on public.financial_balance;
drop policy if exists "financial_balance_delete_own" on public.financial_balance;

create policy "financial_balance_select_own"
  on public.financial_balance for select using (auth.uid() = user_id);
create policy "financial_balance_insert_own"
  on public.financial_balance for insert with check (auth.uid() = user_id);
create policy "financial_balance_update_own"
  on public.financial_balance for update using (auth.uid() = user_id);
create policy "financial_balance_delete_own"
  on public.financial_balance for delete using (auth.uid() = user_id);

drop trigger if exists financial_balance_updated_at on public.financial_balance;
create trigger financial_balance_updated_at
  before update on public.financial_balance
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Triggers opcionais (Alvesz + metas) — só se orcamentos existir
-- -----------------------------------------------------------------------------
create or replace function public.sync_financial_income_from_orcamento()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_valor numeric(12, 2);
begin
  if NEW.status = 'fechado' and (OLD.status is distinct from 'fechado') then
    v_valor := case
      when NEW.lucro_estimado > 0 then NEW.lucro_estimado
      else NEW.valor_total
    end;

    if v_valor > 0 then
      insert into public.financial_income (
        user_id, descricao, valor, origem, data, orcamento_id
      )
      select
        NEW.user_id,
        'Orçamento Alvesz — ' || NEW.tipo_evento,
        v_valor,
        'alvesz',
        current_date,
        NEW.id
      where not exists (
        select 1
        from public.financial_income fi
        where fi.user_id = NEW.user_id
          and fi.orcamento_id = NEW.id
      );
    end if;
  end if;
  return NEW;
end;
$$;

create or replace function public.sync_financial_goals_on_income()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.financial_goals g
  set valor_atual = sub.total
  from (
    select g2.id,
      coalesce((
        select sum(fi.valor)
        from public.financial_income fi
        where fi.user_id = NEW.user_id
          and fi.data >= g2.data_inicio
          and fi.data <= g2.data_fim
      ), 0) as total
    from public.financial_goals g2
    where g2.user_id = NEW.user_id
      and g2.data_inicio <= NEW.data
      and g2.data_fim >= NEW.data
  ) sub
  where g.id = sub.id;
  return NEW;
end;
$$;

do $$
begin
  if to_regclass('public.orcamentos') is not null then
    drop trigger if exists orcamentos_sync_financial_income on public.orcamentos;
    create trigger orcamentos_sync_financial_income
      after update of status on public.orcamentos
      for each row execute function public.sync_financial_income_from_orcamento();
  end if;
end;
$$;

drop trigger if exists financial_income_sync_goals on public.financial_income;
create trigger financial_income_sync_goals
  after insert or update of valor, data on public.financial_income
  for each row execute function public.sync_financial_goals_on_income();
