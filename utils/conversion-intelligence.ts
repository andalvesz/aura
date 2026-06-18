import type { ConversionInsight, Json } from "@/types/database";

export const CONVERSION_INTELLIGENCE_SAFE_MODE = {
  active: true,
  message:
    "Conversion Intelligence analisa padrões reais e estimados — recomendações exigem validação antes de escalar.",
};

export type ConversionPatternType =
  | "headline"
  | "creative"
  | "landing"
  | "offer"
  | "country"
  | "language"
  | "funnel_structure"
  | "campaign"
  | "general";

export type ConversionPatternOutcome = "winning" | "losing";

export type ConversionSignal = {
  source:
    | "growth_brain"
    | "revenue_ai"
    | "funnel_analytics"
    | "performance_ai"
    | "market_hunter"
    | "decision_engine";
  patternType: ConversionPatternType;
  label: string;
  funnelId?: string | null;
  productId?: string | null;
  offerId?: string | null;
  landingId?: string | null;
  creativeId?: string | null;
  campaignId?: string | null;
  country?: string | null;
  language?: string | null;
  conversionRate?: number | null;
  ctr?: number | null;
  cpc?: number | null;
  cpa?: number | null;
  roas?: number | null;
  revenue?: number | null;
  spend?: number | null;
  score: number;
  outcome: ConversionPatternOutcome;
  insight: string;
  recommendation: string;
  metadata?: Record<string, unknown>;
};

export type ConversionBestCard = {
  label: string;
  score: number;
  conversionRate: number | null;
  roas: number | null;
  insight: string | null;
  recommendation: string | null;
  entityId: string | null;
};

export type ConversionIntelligenceDashboard = {
  melhorHeadline: ConversionBestCard | null;
  melhorCriativo: ConversionBestCard | null;
  melhorLanding: ConversionBestCard | null;
  melhorOferta: ConversionBestCard | null;
  melhorPais: ConversionBestCard | null;
  melhorIdioma: ConversionBestCard | null;
  melhorEstruturaFunil: ConversionBestCard | null;
  totalInsights: number;
  winningPatterns: number;
  losingPatterns: number;
  avgConfidence: number;
  whyConverted: string | null;
  whyNotConverted: string | null;
};

export type ConversionAnalysisResult = {
  dashboard: ConversionIntelligenceDashboard;
  insights: ConversionInsight[];
  winningPatterns: ConversionSignal[];
  losingPatterns: ConversionSignal[];
  recommendations: ConversionRecommendation[];
};

export type ConversionRecommendation = {
  id: string;
  title: string;
  action: string;
  priority: "high" | "medium" | "low";
  confidence: number;
  patternType: ConversionPatternType;
};

export type ConversionIntelligenceIntake = {
  funnel_id?: string | null;
  product_id?: string | null;
  force_refresh?: boolean;
};

const WINNING_THRESHOLD = 55;
const LOSING_THRESHOLD = 35;

export function computeSignalScore(signal: Pick<
  ConversionSignal,
  "conversionRate" | "ctr" | "roas" | "revenue" | "spend" | "score"
>): number {
  const conversion = Number(signal.conversionRate ?? 0);
  const ctr = Number(signal.ctr ?? 0);
  const roas = Number(signal.roas ?? 0);
  const revenue = Number(signal.revenue ?? 0);
  const spend = Number(signal.spend ?? 0);
  const roiFactor = spend > 0 ? revenue / spend : revenue > 0 ? 1 : 0;

  const computed =
    signal.score > 0
      ? signal.score
      : roas * 35 + conversion * 120 + ctr * 800 + roiFactor * 15;

  return Math.round(Math.min(Math.max(computed, 0), 100) * 100) / 100;
}

export function calculateConfidence(params: {
  signal: ConversionSignal;
  sourceCount: number;
  dataPoints: number;
  hasRealMetrics: boolean;
}): number {
  const { signal, sourceCount, dataPoints, hasRealMetrics } = params;
  let confidence = 40;

  const score = computeSignalScore(signal);
  confidence += Math.min(score * 0.35, 28);

  if (hasRealMetrics) confidence += 12;
  if (sourceCount >= 2) confidence += 8;
  if (sourceCount >= 4) confidence += 6;
  if (dataPoints >= 5) confidence += 6;
  if (dataPoints >= 15) confidence += 4;

  if (signal.conversionRate != null && signal.conversionRate > 0) confidence += 4;
  if (signal.roas != null && signal.roas >= 1.5) confidence += 4;

  if (signal.source === "revenue_ai" || signal.source === "growth_brain") confidence += 3;

  return Math.round(Math.min(Math.max(confidence, 15), 98) * 100) / 100;
}

export function identifyWinningPatterns(signals: ConversionSignal[]): ConversionSignal[] {
  return signals
    .filter((signal) => {
      const score = computeSignalScore(signal);
      return signal.outcome === "winning" || score >= WINNING_THRESHOLD;
    })
    .sort((a, b) => computeSignalScore(b) - computeSignalScore(a));
}

export function identifyLosingPatterns(signals: ConversionSignal[]): ConversionSignal[] {
  return signals
    .filter((signal) => {
      const score = computeSignalScore(signal);
      return signal.outcome === "losing" || score <= LOSING_THRESHOLD;
    })
    .sort((a, b) => computeSignalScore(a) - computeSignalScore(b));
}

export function generateRecommendations(params: {
  winning: ConversionSignal[];
  losing: ConversionSignal[];
}): ConversionRecommendation[] {
  const recommendations: ConversionRecommendation[] = [];

  for (const winner of params.winning.slice(0, 3)) {
    recommendations.push({
      id: `win-${winner.patternType}-${winner.label.slice(0, 12)}`,
      title: `Escalar: ${winner.label}`,
      action: winner.recommendation,
      priority: "high",
      confidence: calculateConfidence({
        signal: winner,
        sourceCount: 1,
        dataPoints: params.winning.length,
        hasRealMetrics: Boolean(winner.conversionRate && winner.revenue),
      }),
      patternType: winner.patternType,
    });
  }

  for (const loser of params.losing.slice(0, 3)) {
    recommendations.push({
      id: `fix-${loser.patternType}-${loser.label.slice(0, 12)}`,
      title: `Corrigir: ${loser.label}`,
      action: loser.recommendation,
      priority: loser.patternType === "landing" || loser.patternType === "offer" ? "high" : "medium",
      confidence: calculateConfidence({
        signal: loser,
        sourceCount: 1,
        dataPoints: params.losing.length,
        hasRealMetrics: Boolean(loser.spend && loser.spend > 0),
      }),
      patternType: loser.patternType,
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      id: "baseline-analyze",
      title: "Coletar mais dados",
      action: "Registre resultados no Growth Brain e Revenue AI para gerar padrões confiáveis.",
      priority: "medium",
      confidence: 45,
      patternType: "general",
    });
  }

  return recommendations;
}

function pickBestByType(
  insights: ConversionInsight[],
  patternType: ConversionPatternType
): ConversionBestCard | null {
  const matches = insights.filter((row) => readPatternType(row) === patternType);
  if (matches.length === 0) return null;

  const best = matches.reduce((acc, item) =>
    Number(item.confidence_score ?? 0) > Number(acc.confidence_score ?? 0) ? item : acc
  );

  return insightToBestCard(best, patternType);
}

function readPatternType(insight: ConversionInsight): ConversionPatternType {
  if (!insight.metadata || typeof insight.metadata !== "object" || Array.isArray(insight.metadata)) {
    return "general";
  }
  const patternType = (insight.metadata as Record<string, unknown>).pattern_type;
  if (typeof patternType === "string") return patternType as ConversionPatternType;
  return "general";
}

function insightToBestCard(
  insight: ConversionInsight,
  patternType: ConversionPatternType
): ConversionBestCard {
  const meta =
    insight.metadata && typeof insight.metadata === "object" && !Array.isArray(insight.metadata)
      ? (insight.metadata as Record<string, unknown>)
      : {};

  const entityId =
    patternType === "headline"
      ? insight.product_id
      : patternType === "creative"
        ? insight.creative_id
        : patternType === "landing"
          ? insight.landing_id
          : patternType === "offer"
            ? insight.offer_id
            : patternType === "funnel_structure"
              ? insight.funnel_id
              : patternType === "country"
                ? insight.country
                : patternType === "language"
                  ? insight.language
                  : insight.campaign_id;

  return {
    label: typeof meta.label === "string" ? meta.label : insight.insight?.slice(0, 80) ?? "—",
    score: Number(insight.confidence_score ?? 0),
    conversionRate: insight.conversion_rate != null ? Number(insight.conversion_rate) : null,
    roas: insight.roas != null ? Number(insight.roas) : null,
    insight: insight.insight,
    recommendation: insight.recommendation,
    entityId: entityId ? String(entityId) : null,
  };
}

export function computeConversionIntelligenceDashboard(params: {
  insights: ConversionInsight[];
  winning: ConversionSignal[];
  losing: ConversionSignal[];
}): ConversionIntelligenceDashboard {
  const { insights, winning, losing } = params;

  const avgConfidence =
    insights.length > 0
      ? Math.round(
          (insights.reduce((acc, row) => acc + Number(row.confidence_score ?? 0), 0) / insights.length) *
            100
        ) / 100
      : 0;

  const topWinner = winning[0] ?? null;
  const topLoser = losing[0] ?? null;

  return {
    melhorHeadline: pickBestByType(insights, "headline"),
    melhorCriativo: pickBestByType(insights, "creative"),
    melhorLanding: pickBestByType(insights, "landing"),
    melhorOferta: pickBestByType(insights, "offer"),
    melhorPais: pickBestByType(insights, "country"),
    melhorIdioma: pickBestByType(insights, "language"),
    melhorEstruturaFunil: pickBestByType(insights, "funnel_structure"),
    totalInsights: insights.length,
    winningPatterns: winning.length,
    losingPatterns: losing.length,
    avgConfidence,
    whyConverted: topWinner
      ? `${topWinner.label}: ${topWinner.insight}`
      : insights.find((row) => readPatternType(row) !== "general")?.insight ?? null,
    whyNotConverted: topLoser
      ? `${topLoser.label}: ${topLoser.insight}`
      : losing[0]?.insight ?? null,
  };
}

export function mergeConversionInsightMetadata(
  current: Json,
  patch: Record<string, unknown>
): Json {
  const base =
    current && typeof current === "object" && !Array.isArray(current)
      ? (current as Record<string, unknown>)
      : {};
  return { ...base, ...patch } as Json;
}

export function buildConversionIntelligenceAuraContext(
  dashboard: ConversionIntelligenceDashboard
): string {
  const lines = [
    "Conversion Intelligence V1",
    `Insights: ${dashboard.totalInsights} · Confiança média ${dashboard.avgConfidence}%`,
    `Vencedores: ${dashboard.winningPatterns} · Perdedores: ${dashboard.losingPatterns}`,
    dashboard.whyConverted ? `Por que converteu: ${dashboard.whyConverted}` : null,
    dashboard.whyNotConverted ? `Por que não converteu: ${dashboard.whyNotConverted}` : null,
    dashboard.melhorLanding ? `Melhor landing: ${dashboard.melhorLanding.label}` : null,
    dashboard.melhorOferta ? `Melhor oferta: ${dashboard.melhorOferta.label}` : null,
    dashboard.melhorEstruturaFunil
      ? `Melhor funil: ${dashboard.melhorEstruturaFunil.label}`
      : null,
  ].filter(Boolean);

  return lines.join("\n");
}

export function formatConversionPct(rate: number | null | undefined): string {
  if (rate == null || !Number.isFinite(Number(rate))) return "—";
  const normalized = Number(rate) > 1 ? Number(rate) / 100 : Number(rate);
  return `${Math.round(normalized * 1000) / 10}%`;
}
