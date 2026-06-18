import { recordSystemLog } from "@/lib/logs/record";
import {
  MarketOpportunitiesRepository,
  MarketWatchlistRepository,
} from "@/lib/supabase/repositories/market-hunter.repository";
import type { Json, MarketOpportunity, TableInsert } from "@/types/database";
import {
  buildMarketHunterAuraContext,
  computeMarketHunterDashboard,
  computeOpportunityScore,
  generateOpportunityReport as buildOpportunityReport,
  rankProducts,
  type MarketCandidate,
  type MarketHunterDashboard,
  type MarketOpportunityReport,
} from "@/utils/market-hunter";
import { getOptionalDataContext } from "./context";
import {
  injectIntentCandidates,
  resolveMasterFlowIntent,
  type MasterFlowIntentInput,
} from "@/utils/master-flow-intent";

export type MarketAnalysisResult = {
  candidates: MarketCandidate[];
  sources: string[];
  summary: string;
};

function toOpportunityPayload(
  candidate: MarketCandidate
): Omit<TableInsert<"market_opportunities">, "user_id"> {
  const score = computeOpportunityScore(candidate);
  const recommendation =
    score >= 70
      ? `Alta prioridade — escale ${candidate.productName} agora.`
      : score >= 50
        ? `Oportunidade promissora — valide com tráfego pago.`
        : `Monitore e teste com budget reduzido.`;

  return {
    source_platform: candidate.sourcePlatform,
    product_name: candidate.productName,
    niche: candidate.niche,
    country: candidate.country,
    language: candidate.language,
    currency: candidate.currency as "BRL" | "USD" | "EUR" | "GBP" | "CAD",
    estimated_demand: candidate.estimatedDemand,
    estimated_competition: candidate.estimatedCompetition,
    estimated_conversion: candidate.estimatedConversion,
    opportunity_score: score,
    recommendation,
    metadata: (candidate.metadata ?? {}) as Json,
  };
}

export async function analyzeMarket(intentInput?: MasterFlowIntentInput): Promise<{
  analysis: MarketAnalysisResult | null;
  error: string | null;
}> {
  const intent = resolveMasterFlowIntent(intentInput);
  const ctx = await getOptionalDataContext();
  if (!ctx) return { analysis: null, error: "Usuário não autenticado." };

  const candidates: MarketCandidate[] = [];
  const sources: string[] = [];

  const [growthBrain, revenueAi, kiwify, operationCenter] = await Promise.all([
    import("./growth-brain.service").then((mod) => mod.getGrowthBrainDashboard()),
    import("./revenue-ai.service").then((mod) => mod.getRevenueAiDashboard()),
    import("./kiwify-intelligence.service").then((mod) => mod.getKiwifyIntelligence()),
    import("./operation-center.service").then((mod) => mod.getOperationCenterState()),
  ]);

  if (growthBrain.dashboard) {
    sources.push("growth_brain");
    const { dashboard } = growthBrain;

    if (dashboard.melhorCampanha?.label) {
      candidates.push({
        productName: dashboard.melhorCampanha.label,
        sourcePlatform: "growth_brain",
        niche: dashboard.melhorNicho?.label ?? null,
        country: dashboard.melhorPais?.label ?? "BR",
        language: dashboard.melhorIdioma?.label ?? "pt-BR",
        currency: "BRL",
        estimatedDemand: Math.min(100, dashboard.melhorCampanha.score / 2),
        estimatedCompetition: 40,
        estimatedConversion: Number(dashboard.melhorCampanha.metrics.conversionRate ?? 0.05),
        metadata: { source: "growth_brain", type: "campaign" },
      });
    }

    if (dashboard.melhorNicho?.label) {
      candidates.push({
        productName: `Nicho: ${dashboard.melhorNicho.label}`,
        sourcePlatform: "growth_brain",
        niche: dashboard.melhorNicho.label,
        country: dashboard.melhorPais?.label ?? "BR",
        language: dashboard.melhorIdioma?.label ?? "pt-BR",
        currency: "BRL",
        estimatedDemand: Math.min(100, dashboard.melhorNicho.score / 1.5),
        estimatedCompetition: 35,
        estimatedConversion: 0.04,
        metadata: { source: "growth_brain", type: "niche" },
      });
    }
  }

  if (revenueAi.dashboard) {
    sources.push("revenue_ai");
    const { dashboard } = revenueAi;

    if (dashboard.melhorProduto?.label) {
      candidates.push({
        productName: dashboard.melhorProduto.label,
        sourcePlatform: "revenue_ai",
        niche: null,
        country: dashboard.melhorPais?.label ?? "BR",
        language: "pt-BR",
        currency: dashboard.melhorProduto.currency ?? "BRL",
        estimatedDemand: Math.min(100, dashboard.melhorProduto.value / 100),
        estimatedCompetition: 45,
        estimatedConversion: Number(dashboard.roasMedioReal ?? dashboard.roasMedio ?? 1) / 10,
        metadata: { source: "revenue_ai", roas: dashboard.roasMedioReal ?? dashboard.roasMedio },
      });
    }

    for (const point of dashboard.chartReceitaPorPlataforma.slice(0, 3)) {
      candidates.push({
        productName: `Receita ${point.label}`,
        sourcePlatform: point.label.toLowerCase().replace(/\s+/g, "_"),
        niche: null,
        country: dashboard.melhorPais?.label ?? "BR",
        language: "pt-BR",
        currency: "BRL",
        estimatedDemand: Math.min(100, point.pct),
        estimatedCompetition: 50,
        estimatedConversion: 0.03,
        metadata: { source: "revenue_ai", platform: point.label, revenue: point.value },
      });
    }
  }

  if (kiwify.data) {
    sources.push("kiwify");
    const { metrics, products } = kiwify.data;

    for (const top of metrics.topSellingProducts.slice(0, 5)) {
      const product = products.find(
        (item) => item.id === top.id || item.name === top.name
      );
      const niche =
        product?.metadata &&
        typeof product.metadata === "object" &&
        !Array.isArray(product.metadata)
          ? String((product.metadata as Record<string, unknown>).niche ?? "") || null
          : null;

      candidates.push({
        productName: top.name,
        sourcePlatform: "kiwify",
        niche,
        country: "BR",
        language: "pt-BR",
        currency: "BRL",
        estimatedDemand: Math.min(100, top.revenueCents / 1000),
        estimatedCompetition: Math.max(20, 70 - metrics.conversionPct),
        estimatedConversion: metrics.conversionPct / 100,
        metadata: {
          source: "kiwify",
          productId: product?.id ?? top.id,
          salesCount: top.salesCount,
        },
      });
    }
  }

  if (operationCenter.dashboard?.operation) {
    sources.push("operation_center");
    const op = operationCenter.dashboard.operation;

    if (op.product_nome) {
      candidates.push({
        productName: op.product_nome,
        sourcePlatform: "operation_center",
        niche: null,
        country: "BR",
        language: "pt-BR",
        currency: "BRL",
        estimatedDemand: Math.min(100, Number(op.operational_score ?? 50)),
        estimatedCompetition: Math.max(10, 100 - Number(op.success_chance ?? 50)),
        estimatedConversion: Number(op.roi_previsto ?? 1) / 20,
        metadata: {
          source: "operation_center",
          operationId: op.id,
          status: op.status,
        },
      });
    }
  }

  const ranked = injectIntentCandidates(rankProducts(candidates), intent);
  const summary =
    ranked.length > 0
      ? intent.niche
        ? `${ranked.length} produtos analisados no nicho "${intent.niche}" (${sources.join(", ")}).`
        : `${ranked.length} produtos analisados de ${sources.length} fontes (${sources.join(", ")}).`
      : "Nenhum dado disponível. Conecte plataformas e registre resultados.";

  return {
    analysis: { candidates: ranked, sources, summary },
    error: null,
  };
}

export { rankProducts } from "@/utils/market-hunter";

export async function identifyOpportunities(intentInput?: MasterFlowIntentInput): Promise<{
  opportunities: MarketOpportunity[];
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { opportunities: [], error: "Usuário não autenticado." };

  const { analysis, error } = await analyzeMarket(intentInput);
  if (error || !analysis) return { opportunities: [], error: error ?? "Erro na análise." };

  const repo = new MarketOpportunitiesRepository(ctx.supabase, ctx.userId);
  const persisted: MarketOpportunity[] = [];

  for (const candidate of analysis.candidates.slice(0, 20)) {
    const result = await repo.upsertByProduct(toOpportunityPayload(candidate));
    if (result.data) persisted.push(result.data);
  }

  const top = analysis.candidates[0];
  if (top) {
    const watchlistRepo = new MarketWatchlistRepository(ctx.supabase, ctx.userId);
    const { data: existing } = await watchlistRepo.findActive(100);
    const alreadyWatching = (existing ?? []).some(
      (item) =>
        item.product_name === top.productName &&
        item.source_platform === top.sourcePlatform
    );

    if (!alreadyWatching) {
      await watchlistRepo.create({
        product_name: top.productName,
        source_platform: top.sourcePlatform,
        score: computeOpportunityScore(top),
        status: "watching",
        notes: `Auto-adicionado pelo Market Hunter — ${analysis.summary}`,
      });
    }
  }

  return { opportunities: persisted, error: null };
}

export async function generateOpportunityReport(): Promise<{
  report: MarketOpportunityReport | null;
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { report: null, error: "Usuário não autenticado." };

  const repo = new MarketOpportunitiesRepository(ctx.supabase, ctx.userId);
  const { data, error } = await repo.findTopScored(50);
  if (error) return { report: null, error };

  return {
    report: buildOpportunityReport(data ?? []),
    error: null,
  };
}

export async function getMarketHunterDashboard(): Promise<{
  dashboard: MarketHunterDashboard | null;
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { dashboard: null, error: "Usuário não autenticado." };

  const opportunitiesRepo = new MarketOpportunitiesRepository(ctx.supabase, ctx.userId);
  const watchlistRepo = new MarketWatchlistRepository(ctx.supabase, ctx.userId);

  const [opportunitiesRes, watchlistRes] = await Promise.all([
    opportunitiesRepo.findTopScored(50),
    watchlistRepo.findActive(),
  ]);

  if (opportunitiesRes.error || watchlistRes.error) {
    return {
      dashboard: null,
      error: opportunitiesRes.error ?? watchlistRes.error,
    };
  }

  const dashboard = computeMarketHunterDashboard(
    opportunitiesRes.data ?? [],
    watchlistRes.data ?? []
  );

  return { dashboard, error: null };
}

export async function getMarketHunterContext(): Promise<{
  context: string;
  error: string | null;
}> {
  const { dashboard, error } = await getMarketHunterDashboard();
  if (error || !dashboard) return { context: "", error: error ?? "Erro ao carregar Market Hunter." };
  return { context: buildMarketHunterAuraContext(dashboard), error: null };
}

export async function feedMarketHunterFromGrowthBrain(params: {
  productName: string;
  niche?: string | null;
  country?: string | null;
  score?: number | null;
}): Promise<void> {
  console.info("[market-hunter] feed from Growth Brain", {
    productName: params.productName,
    niche: params.niche,
    score: params.score,
  });

  const ctx = await getOptionalDataContext();
  if (!ctx) return;

  const repo = new MarketOpportunitiesRepository(ctx.supabase, ctx.userId);
  await repo.upsertByProduct({
    source_platform: "growth_brain",
    product_name: params.productName,
    niche: params.niche ?? null,
    country: params.country ?? "BR",
    language: "pt-BR",
    currency: "BRL",
    estimated_demand: Math.min(100, Number(params.score ?? 50)),
    estimated_competition: 40,
    estimated_conversion: 0.04,
    opportunity_score: Number(params.score ?? 50),
    recommendation: "Alimentado pelo Growth Brain — padrão de crescimento detectado.",
    metadata: { source: "growth_brain_feed" } as Json,
  });

  recordSystemLog({
    tipo: "info",
    modulo: "market-hunter",
    mensagem: `Oportunidade atualizada via Growth Brain: ${params.productName}`,
    detalhes: {
      productName: params.productName,
      niche: params.niche,
      score: params.score,
    },
  });
}

export async function feedMarketHunterFromRevenue(params: {
  productName: string;
  platform?: string | null;
  country?: string | null;
  currency?: string | null;
  revenue?: number | null;
  roas?: number | null;
}): Promise<void> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return;

  const demand = Math.min(100, Number(params.revenue ?? 0) / 50);
  const conversion = Math.min(1, Number(params.roas ?? 1) / 10);
  const candidate: MarketCandidate = {
    productName: params.productName,
    sourcePlatform: params.platform ?? "revenue_ai",
    niche: null,
    country: params.country ?? "BR",
    language: "pt-BR",
    currency: params.currency ?? "BRL",
    estimatedDemand: demand,
    estimatedCompetition: 45,
    estimatedConversion: conversion,
    metadata: { source: "revenue_ai_feed", roas: params.roas },
  };

  const repo = new MarketOpportunitiesRepository(ctx.supabase, ctx.userId);
  await repo.upsertByProduct(toOpportunityPayload(candidate));

  recordSystemLog({
    tipo: "info",
    modulo: "market-hunter",
    mensagem: `Oportunidade atualizada via Revenue AI: ${params.productName}`,
    detalhes: {
      productName: params.productName,
      platform: params.platform,
      revenue: params.revenue,
      roas: params.roas,
    },
  });
}

export async function feedMarketHunterFromKiwify(params: {
  productName: string;
  productId?: string | null;
  niche?: string | null;
  revenue?: number | null;
  conversionRate?: number | null;
}): Promise<void> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return;

  const candidate: MarketCandidate = {
    productName: params.productName,
    sourcePlatform: "kiwify",
    niche: params.niche ?? null,
    country: "BR",
    language: "pt-BR",
    currency: "BRL",
    estimatedDemand: Math.min(100, Number(params.revenue ?? 0) / 100),
    estimatedCompetition: 35,
    estimatedConversion: Number(params.conversionRate ?? 0.03),
    metadata: { source: "kiwify_feed", productId: params.productId },
  };

  const repo = new MarketOpportunitiesRepository(ctx.supabase, ctx.userId);
  await repo.upsertByProduct(toOpportunityPayload(candidate));

  recordSystemLog({
    tipo: "info",
    modulo: "market-hunter",
    mensagem: `Oportunidade atualizada via Kiwify: ${params.productName}`,
    detalhes: {
      productName: params.productName,
      productId: params.productId,
      revenue: params.revenue,
    },
  });
}

export async function feedMarketHunterFromOperation(params: {
  productName: string;
  operationId: string;
  operationalScore?: number | null;
  roiPrevisto?: number | null;
}): Promise<void> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return;

  const candidate: MarketCandidate = {
    productName: params.productName,
    sourcePlatform: "operation_center",
    niche: null,
    country: "BR",
    language: "pt-BR",
    currency: "BRL",
    estimatedDemand: Math.min(100, Number(params.operationalScore ?? 50)),
    estimatedCompetition: Math.max(10, 100 - Number(params.operationalScore ?? 50)),
    estimatedConversion: Number(params.roiPrevisto ?? 1) / 20,
    metadata: { source: "operation_center_feed", operationId: params.operationId },
  };

  const repo = new MarketOpportunitiesRepository(ctx.supabase, ctx.userId);
  await repo.upsertByProduct(toOpportunityPayload(candidate));
}
