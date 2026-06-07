-- =============================================================================
-- Aura OS — Instagram Inteligente
-- Perfis por marca, análise, conteúdo vinculado à marca
-- =============================================================================

-- growth_profiles: suporte a 3 marcas Instagram
alter table public.growth_profiles
  add column if not exists marca text,
  add column if not exists bio text,
  add column if not exists frequencia_conteudo text,
  add column if not exists analise jsonb;

-- Migra perfis existentes sem marca
update public.growth_profiles
set marca = case
  when lower(coalesce(nicho, '')) like '%consorc%' then 'consorcios'
  when lower(coalesce(nicho, '')) like '%alvesz%' or lower(coalesce(objetivo, '')) like '%evento%' then 'alvesz'
  else 'marca_pessoal'
end
where marca is null;

alter table public.growth_profiles
  alter column marca set default 'marca_pessoal';

-- Remove constraint antiga (uma plataforma por usuário)
alter table public.growth_profiles
  drop constraint if exists growth_profiles_user_id_plataforma_key;

-- Uma marca por usuário
create unique index if not exists growth_profiles_user_marca_idx
  on public.growth_profiles (user_id, marca)
  where marca is not null;

alter table public.growth_profiles
  drop constraint if exists growth_profiles_marca_check;

alter table public.growth_profiles
  add constraint growth_profiles_marca_check check (
    marca is null or marca in ('marca_pessoal', 'alvesz', 'consorcios')
  );

-- conteudos: vincular à marca
alter table public.conteudos
  add column if not exists marca text;

alter table public.conteudos
  drop constraint if exists conteudos_marca_check;

alter table public.conteudos
  add constraint conteudos_marca_check check (
    marca is null or marca in ('marca_pessoal', 'alvesz', 'consorcios')
  );

create index if not exists conteudos_marca_idx
  on public.conteudos (user_id, marca);
