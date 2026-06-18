import {
  type CreatorCountry,
  type CreatorLanguage,
  DEFAULT_CREATOR_LOCALE,
  getIntlLocale,
  resolveCreatorLocale,
} from "@/utils/creator-locale";
import type { MarketCandidate, MarketHunterDashboard } from "@/utils/market-hunter";
import { computeOpportunityScore, rankProducts } from "@/utils/market-hunter";
import type { MasterFlowMetadata } from "@/utils/master-flow";

export type MasterFlowIntentInput = {
  niche?: string | null;
  country?: string | null;
  language?: string | null;
  avatar?: string | null;
  ticket?: number | null;
  raw?: string | null;
};

export type MasterFlowIntent = {
  niche: string | null;
  country: string | null;
  language: string | null;
  avatar: string | null;
  ticket: number | null;
  raw: string | null;
};

const COUNTRY_ALIASES: Record<string, string> = {
  br: "BR",
  brasil: "BR",
  brazil: "BR",
  us: "US",
  usa: "US",
  eua: "US",
  "estados unidos": "US",
  "united states": "US",
  ca: "CA",
  canada: "CA",
  canadá: "CA",
  uk: "GB",
  gb: "GB",
  "reino unido": "GB",
  pt: "PT",
  portugal: "PT",
  es: "ES",
  espanha: "ES",
  spain: "ES",
  de: "DE",
  alemanha: "DE",
  germany: "DE",
  fr: "FR",
  frança: "FR",
  franca: "FR",
  france: "FR",
};

const MARKET_TO_CREATOR_COUNTRY: Record<string, CreatorCountry> = {
  BR: "Brasil",
  US: "Estados Unidos",
  CA: "Canadá",
  GB: "Reino Unido",
  PT: "Portugal",
  ES: "Espanha",
  DE: "Alemanha",
  FR: "França",
};

const LANGUAGE_ALIASES: Record<string, string> = {
  pt: "pt-BR",
  "pt-br": "pt-BR",
  portugues: "pt-BR",
  português: "pt-BR",
  en: "en-US",
  "en-us": "en-US",
  ingles: "en-US",
  inglês: "en-US",
  english: "en-US",
  es: "es-ES",
  espanhol: "es-ES",
  spanish: "es-ES",
  fr: "fr-FR",
  frances: "fr-FR",
  francês: "fr-FR",
  de: "de-DE",
  alemao: "de-DE",
  alemão: "de-DE",
};

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function normalizeMarketCountry(input: string | null | undefined): string | null {
  if (!input?.trim()) return null;
  const key = normalizeText(input);
  if (COUNTRY_ALIASES[key]) return COUNTRY_ALIASES[key];
  const upper = input.trim().toUpperCase();
  if (upper.length === 2 && MARKET_TO_CREATOR_COUNTRY[upper]) return upper;
  for (const [alias, code] of Object.entries(COUNTRY_ALIASES)) {
    if (key.includes(alias)) return code;
  }
  return null;
}

export function normalizeMarketLanguage(
  input: string | null | undefined,
  countryCode?: string | null
): string | null {
  if (input?.trim()) {
    const key = normalizeText(input);
    if (LANGUAGE_ALIASES[key]) return LANGUAGE_ALIASES[key];
    if (input.includes("-")) return input.trim();
  }
  const creatorCountry = toCreatorCountryFromIntent(countryCode);
  return getIntlLocale(resolveCreatorLocale({ target_country: creatorCountry }));
}

export function toCreatorCountryFromIntent(country: string | null | undefined): CreatorCountry {
  const code = normalizeMarketCountry(country);
  if (code && MARKET_TO_CREATOR_COUNTRY[code]) return MARKET_TO_CREATOR_COUNTRY[code];
  return DEFAULT_CREATOR_LOCALE.target_country;
}

export function toCreatorLanguageFromIntent(
  language: string | null | undefined,
  country: string | null | undefined
): CreatorLanguage {
  const intl = normalizeMarketLanguage(language, country);
  if (intl?.startsWith("en")) return "Inglês";
  if (intl?.startsWith("es")) return "Espanhol";
  if (intl?.startsWith("fr")) return "Francês";
  if (intl?.startsWith("de")) return "Alemão";
  return resolveCreatorLocale({ target_country: toCreatorCountryFromIntent(country) }).target_language;
}

export function marketCurrencyForCountry(country: string | null | undefined): string {
  const creatorCountry = toCreatorCountryFromIntent(country);
  return resolveCreatorLocale({ target_country: creatorCountry }).currency;
}

export function nicheMatches(
  candidate: string | null | undefined,
  target: string | null | undefined
): boolean {
  if (!target?.trim()) return true;
  if (!candidate?.trim()) return false;
  const a = normalizeText(candidate);
  const b = normalizeText(target);
  return a.includes(b) || b.includes(a);
}

function extractCountryFromText(raw: string): string | null {
  const normalized = normalizeText(raw);
  for (const [alias, code] of Object.entries(COUNTRY_ALIASES)) {
    if (normalized.includes(alias)) return code;
  }
  return null;
}

function extractNicheFromText(raw: string, country: string | null): string | null {
  const patterns = [
    /(?:quero\s+)?vender\s+(.+?)(?:\s+nos?\s+|\s+no\s+|\s+em\s+|$)/i,
    /(?:nicho|mercado|segmento)\s+(?:de\s+)?(.+?)(?:\s+nos?\s+|\s+no\s+|\s+em\s+|$)/i,
  ];
  for (const pattern of patterns) {
    const match = raw.match(pattern);
    if (match?.[1]) {
      let niche = match[1].trim();
      if (country) {
        const countryWords = Object.keys(COUNTRY_ALIASES).filter((k) => COUNTRY_ALIASES[k] === country);
        for (const word of countryWords) {
          niche = niche.replace(new RegExp(`\\b${word}\\b`, "i"), "").trim();
        }
      }
      if (niche.length >= 3) return niche;
    }
  }
  return null;
}

function extractTicketFromText(raw: string): number | null {
  const match = raw.match(/(?:ticket|preco|preço|price)\s*(?:de\s+)?(?:r\$|\$|€)?\s*(\d+(?:[.,]\d+)?)/i);
  if (!match?.[1]) return null;
  const value = Number(match[1].replace(",", "."));
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function parseIntentFromText(raw: string): MasterFlowIntentInput {
  const country = extractCountryFromText(raw);
  const niche = extractNicheFromText(raw, country);
  const ticket = extractTicketFromText(raw);
  const language = normalizeMarketLanguage(null, country);
  return {
    raw: raw.trim(),
    niche,
    country,
    language,
    ticket,
    avatar: null,
  };
}

export function resolveMasterFlowIntent(input?: MasterFlowIntentInput | null): MasterFlowIntent {
  const parsed = input?.raw?.trim() ? parseIntentFromText(input.raw) : {};
  const merged: MasterFlowIntentInput = { ...parsed, ...input };

  const country = normalizeMarketCountry(merged.country);
  const language = normalizeMarketLanguage(merged.language, country ?? merged.country);

  const rawNiche = merged.niche?.trim() || parsed.niche?.trim() || null;

  return {
    niche: rawNiche,
    country,
    language,
    avatar: merged.avatar?.trim() || null,
    ticket: merged.ticket != null && merged.ticket > 0 ? merged.ticket : null,
    raw: merged.raw?.trim() || null,
  };
}

export function intentToMetadata(intent: MasterFlowIntent): MasterFlowMetadata {
  return {
    niche: intent.niche,
    country: intent.country,
    language: intent.language,
    avatar: intent.avatar,
    ticket: intent.ticket,
    user_intent: intent.raw,
  };
}

export function intentFromMetadata(meta: MasterFlowMetadata): MasterFlowIntent {
  return resolveMasterFlowIntent({
    niche: meta.niche,
    country: meta.country,
    language: meta.language,
    avatar: meta.avatar,
    ticket: meta.ticket,
    raw: meta.user_intent,
  });
}

export function hasActiveIntent(intent: MasterFlowIntent): boolean {
  return Boolean(
    intent.niche || intent.country || intent.language || intent.avatar || intent.ticket || intent.raw
  );
}

export function injectIntentCandidates(
  candidates: MarketCandidate[],
  intent: MasterFlowIntent
): MarketCandidate[] {
  if (!hasActiveIntent(intent)) return candidates;

  const next = [...candidates];

  if (intent.niche) {
    const hasNicheMatch = next.some((item) => nicheMatches(item.niche, intent.niche));
    if (!hasNicheMatch) {
      next.push({
        productName: `Programa de ${intent.niche}`,
        sourcePlatform: "master_flow_intent",
        niche: intent.niche,
        country: intent.country ?? "BR",
        language: intent.language ?? "pt-BR",
        currency: marketCurrencyForCountry(intent.country),
        estimatedDemand: 78,
        estimatedCompetition: 42,
        estimatedConversion: 0.045,
        metadata: { source: "master_flow_intent", injected: true },
      });
    }
  }

  const boosted = next.map((item) => {
    let bonus = 0;
    if (intent.niche && nicheMatches(item.niche ?? item.productName, intent.niche)) bonus += 18;
    if (intent.country && normalizeMarketCountry(item.country) === intent.country) bonus += 10;
    if (intent.language && item.language === intent.language) bonus += 6;
    if (bonus === 0) return item;
    return {
      ...item,
      estimatedDemand: Math.min(100, item.estimatedDemand + bonus * 0.6),
      metadata: { ...item.metadata, intentBoost: bonus },
    };
  });

  const ranked = rankProducts(boosted);
  if (!intent.niche) return ranked;

  const nicheMatchesList = ranked.filter((item) =>
    nicheMatches(item.niche ?? item.productName, intent.niche)
  );
  const rest = ranked.filter((item) => !nicheMatches(item.niche ?? item.productName, intent.niche));
  return [...nicheMatchesList, ...rest];
}

export function scopeMarketHunterDashboard(
  dashboard: MarketHunterDashboard,
  intent: MasterFlowIntent
): MarketHunterDashboard {
  if (!intent.niche?.trim()) return dashboard;

  const topOportunidades = dashboard.topOportunidades.filter((item) =>
    nicheMatches(item.niche ?? item.productName, intent.niche)
  );

  if (topOportunidades.length === 0) return dashboard;

  const bestProduct = topOportunidades[0] ?? dashboard.report.bestProduct;
  const avgScore =
    topOportunidades.reduce((sum, item) => sum + item.score, 0) / topOportunidades.length;

  return {
    ...dashboard,
    topOportunidades,
    scoreMedio: Math.round(avgScore * 100) / 100,
    totalOpportunities: topOportunidades.length,
    report: {
      ...dashboard.report,
      bestProduct,
      topRecommendation: bestProduct?.recommendation ?? dashboard.report.topRecommendation,
      totalOpportunities: topOportunidades.length,
      avgScore: Math.round(avgScore * 100) / 100,
    },
  };
}

export function buildIntentCandidate(intent: MasterFlowIntent): MarketCandidate | null {
  if (!intent.niche?.trim()) return null;
  return {
    productName: `Programa de ${intent.niche}`,
    sourcePlatform: "master_flow_intent",
    niche: intent.niche,
    country: intent.country ?? "BR",
    language: intent.language ?? "pt-BR",
    currency: marketCurrencyForCountry(intent.country),
    estimatedDemand: 78,
    estimatedCompetition: 42,
    estimatedConversion: 0.045,
    metadata: { source: "master_flow_intent" },
  };
}

export function scoreIntentCandidate(intent: MasterFlowIntent): number {
  const candidate = buildIntentCandidate(intent);
  return candidate ? computeOpportunityScore(candidate) : 0;
}
