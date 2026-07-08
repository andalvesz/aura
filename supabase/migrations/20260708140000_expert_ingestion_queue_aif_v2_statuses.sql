-- AIF v2: incremental chunk pipeline statuses for expert_ingestion_queue
-- Idempotent: drop-if-exists then recreate with extended status set.

alter table public.expert_ingestion_queue
  drop constraint if exists expert_ingestion_queue_status_check;

alter table public.expert_ingestion_queue
  add constraint expert_ingestion_queue_status_check
  check (status in (
    'pending_drive',
    'downloaded',
    'uploaded',
    'transcribing',
    'transcribed',
    'chunking',
    'extracting',
    'extracting_chunk',
    'normalizing_chunk',
    'validating_chunk',
    'committing_chunk',
    'waiting_for_openai',
    'completed',
    'failed',
    -- legacy values still present in older rows / TypeScript union
    'pending',
    'processing',
    'done'
  ));
