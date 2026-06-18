import type { GrowthBrainDashboard } from "@/utils/growth-brain";
import type { MarketHunterDashboard } from "@/utils/market-hunter";
import type { OperationCenterDashboard } from "@/utils/operation-center";
import type {
  PerformanceAiAnalysis,
  PerformanceDashboardMetrics,
  PerformanceExecutiveMemory,
  PerformancePanel,
} from "@/utils/performance";
import type { RevenueAiDashboard } from "@/utils/revenue-ai";

export type DecisionSource =
  | "growth_brain"
  | "revenue_ai"
  | "market_hunter"
  | "operation_center"
  | "performance_ai";

export type UnifiedDecision = {
  label: string;
  score: number;
  source: DecisionSource;
  reason: string;
  entityId: string | null;
  metadata: Record<string, unknown>;
};

export type DecisionEngineInput = {
  growthBrain: GrowthBrainDashboard | null;
  revenueAi: RevenueAiDashboard | null;
  marketHunter: MarketHunterDashboard | null;
  operationCenter: OperationCenterDashboard | null;
  performance: {
    dashboard: PerformanceDashboardMetrics | null;
    panel: PerformancePanel | null;
    analysis: PerformanceAiAnalysis | null;
    executiveMemory: PerformanceExecutiveMemory | null;
  } | null;
};

export type UnifiedDecisionEngineResult = {
  bestProduct: UnifiedDecision | null;
  bestCountry: UnifiedDecision | null;
  bestLanguage: UnifiedDecision | null;
  bestOffer: UnifiedDecision | null;
  bestCreative: UnifiedDecision | null;
  bestLanding: UnifiedDecision | null;
  bestCampaign: UnifiedDecision | null;
  sourcesUsed: DecisionSource[];
  confidence: number;
};

const SOURCE_WEIGHT: Record<DecisionSource, number> = {
  growth_brain: 1.0,
  revenue_ai: 1.1,
  market_hunter: 1.2,
  operation_center: 1.15,
  performance_ai: 1.05,
};

function weightedScore(source: DecisionSource, score: number): number {
  return Math.round(score * SOURCE_WEIGHT[source] * 100) / 100;
}

function pickBest(candidates: UnifiedDecision[]): UnifiedDecision | null {
  if (candidates.length === 0) return null;
  return candidates.reduce((best, item) => (item.score > best.score ? item : best));
}

function candidate(
  label: string,
  score: number,
  source: DecisionSource,
  reason: string,
  entityId: string | null = null,
  metadata: Record<string, unknown> = {}
): UnifiedDecision | null {
  if (!label.trim() || score <= 0) return null;
  return {
    label: label.trim(),
    score: weightedScore(source, score),
    source,
    reason,
    entityId,
    metadata,
  };
}

export function selectBestProduct(input: DecisionEngineInput): UnifiedDecision | null {
  const candidates: UnifiedDecision[] = [];

  if (input.growthBrain?.melhorCampanha) {
    const card = input.growthBrain.melhorCampanha;
    const c = candidate(
      card.label,
      card.score,
      "growth_brain",
      card.recommendation ?? "Melhor campanha no Growth Brain",
      card.entityId
    );
    if (c) candidates.push(c);
  }

  if (input.revenueAi?.melhorProduto) {
    const card = input.revenueAi.melhorProduto;
    const c = candidate(
      card.label,
      card.value > 0 ? Math.min(100, card.value / 10) : 50,
      "revenue_ai",
      `Melhor produto por receita (${card.currency})`,
      null,
      { roas: card.roas, roi: card.roi }
    );
    if (c) candidates.push(c);
  }

  if (input.marketHunter?.report.bestProduct) {
    const item = input.marketHunter.report.bestProduct;
    const c = candidate(
      item.productName,
      item.score,
      "market_hunter",
      item.recommendation ?? "Top oportunidade do Market Hunter",
      item.id
    );
    if (c) candidates.push(c);
  }

  for (const item of input.marketHunter?.topOportunidades.slice(0, 3) ?? []) {
    const c = candidate(
      item.productName,
      item.score,
      "market_hunter",
      item.recommendation ?? "Oportunidade de mercado identificada",
      item.id
    );
    if (c) candidates.push(c);
  }

  if (input.operationCenter?.productName) {
    const score = input.operationCenter.operationalScore ?? 50;
    const c = candidate(
      input.operationCenter.productName,
      score,
      "operation_center",
      "Produto ativo no Operation Center",
      input.operationCenter.operation?.product_id ?? null,
      { operationId: input.operationCenter.operation?.id }
    );
    if (c) candidates.push(c);
  }

  if (input.performance?.panel?.melhorProjeto) {
    const c = candidate(
      input.performance.panel.melhorProjeto,
      input.performance.dashboard?.scorePerformance ?? 55,
      "performance_ai",
      "Melhor projeto segundo Performance AI"
    );
    if (c) candidates.push(c);
  }

  if (input.performance?.analysis?.maiorPotencial) {
    const c = candidate(
      input.performance.analysis.maiorPotencial,
      (input.performance.dashboard?.scorePerformance ?? 50) + 5,
      "performance_ai",
      "Maior potencial identificado pela Performance AI"
    );
    if (c) candidates.push(c);
  }

  const topProduct = input.performance?.executiveMemory?.produtosBons[0];
  if (topProduct) {
    const c = candidate(topProduct, 60, "performance_ai", "Produto vencedor na memória executiva");
    if (c) candidates.push(c);
  }

  return pickBest(candidates);
}

export function selectBestCountry(input: DecisionEngineInput): UnifiedDecision | null {
  const candidates: UnifiedDecision[] = [];

  if (input.growthBrain?.melhorPais) {
    const card = input.growthBrain.melhorPais;
    const c = candidate(
      card.label,
      card.score,
      "growth_brain",
      card.recommendation ?? "Melhor país no Growth Brain"
    );
    if (c) candidates.push(c);
  }

  if (input.revenueAi?.melhorPais) {
    const card = input.revenueAi.melhorPais;
    const c = candidate(
      card.label,
      card.value > 0 ? Math.min(100, card.value / 10) : 50,
      "revenue_ai",
      "Melhor país por receita"
    );
    if (c) candidates.push(c);
  }

  if (input.marketHunter?.melhorPais) {
    const card = input.marketHunter.melhorPais;
    const c = candidate(
      card.label,
      card.score,
      "market_hunter",
      card.recommendation ?? "Melhor país no Market Hunter"
    );
    if (c) candidates.push(c);
  }

  return pickBest(candidates);
}

export function selectBestLanguage(input: DecisionEngineInput): UnifiedDecision | null {
  const candidates: UnifiedDecision[] = [];

  if (input.growthBrain?.melhorIdioma) {
    const card = input.growthBrain.melhorIdioma;
    const c = candidate(
      card.label,
      card.score,
      "growth_brain",
      card.recommendation ?? "Melhor idioma no Growth Brain"
    );
    if (c) candidates.push(c);
  }

  for (const item of input.marketHunter?.topOportunidades ?? []) {
    if (!item.country) continue;
    const c = candidate(
      item.country === "BR" ? "pt-BR" : item.country === "US" ? "en-US" : item.country,
      item.score * 0.8,
      "market_hunter",
      `Idioma inferido da oportunidade ${item.productName}`
    );
    if (c) candidates.push(c);
  }

  return pickBest(candidates);
}

export function selectBestOffer(input: DecisionEngineInput): UnifiedDecision | null {
  const candidates: UnifiedDecision[] = [];

  if (input.operationCenter?.productName) {
    const score = input.operationCenter.operationalScore ?? 50;
    const c = candidate(
      input.operationCenter.productName,
      score,
      "operation_center",
      "Oferta ativa preparada no Operation Center",
      input.operationCenter.operation?.product_id ?? null
    );
    if (c) candidates.push(c);
  }

  if (input.revenueAi?.melhorProduto) {
    const card = input.revenueAi.melhorProduto;
    const c = candidate(
      card.label,
      card.roas != null ? Math.min(100, card.roas * 25) : 50,
      "revenue_ai",
      "Oferta com melhor ROAS"
    );
    if (c) candidates.push(c);
  }

  if (input.marketHunter?.topOportunidades[0]) {
    const item = input.marketHunter.topOportunidades[0];
    const c = candidate(
      item.productName,
      item.score,
      "market_hunter",
      item.recommendation ?? "Melhor oferta por oportunidade de mercado",
      item.id
    );
    if (c) candidates.push(c);
  }

  if (input.growthBrain?.melhorLanding) {
    const card = input.growthBrain.melhorLanding;
    const c = candidate(
      card.label,
      card.score,
      "growth_brain",
      "Oferta associada à melhor landing"
    );
    if (c) candidates.push(c);
  }

  return pickBest(candidates);
}

export function selectBestCreative(input: DecisionEngineInput): UnifiedDecision | null {
  const candidates: UnifiedDecision[] = [];

  if (input.growthBrain?.melhorCriativo) {
    const card = input.growthBrain.melhorCriativo;
    const c = candidate(
      card.label,
      card.score,
      "growth_brain",
      card.recommendation ?? "Melhor criativo no Growth Brain",
      card.entityId
    );
    if (c) candidates.push(c);
  }

  if (input.operationCenter?.creativeDirector?.ready) {
    const cd = input.operationCenter.creativeDirector;
    const score = cd.creativeScore?.overall ?? input.operationCenter.operationalScore ?? 50;
    const c = candidate(
      `Criativos Operation Center (${cd.assetCount} assets)`,
      score,
      "operation_center",
      "Creative Director pronto na operação ativa",
      input.operationCenter.operation?.assets_id ?? null,
      { downloadUrl: cd.downloadUrl }
    );
    if (c) candidates.push(c);
  }

  if (input.performance?.analysis?.oQueFunciona) {
    const c = candidate(
      "Criativo validado por Performance AI",
      input.performance.dashboard?.scorePerformance ?? 55,
      "performance_ai",
      input.performance.analysis.oQueFunciona.slice(0, 120)
    );
    if (c) candidates.push(c);
  }

  return pickBest(candidates);
}

export function selectBestLanding(input: DecisionEngineInput): UnifiedDecision | null {
  const candidates: UnifiedDecision[] = [];

  if (input.growthBrain?.melhorLanding) {
    const card = input.growthBrain.melhorLanding;
    const c = candidate(
      card.label,
      card.score,
      "growth_brain",
      card.recommendation ?? "Melhor landing no Growth Brain",
      card.entityId
    );
    if (c) candidates.push(c);
  }

  if (input.operationCenter?.landingPage) {
    const landing = input.operationCenter.landingPage;
    const c = candidate(
      landing.title ?? landing.slug,
      input.operationCenter.operationalScore ?? 50,
      "operation_center",
      "Landing ativa no Operation Center",
      landing.id,
      { slug: landing.slug, previewUrl: landing.previewUrl }
    );
    if (c) candidates.push(c);
  }

  return pickBest(candidates);
}

export function selectBestCampaign(input: DecisionEngineInput): UnifiedDecision | null {
  const candidates: UnifiedDecision[] = [];

  if (input.growthBrain?.melhorCampanha) {
    const card = input.growthBrain.melhorCampanha;
    const c = candidate(
      card.label,
      card.score,
      "growth_brain",
      card.recommendation ?? "Melhor campanha no Growth Brain",
      card.entityId,
      { roas: card.metrics.roas, ctr: card.metrics.ctr }
    );
    if (c) candidates.push(c);
  }

  const topCampaign = input.performance?.executiveMemory?.campanhasBoas[0];
  if (topCampaign) {
    const c = candidate(
      topCampaign,
      input.performance?.dashboard?.scorePerformance ?? 60,
      "performance_ai",
      "Campanha vencedora na memória executiva"
    );
    if (c) candidates.push(c);
  }

  if (input.operationCenter?.operation?.orchestration_id) {
    const c = candidate(
      input.operationCenter.operation.titulo ?? "Campanha da operação ativa",
      input.operationCenter.operationalScore ?? 50,
      "operation_center",
      "Campanha preparada no Operation Center",
      input.operationCenter.operation.orchestration_id
    );
    if (c) candidates.push(c);
  }

  if (input.revenueAi?.melhorPlataforma) {
    const card = input.revenueAi.melhorPlataforma;
    const c = candidate(
      `Campanha ${card.label}`,
      card.roas != null ? Math.min(100, card.roas * 25) : 50,
      "revenue_ai",
      "Melhor plataforma por receita de campanha"
    );
    if (c) candidates.push(c);
  }

  return pickBest(candidates);
}

export function computeUnifiedDecisions(input: DecisionEngineInput): UnifiedDecisionEngineResult {
  const sourcesUsed: DecisionSource[] = [];
  if (input.growthBrain) sourcesUsed.push("growth_brain");
  if (input.revenueAi) sourcesUsed.push("revenue_ai");
  if (input.marketHunter) sourcesUsed.push("market_hunter");
  if (input.operationCenter?.operation) sourcesUsed.push("operation_center");
  if (input.performance?.dashboard) sourcesUsed.push("performance_ai");

  const decisions = [
    selectBestProduct(input),
    selectBestCountry(input),
    selectBestLanguage(input),
    selectBestOffer(input),
    selectBestCreative(input),
    selectBestLanding(input),
    selectBestCampaign(input),
  ].filter(Boolean) as UnifiedDecision[];

  const confidence =
    decisions.length > 0
      ? Math.round(
          (decisions.reduce((sum, d) => sum + d.score, 0) / decisions.length) *
            (sourcesUsed.length / 5) *
            100
        ) / 100
      : 0;

  return {
    bestProduct: selectBestProduct(input),
    bestCountry: selectBestCountry(input),
    bestLanguage: selectBestLanguage(input),
    bestOffer: selectBestOffer(input),
    bestCreative: selectBestCreative(input),
    bestLanding: selectBestLanding(input),
    bestCampaign: selectBestCampaign(input),
    sourcesUsed,
    confidence,
  };
}

export function buildDecisionEngineAuraContext(result: UnifiedDecisionEngineResult): string {
  const lines = [
    "## UNIFIED DECISION ENGINE",
    `Fontes ativas: ${result.sourcesUsed.join(", ") || "nenhuma"}`,
    result.confidence > 0 ? `Confiança: ${result.confidence.toFixed(1)}%` : null,
    result.bestProduct
      ? `Produto: ${result.bestProduct.label} (${result.bestProduct.source}, score ${result.bestProduct.score}) — ${result.bestProduct.reason}`
      : null,
    result.bestCountry ? `País: ${result.bestCountry.label}` : null,
    result.bestLanguage ? `Idioma: ${result.bestLanguage.label}` : null,
    result.bestOffer ? `Oferta: ${result.bestOffer.label}` : null,
    result.bestCreative ? `Criativo: ${result.bestCreative.label}` : null,
    result.bestLanding ? `Landing: ${result.bestLanding.label}` : null,
    result.bestCampaign ? `Campanha: ${result.bestCampaign.label}` : null,
  ].filter(Boolean);

  return lines.join("\n");
}
