-- Revenue AI — separar métricas estimadas de métricas reais

alter table public.revenue_metrics
  add column if not exists metric_type text not null default 'real'
    check (metric_type in ('estimated', 'real'));

create index if not exists revenue_metrics_user_metric_type_idx
  on public.revenue_metrics (user_id, metric_type, date desc);
