-- Aura Autopilot — automação controlada de campanhas

create table if not exists public.autopilot_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  control_level text not null default 'manual' check (
    control_level in ('manual', 'suggest', 'prepare', 'execute_approved')
  ),
  rules jsonb not null default '{
    "pause_low_ctr": {"enabled": false, "threshold": 1.0},
    "pause_high_cpa": {"enabled": false, "threshold": 150},
    "alert_fast_budget": {"enabled": true, "threshold": 70},
    "suggest_scale_roas": {"enabled": true, "threshold": 3.0},
    "suggest_new_creative": {"enabled": true, "threshold": 3.5}
  }'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.autopilot_monitors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  campaign_id uuid not null references public.creator_ads_campaigns (id) on delete cascade,
  monitor_status text not null default 'active' check (
    monitor_status in ('active', 'paused')
  ),
  metrics jsonb not null default '{}'::jsonb,
  last_evaluated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, campaign_id)
);

create table if not exists public.autopilot_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  campaign_id uuid references public.creator_ads_campaigns (id) on delete set null,
  action_type text not null check (
    action_type in (
      'start_campaign',
      'pause_campaign',
      'resume_campaign',
      'duplicate_campaign',
      'generate_creative',
      'generate_copy',
      'suggest_scale',
      'alert_budget',
      'alert_ctr',
      'alert_cpa',
      'alert_frequency',
      'increase_budget',
      'publish_campaign'
    )
  ),
  trigger_type text not null default 'manual' check (
    trigger_type in ('manual', 'rule', 'ai')
  ),
  rule_key text,
  status text not null default 'pending_approval' check (
    status in (
      'suggested',
      'pending_approval',
      'approved',
      'rejected',
      'executed',
      'auto_executed'
    )
  ),
  requires_approval boolean not null default true,
  metric_detected text,
  metric_value numeric(14, 4),
  reason text,
  suggestion text,
  payload jsonb not null default '{}'::jsonb,
  executed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists autopilot_monitors_user_idx
  on public.autopilot_monitors (user_id, updated_at desc);

create index if not exists autopilot_monitors_campaign_idx
  on public.autopilot_monitors (campaign_id);

create index if not exists autopilot_actions_user_idx
  on public.autopilot_actions (user_id, created_at desc);

create index if not exists autopilot_actions_status_idx
  on public.autopilot_actions (user_id, status);

alter table public.autopilot_settings enable row level security;
alter table public.autopilot_monitors enable row level security;
alter table public.autopilot_actions enable row level security;

drop policy if exists "autopilot_settings_select_own" on public.autopilot_settings;
drop policy if exists "autopilot_settings_insert_own" on public.autopilot_settings;
drop policy if exists "autopilot_settings_update_own" on public.autopilot_settings;

create policy "autopilot_settings_select_own"
  on public.autopilot_settings for select using (auth.uid() = user_id);
create policy "autopilot_settings_insert_own"
  on public.autopilot_settings for insert with check (auth.uid() = user_id);
create policy "autopilot_settings_update_own"
  on public.autopilot_settings for update using (auth.uid() = user_id);

drop policy if exists "autopilot_monitors_select_own" on public.autopilot_monitors;
drop policy if exists "autopilot_monitors_insert_own" on public.autopilot_monitors;
drop policy if exists "autopilot_monitors_update_own" on public.autopilot_monitors;
drop policy if exists "autopilot_monitors_delete_own" on public.autopilot_monitors;

create policy "autopilot_monitors_select_own"
  on public.autopilot_monitors for select using (auth.uid() = user_id);
create policy "autopilot_monitors_insert_own"
  on public.autopilot_monitors for insert with check (auth.uid() = user_id);
create policy "autopilot_monitors_update_own"
  on public.autopilot_monitors for update using (auth.uid() = user_id);
create policy "autopilot_monitors_delete_own"
  on public.autopilot_monitors for delete using (auth.uid() = user_id);

drop policy if exists "autopilot_actions_select_own" on public.autopilot_actions;
drop policy if exists "autopilot_actions_insert_own" on public.autopilot_actions;
drop policy if exists "autopilot_actions_update_own" on public.autopilot_actions;
drop policy if exists "autopilot_actions_delete_own" on public.autopilot_actions;

create policy "autopilot_actions_select_own"
  on public.autopilot_actions for select using (auth.uid() = user_id);
create policy "autopilot_actions_insert_own"
  on public.autopilot_actions for insert with check (auth.uid() = user_id);
create policy "autopilot_actions_update_own"
  on public.autopilot_actions for update using (auth.uid() = user_id);
create policy "autopilot_actions_delete_own"
  on public.autopilot_actions for delete using (auth.uid() = user_id);

drop trigger if exists autopilot_settings_updated_at on public.autopilot_settings;
create trigger autopilot_settings_updated_at
  before update on public.autopilot_settings
  for each row execute function public.set_updated_at();

drop trigger if exists autopilot_monitors_updated_at on public.autopilot_monitors;
create trigger autopilot_monitors_updated_at
  before update on public.autopilot_monitors
  for each row execute function public.set_updated_at();

drop trigger if exists autopilot_actions_updated_at on public.autopilot_actions;
create trigger autopilot_actions_updated_at
  before update on public.autopilot_actions
  for each row execute function public.set_updated_at();
