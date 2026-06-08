-- Adiciona tipo de meta "idiomas" para integração com Aura English Coach

alter table public.goals drop constraint if exists goals_tipo_check;

alter table public.goals add constraint goals_tipo_check check (
  tipo in (
    'financeira',
    'saude',
    'conteudo',
    'vendas',
    'eventos',
    'idiomas',
    'personalizada'
  )
);
