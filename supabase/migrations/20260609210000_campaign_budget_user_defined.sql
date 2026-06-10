-- Orçamento disponível definido pelo usuário (sem padrão fixo de R$ 2.000)

alter table public.money_mission_plans
  add column if not exists orcamento_disponivel numeric(12, 2);

alter table public.creator_ads_campaigns
  add column if not exists orcamento_disponivel numeric(12, 2);

alter table public.creator_campaign_orchestrations
  add column if not exists orcamento_disponivel numeric(12, 2);

alter table public.creator_launch_plans
  add column if not exists orcamento_disponivel numeric(12, 2);
