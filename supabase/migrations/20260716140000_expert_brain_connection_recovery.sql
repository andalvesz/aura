-- Expert Brain: connection recovery (OAuth expired + Whisper retry)

-- Google Drive connection status (integration_connection equivalent for Drive)
alter table public.google_drive_connections
  add column if not exists status text not null default 'active';

alter table public.google_drive_connections
  add column if not exists last_error text;

alter table public.google_drive_connections
  drop constraint if exists google_drive_connections_status_check;

alter table public.google_drive_connections
  add constraint google_drive_connections_status_check
  check (status in ('active', 'expired', 'disconnected'));

-- Ingestion queue: recoverable retries without marking failed
alter table public.expert_ingestion_queue
  add column if not exists retry_count integer not null default 0;

alter table public.expert_ingestion_queue
  add column if not exists last_error text;

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
    'waiting_transcription_retry',
    'completed',
    'failed',
    'pending',
    'processing',
    'done'
  ));
