-- Central de logs da Aura OS

create table if not exists public.system_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  tipo text not null check (tipo in ('error', 'warning', 'info', 'success')),
  modulo text not null,
  mensagem text not null,
  detalhes jsonb,
  created_at timestamptz not null default now()
);

create index if not exists system_logs_user_created_idx
  on public.system_logs (user_id, created_at desc);

create index if not exists system_logs_user_modulo_idx
  on public.system_logs (user_id, modulo, created_at desc);

create index if not exists system_logs_user_tipo_idx
  on public.system_logs (user_id, tipo, created_at desc);

alter table public.system_logs enable row level security;

create policy "system_logs_select_own"
  on public.system_logs for select using (auth.uid() = user_id);

create policy "system_logs_insert_own"
  on public.system_logs for insert with check (auth.uid() = user_id);

create policy "system_logs_delete_own"
  on public.system_logs for delete using (auth.uid() = user_id);
