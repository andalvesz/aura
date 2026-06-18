-- Specialist Engine V1 — especialistas persistentes com critérios próprios

create table if not exists public.specialists (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null,
  criteria jsonb not null default '[]'::jsonb,
  asset_types text[] not null default '{}'::text[],
  default_weight numeric(5, 3) not null default 0.125 check (default_weight > 0 and default_weight <= 1),
  persona text,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists specialists_slug_idx on public.specialists (slug) where active = true;
create index if not exists specialists_active_idx on public.specialists (active, name);

alter table public.specialists enable row level security;

do $$
begin
  execute 'drop policy if exists specialists_select_authenticated on public.specialists';
  execute 'create policy specialists_select_authenticated on public.specialists for select to authenticated using (true)';
end $$;

drop trigger if exists specialists_set_updated_at on public.specialists;
create trigger specialists_set_updated_at
  before update on public.specialists
  for each row execute function public.set_updated_at();

-- Migrar reviewers legados do Excellence Engine
update public.quality_reviews
set reviewer = 'growth_strategist'
where reviewer in ('conversion_expert', 'funnel_architect', 'compliance_reviewer');

alter table public.quality_reviews drop constraint if exists quality_reviews_reviewer_check;
alter table public.quality_reviews add constraint quality_reviews_reviewer_check check (
  reviewer in (
    'product_strategist',
    'copy_chief',
    'creative_director',
    'media_buyer',
    'offer_architect',
    'landing_expert',
    'consumer_psychologist',
    'growth_strategist'
  )
);

insert into public.specialists (slug, name, description, criteria, asset_types, default_weight, persona)
values
  (
    'product_strategist',
    'Product Strategist',
    'Valida posicionamento, avatar, promessa e coerência do produto com o mercado.',
    '["Clareza de avatar e dor principal", "Promessa específica e crível", "Diferenciação vs concorrentes", "Ticket alinhado ao valor percebido", "Escalabilidade do produto"]'::jsonb,
    array['product', 'ebook', 'offer', 'strategy'],
    0.200,
    'Estrategista de produto digital — foco em fit mercado-produto e monetização.'
  ),
  (
    'copy_chief',
    'Copy Chief',
    'Audita headline, narrativa, bullets, CTA e persuasão ética.',
    '["Headline com benefício claro", "Mecanismo único explícito", "Bullets orientados a resultado", "CTA direto e específico", "Tom consistente com avatar"]'::jsonb,
    array['copy', 'landing', 'offer', 'creative', 'campaign'],
    0.200,
    'Diretor de copy — rigoroso com clareza, gancho e conversão honesta.'
  ),
  (
    'creative_director',
    'Creative Director',
    'Avalia hook visual, coerência criativa e aderência ao briefing.',
    '["Hook visual nos primeiros 3 segundos", "Coerência com promessa do produto", "Formato adequado ao canal", "Legibilidade e contraste", "Variações testáveis"]'::jsonb,
    array['creative', 'campaign', 'landing'],
    0.175,
    'Diretor criativo — padrão premium para criativos e peças visuais.'
  ),
  (
    'media_buyer',
    'Media Buyer',
    'Analisa estrutura de campanha, público, budget e escalabilidade de mídia.',
    '["Objetivo de campanha claro", "Segmentação coerente com avatar", "Budget realista para teste", "Criativos alinhados ao funil", "Métricas de controle definidas"]'::jsonb,
    array['campaign', 'creative', 'strategy'],
    0.175,
    'Media buyer sênior — foco em ROAS, testes e escala segura.'
  ),
  (
    'offer_architect',
    'Offer Architect',
    'Valida stack de ofertas, pricing, bumps, upsells e valor percebido.',
    '["Stack coerente com ticket front-end", "Order bump com take rate realista", "Upsell complementar (não redundante)", "Downsell para recuperação", "AOV projetado sustentável"]'::jsonb,
    array['offer', 'funnel', 'product', 'strategy'],
    0.200,
    'Arquiteto de ofertas — maximiza AOV sem quebrar confiança.'
  ),
  (
    'landing_expert',
    'Landing Expert',
    'Audita estrutura de página, fluxo de conversão e elementos de prova.',
    '["Above-the-fold com promessa + CTA", "Prova social ou autoridade", "Seção de benefícios escaneável", "FAQ/objeções respondidas", "Mobile-first e velocidade percebida"]'::jsonb,
    array['landing', 'funnel', 'copy'],
    0.200,
    'Especialista em landing pages — conversão estrutural e UX de vendas.'
  ),
  (
    'consumer_psychologist',
    'Consumer Psychologist',
    'Avalia gatilhos mentais, objeções, urgência e ética persuasiva.',
    '["Dor e desejo bem mapeados", "Objeções antecipadas", "Prova que reduz risco percebido", "Urgência legítima (sem fake scarcity)", "Linguagem empática com avatar"]'::jsonb,
    array['copy', 'landing', 'offer', 'creative', 'product', 'ebook'],
    0.175,
    'Psicólogo do consumidor — persuasão baseada em comportamento real.'
  ),
  (
    'growth_strategist',
    'Growth Strategist',
    'Valida escalabilidade, loops de crescimento, LTV e compliance de growth.',
    '["Loop de aquisição-retenção claro", "Métricas norte definidas", "Risco regulatório/compliance", "Potencial de escala por canal", "Aprendizado iterativo (test-learn)"]'::jsonb,
    array['strategy', 'funnel', 'campaign', 'offer', 'product'],
    0.175,
    'Growth strategist — escala sustentável e compliance em growth.'
  )
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  criteria = excluded.criteria,
  asset_types = excluded.asset_types,
  default_weight = excluded.default_weight,
  persona = excluded.persona,
  active = excluded.active,
  updated_at = now();

notify pgrst, 'reload schema';
