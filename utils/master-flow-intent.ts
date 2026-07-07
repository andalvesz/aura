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

const AMBIGUOUS_COUNTRY_TOKENS = new Set(["de", "es", "fr", "ca", "pt", "br", "us"]);

const COUNTRY_TEXT_PATTERNS: Array<{ pattern: RegExp; code: string }> = [
  { pattern: /\b(?:mercado\s+americano|mercado\s+dos?\s+eua)\b/i, code: "US" },
  { pattern: /\b(?:nos?|nas?|no|na|em)\s+(?:eua|usa|estados\s+unidos|united\s+states)\b/i, code: "US" },
  { pattern: /\b(?:eua|usa|estados\s+unidos|united\s+states)\b/i, code: "US" },
  { pattern: /\bmercado\s+espanhol\b/i, code: "ES" },
  { pattern: /\b(?:nos?|nas?|no|na|em)\s+(?:espanha|spain)\b/i, code: "ES" },
  { pattern: /\b(?:espanha|spain)\b/i, code: "ES" },
  { pattern: /\b(?:nos?|nas?|no|na|em)\s+(?:brasil|brazil)\b/i, code: "BR" },
  { pattern: /\b(?:brasil|brazil)\b/i, code: "BR" },
  { pattern: /\b(?:nos?|nas?|no|na|em)\s+(?:portugal)\b/i, code: "PT" },
  { pattern: /\bportugal\b/i, code: "PT" },
  { pattern: /\b(?:nos?|nas?|no|na|em)\s+(?:canada|canadá)\b/i, code: "CA" },
  { pattern: /\b(?:canada|canadá)\b/i, code: "CA" },
  { pattern: /\b(?:nos?|nas?|no|na|em)\s+(?:reino\s+unido|united\s+kingdom)\b/i, code: "GB" },
  { pattern: /\b(?:reino\s+unido|united\s+kingdom)\b/i, code: "GB" },
  { pattern: /\b(?:nos?|nas?|no|na|em)\s+(?:alemanha|germany)\b/i, code: "DE" },
  { pattern: /\b(?:alemanha|germany)\b/i, code: "DE" },
  { pattern: /\b(?:nos?|nas?|no|na|em)\s+(?:franca|frança|france)\b/i, code: "FR" },
  { pattern: /\b(?:franca|frança|france)\b/i, code: "FR" },
];

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchesCountryAlias(normalized: string, alias: string): boolean {
  if (AMBIGUOUS_COUNTRY_TOKENS.has(alias) && !alias.includes(" ")) {
    return false;
  }
  if (alias.includes(" ")) {
    return normalized.includes(alias);
  }
  return new RegExp(`\\b${escapeRegex(alias)}\\b`, "i").test(normalized);
}

export function normalizeMarketCountry(input: string | null | undefined): string | null {
  if (!input?.trim()) return null;
  const key = normalizeText(input);
  if (COUNTRY_ALIASES[key]) return COUNTRY_ALIASES[key];
  const upper = input.trim().toUpperCase();
  if (upper.length === 2 && MARKET_TO_CREATOR_COUNTRY[upper]) return upper;
  for (const [alias, code] of Object.entries(COUNTRY_ALIASES)) {
    if (matchesCountryAlias(key, alias)) return code;
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
  for (const { pattern, code } of COUNTRY_TEXT_PATTERNS) {
    if (pattern.test(raw)) return code;
  }

  const normalized = normalizeText(raw);
  if (/\b(?:us|usa|eua)\b/i.test(normalized)) return "US";

  for (const [alias, code] of Object.entries(COUNTRY_ALIASES)) {
    if (matchesCountryAlias(normalized, alias)) return code;
  }
  return null;
}

function isPortuguesePhrase(raw: string): boolean {
  const normalized = normalizeText(raw);
  if (/[áéíóúãõç]/i.test(raw)) return true;
  return /\b(?:quero|criar|negocio|produto|vender|nicho|para|mulheres|mercado|curso|programa)\b/.test(
    normalized
  );
}

function extractAvatarFromText(raw: string): string | null {
  const match = raw.match(/\bpara\s+(.+?)$/i);
  if (!match?.[1]) return null;
  const avatar = match[1].trim();
  return avatar.length >= 2 ? avatar : null;
}

const NICHE_STOP_PATTERN = /\s+(?:para|nos?|nas?|no|na|em)\s+/i;

function stripCountryFromNiche(niche: string, country: string | null): string {
  let next = niche.trim();
  if (country) {
    const countryWords = Object.keys(COUNTRY_ALIASES).filter((k) => COUNTRY_ALIASES[k] === country);
    for (const word of countryWords) {
      if (AMBIGUOUS_COUNTRY_TOKENS.has(word)) continue;
      next = next.replace(new RegExp(`\\b${escapeRegex(word)}\\b`, "i"), "").trim();
    }
  }
  return next.replace(/^(?:de|sobre)\s+/i, "").trim();
}

function extractNicheFromText(raw: string, country: string | null): string | null {
  const patterns = [
    /(?:quero\s+)?(?:criar\s+(?:um\s+)?(?:negocio|negócio)\s+de\s+)(.+)$/i,
    /(?:negocio|negócio)\s+de\s+(.+)$/i,
    /(?:produto|curso|programa|método|metodo)\s+de\s+(.+)$/i,
    /(?:quero\s+)?vender\s+(.+)$/i,
    /(?:nicho|mercado|segmento)\s+(?:de\s+)?(.+)$/i,
  ];

  for (const pattern of patterns) {
    const match = raw.match(pattern);
    if (!match?.[1]) continue;

    let niche = match[1].trim();
    const stopMatch = niche.match(NICHE_STOP_PATTERN);
    if (stopMatch?.index != null && stopMatch.index > 0) {
      niche = niche.slice(0, stopMatch.index).trim();
    }

    niche = stripCountryFromNiche(niche, country);
    if (niche.length >= 2) return niche;
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
  const trimmed = raw.trim();
  const country = extractCountryFromText(trimmed) ?? (isPortuguesePhrase(trimmed) ? "BR" : null);
  const avatar = extractAvatarFromText(trimmed);
  const niche = extractNicheFromText(trimmed, country);
  const ticket = extractTicketFromText(trimmed);
  const language = normalizeMarketLanguage(null, country);
  return {
    raw: trimmed,
    niche,
    country,
    language,
    ticket,
    avatar,
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
