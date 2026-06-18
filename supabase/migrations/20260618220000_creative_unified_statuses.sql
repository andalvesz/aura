-- Creative Director Unified — lifecycle statuses for real generated assets

alter table public.creative_generated_assets
  drop constraint if exists creative_generated_assets_status_check;

update public.creative_generated_assets
set status = case status
  when 'prompt_ready' then 'briefing'
  when 'ready' then 'delivered'
  else status
end;

alter table public.creative_generated_assets
  add constraint creative_generated_assets_status_check
  check (status in (
    'briefing',
    'generating',
    'reviewing',
    'approved',
    'blocked',
    'delivered',
    'failed'
  ));

notify pgrst, 'reload schema';
