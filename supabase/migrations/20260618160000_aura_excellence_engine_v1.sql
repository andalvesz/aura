-- Aura Excellence Engine V1 — auditoria de especialistas antes da entrega

create table if not exists public.quality_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  asset_type text not null check (
    asset_type in (
      'product',
      'ebook',
      'offer',
      'copy',
      'creative',
      'landing',
      'funnel',
      'campaign',
      'strategy'
    )
  ),
  asset_id uuid not null,
  reviewer text not null check (
    reviewer in (
      'product_strategist',
      'copy_chief',
      'conversion_expert',
      'creative_director',
      'funnel_architect',
      'media_buyer',
      'consumer_psychologist',
      'compliance_reviewer'
    )
  ),
  score numeric(5, 2) not null check (score >= 0 and score <= 100),
  strengths text[] not null default '{}'::text[],
  weaknesses text[] not null default '{}'::text[],
  recommendations text[] not null default '{}'::text[],
  approved boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists quality_reviews_user_idx
  on public.quality_reviews (user_id, created_at desc);

create index if not exists quality_reviews_asset_idx
  on public.quality_reviews (user_id, asset_type, asset_id, created_at desc);

create index if not exists quality_reviews_reviewer_idx
  on public.quality_reviews (user_id, reviewer, created_at desc);

create table if not exists public.quality_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  asset_type text not null check (
    asset_type in (
      'product',
      'ebook',
      'offer',
      'copy',
      'creative',
      'landing',
      'funnel',
      'campaign',
      'strategy'
    )
  ),
  asset_id uuid not null,
  final_score numeric(5, 2) not null check (final_score >= 0 and final_score <= 100),
  approved boolean not null default false,
  regeneration_count integer not null default 0 check (regeneration_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, asset_type, asset_id)
);

create index if not exists quality_scores_user_idx
  on public.quality_scores (user_id, updated_at desc);

create index if not exists quality_scores_approved_idx
  on public.quality_scores (user_id, approved, final_score desc);

alter table public.quality_reviews enable row level security;
alter table public.quality_scores enable row level security;

do $$
begin
  execute 'drop policy if exists quality_reviews_select_own on public.quality_reviews';
  execute 'drop policy if exists quality_reviews_insert_own on public.quality_reviews';
  execute 'drop policy if exists quality_reviews_update_own on public.quality_reviews';
  execute 'drop policy if exists quality_reviews_delete_own on public.quality_reviews';

  execute 'create policy quality_reviews_select_own on public.quality_reviews for select using (auth.uid() = user_id)';
  execute 'create policy quality_reviews_insert_own on public.quality_reviews for insert with check (auth.uid() = user_id)';
  execute 'create policy quality_reviews_update_own on public.quality_reviews for update using (auth.uid() = user_id)';
  execute 'create policy quality_reviews_delete_own on public.quality_reviews for delete using (auth.uid() = user_id)';

  execute 'drop policy if exists quality_scores_select_own on public.quality_scores';
  execute 'drop policy if exists quality_scores_insert_own on public.quality_scores';
  execute 'drop policy if exists quality_scores_update_own on public.quality_scores';
  execute 'drop policy if exists quality_scores_delete_own on public.quality_scores';

  execute 'create policy quality_scores_select_own on public.quality_scores for select using (auth.uid() = user_id)';
  execute 'create policy quality_scores_insert_own on public.quality_scores for insert with check (auth.uid() = user_id)';
  execute 'create policy quality_scores_update_own on public.quality_scores for update using (auth.uid() = user_id)';
  execute 'create policy quality_scores_delete_own on public.quality_scores for delete using (auth.uid() = user_id)';
end $$;

drop trigger if exists quality_scores_set_updated_at on public.quality_scores;
create trigger quality_scores_set_updated_at
  before update on public.quality_scores
  for each row execute function public.set_updated_at();

notify pgrst, 'reload schema';
