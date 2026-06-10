export type CreatorCountry =
  | "Brasil"
  | "Estados Unidos"
  | "Canadá"
  | "Reino Unido"
  | "Portugal"
  | "Espanha"
  | "Alemanha"
  | "França";

export type CreatorLanguage = "Português" | "Inglês" | "Espanhol" | "Francês" | "Alemão";

export type CreatorCurrency = "BRL" | "USD" | "EUR" | "GBP" | "CAD";

export type CreatorLocale = {
  target_country: CreatorCountry;
  target_language: CreatorLanguage;
  currency: CreatorCurrency;
};

export type CreatorLocalePartial = Partial<CreatorLocale>;

export type CreatorLocaleFields = {
  target_country?: string | null;
  target_language?: string | null;
  currency?: string | null;
};

export const CREATOR_COUNTRY_OPTIONS: CreatorCountry[] = [
  "Brasil",
  "Estados Unidos",
  "Canadá",
  "Reino Unido",
  "Portugal",
  "Espanha",
  "Alemanha",
  "França",
];

export const CREATOR_LANGUAGE_OPTIONS: CreatorLanguage[] = [
  "Português",
  "Inglês",
  "Espanhol",
  "Francês",
  "Alemão",
];

export const CREATOR_CURRENCY_OPTIONS: CreatorCurrency[] = [
  "BRL",
  "USD",
  "EUR",
  "GBP",
  "CAD",
];

export const DEFAULT_CREATOR_LOCALE: CreatorLocale = {
  target_country: "Brasil",
  target_language: "Português",
  currency: "BRL",
};

const COUNTRY_LANGUAGE_DEFAULTS: Record<CreatorCountry, CreatorLanguage> = {
  Brasil: "Português",
  Portugal: "Português",
  "Estados Unidos": "Inglês",
  Canadá: "Inglês",
  "Reino Unido": "Inglês",
  Espanha: "Espanhol",
  Alemanha: "Alemão",
  França: "Francês",
};

const COUNTRY_CURRENCY_DEFAULTS: Record<CreatorCountry, CreatorCurrency> = {
  Brasil: "BRL",
  Portugal: "EUR",
  "Estados Unidos": "USD",
  Canadá: "CAD",
  "Reino Unido": "GBP",
  Espanha: "EUR",
  Alemanha: "EUR",
  França: "EUR",
};

const INTL_LOCALE_BY_COUNTRY: Record<CreatorCountry, string> = {
  Brasil: "pt-BR",
  Portugal: "pt-PT",
  "Estados Unidos": "en-US",
  Canadá: "en-CA",
  "Reino Unido": "en-GB",
  Espanha: "es-ES",
  Alemanha: "de-DE",
  França: "fr-FR",
};

const SALES_CHANNELS: Record<CreatorCountry, string[]> = {
  Brasil: ["Instagram", "WhatsApp", "Hotmart", "Kiwify", "YouTube"],
  Portugal: ["Instagram", "Hotmart", "Kiwify", "Email marketing"],
  "Estados Unidos": ["Meta Ads", "Google Ads", "TikTok Shop", "Email", "YouTube"],
  Canadá: ["Meta Ads", "Google Ads", "TikTok", "Email marketing"],
  "Reino Unido": ["Meta Ads", "Google Ads", "TikTok", "Email marketing"],
  Espanha: ["Instagram", "Meta Ads", "Hotmart", "Email marketing"],
  Alemanha: ["Meta Ads", "Google Ads", "LinkedIn", "Email marketing"],
  França: ["Instagram", "Meta Ads", "Email marketing", "YouTube"],
};

function isCreatorCountry(value: string | null | undefined): value is CreatorCountry {
  return CREATOR_COUNTRY_OPTIONS.includes(value as CreatorCountry);
}

function isCreatorLanguage(value: string | null | undefined): value is CreatorLanguage {
  return CREATOR_LANGUAGE_OPTIONS.includes(value as CreatorLanguage);
}

function isCreatorCurrency(value: string | null | undefined): value is CreatorCurrency {
  return CREATOR_CURRENCY_OPTIONS.includes(value as CreatorCurrency);
}

export function resolveCreatorLocale(partial?: CreatorLocalePartial | CreatorLocaleFields | null): CreatorLocale {
  const country = isCreatorCountry(partial?.target_country)
    ? partial.target_country
    : DEFAULT_CREATOR_LOCALE.target_country;

  const language = isCreatorLanguage(partial?.target_language)
    ? partial.target_language
    : COUNTRY_LANGUAGE_DEFAULTS[country];

  const currency = isCreatorCurrency(partial?.currency)
    ? partial.currency
    : COUNTRY_CURRENCY_DEFAULTS[country];

  return { target_country: country, target_language: language, currency };
}

export function localeFromFields(fields?: CreatorLocaleFields | null): CreatorLocale {
  return resolveCreatorLocale(fields ?? undefined);
}

export function pickLocaleFields(locale: CreatorLocale): CreatorLocale {
  return { ...locale };
}

export function getIntlLocale(locale: CreatorLocale): string {
  return INTL_LOCALE_BY_COUNTRY[locale.target_country] ?? "pt-BR";
}

export function formatCreatorMoney(value: number, locale?: CreatorLocalePartial | CreatorLocaleFields | null): string {
  const resolved = resolveCreatorLocale(locale);
  return new Intl.NumberFormat(getIntlLocale(resolved), {
    style: "currency",
    currency: resolved.currency,
  }).format(value);
}

export function getCurrencySymbol(currency: CreatorCurrency): string {
  return formatCreatorMoney(0, { currency, target_country: "Brasil", target_language: "Português" })
    .replace(/[\d.,\s]/g, "")
    .trim();
}

export function getSalesChannels(country: CreatorCountry): string[] {
  return SALES_CHANNELS[country] ?? SALES_CHANNELS.Brasil;
}

export function buildLocaleAiRules(locale: CreatorLocale): string {
  const channels = getSalesChannels(locale.target_country).join(", ");
  return `LOCALIZAÇÃO (OBRIGATÓRIO):
- País de destino: ${locale.target_country}
- Idioma do produto: ${locale.target_language}
- Moeda principal: ${locale.currency}
- Gere TODO o conteúdo em ${locale.target_language}, adaptado à cultura e comportamento de compra de ${locale.target_country}.
- Preços, orçamentos e metas financeiras em ${locale.currency}.
- Adapte avatar, dores, promessa, objeções, exemplos, copy e canais de venda ao mercado local.
- Canais de venda relevantes: ${channels}.`;
}

export function buildCreatorAiContext(locale?: CreatorLocalePartial | null): string {
  const resolved = resolveCreatorLocale(locale);
  return `Você é a Aura Creator — especialista em transformar ideias em projetos executáveis para mercados globais.
Use dados reais da Aura (Legado, produtos já criados, Financeiro) quando disponíveis.
${buildLocaleAiRules(resolved)}
Tom estratégico e orientado a lançamento.`;
}

export function buildResearchAiContext(locale?: CreatorLocalePartial | null): string {
  const resolved = resolveCreatorLocale(locale);
  return `Você é a Aura Market Research — valida oportunidades de mercado antes da criação de produtos digitais.
${buildLocaleAiRules(resolved)}
Avalie demanda, concorrência e viabilidade considerando o país e a moeda escolhidos.
Tom analítico e orientado a decisão.`;
}

export function buildCopylabAiContext(locale?: CreatorLocalePartial | null): string {
  const resolved = resolveCreatorLocale(locale);
  return `Você é a Aura CopyLab — copywriter de elite para produtos digitais.
${buildLocaleAiRules(resolved)}
Gere headlines, ofertas, VSLs, storytelling e criativos para tráfego pago no idioma escolhido.`;
}

export function buildLandingAiContext(locale?: CreatorLocalePartial | null): string {
  const resolved = resolveCreatorLocale(locale);
  return `Você é a Aura Landing Builder — especialista em páginas de vendas de alta conversão.
${buildLocaleAiRules(resolved)}
Gere landing pages completas no idioma e cultura do mercado alvo.`;
}

export function buildAdsAiContext(locale?: CreatorLocalePartial | null): string {
  const resolved = resolveCreatorLocale(locale);
  const platform =
    resolved.target_country === "Brasil" ? "Meta Ads" : "Meta Ads e Google Ads";
  return `Você é a Aura Ads Manager — estrategista de tráfego pago (${platform}) para ${resolved.target_country}.
${buildLocaleAiRules(resolved)}
Monte campanhas em RASCUNHO com público local, copy no idioma escolhido e orçamento em ${resolved.currency}.
NUNCA publique — apenas estruture o plano de mídia.`;
}

export function buildMoneyAiContext(currency: CreatorCurrency = "BRL"): string {
  return `Você é a Aura Money Missions — transforma metas financeiras em planos executáveis.
Analise Legado, Creator, Research, CopyLab, Launch, Financeiro, Metas, Social Media e Alvesz Experience.
Gere planos práticos com produtos, serviços, receita, investimento, ROI, riscos e cronograma semanal.
Valores e metas em ${currency}. Nunca assuma orçamento padrão — use apenas o "Orçamento disponível" informado.
Tom executivo, orientado a ação.`;
}

export function buildCeoAiContext(): string {
  return `Você é a Aura CEO — inteligência central da Aura.
Analise Legado, Money Missions, Creator, Research, CopyLab, Launch, Financeiro, Metas, Social Media, Alvesz, Idiomas, Viagens, Saúde e Calendário.
Gere estratégias executivas com resumo, prioridades, riscos, oportunidades, plano de ação, cronograma e missões recomendadas.
Ao sugerir produtos internacionais, indique país recomendado, idioma, moeda e motivo estratégico.
Tom de conselheiro executivo, orientado a ação.`;
}

export function formatLocaleLabel(locale: CreatorLocale): string {
  return `${locale.target_country} · ${locale.target_language} · ${locale.currency}`;
}
