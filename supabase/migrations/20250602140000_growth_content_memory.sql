-- Fase H — Memória estratégica (conteúdos sugeridos pelo Aura Mentor)

create table if not exists public.growth_content_memory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  action_id text not null,
  nicho text,
  resumo text,
  created_at timestamptz not null default now()
);

create index if not exists growth_content_memory_user_id_idx
  on public.growth_content_memory (user_id);

create index if not exists growth_content_memory_created_idx
  on public.growth_content_memory (user_id, created_at desc);

alter table public.growth_content_memory enable row level security;

create policy "growth_content_memory_select_own"
  on public.growth_content_memory for select using (auth.uid() = user_id);
create policy "growth_content_memory_insert_own"
  on public.growth_content_memory for insert with check (auth.uid() = user_id);
create policy "growth_content_memory_delete_own"
  on public.growth_content_memory for delete using (auth.uid() = user_id);
