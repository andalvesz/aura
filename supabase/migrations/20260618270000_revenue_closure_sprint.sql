-- Revenue Closure Sprint — READY_TO_SELL certification + extended Master Flow steps

alter table public.master_flows
  drop constraint if exists master_flows_status_check;

alter table public.master_flows
  add constraint master_flows_status_check
  check (status in ('pending', 'running', 'completed', 'ready_to_sell', 'failed', 'paused'));

alter table public.master_flows
  drop constraint if exists master_flows_current_step_check;

alter table public.master_flows
  add constraint master_flows_current_step_check
  check (current_step in (
    'market_hunter',
    'decision_engine',
    'product_factory',
    'copylab',
    'offer_engine',
    'funnel_engine',
    'funnel_pages',
    'checkout_engine',
    'creative_director',
    'ads_commander',
    'publish_orchestrator',
    'commercial_excellence',
    'excellence',
    'done'
  ));
