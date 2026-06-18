-- Market Leader Mode V1 — benchmarks de mercado e score composto

create table if not exists public.market_benchmarks (
  id uuid primary key default gen_random_uuid(),
  category text not null
    check (category in ('headline', 'landing', 'offer', 'creative', 'funnel')),
  name text not null,
  description text,
  criteria jsonb not null default '[]'::jsonb,
  reference_metrics jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists market_benchmarks_category_name_idx
  on public.market_benchmarks (category, name);

create index if not exists market_benchmarks_category_active_idx
  on public.market_benchmarks (category, active);

alter table public.quality_scores
  add column if not exists excellence_score numeric(5, 2)
    check (excellence_score is null or (excellence_score >= 0 and excellence_score <= 100)),
  add column if not exists benchmark_score numeric(5, 2)
    check (benchmark_score is null or (benchmark_score >= 0 and benchmark_score <= 100)),
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.market_benchmarks enable row level security;

do $$
begin
  execute 'drop policy if exists market_benchmarks_select_all on public.market_benchmarks';
  execute 'create policy market_benchmarks_select_all on public.market_benchmarks for select using (true)';
end $$;

drop trigger if exists market_benchmarks_updated_at on public.market_benchmarks;
create trigger market_benchmarks_updated_at
  before update on public.market_benchmarks
  for each row execute function public.set_updated_at();

insert into public.market_benchmarks (category, name, description, criteria, reference_metrics)
values
  (
    'headline',
    'Headline Market Leader',
    'Benchmarks de headlines de alta conversão no mercado digital BR.',
    '[
      {"key":"clarity","label":"Clareza e especificidade","weight":0.22,"signals":["como","método","passo","resultado","em até"],"min_length":15},
      {"key":"curiosity","label":"Curiosity gap ético","weight":0.18,"signals":["descubra","revelado","segredo","por que","verdade"],"min_length":10},
      {"key":"benefit","label":"Benefício tangível","weight":0.25,"signals":["ganhe","economize","aumente","reduza","transforme"],"min_length":10},
      {"key":"proof","label":"Prova social ou credibilidade","weight":0.20,"signals":["alunos","clientes","depoimento","comprovado","cases"],"min_length":8},
      {"key":"cta","label":"Chamada para ação clara","weight":0.15,"signals":["comece","garanta","acesse","inscreva","quero"],"min_length":5}
    ]'::jsonb,
    '{"avg_ctr":0.035,"top_ctr":0.08,"avg_length":62}'::jsonb
  ),
  (
    'landing',
    'Landing Page Market Leader',
    'Benchmarks de landing pages com conversão acima da média do mercado.',
    '[
      {"key":"value_prop","label":"Proposta de valor acima da dobra","weight":0.25,"signals":["promessa","solução","resultado","para quem","benefício"],"min_length":40},
      {"key":"social_proof","label":"Prova social visível","weight":0.20,"signals":["depoimento","avaliação","alunos","clientes","estrelas"],"min_length":20},
      {"key":"objections","label":"Tratamento de objeções","weight":0.18,"signals":["garantia","risco","dúvida","funciona","sem"],"min_length":25},
      {"key":"urgency","label":"Urgência ética","weight":0.12,"signals":["vagas","limitado","hoje","últimas","encerra"],"min_length":8},
      {"key":"structure","label":"Estrutura escaneável","weight":0.25,"signals":["bullet","passo","módulo","bônus","inclui"],"min_length":50}
    ]'::jsonb,
    '{"avg_conversion":0.035,"top_conversion":0.12,"avg_sections":7}'::jsonb
  ),
  (
    'offer',
    'Offer Stack Market Leader',
    'Benchmarks de ofertas com take rate acima da média.',
    '[
      {"key":"anchoring","label":"Ancoragem de preço","weight":0.20,"signals":["de r$","por apenas","valor","investimento","economia"],"min_length":15},
      {"key":"stack","label":"Stack de valor claro","weight":0.25,"signals":["bônus","inclui","acesso","módulo","entrega"],"min_length":30},
      {"key":"risk_reversal","label":"Reversão de risco","weight":0.22,"signals":["garantia","devolução","reembolso","sem risco","teste"],"min_length":12},
      {"key":"scarcity","label":"Escassez legítima","weight":0.13,"signals":["vagas","limitado","exclusivo","encerra","últimas"],"min_length":8},
      {"key":"payment","label":"Clareza de pagamento","weight":0.20,"signals":["parcela","pix","cartão","à vista","assinatura"],"min_length":10}
    ]'::jsonb,
    '{"avg_take_rate":0.035,"top_take_rate":0.15,"avg_stack_items":5}'::jsonb
  ),
  (
    'creative',
    'Creative Market Leader',
    'Benchmarks de criativos com CTR acima do mercado.',
    '[
      {"key":"hook","label":"Hook nos primeiros 3 segundos","weight":0.30,"signals":["pare","atenção","você","erro","nunca"],"min_length":12},
      {"key":"alignment","label":"Alinhamento visual-copy","weight":0.18,"signals":["mostra","veja","antes","depois","resultado"],"min_length":15},
      {"key":"cta","label":"CTA direto","weight":0.20,"signals":["clique","saiba","link","comente","acesse"],"min_length":8},
      {"key":"platform","label":"Fit de plataforma","weight":0.15,"signals":["stories","reels","feed","vertical","mobile"],"min_length":8},
      {"key":"thumbstop","label":"Thumb-stopping power","weight":0.17,"signals":["novo","grátis","urgente","exclusivo","revelado"],"min_length":10}
    ]'::jsonb,
    '{"avg_ctr":0.012,"top_ctr":0.045,"avg_hook_words":8}'::jsonb
  ),
  (
    'funnel',
    'Funnel Market Leader',
    'Benchmarks de funis com AOV e conversão acima da média.',
    '[
      {"key":"coherence","label":"Coerência entre etapas","weight":0.22,"signals":["próximo","passo","continuar","oferta","upgrade"],"min_length":30},
      {"key":"aov","label":"Otimização de AOV","weight":0.25,"signals":["bump","upsell","combo","adicional","upgrade"],"min_length":20},
      {"key":"upsell_logic","label":"Lógica de upsell","weight":0.20,"signals":["complemento","acelera","avançado","completo","premium"],"min_length":15},
      {"key":"thank_you","label":"Engajamento pós-compra","weight":0.13,"signals":["obrigado","acesso","próximo passo","comunidade","suporte"],"min_length":12},
      {"key":"path","label":"Clareza do caminho de conversão","weight":0.20,"signals":["checkout","carrinho","comprar","garantir","finalizar"],"min_length":20}
    ]'::jsonb,
    '{"avg_aov_multiplier":1.8,"top_aov_multiplier":3.2,"avg_steps":6}'::jsonb
  )
on conflict do nothing;

notify pgrst, 'reload schema';
