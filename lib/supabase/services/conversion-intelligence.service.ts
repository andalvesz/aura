import OpenAI from "openai";
import { recordSystemLog } from "@/lib/logs/record";
import { ConversionInsightsRepository } from "@/lib/supabase/repositories/conversion-intelligence.repository";
import { FunnelsRepository } from "@/lib/supabase/repositories/funnel-engine.repository";
import { OffersRepository } from "@/lib/supabase/repositories/offer-engine.repository";
import { RevenueMetricsRepository } from "@/lib/supabase/repositories/revenue-ai.repository";
import { GrowthBrainMemoriesRepository } from "@/lib/supabase/repositories/growth-brain.repository";
import type { ConversionInsight, Json, TableInsert } from "@/types/database";
import { COPYLAB_AI_CONTEXT } from "@/utils/copylab";
import {
  buildConversionIntelligenceAuraContext,
  calculateConfidence,
  computeConversionIntelligenceDashboard,
  computeSignalScore,
  generateRecommendations,
  identifyLosingPatterns,
  identifyWinningPatterns,
  mergeConversionInsightMetadata,
  type ConversionAnalysisResult,
  type ConversionIntelligenceDashboard,
  type ConversionIntelligenceIntake,
  type ConversionSignal,
} from "@/utils/conversion-intelligence";
import { getOptionalDataContext } from "./context";

const CONVERSION_INTELLIGENCE_SYSTEM = `${COPYLAB_AI_CONTEXT}

Você é a Aura Conversion Intelligence — analisa padrões reais de conversão.
Regras:
- Explique POR QUE converteu ou NÃO converteu com base em métricas
- Recomendações práticas e honestas
- Nunca prometa resultados garantidos
- Responda APENAS JSON conforme solicitado.`;

type IntegrationBundle = {
  sourcesUsed: string[];
  dataPoints: number;
  signals: ConversionSignal[];
};

function getOpenAi() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
}

function parseJsonBlock<T>(text: string): T | null {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]) as T;
    } catch {
      return null;
    }
  }
}

function readMetaLabel(metadata: Json, keys: string[]): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const meta = metadata as Record<string, unknown>;
  for (const key of keys) {
    const value = meta[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function signalToInsightPayload(
  signal: ConversionSignal,
  confidence: number
): Omit<TableInsert<"conversion_insights">, "user_id"> {
  return {
    funnel_id: signal.funnelId ?? null,
    product_id: signal.productId ?? null,
    offer_id: signal.offerId ?? null,
    landing_id: signal.landingId ?? null,
    creative_id: signal.creativeId ?? null,
    campaign_id: signal.campaignId ?? null,
    country: signal.country ?? null,
    language: signal.language ?? null,
    conversion_rate: signal.conversionRate ?? null,
    ctr: signal.ctr ?? null,
    cpc: signal.cpc ?? null,
    cpa: signal.cpa ?? null,
    roas: signal.roas ?? null,
    revenue: signal.revenue ?? null,
    spend: signal.spend ?? null,
    insight: signal.insight,
    recommendation: signal.recommendation,
    confidence_score: confidence,
    metadata: mergeConversionInsightMetadata({} as Json, {
      pattern_type: signal.patternType,
      outcome: signal.outcome,
      source: signal.source,
      label: signal.label,
      score: computeSignalScore(signal),
      ...(signal.metadata ?? {}),
    }),
  };
}

async function loadGrowthBrainSignals(): Promise<ConversionSignal[]> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return [];

  const repo = new GrowthBrainMemoriesRepository(ctx.supabase, ctx.userId);
  const { data: memories } = await repo.findRecent(80);
  if (!memories?.length) return [];

  const signals: ConversionSignal[] = [];

  for (const memory of memories) {
    const score = Math.round(
      Number(memory.roas ?? 0) * 30 +
        Number(memory.conversion_rate ?? 0) * 100 +
        Number(memory.ctr ?? 0) * 500
    );
    const outcome = score >= 55 ? "winning" : score <= 35 ? "losing" : "winning";
    const label =
      readMetaLabel(memory.metadata, ["copy_label", "headline", "campaign_label", "product_label"]) ??
      memory.lesson?.slice(0, 60) ??
      "Resultado Growth Brain";

    if (memory.copy_id) {
      signals.push({
        source: "growth_brain",
        patternType: "headline",
        label,
        productId: memory.product_id,
        landingId: memory.landing_id,
        creativeId: memory.creative_id,
        campaignId: memory.campaign_id,
        country: memory.country,
        language: memory.language,
        conversionRate: memory.conversion_rate,
        ctr: memory.ctr,
        cpc: memory.cpc,
        cpa: memory.cpa,
        roas: memory.roas,
        revenue: memory.revenue,
        spend: memory.spend,
        score,
        outcome,
        insight:
          memory.lesson ??
          `Headline/copy com conversão ${memory.conversion_rate ?? "—"} e ROAS ${memory.roas ?? "—"}.`,
        recommendation:
          memory.recommendation ??
          "Replique a estrutura de headline vencedora em novas campanhas do mesmo nicho.",
      });
    }

    if (memory.creative_id) {
      signals.push({
        source: "growth_brain",
        patternType: "creative",
        label: readMetaLabel(memory.metadata, ["creative_label"]) ?? "Criativo",
        productId: memory.product_id,
        creativeId: memory.creative_id,
        campaignId: memory.campaign_id,
        country: memory.country,
        language: memory.language,
        conversionRate: memory.conversion_rate,
        ctr: memory.ctr,
        roas: memory.roas,
        revenue: memory.revenue,
        spend: memory.spend,
        score,
        outcome,
        insight: memory.lesson ?? "Criativo com CTR e conversão acima da média.",
        recommendation:
          memory.recommendation ?? "Use variações deste criativo como base no Ads Commander.",
      });
    }

    if (memory.landing_id) {
      signals.push({
        source: "growth_brain",
        patternType: "landing",
        label: readMetaLabel(memory.metadata, ["landing_label"]) ?? "Landing",
        productId: memory.product_id,
        landingId: memory.landing_id,
        country: memory.country,
        language: memory.language,
        conversionRate: memory.conversion_rate,
        ctr: memory.ctr,
        roas: memory.roas,
        revenue: memory.revenue,
        spend: memory.spend,
        score,
        outcome,
        insight: memory.lesson ?? "Landing com taxa de conversão relevante.",
        recommendation:
          memory.recommendation ?? "Publique e escale tráfego para esta landing.",
      });
    }

    if (memory.campaign_id) {
      signals.push({
        source: "growth_brain",
        patternType: "campaign",
        label: readMetaLabel(memory.metadata, ["campaign_label"]) ?? "Campanha",
        productId: memory.product_id,
        campaignId: memory.campaign_id,
        country: memory.country,
        language: memory.language,
        conversionRate: memory.conversion_rate,
        ctr: memory.ctr,
        roas: memory.roas,
        revenue: memory.revenue,
        spend: memory.spend,
        score,
        outcome,
        insight: memory.lesson ?? "Campanha com performance registrada no Growth Brain.",
        recommendation: memory.recommendation ?? "Mantenha budget nesta campanha e teste novos criativos.",
      });
    }

    if (memory.country) {
      signals.push({
        source: "growth_brain",
        patternType: "country",
        label: memory.country,
        country: memory.country,
        conversionRate: memory.conversion_rate,
        roas: memory.roas,
        revenue: memory.revenue,
        spend: memory.spend,
        score,
        outcome,
        insight: `País ${memory.country} com ROAS ${memory.roas ?? "—"} e conversão ${memory.conversion_rate ?? "—"}.`,
        recommendation: "Priorize budget neste país enquanto ROAS se mantiver saudável.",
      });
    }

    if (memory.language) {
      signals.push({
        source: "growth_brain",
        patternType: "language",
        label: memory.language,
        language: memory.language,
        conversionRate: memory.conversion_rate,
        roas: memory.roas,
        score,
        outcome,
        insight: `Idioma ${memory.language} apresentou padrão ${outcome === "winning" ? "positivo" : "fraco"}.`,
        recommendation: "Ajuste copy e criativos para o idioma com melhor resposta.",
      });
    }
  }

  return signals;
}

async function loadRevenueAiSignals(): Promise<ConversionSignal[]> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return [];

  const repo = new RevenueMetricsRepository(ctx.supabase, ctx.userId);
  const { data: metrics } = await repo.findRecent(120);
  if (!metrics?.length) return [];

  const signals: ConversionSignal[] = [];

  for (const metric of metrics) {
    const conversionRate =
      metric.clicks && metric.conversions
        ? Number(metric.conversions) / Math.max(Number(metric.clicks), 1)
        : null;
    const roas = metric.roas != null ? Number(metric.roas) : null;
    const score = Math.round((roas ?? 0) * 25 + (conversionRate ?? 0) * 100);
    const outcome = score >= 55 ? "winning" : score <= 35 ? "losing" : "winning";

    if (metric.product_id) {
      signals.push({
        source: "revenue_ai",
        patternType: "offer",
        label: readMetaLabel(metric.metadata, ["product_label", "offer_label"]) ?? "Produto/Oferta",
        productId: metric.product_id,
        country: metric.country,
        conversionRate,
        ctr: metric.ctr,
        cpc: metric.cpc,
        cpa: metric.cpa,
        roas,
        revenue: metric.revenue,
        spend: metric.spend,
        score,
        outcome,
        insight: `Receita R$ ${Number(metric.revenue ?? 0).toFixed(2)} com ROAS ${roas ?? "—"}.`,
        recommendation:
          outcome === "winning"
            ? "Escale a oferta com maior contribuição de receita."
            : "Revise preço, promessa ou público desta oferta.",
        metadata: { metric_type: metric.metric_type, platform: metric.platform },
      });
    }

    if (metric.country) {
      signals.push({
        source: "revenue_ai",
        patternType: "country",
        label: metric.country,
        country: metric.country,
        conversionRate,
        roas,
        revenue: metric.revenue,
        spend: metric.spend,
        score,
        outcome,
        insight: `País ${metric.country}: receita ${Number(metric.revenue ?? 0).toFixed(2)}, spend ${Number(metric.spend ?? 0).toFixed(2)}.`,
        recommendation:
          outcome === "winning"
            ? "Aumente investimento gradualmente neste mercado."
            : "Reduza spend ou adapte oferta para este país.",
      });
    }
  }

  return signals;
}

async function loadFunnelAnalyticsSignals(
  funnelFilter?: string | null
): Promise<ConversionSignal[]> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return [];

  const funnelsRepo = new FunnelsRepository(ctx.supabase, ctx.userId);
  const offersRepo = new OffersRepository(ctx.supabase, ctx.userId);

  const { data: funnels } = await funnelsRepo.findAllOrdered();
  const filtered = funnelFilter
    ? (funnels ?? []).filter((f) => f.id === funnelFilter)
    : (funnels ?? []);

  const signals: ConversionSignal[] = [];

  for (const funnel of filtered) {
    const conversion = Number(funnel.expected_conversion ?? 0);
    const aov = Number(funnel.expected_aov ?? 0);
    const score = Math.round(conversion * 120 + aov * 0.05);
    const outcome = score >= 55 ? "winning" : score <= 35 ? "losing" : "winning";

    signals.push({
      source: "funnel_analytics",
      patternType: "funnel_structure",
      label: funnel.funnel_name,
      funnelId: funnel.id,
      productId: funnel.product_id,
      country: funnel.niche,
      conversionRate: conversion,
      revenue: aov,
      score,
      outcome,
      insight: `Funil ${funnel.funnel_type} com AOV esperado R$ ${aov.toFixed(2)} e conversão ${(conversion * 100).toFixed(1)}%.`,
      recommendation:
        outcome === "winning"
          ? "Replique esta estrutura de funil em produtos similares."
          : "Teste order bump, upsell ou quiz para elevar AOV e conversão.",
      metadata: { funnel_type: funnel.funnel_type, total_steps: funnel.total_steps },
    });

    const { data: offers } = await offersRepo.findByFunnelId(funnel.id);
    for (const offer of offers ?? []) {
      const takeRate = Number(offer.expected_take_rate ?? 0.1);
      const offerScore = Math.round(takeRate * 80 + Number(offer.expected_revenue ?? 0) * 0.02);
      signals.push({
        source: "funnel_analytics",
        patternType: "offer",
        label: offer.title,
        funnelId: funnel.id,
        productId: offer.product_id,
        offerId: offer.id,
        conversionRate: takeRate,
        revenue: offer.expected_revenue,
        score: offerScore,
        outcome: offerScore >= 55 ? "winning" : offerScore <= 35 ? "losing" : "winning",
        insight: `Oferta ${offer.offer_type} — take ${Math.round(takeRate * 100)}%, receita esperada R$ ${Number(offer.expected_revenue ?? 0).toFixed(2)}.`,
        recommendation:
          offerScore >= 55
            ? "Mantenha esta oferta no funil e teste variações de copy."
            : "Reformule preço ou promessa desta oferta.",
      });
    }
  }

  return signals;
}

async function loadPerformanceAiSignals(): Promise<ConversionSignal[]> {
  try {
    const { getPerformanceDashboard } = await import("./performance.service");
    const { dashboard, panel, analysis } = await getPerformanceDashboard();

    const signals: ConversionSignal[] = [];
    if (panel?.melhorProjeto) {
      signals.push({
        source: "performance_ai",
        patternType: "general",
        label: panel.melhorProjeto,
        score: 62,
        outcome: "winning",
        insight: analysis?.oQueFunciona ?? "Projeto com maior potencial no Performance AI.",
        recommendation: analysis?.projetoAcelerar ?? "Acelere o projeto com melhor ROI.",
      });
    }

    if (panel?.maiorDesperdicio) {
      signals.push({
        source: "performance_ai",
        patternType: "general",
        label: panel.maiorDesperdicio,
        score: 25,
        outcome: "losing",
        insight: analysis?.oQueAtrasa ?? "Desperdício identificado no Performance AI.",
        recommendation: analysis?.projetoAbandonar ?? "Corte ou pause iniciativas com baixo retorno.",
        metadata: { taxa_execucao: dashboard?.taxaExecucao },
      });
    }

    return signals;
  } catch {
    return [];
  }
}

async function loadMarketHunterSignals(): Promise<ConversionSignal[]> {
  try {
    const { getMarketHunterDashboard } = await import("./market-hunter.service");
    const { dashboard } = await getMarketHunterDashboard();
    if (!dashboard) return [];

    const signals: ConversionSignal[] = [];

    if (dashboard.melhorPais) {
      signals.push({
        source: "market_hunter",
        patternType: "country",
        label: dashboard.melhorPais.label,
        country: dashboard.melhorPais.label,
        score: dashboard.melhorPais.score,
        outcome: "winning",
        insight: `Mercado ${dashboard.melhorPais.label} com score ${dashboard.melhorPais.score}.`,
        recommendation: "Valide com tráfego pago de baixo budget antes de escalar.",
      });
    }

    if (dashboard.melhorNicho) {
      signals.push({
        source: "market_hunter",
        patternType: "general",
        label: dashboard.melhorNicho.label,
        score: dashboard.melhorNicho.score,
        outcome: "winning",
        insight: `Nicho ${dashboard.melhorNicho.label} com demanda favorável.`,
        recommendation: "Crie funil e ofertas alinhados a este nicho.",
      });
    }

    for (const item of dashboard.topOportunidades.slice(0, 3)) {
      signals.push({
        source: "market_hunter",
        patternType: "offer",
        label: item.productName,
        country: item.country,
        score: item.score,
        outcome: item.score >= 60 ? "winning" : "losing",
        insight: item.recommendation ?? `Oportunidade ${item.productName} no mercado ${item.country ?? "—"}.`,
        recommendation: item.recommendation ?? "Teste MVP com budget controlado.",
        metadata: { platform: item.sourcePlatform, niche: item.niche },
      });
    }

    return signals;
  } catch {
    return [];
  }
}

async function loadDecisionEngineSignals(): Promise<ConversionSignal[]> {
  try {
    const { getUnifiedDecisionsReadOnly } = await import("./aura-decision-engine.service");
    const { decisions } = await getUnifiedDecisionsReadOnly();
    if (!decisions) return [];

    const signals: ConversionSignal[] = [];
    const entries: Array<{
      decision: typeof decisions.bestLanding;
      patternType: ConversionSignal["patternType"];
    }> = [
      { decision: decisions.bestLanding, patternType: "landing" },
      { decision: decisions.bestCreative, patternType: "creative" },
      { decision: decisions.bestOffer, patternType: "offer" },
      { decision: decisions.bestCountry, patternType: "country" },
      { decision: decisions.bestLanguage, patternType: "language" },
      { decision: decisions.bestCampaign, patternType: "campaign" },
    ];

    for (const entry of entries) {
      const decision = entry.decision;
      if (!decision) continue;
      signals.push({
        source: "decision_engine",
        patternType: entry.patternType,
        label: decision.label,
        landingId: entry.patternType === "landing" ? decision.entityId : null,
        creativeId: entry.patternType === "creative" ? decision.entityId : null,
        offerId: entry.patternType === "offer" ? decision.entityId : null,
        campaignId: entry.patternType === "campaign" ? decision.entityId : null,
        country: entry.patternType === "country" ? decision.label : null,
        language: entry.patternType === "language" ? decision.label : null,
        score: decision.score,
        outcome: decision.score >= 55 ? "winning" : "losing",
        insight: decision.reason,
        recommendation: `Decision Engine (${decision.source}): priorize ${decision.label}.`,
        metadata: { decision_source: decision.source },
      });
    }

    return signals;
  } catch {
    return [];
  }
}

async function collectIntegrationSignals(
  funnelFilter?: string | null
): Promise<IntegrationBundle> {
  const [
    growthSignals,
    revenueSignals,
    funnelSignals,
    performanceSignals,
    marketSignals,
    decisionSignals,
  ] = await Promise.all([
    loadGrowthBrainSignals(),
    loadRevenueAiSignals(),
    loadFunnelAnalyticsSignals(funnelFilter),
    loadPerformanceAiSignals(),
    loadMarketHunterSignals(),
    loadDecisionEngineSignals(),
  ]);

  const signals = [
    ...growthSignals,
    ...revenueSignals,
    ...funnelSignals,
    ...performanceSignals,
    ...marketSignals,
    ...decisionSignals,
  ];

  const sourcesUsed = [
    growthSignals.length ? "growth_brain" : null,
    revenueSignals.length ? "revenue_ai" : null,
    funnelSignals.length ? "funnel_analytics" : null,
    performanceSignals.length ? "performance_ai" : null,
    marketSignals.length ? "market_hunter" : null,
    decisionSignals.length ? "decision_engine" : null,
  ].filter(Boolean) as string[];

  return {
    sourcesUsed,
    dataPoints: signals.length,
    signals,
  };
}

async function enrichSignalsWithAi(
  winning: ConversionSignal[],
  losing: ConversionSignal[]
): Promise<{ winning: ConversionSignal[]; losing: ConversionSignal[] }> {
  const openai = getOpenAi();
  if (!openai || (winning.length === 0 && losing.length === 0)) {
    return { winning, losing };
  }

  const generated = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: CONVERSION_INTELLIGENCE_SYSTEM },
      {
        role: "user",
        content: JSON.stringify({
          task: "explain_conversion_patterns",
          winning: winning.slice(0, 5).map((s) => ({
            label: s.label,
            patternType: s.patternType,
            conversionRate: s.conversionRate,
            roas: s.roas,
          })),
          losing: losing.slice(0, 5).map((s) => ({
            label: s.label,
            patternType: s.patternType,
            conversionRate: s.conversionRate,
            roas: s.roas,
          })),
          response: {
            why_converted: "string",
            why_not_converted: "string",
            winning_insights: [{ label: "string", insight: "string", recommendation: "string" }],
            losing_insights: [{ label: "string", insight: "string", recommendation: "string" }],
          },
        }),
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.5,
  });

  const content = generated.choices[0]?.message?.content;
  const parsed = content
    ? parseJsonBlock<{
        why_converted?: string;
        why_not_converted?: string;
        winning_insights?: { label: string; insight: string; recommendation: string }[];
        losing_insights?: { label: string; insight: string; recommendation: string }[];
      }>(content)
    : null;

  if (!parsed) return { winning, losing };

  const enrichedWinning = winning.map((signal, index) => {
    const ai = parsed.winning_insights?.[index];
    if (!ai) return signal;
    return {
      ...signal,
      insight: ai.insight || signal.insight,
      recommendation: ai.recommendation || signal.recommendation,
    };
  });

  const enrichedLosing = losing.map((signal, index) => {
    const ai = parsed.losing_insights?.[index];
    if (!ai) return signal;
    return {
      ...signal,
      insight: ai.insight || signal.insight,
      recommendation: ai.recommendation || signal.recommendation,
    };
  });

  if (parsed.why_converted && enrichedWinning[0]) {
    enrichedWinning[0] = {
      ...enrichedWinning[0],
      insight: parsed.why_converted,
    };
  }

  if (parsed.why_not_converted && enrichedLosing[0]) {
    enrichedLosing[0] = {
      ...enrichedLosing[0],
      insight: parsed.why_not_converted,
    };
  }

  return { winning: enrichedWinning, losing: enrichedLosing };
}

export { calculateConfidence, identifyWinningPatterns, identifyLosingPatterns };

export async function analyzeConversion(
  input: ConversionIntelligenceIntake = {}
): Promise<{ result: ConversionAnalysisResult | null; error: string | null }> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { result: null, error: "Usuário não autenticado." };

  const repo = new ConversionInsightsRepository(ctx.supabase, ctx.userId);
  const funnelFilter = input.funnel_id?.trim() || null;

  if (input.force_refresh) {
    await repo.deleteAll();
  }

  const integration = await collectIntegrationSignals(funnelFilter);
  if (integration.signals.length === 0) {
    return {
      result: null,
      error: "Sem dados suficientes. Registre resultados no Growth Brain ou Revenue AI.",
    };
  }

  let winning = identifyWinningPatterns(integration.signals);
  let losing = identifyLosingPatterns(integration.signals);

  const enriched = await enrichSignalsWithAi(winning, losing);
  winning = enriched.winning;
  losing = enriched.losing;

  const recommendations = generateRecommendations({ winning, losing });
  const sourceCount = integration.sourcesUsed.length;
  const persisted: ConversionInsight[] = [];

  const toPersist = [...winning.slice(0, 12), ...losing.slice(0, 8)];

  for (const signal of toPersist) {
    const confidence = calculateConfidence({
      signal,
      sourceCount,
      dataPoints: integration.dataPoints,
      hasRealMetrics: Boolean(
        signal.revenue != null && signal.spend != null && Number(signal.spend) > 0
      ),
    });

    const { data: row, error } = await repo.create(signalToInsightPayload(signal, confidence));
    if (error) {
      return { result: null, error };
    }
    if (row) persisted.push(row);
  }

  const dashboard = computeConversionIntelligenceDashboard({
    insights: persisted,
    winning,
    losing,
  });

  const result: ConversionAnalysisResult = {
    dashboard,
    insights: persisted,
    winningPatterns: winning,
    losingPatterns: losing,
    recommendations,
  };

  recordSystemLog({
    tipo: "info",
    modulo: "conversion-intelligence",
    mensagem: "Análise de conversão concluída",
    detalhes: {
      totalInsights: persisted.length,
      winning: winning.length,
      losing: losing.length,
      sources: integration.sourcesUsed,
    },
  });

  void import("./growth-brain.service")
    .then(({ registerCampaignResult }) =>
      registerCampaignResult({
        sourcePlatform: "conversion_intelligence",
        conversionRate: dashboard.avgConfidence / 100,
        lesson: dashboard.whyConverted ?? "Padrões de conversão analisados.",
        recommendation: dashboard.whyNotConverted ?? recommendations[0]?.action,
        metadata: {
          source: "conversion_intelligence",
          winning: winning.length,
          losing: losing.length,
        } as Json,
      })
    )
    .catch((err) => console.error("[conversion-intelligence] growth-brain feed failed", err));

  return { result, error: null };
}

export async function getConversionIntelligenceDashboard(params?: {
  funnelId?: string | null;
}): Promise<{
  dashboard: ConversionIntelligenceDashboard;
  insights: ConversionInsight[];
  recommendations: ReturnType<typeof generateRecommendations>;
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) {
    return {
      dashboard: computeConversionIntelligenceDashboard({
        insights: [],
        winning: [],
        losing: [],
      }),
      insights: [],
      recommendations: [],
      error: "Usuário não autenticado.",
    };
  }

  const repo = new ConversionInsightsRepository(ctx.supabase, ctx.userId);
  const funnelId = params?.funnelId?.trim();

  const { data: insights, error } = funnelId
    ? await repo.findByFunnelId(funnelId)
    : await repo.findRecent(100);

  if (error) {
    return {
      dashboard: computeConversionIntelligenceDashboard({
        insights: [],
        winning: [],
        losing: [],
      }),
      insights: [],
      recommendations: [],
      error,
    };
  }

  const rows = insights ?? [];

  if (rows.length === 0) {
    const emptyDashboard = computeConversionIntelligenceDashboard({
      insights: [],
      winning: [],
      losing: [],
    });
    return {
      dashboard: emptyDashboard,
      insights: [],
      recommendations: generateRecommendations({ winning: [], losing: [] }),
      error: null,
    };
  }

  const winningFromDb: ConversionSignal[] = rows
    .filter((row) => {
      const meta =
        row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
          ? (row.metadata as Record<string, unknown>)
          : {};
      return meta.outcome !== "losing";
    })
    .map((row) => dbRowToSignal(row, "winning"));

  const losingFromDb: ConversionSignal[] = rows
    .filter((row) => {
      const meta =
        row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
          ? (row.metadata as Record<string, unknown>)
          : {};
      return meta.outcome === "losing";
    })
    .map((row) => dbRowToSignal(row, "losing"));

  const dashboard = computeConversionIntelligenceDashboard({
    insights: rows,
    winning: winningFromDb,
    losing: losingFromDb,
  });

  return {
    dashboard,
    insights: rows,
    recommendations: generateRecommendations({
      winning: winningFromDb,
      losing: losingFromDb,
    }),
    error: null,
  };
}

function dbRowToSignal(row: ConversionInsight, outcome: ConversionSignal["outcome"]): ConversionSignal {
  const meta =
    row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : {};

  return {
    source: (meta.source as ConversionSignal["source"]) ?? "growth_brain",
    patternType: (meta.pattern_type as ConversionSignal["patternType"]) ?? "general",
    label: typeof meta.label === "string" ? meta.label : row.insight?.slice(0, 60) ?? "Insight",
    funnelId: row.funnel_id,
    productId: row.product_id,
    offerId: row.offer_id,
    landingId: row.landing_id,
    creativeId: row.creative_id,
    campaignId: row.campaign_id,
    country: row.country,
    language: row.language,
    conversionRate: row.conversion_rate,
    ctr: row.ctr,
    cpc: row.cpc,
    cpa: row.cpa,
    roas: row.roas,
    revenue: row.revenue,
    spend: row.spend,
    score: typeof meta.score === "number" ? meta.score : Number(row.confidence_score ?? 0),
    outcome,
    insight: row.insight ?? "",
    recommendation: row.recommendation ?? "",
  };
}

export async function getConversionIntelligenceContext(): Promise<{
  context: string;
  error: string | null;
}> {
  const { dashboard, error } = await getConversionIntelligenceDashboard();
  if (error) return { context: "", error };
  if (dashboard.totalInsights === 0) {
    return { context: "Nenhum insight de conversão gerado ainda.", error: null };
  }
  return {
    context: buildConversionIntelligenceAuraContext(dashboard),
    error: null,
  };
}
