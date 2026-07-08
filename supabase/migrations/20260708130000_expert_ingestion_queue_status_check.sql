-- Hotfix: ensure expert_ingestion_queue.status accepts all statuses used by the app.
-- Idempotent: drop-if-exists then recreate.

alter table public.expert_ingestion_queue
  drop constraint if exists expert_ingestion_queue_status_check;

alter table public.expert_ingestion_queue
  add constraint expert_ingestion_queue_status_check
  check (status in (
    'pending_drive',
    'uploaded',
    'transcribing',
    'extracting',
    'waiting_for_openai',
    'completed',
    'failed',
    -- legacy values still present in older rows / TypeScript union
    'pending',
    'processing',
    'done'
  ));

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
      and rel.relname = 'expert_ingestion_queue'
      and con.contype = 'c'
  loop
    raise notice 'expert_ingestion_queue check constraint: % => %',
      constraint_rec.conname,
      constraint_rec.definition;
  end loop;
end $$;
