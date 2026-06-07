-- Memória persistente da Aura (recomendações, planos, ações)

create table if not exists public.ai_memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  categoria text not null check (
    categoria in (
      'coach',
      'mentor',
      'calendario',
      'financeiro',
      'saude',
      'alvesz',
      'crescimento',
      'social_media'
    )
  ),
  titulo text not null,
  conteudo text not null,
  origem text not null,
  created_at timestamptz not null default now()
);

create index if not exists ai_memories_user_created_idx
  on public.ai_memories (user_id, created_at desc);

create index if not exists ai_memories_user_categoria_idx
  on public.ai_memories (user_id, categoria, created_at desc);

alter table public.ai_memories enable row level security;

create policy "ai_memories_select_own"
  on public.ai_memories for select using (auth.uid() = user_id);
create policy "ai_memories_insert_own"
  on public.ai_memories for insert with check (auth.uid() = user_id);
create policy "ai_memories_delete_own"
  on public.ai_memories for delete using (auth.uid() = user_id);
