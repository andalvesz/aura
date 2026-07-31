-- Multiuser Cognitive Isolation — corrective (idempotent)
-- Run AFTER health module exists. Safe to re-run.
-- Does NOT guess ownership of ambiguous rows.

-- 1) Readonly integrity probes (raise NOTICE only)
do $$
declare
  n_workouts int;
  n_habits int;
  n_meals int;
  n_sessions int;
begin
  if to_regclass('public.health_workouts') is not null then
    select count(*) into n_workouts from public.health_workouts where user_id is null;
    raise notice 'health_workouts.user_id IS NULL: %', n_workouts;
  end if;
  if to_regclass('public.health_habits') is not null then
    select count(*) into n_habits from public.health_habits where user_id is null;
    raise notice 'health_habits.user_id IS NULL: %', n_habits;
  end if;
  if to_regclass('public.health_meals') is not null then
    select count(*) into n_meals from public.health_meals where user_id is null;
    raise notice 'health_meals.user_id IS NULL: %', n_meals;
  end if;
  if to_regclass('public.health_sessions') is not null then
    select count(*) into n_sessions from public.health_sessions where user_id is null;
    raise notice 'health_sessions.user_id IS NULL: %', n_sessions;
  end if;
end $$;

-- 2) Reaffirm RLS + own-row policies on health_* (idempotent)
do $$
declare
  t text;
begin
  foreach t in array array[
    'health_habits',
    'health_workouts',
    'health_meals',
    'health_sessions'
  ]
  loop
    if to_regclass('public.' || t) is null then
      raise notice 'skip missing table: %', t;
      continue;
    end if;

    execute format('alter table public.%I enable row level security', t);

    execute format('drop policy if exists %I on public.%I', t || '_select_own', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert_own', t);
    execute format('drop policy if exists %I on public.%I', t || '_update_own', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete_own', t);
    -- legacy alt names from earlier drafts
    execute format('drop policy if exists %I on public.%I', t || '_own_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_own_write', t);

    execute format(
      'create policy %I on public.%I for select using (auth.uid() = user_id)',
      t || '_select_own', t
    );
    execute format(
      'create policy %I on public.%I for insert with check (auth.uid() = user_id)',
      t || '_insert_own', t
    );
    execute format(
      'create policy %I on public.%I for update using (auth.uid() = user_id) with check (auth.uid() = user_id)',
      t || '_update_own', t
    );
    execute format(
      'create policy %I on public.%I for delete using (auth.uid() = user_id)',
      t || '_delete_own', t
    );
  end loop;
end $$;

-- 3) Ensure user_id NOT NULL where table exists and no nulls remain
do $$
begin
  if to_regclass('public.health_workouts') is not null
     and not exists (select 1 from public.health_workouts where user_id is null) then
    alter table public.health_workouts alter column user_id set not null;
  end if;
  if to_regclass('public.health_habits') is not null
     and not exists (select 1 from public.health_habits where user_id is null) then
    alter table public.health_habits alter column user_id set not null;
  end if;
  if to_regclass('public.health_meals') is not null
     and not exists (select 1 from public.health_meals where user_id is null) then
    alter table public.health_meals alter column user_id set not null;
  end if;
  if to_regclass('public.health_sessions') is not null
     and not exists (select 1 from public.health_sessions where user_id is null) then
    alter table public.health_sessions alter column user_id set not null;
  end if;
end $$;
