import {
  MetaInsightsRepository,
  MetaMetricsRepository,
  MetaRecommendationsRepository,
} from "@/lib/supabase/repositories/meta.repository";
import { getMetaConnectDashboard, syncMetaConnection } from "@/lib/supabase/services/meta-connect.service";
import { getKiwifyIntelligence } from "@/lib/supabase/services/kiwify-intelligence.service";
import type {
  MetaCampaign,
  MetaCampaignMetric,
  MetaConnection,
  MetaInsight,
  MetaRecommendation,
  Json,
} from "@/types/database";
import { todayIsoDate } from "@/utils/health";
import type {
  MetaAutopilotAction,
  MetaIntelligencePayload,
  MetaPerformanceInsight,
  MetaPerformanceMetrics,
} from "@/utils/meta-intelligence";
import {
  buildMetaAuraContext,
  computeMetaRevenueCross,
  generateMetaAutopilotActions,
  generateMetaPerformanceInsights,
  insightToDbRow,
  META_READ_ONLY_MODE,
  recommendationToDbRow,
  shouldAutoSyncMeta,
} from "@/utils/meta-intelligence";
import { getOptionalDataContext } from "./context";

export async function getMetaIntelligenceFull(): Promise<{
  error: string | null;
  data: MetaIntelligencePayload | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { error: "Usuário não autenticado.", data: null };

  const dashboard = await getMetaConnectDashboard();
  if (dashboard.error || !dashboard.data) {
    return { error: dashboard.error ?? "Erro ao carregar Meta.", data: null };
  }

  const d = dashboard.data;
  const connected = d.connection?.status === "connected";

  const insightsRepo = new MetaInsightsRepository(ctx.supabase, ctx.userId);
  const recommendationsRepo = new MetaRecommendationsRepository(ctx.supabase, ctx.userId);

  const [storedInsights, storedRecommendations, kiwify] = await Promise.all([
    insightsRepo.findRecent(20),
    recommendationsRepo.findPending(),
    getKiwifyIntelligence(),
  ]);

  const generatedInsights = generateMetaPerformanceInsights({
    metrics: d.metrics,
    campaigns: d.campaigns,
    metricsMap: d.metricsMap,
    ads: d.ads,
    adSets: d.adSets,
    audiences: d.audiences,
  });

  const insights =
    (storedInsights.data?.length ?? 0) > 0
      ? mapStoredInsights(storedInsights.data ?? [])
      : generatedInsights;

  const generatedActions = generateMetaAutopilotActions({
    insights: generatedInsights,
    campaigns: d.campaigns,
    metricsMap: d.metricsMap,
  });

  const recommendations =
    (storedRecommendations.data?.length ?? 0) > 0
      ? mapStoredRecommendations(storedRecommendations.data ?? [])
      : generatedActions;

  const revenueCross = connected
    ? computeMetaRevenueCross({
        spendCents: d.metrics.performance.spendCents,
        kiwifyRevenueMonthCents: kiwify.data?.metrics.revenueMonthCents ?? 0,
      })
    : null;

  if (revenueCross && revenueCross.investimentoCents > 0 && revenueCross.receitaCents > 0) {
    const roiInsight: MetaPerformanceInsight = {
      type: "revenue_gap",
      title: "Meta + Kiwify",
      summary: `Investimento ${formatCents(revenueCross.investimentoCents)} · Receita ${formatCents(revenueCross.receitaCents)} · Lucro ${formatCents(revenueCross.lucroCents)}`,
      recommendation:
        revenueCross.roiPct >= 100
          ? "ROI positivo — considere escalar campanhas vencedoras."
          : "ROI abaixo do ideal — revise criativos e funil de vendas.",
      severity: revenueCross.roiPct >= 100 ? "success" : "warning",
    };
    if (!insights.some((i) => i.type === "revenue_gap")) {
      insights.unshift(roiInsight);
    }
  }

  void feedMetaToGrowthBrain({
    connected,
    metrics: d.metrics,
    revenueCross,
    insights,
  }).catch(() => undefined);

  return {
    error: null,
    data: {
      connection: d.connection,
      adAccounts: d.adAccounts,
      businessManagers: d.businessManagers,
      pages: d.pages,
      pixels: d.pixels,
      audiences: d.audiences,
      adSets: d.adSets,
      ads: d.ads,
      campaigns: d.campaigns,
      metricsMap: d.metricsMap,
      metrics: d.metrics,
      insights,
      recommendations,
      revenueCross,
      readOnly: META_READ_ONLY_MODE,
      connected,
    },
  };
}

async function feedMetaToGrowthBrain(params: {
  connected: boolean;
  metrics: MetaIntelligencePayload["metrics"];
  revenueCross: MetaIntelligencePayload["revenueCross"];
  insights: MetaPerformanceInsight[];
}): Promise<void> {
  if (!params.connected) return;

  const perf = params.metrics.performance;
  const best = params.metrics.bestCampaign;

  await import("./growth-brain.service").then(({ feedGrowthBrainFromMeta }) =>
    feedGrowthBrainFromMeta({
      campaignId: best?.id ?? null,
      campaignName: best?.name ?? null,
      ctr: perf.ctr != null ? perf.ctr / 100 : null,
      cpc: perf.cpc ?? null,
      cpa: perf.cpa ?? null,
      roas: perf.roas ?? best?.roas ?? null,
      spend: perf.spendCents != null ? perf.spendCents / 100 : null,
      revenue:
        params.revenueCross?.receitaCents != null
          ? params.revenueCross.receitaCents / 100
          : null,
      recommendation: params.insights[0]?.recommendation ?? null,
    })
  );
}

function formatCents(cents: number): string {
  return `R$ ${(cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
}

function mapStoredInsights(rows: MetaInsight[]): MetaPerformanceInsight[] {
  return rows.map((row) => ({
    type: row.insight_type,
    title: row.title,
    summary: row.summary,
    recommendation: row.recommendation ?? "",
    severity: row.severity,
    entityType: row.entity_type ?? undefined,
    entityId: row.entity_id ?? undefined,
    entityName: row.entity_name ?? undefined,
  }));
}

function mapStoredRecommendations(rows: MetaRecommendation[]): MetaAutopilotAction[] {
  return rows.map((row) => ({
    actionType: row.action_type,
    title: row.title,
    summary: row.summary,
    campaignId: row.campaign_id ?? undefined,
    requiresApproval: true as const,
  }));
}

export async function getMetaIntelligenceContext(): Promise<{ context: string; error: string | null }> {
  const [result, operationCenter] = await Promise.all([
    getMetaIntelligenceFull(),
    import("./operation-center.service").then((mod) => mod.getOperationCenterContext()),
  ]);
  if (result.error || !result.data) {
    return { context: "", error: result.error };
  }
  return {
    context: buildMetaAuraContext(result.data, operationCenter.context || undefined),
    error: null,
  };
}

export async function analyzeMetaPerformance(): Promise<{
  insights: MetaPerformanceInsight[];
  metrics: MetaPerformanceMetrics | null;
  recommendations: MetaAutopilotAction[];
  revenueCross: MetaIntelligencePayload["revenueCross"];
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) {
    return { insights: [], metrics: null, recommendations: [], revenueCross: null, error: "Usuário não autenticado." };
  }

  const result = await getMetaIntelligenceFull();
  if (result.error || !result.data) {
    return {
      insights: [],
      metrics: null,
      recommendations: [],
      revenueCross: null,
      error: result.error ?? "Erro na análise.",
    };
  }
  if (!result.data.connected) {
    return {
      insights: [],
      metrics: null,
      recommendations: [],
      revenueCross: null,
      error: "Conecte a Meta Business primeiro.",
    };
  }

  const generatedInsights = generateMetaPerformanceInsights({
    metrics: result.data.metrics,
    campaigns: result.data.campaigns,
    metricsMap: result.data.metricsMap,
    ads: result.data.ads,
    adSets: result.data.adSets,
    audiences: result.data.audiences,
  });

  const recommendations = generateMetaAutopilotActions({
    insights: generatedInsights,
    campaigns: result.data.campaigns,
    metricsMap: result.data.metricsMap,
  });

  const insightsRepo = new MetaInsightsRepository(ctx.supabase, ctx.userId);
  const recommendationsRepo = new MetaRecommendationsRepository(ctx.supabase, ctx.userId);
  const metricsRepo = new MetaMetricsRepository(ctx.supabase, ctx.userId);

  await insightsRepo.replaceForUser(generatedInsights.map(insightToDbRow));
  await recommendationsRepo.replacePending(recommendations.map(recommendationToDbRow));

  const perf = result.data.metrics.performance;
  const metricsDate = todayIsoDate();

  await ctx.supabase.from("meta_metrics").upsert(
    {
      user_id: ctx.userId,
      entity_type: "account",
      entity_id: result.data.connection?.business_id ?? "aggregate",
      entity_name: result.data.metrics.accountLabel ?? "Conta Meta",
      campaign_id: null,
      metrics_date: metricsDate,
      ctr: perf.ctr,
      cpc: perf.cpc,
      cpm: perf.cpm,
      cpa: perf.cpa,
      roas: perf.roas,
      frequency: perf.frequency,
      daily_spend_cents: perf.dailySpendCents,
      conversions: perf.conversions,
      impressions: perf.impressions,
      clicks: perf.clicks,
      spend_cents: perf.spendCents,
      raw_metrics: perf as unknown as Json,
    },
    { onConflict: "user_id,entity_type,entity_id,metrics_date" }
  );

  for (const campaign of result.data.campaigns.slice(0, 20)) {
    const m = result.data.metricsMap[campaign.id];
    if (!m) continue;
    await ctx.supabase.from("meta_metrics").upsert(
      {
        user_id: ctx.userId,
        entity_type: "campaign",
        entity_id: campaign.id,
        entity_name: campaign.name,
        campaign_id: campaign.id,
        metrics_date: metricsDate,
        ctr: m.ctr,
        cpc: m.clicks > 0 ? m.spend_cents / 100 / m.clicks : 0,
        cpm: m.impressions > 0 ? (m.spend_cents / 100 / m.impressions) * 1000 : 0,
        cpa: m.cpa,
        roas: m.roas,
        frequency: m.frequency,
        daily_spend_cents: Math.round(m.spend_cents / 7),
        conversions: m.conversions,
        impressions: m.impressions,
        clicks: m.clicks,
        spend_cents: m.spend_cents,
        raw_metrics: m.raw_metrics,
      },
      { onConflict: "user_id,entity_type,entity_id,metrics_date" }
    );
  }

  void metricsRepo;

  const kiwify = await getKiwifyIntelligence();
  const revenueCross = computeMetaRevenueCross({
    spendCents: perf.spendCents,
    kiwifyRevenueMonthCents: kiwify.data?.metrics.revenueMonthCents ?? 0,
  });

  return {
    insights: generatedInsights,
    metrics: perf,
    recommendations,
    revenueCross,
    error: null,
  };
}

export async function autoSyncMetaIfDue(): Promise<{ synced: boolean; error: string | null }> {
  const dashboard = await getMetaConnectDashboard();
  if (!dashboard.data) return { synced: false, error: dashboard.error };

  const { connection } = dashboard.data;
  if (connection?.status !== "connected") return { synced: false, error: null };

  if (!shouldAutoSyncMeta(connection.last_sync_at)) {
    return { synced: false, error: null };
  }

  const result = await syncMetaConnection();
  return { synced: !result.error, error: result.error ?? null };
}

export async function getMetaIntelligence() {
  return getMetaIntelligenceFull();
}
