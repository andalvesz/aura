-- Hotfix: expand master_flows current_step (+ status) check constraints
-- Idempotent: drop-if-exists then recreate with full Master Flow step set.

-- ---------------------------------------------------------------------------
-- Status: include all MasterFlowStatus values used by the app
-- ---------------------------------------------------------------------------
alter table public.master_flows
  drop constraint if exists master_flows_status_check;

alter table public.master_flows
  add constraint master_flows_status_check
  check (status in (
    'pending',
    'running',
    'completed',
    'ready_for_approval',
    'ready_to_sell',
    'failed',
    'paused'
  ));

-- ---------------------------------------------------------------------------
-- current_step: accept all modern + legacy MasterFlowStep values
-- ---------------------------------------------------------------------------
alter table public.master_flows
  drop constraint if exists master_flows_current_step_check;

alter table public.master_flows
  add constraint master_flows_current_step_check
  check (current_step in (
    -- Pipeline atual (Mission Core / Master Flow)
    'opportunity_engine',
    'reality_engine',
    'validation_engine',
    'product_strategist',
    'decision_engine',
    'product_factory',
    'copylab',
    'offer_engine',
    'funnel_engine',
    'funnel_pages',
    'landing_factory',
    'checkout_engine',
    'creative_director',
    'ads_commander',
    'sales_system',
    'commercial_excellence',
    'investment_committee',
    'mission_review',
    'publish_orchestrator',
    -- Terminal / control steps stored on current_step in some flows
    'completed',
    'failed',
    'paused',
    -- Legacy steps (still present in older rows / TypeScript union)
    'market_hunter',
    'excellence',
    'done'
  ));

-- ---------------------------------------------------------------------------
-- Sanity: no similar CHECK on metadata (jsonb) or other step columns.
-- progress remains 0..100; there is no dedicated "steps" column.
-- ---------------------------------------------------------------------------
do $$
declare
  constraint_rec record;
begin
  for constraint_rec in
    select con.conname, pg_get_constraintdef(con.oid) as definition
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'master_flows'
      and con.contype = 'c'
  loop
    raise notice 'master_flows check constraint: % => %',
      constraint_rec.conname,
      constraint_rec.definition;
  end loop;
end $$;
