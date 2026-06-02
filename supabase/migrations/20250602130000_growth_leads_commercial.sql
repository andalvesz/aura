-- Fase Comercial — CRM growth_leads (status negociacao + campos comerciais)

-- Novos campos
alter table public.growth_leads
  add column if not exists vertical text check (vertical in ('alvesz', 'consorcios', 'marca_pessoal')),
  add column if not exists observacoes text,
  add column if not exists canal text not null default 'outro'
    check (canal in ('instagram', 'whatsapp', 'indicacao', 'outro')),
  add column if not exists external_id text;

-- Status: incluir negociacao
alter table public.growth_leads drop constraint if exists growth_leads_status_check;

alter table public.growth_leads
  add constraint growth_leads_status_check
  check (status in ('novo', 'contato', 'proposta', 'negociacao', 'fechado', 'perdido'));

create index if not exists growth_leads_vertical_idx
  on public.growth_leads (user_id, vertical);

create index if not exists growth_leads_canal_idx
  on public.growth_leads (user_id, canal);
