-- Saldo inicial / atual informado pelo usuário (Financeiro Pessoal)

create table if not exists public.financial_balance (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  valor_atual numeric(12, 2) not null check (valor_atual >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists financial_balance_user_id_unique_idx
  on public.financial_balance (user_id);

create index if not exists financial_balance_user_updated_idx
  on public.financial_balance (user_id, updated_at desc);

alter table public.financial_balance enable row level security;

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
