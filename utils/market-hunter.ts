import type { MarketOpportunity, MarketWatchlist } from "@/types/database";

export type MarketCandidate = {
  productName: string;
  sourcePlatform: string;
  niche: string | null;
  country: string | null;
  language: string | null;
  currency: string;
  estimatedDemand: number;
  estimatedCompetition: number;
  estimatedConversion: number;
  metadata?: Record<string, unknown>;
};

export type MarketBestCard = {
  label: string;
  score: number;
  recommendation: string | null;
  productName: string | null;
};

export type MarketOpportunityItem = {
  id: string;
  productName: string;
  sourcePlatform: string | null;
  niche: string | null;
  country: string | null;
  score: number;
  recommendation: string | null;
};

export type MarketOpportunityReport = {
  topRecommendation: string;
  summary: string;
  bestProduct: MarketOpportunityItem | null;
  totalOpportunities: number;
  avgScore: number;
};

export type MarketHunterDashboard = {
  topOportunidades: MarketOpportunityItem[];
  melhorNicho: MarketBestCard | null;
  melhorPais: MarketBestCard | null;
  melhorMoeda: MarketBestCard | null;
  melhorPlataforma: MarketBestCard | null;
  scoreMedio: number;
  totalOpportunities: number;
  watchlist: MarketWatchlist[];
  report: MarketOpportunityReport;
};

export function computeOpportunityScore(candidate: MarketCandidate): number {
  const demand = Math.min(100, Math.max(0, candidate.estimatedDemand));
  const competition = Math.min(100, Math.max(0, candidate.estimatedCompetition));
  const conversion = Math.min(1, Math.max(0, candidate.estimatedConversion));

  const demandScore = demand * 0.35;
  const competitionScore = (100 - competition) * 0.25;
  const conversionScore = conversion * 100 * 0.25;
  const platformBonus =
    candidate.sourcePlatform === "kiwify"
      ? 8
      : candidate.sourcePlatform === "revenue_ai"
        ? 6
        : candidate.sourcePlatform === "growth_brain"
          ? 5
          : candidate.sourcePlatform === "operation_center"
            ? 7
            : 3;

  return Math.round((demandScore + competitionScore + conversionScore + platformBonus) * 100) / 100;
}

export function rankProducts(candidates: MarketCandidate[]): MarketCandidate[] {
  return [...candidates].sort(
    (a, b) => computeOpportunityScore(b) - computeOpportunityScore(a)
  );
}

function pickBestGrouped(
  opportunities: MarketOpportunity[],
  keyFn: (item: MarketOpportunity) => string | null
): MarketBestCard | null {
  const groups = new Map<string, MarketOpportunity[]>();

  for (const item of opportunities) {
    const key = keyFn(item);
    if (!key) continue;
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  }

  if (groups.size === 0) return null;

  let bestKey = "";
  let bestScore = -Infinity;
  let bestItem: MarketOpportunity | null = null;

  for (const [key, list] of groups) {
    const avgScore =
      list.reduce((sum, item) => sum + Number(item.opportunity_score ?? 0), 0) / list.length;
    if (avgScore > bestScore) {
      bestScore = avgScore;
      bestKey = key;
      bestItem =
        list.sort(
          (a, b) => Number(b.opportunity_score ?? 0) - Number(a.opportunity_score ?? 0)
        )[0] ?? null;
    }
  }

  if (!bestItem) return null;

  return {
    label: bestKey,
    score: Math.round(bestScore),
    recommendation: bestItem.recommendation,
    productName: bestItem.product_name,
  };
}

function toOpportunityItem(item: MarketOpportunity): MarketOpportunityItem {
  return {
    id: item.id,
    productName: item.product_name,
    sourcePlatform: item.source_platform,
    niche: item.niche,
    country: item.country,
    score: Number(item.opportunity_score ?? 0),
    recommendation: item.recommendation,
  };
}

export function generateOpportunityReport(
  opportunities: MarketOpportunity[]
): MarketOpportunityReport {
  const sorted = [...opportunities].sort(
    (a, b) => Number(b.opportunity_score ?? 0) - Number(a.opportunity_score ?? 0)
  );
  const best = sorted[0] ?? null;
  const avgScore =
    opportunities.length > 0
      ? opportunities.reduce((sum, item) => sum + Number(item.opportunity_score ?? 0), 0) /
        opportunities.length
      : 0;

  const topRecommendation = best
    ? `Venda agora: ${best.product_name} (${best.source_platform ?? "mercado"}) — score ${Math.round(Number(best.opportunity_score ?? 0))}`
    : "Conecte Kiwify, Revenue AI ou Growth Brain para descobrir oportunidades.";

  const summary = best
    ? `${best.product_name} lidera com score ${Math.round(Number(best.opportunity_score ?? 0))}. ${best.recommendation ?? "Valide demanda e prepare operação no Operation Center."}`
    : "Nenhuma oportunidade identificada ainda. Execute uma análise de mercado.";

  return {
    topRecommendation,
    summary,
    bestProduct: best ? toOpportunityItem(best) : null,
    totalOpportunities: opportunities.length,
    avgScore: Math.round(avgScore * 100) / 100,
  };
}

export function computeMarketHunterDashboard(
  opportunities: MarketOpportunity[],
  watchlist: MarketWatchlist[]
): MarketHunterDashboard {
  const sorted = [...opportunities].sort(
    (a, b) => Number(b.opportunity_score ?? 0) - Number(a.opportunity_score ?? 0)
  );
  const scores = opportunities.map((item) => Number(item.opportunity_score ?? 0));
  const scoreMedio =
    scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

  return {
    topOportunidades: sorted.slice(0, 5).map(toOpportunityItem),
    melhorNicho: pickBestGrouped(opportunities, (item) => item.niche),
    melhorPais: pickBestGrouped(opportunities, (item) => item.country),
    melhorMoeda: pickBestGrouped(opportunities, (item) => item.currency),
    melhorPlataforma: pickBestGrouped(opportunities, (item) => item.source_platform),
    scoreMedio: Math.round(scoreMedio * 100) / 100,
    totalOpportunities: opportunities.length,
    watchlist,
    report: generateOpportunityReport(opportunities),
  };
}

export function buildMarketHunterAuraContext(dashboard: MarketHunterDashboard): string {
  const lines = [
    "## MARKET HUNTER",
    `Oportunidades identificadas: ${dashboard.totalOpportunities}`,
    dashboard.scoreMedio > 0 ? `Score médio: ${dashboard.scoreMedio.toFixed(1)}` : null,
    dashboard.report.topRecommendation,
    dashboard.melhorPlataforma
      ? `Melhor plataforma: ${dashboard.melhorPlataforma.label} (score ${dashboard.melhorPlataforma.score})`
      : null,
    dashboard.melhorNicho ? `Melhor nicho: ${dashboard.melhorNicho.label}` : null,
    dashboard.topOportunidades[0]
      ? `Top oportunidade: ${dashboard.topOportunidades[0].productName} — ${dashboard.topOportunidades[0].recommendation ?? "sem recomendação"}`
      : null,
  ].filter(Boolean);

  return lines.join("\n");
}
