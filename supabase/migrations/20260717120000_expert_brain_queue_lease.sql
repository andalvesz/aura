-- Expert Brain — Sprint 1: queue stabilization (lease/lock + per-micro-step persistence)
-- Fully idempotent: safe to run multiple times.

-- ---------------------------------------------------------------------------
-- 1. Per-micro-step progress + retry columns
-- ---------------------------------------------------------------------------
alter table public.expert_ingestion_queue
  add column if not exists current_step text;

alter table public.expert_ingestion_queue
  add column if not exists current_chunk integer not null default 0;

alter table public.expert_ingestion_queue
  add column if not exists total_chunks integer not null default 0;

alter table public.expert_ingestion_queue
  add column if not exists processed_chunks integer not null default 0;

alter table public.expert_ingestion_queue
  add column if not exists last_attempt_at timestamptz;

alter table public.expert_ingestion_queue
  add column if not exists next_retry_at timestamptz;

-- ---------------------------------------------------------------------------
-- 2. Lease / lock columns
-- ---------------------------------------------------------------------------
alter table public.expert_ingestion_queue
  add column if not exists processing_by text;

alter table public.expert_ingestion_queue
  add column if not exists processing_started_at timestamptz;

alter table public.expert_ingestion_queue
  add column if not exists lease_until timestamptz;

alter table public.expert_ingestion_queue
  add column if not exists updated_at timestamptz not null default now();

-- retry_count / last_error may already exist (20260716140000). Guard anyway.
alter table public.expert_ingestion_queue
  add column if not exists retry_count integer not null default 0;

alter table public.expert_ingestion_queue
  add column if not exists last_error text;

-- ---------------------------------------------------------------------------
-- 3. Canonical status set (adds 'downloading'; keeps legacy for compatibility)
-- ---------------------------------------------------------------------------
alter table public.expert_ingestion_queue
  drop constraint if exists expert_ingestion_queue_status_check;

alter table public.expert_ingestion_queue
  add constraint expert_ingestion_queue_status_check
  check (status in (
    -- canonical operational states
    'pending_drive',
    'downloading',
    'downloaded',
    'waiting_for_openai',
    'transcribing',
    'waiting_transcription_retry',
    'transcribed',
    'chunking',
    'extracting_chunk',
    'normalizing_chunk',
    'validating_chunk',
    'committing_chunk',
    'completed',
    'failed',
    -- legacy states (accepted for compatibility, not produced by new runs)
    'uploaded',
    'extracting',
    'pending',
    'processing',
    'done'
  ));

-- ---------------------------------------------------------------------------
-- 4. Indexes for worker selection (eligible items + lease recovery)
-- ---------------------------------------------------------------------------
create index if not exists expert_ingestion_queue_worker_idx
  on public.expert_ingestion_queue (user_id, status, next_retry_at, lease_until);

create index if not exists expert_ingestion_queue_lease_idx
  on public.expert_ingestion_queue (lease_until);

-- ---------------------------------------------------------------------------
-- 5. Keep updated_at fresh on every write
-- ---------------------------------------------------------------------------
create or replace function public.expert_ingestion_queue_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists expert_ingestion_queue_touch_updated_at on public.expert_ingestion_queue;

create trigger expert_ingestion_queue_touch_updated_at
  before update on public.expert_ingestion_queue
  for each row
  execute function public.expert_ingestion_queue_touch_updated_at();
