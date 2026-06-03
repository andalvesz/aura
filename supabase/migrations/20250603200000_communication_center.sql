-- Centro de Comunicação da Aura

alter table public.google_calendar_connections
  add column if not exists gmail_enabled boolean not null default false;

create table if not exists public.communication_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  channel text not null check (channel in ('email', 'whatsapp', 'instagram')),
  direction text not null default 'outbound' check (direction in ('outbound', 'inbound')),
  status text not null default 'sent' check (status in ('pending', 'sent', 'opened', 'failed')),
  subject text,
  body_preview text,
  recipient text,
  cliente_id uuid references public.clientes (id) on delete set null,
  orcamento_id uuid references public.orcamentos (id) on delete set null,
  lead_id uuid references public.growth_leads (id) on delete set null,
  proposta_id uuid references public.alvesz_propostas (id) on delete set null,
  gmail_message_id text,
  gmail_thread_id text,
  tracking_token uuid unique default gen_random_uuid(),
  opened_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists communication_logs_user_created_idx
  on public.communication_logs (user_id, created_at desc);

create index if not exists communication_logs_proposta_idx
  on public.communication_logs (user_id, proposta_id)
  where proposta_id is not null;

create index if not exists communication_logs_status_idx
  on public.communication_logs (user_id, status);

alter table public.communication_logs enable row level security;

drop policy if exists "communication_logs_select_own" on public.communication_logs;
create policy "communication_logs_select_own"
  on public.communication_logs for select using (auth.uid() = user_id);

drop policy if exists "communication_logs_insert_own" on public.communication_logs;
create policy "communication_logs_insert_own"
  on public.communication_logs for insert with check (auth.uid() = user_id);

drop policy if exists "communication_logs_update_own" on public.communication_logs;
create policy "communication_logs_update_own"
  on public.communication_logs for update using (auth.uid() = user_id);
