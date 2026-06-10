-- Suporte internacional no Aura Creator: país, idioma e moeda

alter table public.creator_products
  add column if not exists target_country text default 'Brasil',
  add column if not exists target_language text default 'Português',
  add column if not exists currency text default 'BRL';

alter table public.creator_research
  add column if not exists target_country text default 'Brasil',
  add column if not exists target_language text default 'Português',
  add column if not exists currency text default 'BRL';

alter table public.creator_launches
  add column if not exists target_country text default 'Brasil',
  add column if not exists target_language text default 'Português',
  add column if not exists currency text default 'BRL';

alter table public.creator_ads_campaigns
  add column if not exists target_country text default 'Brasil',
  add column if not exists target_language text default 'Português',
  add column if not exists currency text default 'BRL';

alter table public.creator_landings
  add column if not exists target_country text default 'Brasil',
  add column if not exists target_language text default 'Português',
  add column if not exists currency text default 'BRL';

alter table public.money_mission_plans
  add column if not exists currency text default 'BRL';

update public.creator_products
set
  target_country = coalesce(target_country, 'Brasil'),
  target_language = coalesce(target_language, 'Português'),
  currency = coalesce(currency, 'BRL');

update public.creator_research
set
  target_country = coalesce(target_country, 'Brasil'),
  target_language = coalesce(target_language, 'Português'),
  currency = coalesce(currency, 'BRL');

update public.creator_launches
set
  target_country = coalesce(target_country, 'Brasil'),
  target_language = coalesce(target_language, 'Português'),
  currency = coalesce(currency, 'BRL');

update public.creator_ads_campaigns
set
  target_country = coalesce(target_country, 'Brasil'),
  target_language = coalesce(target_language, 'Português'),
  currency = coalesce(currency, 'BRL');

update public.creator_landings
set
  target_country = coalesce(target_country, 'Brasil'),
  target_language = coalesce(target_language, 'Português'),
  currency = coalesce(currency, 'BRL');

update public.money_mission_plans
set currency = coalesce(currency, 'BRL');
