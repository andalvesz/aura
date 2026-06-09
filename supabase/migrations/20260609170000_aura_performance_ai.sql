-- Aura Performance AI — análise estratégica cross-module

create table if not exists public.performance_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  report_date date not null default current_date,
  period text not null default 'weekly' check (period in ('daily', 'weekly', 'monthly')),
  status text not null default 'active' check (status in ('active', 'archived')),
  titulo text,
  resumo text,
  score_performance numeric(5, 2),
  ai_analysis jsonb not null default '{}'::jsonb,
  panel jsonb not null default '{}'::jsonb,
  executive_memory jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.performance_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  report_id uuid not null references public.performance_reports (id) on delete cascade,
  metric_key text not null,
  metric_label text not null,
  metric_value numeric(14, 2) not null default 0,
  metric_formatted text,
  modulo text,
  created_at timestamptz not null default now()
);

create table if not exists public.performance_insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  report_id uuid not null references public.performance_reports (id) on delete cascade,
  tipo text not null check (
    tipo in (
      'oportunidade',
      'risco',
      'desperdicio',
      'projeto',
      'funcionando',
      'atrasando',
      'acelerar',
      'abandonar',
      'potencial'
    )
  ),
  titulo text not null,
  descricao text not null default '',
  score numeric(5, 2) not null default 50,
  modulo text,
  created_at timestamptz not null default now()
);

create index if not exists performance_reports_user_date_idx
  on public.performance_reports (user_id, report_date desc);

create index if not exists performance_metrics_report_idx
  on public.performance_metrics (report_id, metric_key);

create index if not exists performance_insights_report_idx
  on public.performance_insights (report_id, tipo);

alter table public.performance_reports enable row level security;
alter table public.performance_metrics enable row level security;
alter table public.performance_insights enable row level security;

drop policy if exists "performance_reports_select_own" on public.performance_reports;
drop policy if exists "performance_reports_insert_own" on public.performance_reports;
drop policy if exists "performance_reports_update_own" on public.performance_reports;
drop policy if exists "performance_reports_delete_own" on public.performance_reports;

create policy "performance_reports_select_own"
  on public.performance_reports for select using (auth.uid() = user_id);
create policy "performance_reports_insert_own"
  on public.performance_reports for insert with check (auth.uid() = user_id);
create policy "performance_reports_update_own"
  on public.performance_reports for update using (auth.uid() = user_id);
create policy "performance_reports_delete_own"
  on public.performance_reports for delete using (auth.uid() = user_id);

drop policy if exists "performance_metrics_select_own" on public.performance_metrics;
drop policy if exists "performance_metrics_insert_own" on public.performance_metrics;
drop policy if exists "performance_metrics_delete_own" on public.performance_metrics;

create policy "performance_metrics_select_own"
  on public.performance_metrics for select using (auth.uid() = user_id);
create policy "performance_metrics_insert_own"
  on public.performance_metrics for insert with check (auth.uid() = user_id);
create policy "performance_metrics_delete_own"
  on public.performance_metrics for delete using (auth.uid() = user_id);

drop policy if exists "performance_insights_select_own" on public.performance_insights;
drop policy if exists "performance_insights_insert_own" on public.performance_insights;
drop policy if exists "performance_insights_delete_own" on public.performance_insights;

create policy "performance_insights_select_own"
  on public.performance_insights for select using (auth.uid() = user_id);
create policy "performance_insights_insert_own"
  on public.performance_insights for insert with check (auth.uid() = user_id);
create policy "performance_insights_delete_own"
  on public.performance_insights for delete using (auth.uid() = user_id);

drop trigger if exists performance_reports_updated_at on public.performance_reports;
create trigger performance_reports_updated_at
  before update on public.performance_reports
  for each row execute function public.set_updated_at();
